import pool from "../config/db.js";

const PUBLIC_STATUSES = ["published"];
const MOVIE_TYPES = ["series", "movie"];
const LIFECYCLE_STATUS = ["upcoming", "ongoing", "completed"];

/* =========================
   SAFE PARAM HELPER
========================= */
const buildParams = () => {
  const values = [];

  return {
    add: (value) => {
      values.push(value);
      return `$${values.length}`;
    },
    values,
  };
};

/* =========================
   GET PUBLIC MOVIES
========================= */
export const getPublicMovies = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const { keyword, status, type, year, category, country, lifecycle_status } =
    query;

  const { add, values } = buildParams();

  const where = ["m.is_available = true"];

  /* keyword */
  if (keyword?.trim()) {
    const k = add(`%${keyword.trim()}%`);
    where.push(`(
      m.name ILIKE ${k} OR 
      m.origin_name ILIKE ${k}
    )`);
  }

  /* status */
  if (status && PUBLIC_STATUSES.includes(status)) {
    where.push(`m.status = ${add(status)}`);
  }

  /* lifecycle */
  if (lifecycle_status && LIFECYCLE_STATUS.includes(lifecycle_status)) {
    where.push(`m.lifecycle_status = ${add(lifecycle_status)}`);
  }

  /* type */
  const normalizedType = (type || "").toLowerCase().trim();
  if (MOVIE_TYPES.includes(normalizedType)) {
    where.push(`m.type = ${add(normalizedType)}`);
  }

  /* year */
  if (year && !isNaN(Number(year))) {
    where.push(`m.year = ${add(Number(year))}`);
  }

  /* category */
  if (category?.trim()) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_categories mc 
        JOIN categories cat ON cat.id = mc.category_id
        WHERE mc.movie_id = m.id 
        AND cat.slug = ${add(category.trim())}
      )
    `);
  }

  /* country */
  if (country?.trim()) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_countries mco 
        JOIN countries c ON c.id = mco.country_id
        WHERE mco.movie_id = m.id 
        AND c.slug = ${add(country.trim())}
      )
    `);
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
    LIMIT ${add(limit)} OFFSET ${add(offset)}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT m.id)
    ${baseQuery}
  `;

  const dataRes = await pool.query(dataQuery, values);
  const countRes = await pool.query(
    countQuery,
    values.slice(0, values.length - 2),
  );

  return {
    success: true,
    data: dataRes.rows,
    pagination: {
      total: parseInt(countRes.rows[0].count),
      page,
      limit,
    },
  };
};

/* =========================
   GET MOVIE DETAIL
========================= */
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

  return {
    success: true,
    data: {
      ...movie,
      categories: categories.rows,
      countries: countries.rows,
      people: people.rows,
      episodes: movie.lifecycle_status === "upcoming" ? [] : episodes.rows,
    },
  };
};

/* =========================
   WATCH MOVIE
========================= */
export const getMovieWatch = async (slug, query, user = null) => {
  const ep = Number(query.ep) || 1;
  const server = query.server;

  /* =========================
     GET MOVIE
  ========================= */
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

  /* =========================
     PREMIUM CHECK
  ========================= */
  if (movie.is_premium && !user?.is_premium) {
    return {
      success: true,
      locked: true,
      message: "Phim này yêu cầu tài khoản premium để xem",
    };
  }

  /* =========================
     UPCOMING CHECK
  ========================= */
  if (movie.lifecycle_status === "upcoming") {
    return {
      success: true,
      locked: true,
      message: "Phim chưa phát hành",
    };
  }

  /* =========================
     GET ALL EPISODES (IMPORTANT FIX)
  ========================= */
  const episodesRes = await pool.query(
    `
    SELECT id, movie_id, episode_number, name, slug
    FROM episodes
    WHERE movie_id = $1
    ORDER BY episode_number ASC
    `,
    [movie.id],
  );

  const episodes = episodesRes.rows;

  if (!episodes.length) {
    return {
      success: true,
      locked: true,
      message: "Phim chưa có tập nào",
    };
  }

  /* =========================
     GET CURRENT EPISODE
  ========================= */
  const episode =
    episodes.find((e) => Number(e.episode_number) === ep) || episodes[0];

  /* =========================
     GET STREAMS
  ========================= */
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
    streams.find((s) => String(s.id) === String(server)) || streams[0] || null;

  /* =========================
     RESPONSE
  ========================= */
  return {
    success: true,
    data: {
      movie: {
        id: movie.id,
        name: movie.name,
        slug: movie.slug,
        is_premium: movie.is_premium,
      },

      episodes, // ✅ FIX: thêm list tập

      episode, // current episode

      streams,

      currentStream: selectedStream,
    },
  };
};

/* =========================
   CATEGORIES
========================= */
export const getCategories = async () => {
  const res = await pool.query(`
    SELECT id, name, slug
    FROM categories
    ORDER BY name ASC
  `);

  return { success: true, data: res.rows };
};

/* =========================
   COUNTRIES
========================= */
export const getCountries = async () => {
  const res = await pool.query(`
    SELECT id, name, slug
    FROM countries
    ORDER BY name ASC
  `);

  return { success: true, data: res.rows };
};

/* =========================
   YEARS
========================= */
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
