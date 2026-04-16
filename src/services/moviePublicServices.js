import pool from "../config/db.js";

const PUBLIC_STATUSES = ["published"];
const MOVIE_TYPES = ["series", "movie"];
const LIFECYCLE_STATUS = ["upcoming", "ongoing", "completed"];

export const getPublicMovies = async (query = {}) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const { keyword, status, type, year, category, country, lifecycle_status } =
    query;

  let where = ["m.is_available = true", "m.status = ANY($1::text[])"];
  let values = [PUBLIC_STATUSES];
  let i = 2;

  if (keyword) {
    where.push(`(
      m.name ILIKE $${i} OR 
      m.origin_name ILIKE $${i}
    )`);
    values.push(`%${keyword}%`);
    i++;
  }

  if (status && PUBLIC_STATUSES.includes(status)) {
    where.push(`m.status = $${i}`);
    values.push(status);
    i++;
  }

  if (lifecycle_status && LIFECYCLE_STATUS.includes(lifecycle_status)) {
    where.push(`m.lifecycle_status = $${i}`);
    values.push(lifecycle_status);
    i++;
  }

  if (type && MOVIE_TYPES.includes(type)) {
    where.push(`m.type = $${i}`);
    values.push(type);
    i++;
  }

  if (year && !isNaN(Number(year))) {
    where.push(`m.year = $${i}`);
    values.push(Number(year));
    i++;
  }

  if (category) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_categories mc 
        JOIN categories cat ON cat.id = mc.category_id
        WHERE mc.movie_id = m.id 
        AND cat.slug = $${i}
      )
    `);
    values.push(category);
    i++;
  }

  if (country) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_countries mc 
        JOIN countries c ON c.id = mc.country_id
        WHERE mc.movie_id = m.id 
        AND c.slug = $${i}
      )
    `);
    values.push(country);
    i++;
  }

  const whereSQL = `WHERE ${where.join(" AND ")}`;

  const baseQuery = `
    FROM movies m
    ${whereSQL}
  `;

  const dataQuery = `
    SELECT m.*
    ${baseQuery}
    ORDER BY m.created_at DESC NULLS LAST
    LIMIT $${i} OFFSET $${i + 1}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT m.id)
    ${baseQuery}
  `;

  const dataRes = await pool.query(dataQuery, [...values, limit, offset]);

  const countRes = await pool.query(countQuery, values);

  return {
    data: dataRes.rows,
    pagination: {
      total: parseInt(countRes.rows[0]?.count || 0),
      page,
      limit,
    },
  };
};
export const getPublicMovieBySlug = async (slug, user = null) => {
  if (!slug) return null;

  const movieRes = await pool.query(
    `
    SELECT * FROM movies 
    WHERE slug = $1
      AND is_available = true
      AND status = ANY($2::text[])
    `,
    [slug, PUBLIC_STATUSES],
  );

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];
  const movieId = movie.id;

  if (movie.is_premium && !user?.is_premium) {
    return {
      ...movie,
      locked: true,
      message: "Phim này yêu cầu tài khoản premium",
      episodes: [],
    };
  }

  const [categories, countries, people, episodes] = await Promise.all([
    pool.query(
      `
      SELECT c.*
      FROM categories c
      JOIN movie_categories mc ON mc.category_id = c.id
      WHERE mc.movie_id = $1
      `,
      [movieId],
    ),

    pool.query(
      `
      SELECT c.*
      FROM countries c
      JOIN movie_countries mc ON mc.country_id = c.id
      WHERE mc.movie_id = $1
      `,
      [movieId],
    ),

    pool.query(
      `
      SELECT p.*, mp.role
      FROM people p
      JOIN movie_people mp ON mp.person_id = p.id
      WHERE mp.movie_id = $1
      `,
      [movieId],
    ),

    pool.query(
      `
      SELECT e.*
      FROM episodes e
      WHERE e.movie_id = $1
      ORDER BY e.season, e.episode_number
      `,
      [movieId],
    ),
  ]);

  return {
    ...movie,
    categories: categories.rows,
    countries: countries.rows,
    people: people.rows,
    episodes: movie.lifecycle_status === "upcoming" ? [] : episodes.rows,
  };
};
export const watchMovie = async (slug, user = null, query = {}) => {
  if (!slug) return null;

  const movieRes = await pool.query(
    `
    SELECT *
    FROM movies
    WHERE slug = $1
      AND is_available = true
      AND status = ANY($2::text[])
    `,
    [slug, PUBLIC_STATUSES],
  );

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];
  const movieId = movie.id;

  if (movie.is_premium && !user?.is_premium) {
    return {
      ...movie,
      locked: true,
      episodes: [],
    };
  }

  const episodesRes = await pool.query(
    `
    SELECT 
      e.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', es.id,
            'server_name', s.name,
            'quality', es.quality,
            'link_embed', es.link_embed,
            'link_m3u8', es.link_m3u8
          )
        ) FILTER (WHERE es.id IS NOT NULL),
        '[]'
      ) AS streams
    FROM episodes e
    LEFT JOIN episode_streams es ON es.episode_id = e.id
    LEFT JOIN servers s ON s.id = es.server_id
    WHERE e.movie_id = $1
    GROUP BY e.id
    ORDER BY e.season, e.episode_number
    `,
    [movieId],
  );

  let episodes = movie.lifecycle_status === "upcoming" ? [] : episodesRes.rows;

  let currentEpisode =
    episodes.find((e) => e.id === Number(query.episode_id)) ||
    episodes[0] ||
    null;

  const [categories, countries, people] = await Promise.all([
    pool.query(
      `
      SELECT c.*
      FROM categories c
      JOIN movie_categories mc ON mc.category_id = c.id
      WHERE mc.movie_id = $1
      `,
      [movieId],
    ),

    pool.query(
      `
      SELECT c.*
      FROM countries c
      JOIN movie_countries mc ON mc.country_id = c.id
      WHERE mc.movie_id = $1
      `,
      [movieId],
    ),

    pool.query(
      `
      SELECT p.*, mp.role
      FROM people p
      JOIN movie_people mp ON mp.person_id = p.id
      WHERE mp.movie_id = $1
      `,
      [movieId],
    ),
  ]);

  return {
    ...movie,
    categories: categories.rows,
    countries: countries.rows,
    people: people.rows,
    episodes,
    currentEpisode,
  };
};
export const getCategories = async () => {
  const res = await pool.query(`
    SELECT id, name, slug
    FROM categories
    ORDER BY name ASC
  `);

  return {
    success: true,
    data: res.rows,
  };
};
export const getCountries = async () => {
  const res = await pool.query(`
    SELECT id, name, slug
    FROM countries
    ORDER BY name ASC
  `);

  return {
    success: true,
    data: res.rows,
  };
};
export const getYears = async () => {
  const res = await pool.query(`
    SELECT DISTINCT year
    FROM movies
    WHERE year IS NOT NULL
    ORDER BY year DESC
  `);

  return {
    success: true,
    data: res.rows.map((r) => ({
      name: r.year,
      slug: r.year,
    })),
  };
};
