import pool from "../config/db.js";

const PUBLIC_STATUSES = ["published"];
const MOVIE_TYPES = ["series", "movie"];
const LIFECYCLE_STATUS = ["upcoming", "ongoing", "completed"];

export const getPublicMovies = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const { keyword, status, type, year, category, country, lifecycle_status } =
    query;

  let where = ["m.is_available = true"];
  let values = [];
  let i = 1;

  if (keyword?.trim()) {
    where.push(`(
      m.name ILIKE $${i} OR 
      m.origin_name ILIKE $${i}
    )`);
    values.push(`%${keyword.trim()}%`);
    i++;
  }

  if (status && PUBLIC_STATUSES.includes(status)) {
    where.push(`m.status = $${i++}`);
    values.push(status);
  }

  if (lifecycle_status && LIFECYCLE_STATUS.includes(lifecycle_status)) {
    where.push(`m.lifecycle_status = $${i++}`);
    values.push(lifecycle_status);
  }

  const normalizedType = (type || "").toLowerCase().trim();
  if (MOVIE_TYPES.includes(normalizedType)) {
    where.push(`m.type = $${i++}`);
    values.push(normalizedType);
  }

  if (year && !isNaN(Number(year))) {
    where.push(`m.year = $${i++}`);
    values.push(Number(year));
  }

  if (category?.trim()) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_categories mc 
        JOIN categories cat ON cat.id = mc.category_id
        WHERE mc.movie_id = m.id 
        AND cat.slug = $${i++}
      )
    `);
    values.push(category.trim());
  }

  if (country?.trim()) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_countries mco 
        JOIN countries c ON c.id = mco.country_id
        WHERE mco.movie_id = m.id 
        AND c.slug = $${i++}
      )
    `);
    values.push(country.trim());
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
    SELECT COUNT(DISTINCT m.id)
    ${baseQuery}
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

export const getPublicMovieById = async (id) => {
  const isNumeric = /^\d+$/.test(id);

  const movieRes = await pool.query(
    isNumeric
      ? `
        SELECT * FROM movies 
        WHERE id = $1
          AND is_available = true
          AND status = ANY($2::text[])
      `
      : `
        SELECT * FROM movies 
        WHERE slug = $1
          AND is_available = true
          AND status = ANY($2::text[])
      `,
    [id, PUBLIC_STATUSES],
  );

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];

  const [categories, countries, people, episodes] = await Promise.all([
    pool.query(
      `SELECT c.* FROM categories c
       JOIN movie_categories mc ON mc.category_id = c.id
       WHERE mc.movie_id = $1`,
      [movie.id],
    ),

    pool.query(
      `SELECT c.* FROM countries c
       JOIN movie_countries mc ON mc.country_id = c.id
       WHERE mc.movie_id = $1`,
      [movie.id],
    ),

    pool.query(
      `SELECT p.*, mp.role
       FROM people p
       JOIN movie_people mp ON mp.person_id = p.id
       WHERE mp.movie_id = $1`,
      [movie.id],
    ),

    pool.query(
      `SELECT e.*,
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
       ORDER BY e.season, e.episode_number`,
      [movie.id],
    ),
  ]);

  const finalEpisodes =
    movie.lifecycle_status === "upcoming" ? [] : episodes.rows;

  return {
    ...movie,
    categories: categories.rows,
    countries: countries.rows,
    people: people.rows,
    episodes: finalEpisodes,
  };
};

export const getMovieWatch = async (slug, query, user = null) => {
  const { ep = 1, server } = query;

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
  const isPremiumUser = Boolean(user?.is_premium);

  if (movie.is_premium && !isPremiumUser) {
    return {
      locked: true,
      message: "Phim này yêu cầu tài khoản premium để xem",
    };
  }
  if (movie.lifecycle_status === "upcoming") {
    return {
      locked: true,
      message: "Phim chưa phát hành",
    };
  }
  const epRes = await pool.query(
    `
    SELECT * FROM episodes
    WHERE movie_id = $1
      AND episode_number = $2
    LIMIT 1
    `,
    [movie.id, ep],
  );

  if (!epRes.rows.length) return null;
  const episode = epRes.rows[0];
  const streamRes = await pool.query(
    `
    SELECT es.*, s.name as server_name
    FROM episode_streams es
    JOIN servers s ON s.id = es.server_id
    WHERE es.episode_id = $1
    `,
    [episode.id],
  );
  const streams = streamRes.rows;

  const selectedStream =
    streams.find((s) => s.id == server) || streams[0] || null;
  return {
    movie: {
      id: movie.id,
      name: movie.name,
      slug: movie.slug,
      is_premium: movie.is_premium,
    },
    episode,
    streams,
    currentStream: selectedStream,
  };
};
export const getCategories = async () => {
  const res = await pool.query(`
    SELECT id, name, slug
    FROM categories
    ORDER BY name ASC
  `);

  return { success: true, data: res.rows };
};

export const getCountries = async () => {
  const res = await pool.query(`
    SELECT id, name, slug
    FROM countries
    ORDER BY name ASC
  `);

  return { success: true, data: res.rows };
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
