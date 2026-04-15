import pool from "../config/db.js";

const PUBLIC_STATUSES = ["published", "completed"];
const MOVIE_TYPES = ["series", "movie"];

export const getPublicMovies = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const { keyword, status, type, year, category, country } = query;

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
    where.push(`m.status = $${i++}`);
    values.push(status);
  }
  if (type && MOVIE_TYPES.includes(type)) {
    where.push(`m.type = $${i++}`);
    values.push(type);
  }
  if (year && !isNaN(year)) {
    where.push(`m.year = $${i++}`);
    values.push(Number(year));
  }
  if (category) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_categories mc 
        JOIN categories cat ON cat.id = mc.category_id
        WHERE mc.movie_id = m.id 
        AND cat.slug = $${i++}
      )
    `);
    values.push(category);
  }
  if (country) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_countries mco 
        JOIN countries c ON c.id = mco.country_id
        WHERE mco.movie_id = m.id 
        AND c.slug = $${i++}
      )
    `);
    values.push(country);
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
    LIMIT $${i++} OFFSET $${i}
  `;
  const countQuery = `
    SELECT COUNT(*)
    FROM movies m
    ${whereSQL}
  `;

  const dataRes = await pool.query(dataQuery, [...values, limit, offset]);

  const countRes = await pool.query(countQuery, values);

  return {
    data: dataRes.rows,
    pagination: {
      total: parseInt(countRes.rows[0].count),
      page,
      limit,
    },
  };
};
export const getPublicMovieById = async (id, user = null) => {
  const movieRes = await pool.query(
    `
    SELECT * FROM movies 
    WHERE id=$1 
      AND is_available = true
      AND status = ANY($2::text[])
    `,
    [id, PUBLIC_STATUSES],
  );

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];
  if (movie.is_premium && !user?.is_premium) {
    return {
      ...movie,
      locked: true,
      message: "Phim này yêu cầu tài khoản premium",
    };
  }

  const categories = await pool.query(
    `
    SELECT c.*
    FROM categories c
    JOIN movie_categories mc ON mc.category_id = c.id
    WHERE mc.movie_id = $1
    `,
    [id],
  );

  const countries = await pool.query(
    `
    SELECT c.*
    FROM countries c
    JOIN movie_countries mc ON mc.country_id = c.id
    WHERE mc.movie_id = $1
    `,
    [id],
  );

  const people = await pool.query(
    `
    SELECT p.*, mp.role
    FROM people p
    JOIN movie_people mp ON mp.person_id = p.id
    WHERE mp.movie_id = $1
    `,
    [id],
  );

  const episodes = await pool.query(
    `
    SELECT e.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', es.id,
            'server_name', s.name,
            'quality', es.quality,
            'lang', es.lang,
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
    [id],
  );

  return {
    ...movie,
    categories: categories.rows,
    countries: countries.rows,
    people: people.rows,
    episodes: episodes.rows,
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
