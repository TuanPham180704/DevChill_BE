import pool from "../config/db.js";

const PUBLIC_STATUSES = ["published"];
const MOVIE_TYPES = ["series", "movie"];
const LIFECYCLE_STATUS = ["upcoming", "ongoing", "completed"];

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
export const getPublicMovies = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const {
    keyword,
    type,
    year,
    category,
    country,
    lifecycle_status,
    is_premium,
  } = query;

  const { add, values } = buildParams();

  const where = [
    "m.is_available = true",
    "c.status = 'active'",
    "m.status = 'published'",
  ];

  if (keyword?.trim()) {
    const k = add(`%${keyword.trim()}%`);
    where.push(`(
      m.name ILIKE ${k} OR 
      m.origin_name ILIKE ${k}
    )`);
  }

  if (lifecycle_status && LIFECYCLE_STATUS.includes(lifecycle_status)) {
    where.push(`m.lifecycle_status = ${add(lifecycle_status)}`);
  }

  const normalizedType = (type || "").toLowerCase().trim();
  if (MOVIE_TYPES.includes(normalizedType)) {
    where.push(`m.type = ${add(normalizedType)}`);
  }

  if (year && !isNaN(Number(year))) {
    where.push(`m.year = ${add(Number(year))}`);
  }

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

  if (country?.trim()) {
    where.push(`
      EXISTS (
        SELECT 1 
        FROM movie_countries mco 
        JOIN countries c2 ON c2.id = mco.country_id
        WHERE mco.movie_id = m.id 
        AND c2.slug = ${add(country.trim())}
      )
    `);
  }

  if (is_premium !== undefined) {
    const isPremiumBool = is_premium === "true";
    where.push(`m.is_premium = ${add(isPremiumBool)}`);
  }

  const whereSQL = `WHERE ${where.join(" AND ")}`;

  const baseQuery = `
    FROM movies m
    JOIN contracts c ON c.id = m.contract_id
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
export const getPublicMovieById = async (id, is_public = false) => {
  const isNumeric = /^\d+$/.test(id);

  const movieRes = await pool.query(
    isNumeric
      ? `
        SELECT m.* FROM movies m
        JOIN contracts c ON c.id = m.contract_id
        WHERE m.id = $1
          AND m.is_available = true
          AND m.status = ANY($2::text[])
          AND c.status = 'active'
      `
      : `
        SELECT m.* FROM movies m
        JOIN contracts c ON c.id = m.contract_id
        WHERE m.slug = $1
          AND m.is_available = true
          AND m.status = ANY($2::text[])
          AND c.status = 'active'
      `,
    [id, PUBLIC_STATUSES],
  );

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];

  const episodeCondition = is_public ? "AND e.is_published = TRUE" : "";

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
       WHERE e.movie_id = $1 ${episodeCondition}
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
      episodes: episodes.rows,
    },
  };
};
export const getMovieWatch = async (slug, query, user = null) => {
  const ep = Number(query.ep) || 1;
  const server = query.server;
  const is_public = query.is_public === "true";

  const movieRes = await pool.query(
    `
    SELECT m.*
    FROM movies m
    JOIN contracts c ON c.id = m.contract_id
    WHERE m.slug = $1
      AND m.is_available = true
      AND m.status = ANY($2::text[])
      AND c.status = 'active'
    `,
    [slug, PUBLIC_STATUSES],
  );

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];
  if (movie.is_premium && !user?.is_premium) {
    return {
      success: true,
      locked: true,
      message: "Phim này yêu cầu tài khoản premium để xem",
    };
  }

  const episodeCondition = is_public ? "AND is_published = TRUE" : "";

  const episodesRes = await pool.query(
    `
    SELECT id, movie_id, episode_number, name, slug
    FROM episodes
    WHERE movie_id = $1 ${episodeCondition}
    ORDER BY episode_number ASC
    `,
    [movie.id],
  );

  const episodes = episodesRes.rows;
  if (!episodes.length) {
    return {
      success: true,
      locked: true,
      message: "Phim hiện chưa có tập nào khả dụng",
    };
  }
  const episode =
    episodes.find((e) => Number(e.episode_number) === ep) || episodes[0];
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

  return {
    success: true,
    data: {
      movie: {
        id: movie.id,
        name: movie.name,
        slug: movie.slug,
        is_premium: movie.is_premium,
      },
      episodes,
      episode,
      streams,
      currentStream: selectedStream,
    },
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
