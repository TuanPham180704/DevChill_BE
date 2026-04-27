import pool from "../../config/db.js";

const toSlug = (str = "") =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
const LIFECYCLES = ["upcoming", "ongoing", "completed"];
const STATUSES = ["draft", "published", "hidden"];
const PRODUCTION_STATUSES = ["planning", "filming", "post-production"];

const validateMovieData = (data, isCreate = false) => {
  if (isCreate) {
    if (!data.name) throw new Error("name is required");
    if (!data.contract_id) throw new Error("contract_id is required");
  }

  if (data.year && isNaN(Number(data.year))) {
    throw new Error("year must be a number");
  }

  if (data.episode_total && isNaN(Number(data.episode_total))) {
    throw new Error("episode_total must be a number");
  }

  if (data.lifecycle_status && !LIFECYCLES.includes(data.lifecycle_status)) {
    throw new Error("invalid lifecycle_status");
  }

  if (data.status && !STATUSES.includes(data.status)) {
    throw new Error("invalid status");
  }

  if (
    data.production_status &&
    !PRODUCTION_STATUSES.includes(data.production_status)
  ) {
    throw new Error("invalid production_status");
  }
};

export const createMovie = async (data) => {
  validateMovieData(data, true);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const slug = toSlug(data.name);

    // 1. CREATE MOVIE
    const movieRes = await client.query(
      `INSERT INTO movies(
        name, origin_name, slug, content, type, year,
        duration, episode_total, created_by, contract_id,
        status, lifecycle_status, production_status,
        is_available, is_premium,
        poster_url, thumb_url, trailer_url
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        data.name,
        data.origin_name || null,
        slug,
        data.content || null,
        data.type || null,
        data.year || null,
        data.duration || null,
        data.episode_total || null,
        data.created_by || null,
        data.contract_id,

        data.status || "draft",
        data.lifecycle_status || "upcoming",
        data.production_status || null,

        data.is_available ?? true,
        data.is_premium ?? false,

        data.poster_url || null,
        data.thumb_url || null,
        data.trailer_url || null,
      ],
    );

    const movieId = movieRes.rows[0].id;

    // =========================
    // 2. META (categories, countries, people)
    // =========================

    const getOrCreate = async (table, items = []) => {
      const ids = [];

      for (const item of items) {
        if (!item?.name) continue;

        const slug = toSlug(item.name);

        let res = await client.query(`SELECT id FROM ${table} WHERE slug=$1`, [
          slug,
        ]);

        let id;

        if (res.rows.length) {
          id = res.rows[0].id;
        } else {
          const insert = await client.query(
            `INSERT INTO ${table}(name, slug) VALUES($1,$2) RETURNING id`,
            [item.name, slug],
          );
          id = insert.rows[0].id;
        }

        ids.push(id);
      }

      return ids;
    };

    // categories
    if (data.categories) {
      const ids = await getOrCreate("categories", data.categories);

      for (const id of ids) {
        await client.query(
          `INSERT INTO movie_categories(movie_id, category_id)
           VALUES($1,$2)`,
          [movieId, id],
        );
      }
    }

    // countries
    if (data.countries) {
      const ids = await getOrCreate("countries", data.countries);

      for (const id of ids) {
        await client.query(
          `INSERT INTO movie_countries(movie_id, country_id)
           VALUES($1,$2)`,
          [movieId, id],
        );
      }
    }

    // people
    if (data.people) {
      for (const p of data.people) {
        if (!p?.name) continue;

        const slug = toSlug(p.name);

        let res = await client.query(`SELECT id FROM people WHERE slug=$1`, [
          slug,
        ]);

        let personId;

        if (!res.rows.length) {
          const insert = await client.query(
            `INSERT INTO people(name, slug) VALUES($1,$2) RETURNING id`,
            [p.name, slug],
          );
          personId = insert.rows[0].id;
        } else {
          personId = res.rows[0].id;
        }

        await client.query(
          `INSERT INTO movie_people(movie_id, person_id, role)
           VALUES($1,$2,$3)`,
          [movieId, personId, p.role || null],
        );
      }
    }

    // =========================
    // 3. EPISODES + STREAMS
    // =========================

    const getOrCreateServer = async (name, type = "embed") => {
      if (!name) return null;

      const find = await client.query(
        `SELECT id FROM servers WHERE name=$1 AND type=$2`,
        [name, type],
      );

      if (find.rows.length) return find.rows[0].id;

      const insert = await client.query(
        `INSERT INTO servers(name, type)
         VALUES($1,$2)
         RETURNING id`,
        [name, type],
      );

      return insert.rows[0].id;
    };

    if (data.episodes && Array.isArray(data.episodes)) {
      const defaultLifecyclePublished =
        data.lifecycle_status === "upcoming" ? false : true;

      for (const ep of data.episodes) {
        if (!ep?.episode_number) continue;

        const epSlug = toSlug(ep.name || `tap-${ep.episode_number}`);
        // Ưu tiên giá trị từ payload truyền lên, nếu không có thì lấy theo lifecycle
        const initialPublished =
          ep.is_published !== undefined
            ? ep.is_published
            : defaultLifecyclePublished;

        const epRes = await client.query(
          `INSERT INTO episodes(movie_id, season, episode_number, name, slug, is_published)
           VALUES($1,$2,$3,$4,$5,$6)
           RETURNING id`,
          [
            movieId,
            ep.season || 1,
            ep.episode_number,
            ep.name || "",
            epSlug,
            initialPublished,
          ],
        );

        const epId = epRes.rows[0].id;

        for (const st of ep.streams || []) {
          if (!st?.quality) continue;

          let serverId = st.server_id;

          if (!serverId && st.server_name) {
            serverId = await getOrCreateServer(
              st.server_name,
              st.type || "embed",
            );
          }

          if (!serverId) continue;

          await client.query(
            `INSERT INTO episode_streams(
              episode_id,
              server_id,
              quality,
              lang,
              link_embed,
              link_m3u8
            )
            VALUES($1,$2,$3,$4,$5,$6)`,
            [
              epId,
              serverId,
              st.quality,
              st.lang || "vietsub",
              st.link_embed || null,
              st.link_m3u8 || null,
            ],
          );
        }
      }
    }

    await client.query("COMMIT");

    return movieRes.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const updateInfo = async (id, data) => {
  validateMovieData(data);

  const fields = [];
  const values = [];
  let i = 1;

  const allowedFields = [
    "name",
    "origin_name",
    "content",
    "type",
    "year",
    "duration",
    "episode_total",
    "contract_id",
  ];

  if (data.name !== undefined) {
    fields.push(`name=$${i++}`);
    values.push(data.name);

    fields.push(`slug=$${i++}`);
    values.push(toSlug(data.name));
  }

  for (const key of allowedFields) {
    if (key === "name") continue;

    if (data[key] !== undefined) {
      fields.push(`${key}=$${i++}`);
      values.push(data[key]);
    }
  }

  if (!fields.length) return null;

  values.push(id);

  const res = await pool.query(
    `UPDATE movies 
     SET ${fields.join(", ")}, updated_at = NOW()
     WHERE id = $${i}
     RETURNING *`,
    values,
  );

  return res.rows[0];
};

export const getAll = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;
  const {
    keyword,
    status,
    type,
    year,
    category,
    country,
    lifecycle_status,
    is_premium,
    sort_by,
    order,
  } = query;

  let where = [];
  let values = [];
  let i = 1;

  if (keyword) {
    where.push(`(m.name ILIKE $${i} OR m.origin_name ILIKE $${i})`);
    values.push(`%${keyword}%`);
    i++;
  }

  if (status) {
    where.push(`m.status = $${i++}`);
    values.push(status);
  }

  if (lifecycle_status) {
    where.push(`m.lifecycle_status = $${i++}`);
    values.push(lifecycle_status);
  }

  if (type) {
    where.push(`m.type = $${i++}`);
    values.push(type);
  }

  if (year) {
    where.push(`m.year = $${i++}`);
    values.push(year);
  }
  if (is_premium !== undefined && is_premium !== "") {
    where.push(`m.is_premium = $${i++}`);
    values.push(is_premium === "true" || is_premium === true);
  }
  if (category) {
    where.push(`cat.slug = $${i++}`);
    values.push(category);
  }

  if (country) {
    where.push(`c.slug = $${i++}`);
    values.push(country);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const ALLOWED_SORT_COLUMNS = {
    id: "m.id",
    year: "m.year",
    name: "m.name",
    episode_total: "m.episode_total",
    created_at: "m.created_at",
  };
  const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "m.created_at";
  const sortDirection = (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const statsQuery = `
  SELECT
    COUNT(*) FILTER (WHERE status = 'draft') AS draft,
    COUNT(*) FILTER (WHERE status = 'published') AS published,
    COUNT(*) FILTER (WHERE status = 'hidden') AS hidden,
    COUNT(*) AS total
  FROM movies m
`;
  const dataQuery = `
    SELECT DISTINCT m.*
    FROM movies m
    LEFT JOIN movie_categories mc ON mc.movie_id = m.id
    LEFT JOIN categories cat ON cat.id = mc.category_id
    LEFT JOIN movie_countries mco ON mco.movie_id = m.id
    LEFT JOIN countries c ON c.id = mco.country_id
    ${whereSQL}
    ORDER BY ${sortColumn} ${sortDirection} NULLS LAST
    LIMIT $${i++} OFFSET $${i}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT m.id)
    FROM movies m
    LEFT JOIN movie_categories mc ON mc.movie_id = m.id
    LEFT JOIN categories cat ON cat.id = mc.category_id
    LEFT JOIN movie_countries mco ON mco.movie_id = m.id
    LEFT JOIN countries c ON c.id = mco.country_id
    ${whereSQL}
  `;

  const dataRes = await pool.query(dataQuery, [...values, limit, offset]);
  const countRes = await pool.query(countQuery, values);
  const statsRes = await pool.query(statsQuery);
  const statsRow = statsRes.rows[0];

  return {
    data: dataRes.rows,
    pagination: {
      total: parseInt(countRes.rows[0].count),
      page,
      limit,
    },
    stats: {
      draft: Number(statsRow.draft),
      published: Number(statsRow.published),
      hidden: Number(statsRow.hidden),
      total: Number(statsRow.total),
    },
  };
};

export const getById = async (id, is_public = false) => {
  const movieRes = await pool.query(`SELECT * FROM movies WHERE id=$1`, [id]);

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];

  const categories = await pool.query(
    `SELECT c.* FROM categories c
     JOIN movie_categories mc ON mc.category_id = c.id
     WHERE mc.movie_id=$1`,
    [id],
  );

  const countries = await pool.query(
    `SELECT c.* FROM countries c
     JOIN movie_countries mc ON mc.country_id = c.id
     WHERE mc.movie_id=$1`,
    [id],
  );

  const people = await pool.query(
    `SELECT p.*, mp.role FROM people p
     JOIN movie_people mp ON mp.person_id = p.id
     WHERE mp.movie_id=$1`,
    [id],
  );

  const episodeCondition = is_public ? "AND e.is_published = TRUE" : "";

  const episodes = await pool.query(
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
     WHERE e.movie_id=$1 ${episodeCondition}
     GROUP BY e.id
     ORDER BY e.season, e.episode_number`,
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

export const updateMeta = async (
  movieId,
  { categories, countries, people },
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const getOrCreate = async (table, items = []) => {
      const ids = [];

      for (const item of items) {
        if (!item?.name) continue;

        const slug = toSlug(item.name);

        let res = await client.query(`SELECT id FROM ${table} WHERE slug=$1`, [
          slug,
        ]);

        let id;

        if (res.rows.length) {
          id = res.rows[0].id;
        } else {
          const insert = await client.query(
            `INSERT INTO ${table}(name, slug) VALUES($1,$2) RETURNING id`,
            [item.name, slug],
          );
          id = insert.rows[0].id;
        }

        ids.push(id);
      }

      return ids;
    };

    if (categories) {
      const ids = await getOrCreate("categories", categories);

      await client.query(`DELETE FROM movie_categories WHERE movie_id=$1`, [
        movieId,
      ]);

      for (const id of ids) {
        await client.query(
          `INSERT INTO movie_categories(movie_id, category_id)
           VALUES($1,$2)`,
          [movieId, id],
        );
      }
    }

    if (countries) {
      const ids = await getOrCreate("countries", countries);

      await client.query(`DELETE FROM movie_countries WHERE movie_id=$1`, [
        movieId,
      ]);

      for (const id of ids) {
        await client.query(
          `INSERT INTO movie_countries(movie_id, country_id)
           VALUES($1,$2)`,
          [movieId, id],
        );
      }
    }

    if (people) {
      await client.query(`DELETE FROM movie_people WHERE movie_id=$1`, [
        movieId,
      ]);

      for (const p of people) {
        if (!p?.name) continue;

        const slug = toSlug(p.name);

        let res = await client.query(`SELECT id FROM people WHERE slug=$1`, [
          slug,
        ]);

        let personId;

        if (!res.rows.length) {
          const insert = await client.query(
            `INSERT INTO people(name, slug) VALUES($1,$2) RETURNING id`,
            [p.name, slug],
          );
          personId = insert.rows[0].id;
        } else {
          personId = res.rows[0].id;
        }

        await client.query(
          `INSERT INTO movie_people(movie_id, person_id, role)
           VALUES($1,$2,$3)`,
          [movieId, personId, p.role || null],
        );
      }
    }

    await client.query("COMMIT");

    const result = await pool.query(`SELECT * FROM movies WHERE id=$1`, [
      movieId,
    ]);

    return result.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const updateMedia = async (movieId, data) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { poster_url, thumb_url, trailer_url, episodes } = data;
    if (poster_url || thumb_url || trailer_url) {
      await client.query(
        `UPDATE movies SET
      poster_url = COALESCE($1, poster_url),
      thumb_url = COALESCE($2, thumb_url),
      trailer_url = COALESCE($3, trailer_url)
     WHERE id=$4`,
        [poster_url, thumb_url, trailer_url, movieId],
      );
    }

    const getOrCreateServer = async (name, type = "embed") => {
      if (!name) return null;

      const find = await client.query(
        `SELECT id FROM servers WHERE name=$1 AND type=$2`,
        [name, type],
      );

      if (find.rows.length) return find.rows[0].id;

      const insert = await client.query(
        `INSERT INTO servers(name, type)
         VALUES($1,$2)
         RETURNING id`,
        [name, type],
      );

      return insert.rows[0].id;
    };

    if (episodes && Array.isArray(episodes)) {
      const movieCheck = await client.query(
        `SELECT lifecycle_status FROM movies WHERE id=$1`,
        [movieId],
      );
      const currentLifecycle =
        movieCheck.rows[0]?.lifecycle_status || "upcoming";
      const defaultPublished = currentLifecycle === "upcoming" ? false : true;

      for (const ep of episodes) {
        if (!ep?.episode_number) continue;

        const epSlug = toSlug(ep.name || `tap-${ep.episode_number}`);
        const epIsPublished =
          ep.is_published !== undefined ? ep.is_published : defaultPublished;

        const epRes = await client.query(
          `INSERT INTO episodes(movie_id, season, episode_number, name, slug, is_published)
           VALUES($1,$2,$3,$4,$5,$6)
           ON CONFLICT (movie_id, season, episode_number)
           DO UPDATE SET 
              name = EXCLUDED.name,
              slug = EXCLUDED.slug,
              is_published = EXCLUDED.is_published
           RETURNING id`,
          [
            movieId,
            ep.season || 1,
            ep.episode_number,
            ep.name || "",
            epSlug,
            epIsPublished,
          ],
        );

        const epId = epRes.rows[0].id;

        await client.query(`DELETE FROM episode_streams WHERE episode_id=$1`, [
          epId,
        ]);

        for (const st of ep.streams || []) {
          if (!st?.quality) continue;

          let serverId = st.server_id;

          if (!serverId && st.server_name) {
            serverId = await getOrCreateServer(
              st.server_name,
              st.type || "embed",
            );
          }

          if (!serverId) continue;

          await client.query(
            `INSERT INTO episode_streams(
              episode_id,
              server_id,
              quality,
              lang,
              link_embed,
              link_m3u8
            )
            VALUES($1,$2,$3,$4,$5,$6)`,
            [
              epId,
              serverId,
              st.quality,
              st.lang || "vietsub",
              st.link_embed || null,
              st.link_m3u8 || null,
            ],
          );
        }
      }
    }

    await client.query("COMMIT");

    const result = await pool.query(`SELECT * FROM movies WHERE id=$1`, [
      movieId,
    ]);

    return result.rows[0];
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

export const updateSetting = async (movieId, data) => {
  const res = await pool.query(
    `UPDATE movies SET
      status = COALESCE($1, status),
      lifecycle_status = COALESCE($2, lifecycle_status),
      production_status = COALESCE($3, production_status),
      is_available = COALESCE($4, is_available),
      is_premium = COALESCE($5, is_premium),
      source = COALESCE($6, source)
     WHERE id=$7
     RETURNING *`,
    [
      data.status,
      data.lifecycle_status,
      data.production_status,
      data.is_available,
      data.is_premium,
      data.source,
      movieId,
    ],
  );

  return res.rows[0];
};
