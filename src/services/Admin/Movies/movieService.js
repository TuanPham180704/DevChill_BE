import pool from "../../../config/db.js";

/* ================= HELPER: SLUG ================= */
const toSlug = (str = "") =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/* ================= CREATE ================= */
export const createMovie = async (data) => {
  const slug = toSlug(data.name);

  const res = await pool.query(
    `INSERT INTO movies(name, origin_name, slug, content, type, year, duration, episode_total, created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.name,
      data.origin_name,
      slug,
      data.content,
      data.type,
      data.year,
      data.duration,
      data.episode_total,
      data.created_by,
    ],
  );

  return res.rows[0];
};

/* ================= UPDATE INFO ================= */
export const updateInfo = async (id, data) => {
  const fields = [];
  const values = [];
  let i = 1;

  if (data.name) {
    fields.push(`name=$${i++}`);
    values.push(data.name);

    fields.push(`slug=$${i++}`);
    values.push(toSlug(data.name));
  }

  for (const key of Object.keys(data)) {
    if (key === "name") continue;
    fields.push(`${key}=$${i++}`);
    values.push(data[key]);
  }

  if (!fields.length) return null;

  values.push(id);

  const res = await pool.query(
    `UPDATE movies 
     SET ${fields.join(", ")}, updated_at=NOW()
     WHERE id=$${i}
     RETURNING *`,
    values,
  );

  return res.rows[0];
};

/* ================= GET ALL ================= */
export const getAll = async (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const offset = (page - 1) * limit;

  const { keyword, status, type } = query;

  let where = [];
  let values = [];
  let i = 1;

  if (keyword) {
    where.push(`(name ILIKE $${i} OR origin_name ILIKE $${i})`);
    values.push(`%${keyword}%`);
    i++;
  }

  if (status) {
    where.push(`status = $${i++}`);
    values.push(status);
  }

  if (type) {
    where.push(`type = $${i++}`);
    values.push(type);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const dataQuery = `
    SELECT * FROM movies
    ${whereSQL}
    ORDER BY created_at DESC
    LIMIT $${i++} OFFSET $${i}
  `;

  const countQuery = `
    SELECT COUNT(*) FROM movies
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

/* ================= GET BY ID ================= */
export const getById = async (id) => {
  // movie
  const movieRes = await pool.query(`SELECT * FROM movies WHERE id=$1`, [id]);

  if (!movieRes.rows.length) return null;

  const movie = movieRes.rows[0];

  // categories
  const categories = await pool.query(
    `SELECT c.* FROM categories c
     JOIN movie_categories mc ON mc.category_id = c.id
     WHERE mc.movie_id=$1`,
    [id],
  );

  // countries
  const countries = await pool.query(
    `SELECT c.* FROM countries c
     JOIN movie_countries mc ON mc.country_id = c.id
     WHERE mc.movie_id=$1`,
    [id],
  );

  // people
  const people = await pool.query(
    `SELECT p.*, mp.role FROM people p
     JOIN movie_people mp ON mp.person_id = p.id
     WHERE mp.movie_id=$1`,
    [id],
  );

  // episodes + streams
  const episodes = await pool.query(
    `SELECT e.*, 
      json_agg(
        json_build_object(
          'id', es.id,
          'server_id', es.server_id,
          'quality', es.quality,
          'lang', es.lang,
          'link_embed', es.link_embed,
          'link_m3u8', es.link_m3u8
        )
      ) AS streams
     FROM episodes e
     LEFT JOIN episode_streams es ON es.episode_id = e.id
     WHERE e.movie_id=$1
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

/* ================= UPDATE META ================= */
export const updateMeta = async (
  movieId,
  { categories, countries, people },
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const getOrCreate = async (table, items) => {
      const ids = [];

      for (const item of items) {
        const slug = toSlug(item.name);

        let res = await client.query(`SELECT id FROM ${table} WHERE slug=$1`, [
          slug,
        ]);

        let id;

        if (res.rows.length) id = res.rows[0].id;
        else {
          const insert = await client.query(
            `INSERT INTO ${table}(name, slug)
             VALUES($1,$2) RETURNING id`,
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
        const slug = toSlug(p.name);

        let res = await client.query(`SELECT id FROM people WHERE slug=$1`, [
          slug,
        ]);

        let personId;

        if (!res.rows.length) {
          const insert = await client.query(
            `INSERT INTO people(name, slug)
             VALUES($1,$2) RETURNING id`,
            [p.name, slug],
          );
          personId = insert.rows[0].id;
        } else personId = res.rows[0].id;

        await client.query(
          `INSERT INTO movie_people(movie_id, person_id, role)
           VALUES($1,$2,$3)`,
          [movieId, personId, p.role],
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

/* ================= UPDATE MEDIA ================= */
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

    if (episodes) {
      for (const ep of episodes) {
        const epSlug = toSlug(ep.name);

        const epRes = await client.query(
          `INSERT INTO episodes(movie_id, season, episode_number, name, slug)
           VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (movie_id, season, episode_number)
           DO UPDATE SET name=EXCLUDED.name
           RETURNING id`,
          [movieId, ep.season || 1, ep.episode_number, ep.name, epSlug],
        );

        const epId = epRes.rows[0].id;

        for (const st of ep.streams || []) {
          await client.query(
            `INSERT INTO episode_streams(
              episode_id, server_id, quality, lang, link_embed, link_m3u8
            )
             VALUES($1,$2,$3,$4,$5,$6)
             ON CONFLICT (episode_id, server_id, quality, lang)
             DO UPDATE SET
               link_embed = EXCLUDED.link_embed,
               link_m3u8 = EXCLUDED.link_m3u8`,
            [
              epId,
              st.server_id,
              st.quality,
              st.lang || "vietsub",
              st.link_embed,
              st.link_m3u8,
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

/* ================= UPDATE SETTING ================= */
export const updateSetting = async (movieId, data) => {
  const res = await pool.query(
    `UPDATE movies SET
      status=$1,
      is_available=$2,
      is_premium=$3,
      contract_id=$4,
      source=$5,
      tmdb_id=$6
     WHERE id=$7
     RETURNING *`,
    [
      data.status,
      data.is_available,
      data.is_premium,
      data.contract_id,
      data.source,
      data.tmdb_id,
      movieId,
    ],
  );

  return res.rows[0];
};
