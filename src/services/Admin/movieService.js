import pool from "../../config/db.js";

const getOrCreateCategories = async (client, categories) => {
  const ids = [];
  for (const cat of categories) {
    const slug = cat.slug || cat.name.toLowerCase().replace(/\s+/g, "-");
    const res = await client.query(`SELECT id FROM categories WHERE slug=$1`, [
      slug,
    ]);
    let categoryId;
    if (res.rows.length) categoryId = res.rows[0].id;
    else {
      const insert = await client.query(
        `INSERT INTO categories(name, slug) VALUES($1,$2) RETURNING id`,
        [cat.name, slug],
      );
      categoryId = insert.rows[0].id;
    }
    ids.push(categoryId);
  }
  return ids;
};

const getOrCreateCountries = async (client, countries) => {
  const ids = [];
  for (const c of countries) {
    const slug = c.slug || c.name.toLowerCase().replace(/\s+/g, "-");
    const res = await client.query(`SELECT id FROM countries WHERE slug=$1`, [
      slug,
    ]);
    let countryId;
    if (res.rows.length) countryId = res.rows[0].id;
    else {
      const insert = await client.query(
        `INSERT INTO countries(name, slug) VALUES($1,$2) RETURNING id`,
        [c.name, slug],
      );
      countryId = insert.rows[0].id;
    }
    ids.push(countryId);
  }
  return ids;
};

const getOrCreatePeople = async (client, people) => {
  const resArr = [];
  for (const p of people) {
    const slug = p.slug || p.name.toLowerCase().replace(/\s+/g, "-");
    const res = await client.query(`SELECT id FROM people WHERE slug=$1`, [
      slug,
    ]);
    let personId;
    if (res.rows.length) personId = res.rows[0].id;
    else {
      const insert = await client.query(
        `INSERT INTO people(name, slug) VALUES($1,$2) RETURNING id`,
        [p.name, slug],
      );
      personId = insert.rows[0].id;
    }
    resArr.push({ id: personId, role: p.role });
  }
  return resArr;
};

const getOrCreateServer = async (client, movieId, name, type) => {
  const res = await client.query(
    `SELECT id FROM servers WHERE movie_id=$1 AND name=$2 AND type=$3`,
    [movieId, name, type],
  );
  if (res.rows.length) return res.rows[0].id;

  const insert = await client.query(
    `INSERT INTO servers(movie_id, name, type) VALUES($1,$2,$3) RETURNING id`,
    [movieId, name, type],
  );
  return insert.rows[0].id;
};

export const createMovie = async (payload) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      name,
      origin_name,
      slug,
      content,
      poster_url,
      thumb_url,
      trailer_url,
      type,
      status,
      production_status,
      is_available,
      is_premium,
      year,
      quality,
      lang,
      duration,
      episode_total,
      tmdb_id,
      source,
      contract_id,
      categories = [],
      countries = [],
      people = [],
      episodes = [],
      created_by,
    } = payload;

    let movieId;
    if (tmdb_id) {
      const exist = await client.query(
        `SELECT id FROM movies WHERE tmdb_id=$1`,
        [tmdb_id],
      );

      if (exist.rows.length) {
        movieId = exist.rows[0].id;
      }
    }
    if (!movieId) {
      const movieRes = await client.query(
        `INSERT INTO movies(
          name, origin_name, slug, content, poster_url, thumb_url, trailer_url,
          type, status, production_status, is_available, is_premium,
          year, quality, lang, duration, episode_total, tmdb_id, source,
          contract_id, created_by
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        RETURNING id`,
        [
          name,
          origin_name,
          slug,
          content,
          poster_url,
          thumb_url,
          trailer_url,
          type,
          status,
          production_status,
          is_available,
          is_premium,
          year,
          quality,
          lang,
          duration,
          episode_total,
          tmdb_id,
          source,
          contract_id,
          created_by,
        ],
      );

      movieId = movieRes.rows[0].id;
      const categoryIds = await getOrCreateCategories(client, categories);
      for (const cid of categoryIds) {
        await client.query(
          `INSERT INTO movie_categories(movie_id, category_id)
           VALUES($1,$2) ON CONFLICT DO NOTHING`,
          [movieId, cid],
        );
      }
      const countryIds = await getOrCreateCountries(client, countries);
      for (const cid of countryIds) {
        await client.query(
          `INSERT INTO movie_countries(movie_id, country_id)
           VALUES($1,$2) ON CONFLICT DO NOTHING`,
          [movieId, cid],
        );
      }
      const peopleArr = await getOrCreatePeople(client, people);
      for (const p of peopleArr) {
        await client.query(
          `INSERT INTO movie_people(movie_id, person_id, role)
           VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
          [movieId, p.id, p.role],
        );
      }
    }
    for (const ep of episodes) {
      const epRes = await client.query(
        `INSERT INTO episodes(movie_id, season, episode_number, name, slug)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (movie_id, season, episode_number) DO NOTHING
         RETURNING id`,
        [movieId, ep.season || 1, ep.episode_number, ep.name, ep.slug],
      );

      let epId;

      if (epRes.rows.length) {
        epId = epRes.rows[0].id;
      } else {
        const existEp = await client.query(
          `SELECT id FROM episodes
           WHERE movie_id=$1 AND season=$2 AND episode_number=$3`,
          [movieId, ep.season || 1, ep.episode_number],
        );
        epId = existEp.rows[0].id;
      }
      if (ep.streams?.length) {
        for (const st of ep.streams) {
          const serverId = st.server_id
            ? st.server_id
            : await getOrCreateServer(
                client,
                movieId,
                st.server_name,
                st.server_type,
              );

          await client.query(
            `INSERT INTO episode_streams(
              episode_id, server_id, quality, link_embed, link_m3u8
            )
            VALUES($1,$2,$3,$4,$5)
            ON CONFLICT (episode_id, server_id, quality) DO NOTHING`,
            [epId, serverId, st.quality, st.link_embed, st.link_m3u8],
          );
        }
      }
    }

    await client.query("COMMIT");
    return movieId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const updateMovie = async (id, payload) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      name,
      origin_name,
      slug,
      content,
      poster_url,
      thumb_url,
      trailer_url,
      type,
      status,
      production_status,
      is_available,
      is_premium,
      year,
      quality,
      lang,
      duration,
      episode_total,
      tmdb_id,
      source,
      contract_id,
      categories,
      countries,
      people,
      episodes,
    } = payload;
    const fields = [];
    const values = [];
    let idx = 1;

    const addField = (field, value) => {
      if (value !== undefined) {
        fields.push(`${field}=$${idx++}`);
        values.push(value);
      }
    };
    addField("name", name);
    addField("origin_name", origin_name);
    addField("slug", slug);
    addField("content", content);
    addField("poster_url", poster_url);
    addField("thumb_url", thumb_url);
    addField("trailer_url", trailer_url);
    addField("type", type);
    addField("status", status);
    addField("production_status", production_status);
    addField("is_available", is_available);
    addField("is_premium", is_premium);
    addField("year", year);
    addField("quality", quality);
    addField("lang", lang);
    addField("duration", duration);
    addField("episode_total", episode_total);
    addField("tmdb_id", tmdb_id);
    addField("source", source);
    addField("contract_id", contract_id);
    if (fields.length) {
      values.push(id);
      await client.query(
        `UPDATE movies SET ${fields.join(", ")}, updated_at=NOW()
         WHERE id=$${idx}`,
        values,
      );
    }
    if (categories !== undefined) {
      const newIds = await getOrCreateCategories(client, categories);

      const oldRes = await client.query(
        `SELECT category_id FROM movie_categories WHERE movie_id=$1`,
        [id],
      );
      const oldIds = oldRes.rows.map((r) => r.category_id);
      const toDelete = oldIds.filter((x) => !newIds.includes(x));
      const toInsert = newIds.filter((x) => !oldIds.includes(x));
      if (toDelete.length) {
        await client.query(
          `DELETE FROM movie_categories
           WHERE movie_id=$1 AND category_id = ANY($2)`,
          [id, toDelete],
        );
      }
      for (const cid of toInsert) {
        await client.query(
          `INSERT INTO movie_categories(movie_id, category_id)
           VALUES($1,$2) ON CONFLICT DO NOTHING`,
          [id, cid],
        );
      }
    }
    if (countries !== undefined) {
      const newIds = await getOrCreateCountries(client, countries);

      const oldRes = await client.query(
        `SELECT country_id FROM movie_countries WHERE movie_id=$1`,
        [id],
      );
      const oldIds = oldRes.rows.map((r) => r.country_id);

      const toDelete = oldIds.filter((x) => !newIds.includes(x));
      const toInsert = newIds.filter((x) => !oldIds.includes(x));

      if (toDelete.length) {
        await client.query(
          `DELETE FROM movie_countries
           WHERE movie_id=$1 AND country_id = ANY($2)`,
          [id, toDelete],
        );
      }

      for (const cid of toInsert) {
        await client.query(
          `INSERT INTO movie_countries(movie_id, country_id)
           VALUES($1,$2) ON CONFLICT DO NOTHING`,
          [id, cid],
        );
      }
    }
    if (people !== undefined) {
      const newPeople = await getOrCreatePeople(client, people);

      const oldRes = await client.query(
        `SELECT person_id, role FROM movie_people WHERE movie_id=$1`,
        [id],
      );

      const oldMap = oldRes.rows.map((r) => `${r.person_id}-${r.role}`);
      const newMap = newPeople.map((p) => `${p.id}-${p.role}`);

      const toDelete = oldRes.rows.filter(
        (r) => !newMap.includes(`${r.person_id}-${r.role}`),
      );

      const toInsert = newPeople.filter(
        (p) => !oldMap.includes(`${p.id}-${p.role}`),
      );

      for (const d of toDelete) {
        await client.query(
          `DELETE FROM movie_people
           WHERE movie_id=$1 AND person_id=$2 AND role=$3`,
          [id, d.person_id, d.role],
        );
      }

      for (const p of toInsert) {
        await client.query(
          `INSERT INTO movie_people(movie_id, person_id, role)
           VALUES($1,$2,$3)`,
          [id, p.id, p.role],
        );
      }
    }
    if (episodes !== undefined) {
      for (const ep of episodes) {
        const epRes = await client.query(
          `INSERT INTO episodes(movie_id, season, episode_number, name, slug)
           VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (movie_id, season, episode_number) DO NOTHING
           RETURNING id`,
          [id, ep.season || 1, ep.episode_number, ep.name, ep.slug],
        );

        let epId;

        if (epRes.rows.length) {
          epId = epRes.rows[0].id;
        } else {
          const exist = await client.query(
            `SELECT id FROM episodes
             WHERE movie_id=$1 AND season=$2 AND episode_number=$3`,
            [id, ep.season || 1, ep.episode_number],
          );
          epId = exist.rows[0].id;
        }

        if (ep.streams?.length) {
          for (const st of ep.streams) {
            const serverId = st.server_id
              ? st.server_id
              : await getOrCreateServer(
                  client,
                  id,
                  st.server_name,
                  st.server_type,
                );

            await client.query(
              `INSERT INTO episode_streams(
                episode_id, server_id, quality, link_embed, link_m3u8
              )
              VALUES($1,$2,$3,$4,$5)
              ON CONFLICT (episode_id, server_id, quality) DO NOTHING`,
              [epId, serverId, st.quality, st.link_embed, st.link_m3u8],
            );
          }
        }
      }
    }

    await client.query("COMMIT");
    return id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const getMovieById = async (id) => {
  const res = await pool.query(`SELECT * FROM movies WHERE id=$1`, [id]);
  if (!res.rows.length) return null;
  const movie = res.rows[0];

  const catRes = await pool.query(
    `SELECT c.* FROM categories c
     JOIN movie_categories mc ON c.id=mc.category_id
     WHERE mc.movie_id=$1`,
    [id],
  );

  const countryRes = await pool.query(
    `SELECT c.* FROM countries c
     JOIN movie_countries mc ON c.id=mc.country_id
     WHERE mc.movie_id=$1`,
    [id],
  );

  const peopleRes = await pool.query(
    `SELECT p.*, mp.role FROM people p
     JOIN movie_people mp ON p.id=mp.person_id
     WHERE mp.movie_id=$1`,
    [id],
  );

  const epRes = await pool.query(
    `SELECT e.id AS episode_id, e.season, e.episode_number, e.name AS episode_name, e.slug,
            s.id AS server_id, s.name AS server_name, s.type AS server_type,
            es.quality, es.link_embed, es.link_m3u8
     FROM episodes e
     LEFT JOIN episode_streams es ON e.id = es.episode_id
     LEFT JOIN servers s ON es.server_id = s.id
     WHERE e.movie_id = $1
     ORDER BY e.season, e.episode_number, s.name`,
    [id],
  );

  const episodes = {};
  epRes.rows.forEach((r) => {
    if (!episodes[r.episode_id]) {
      episodes[r.episode_id] = {
        id: r.episode_id,
        season: r.season,
        episode_number: r.episode_number,
        name: r.episode_name,
        slug: r.slug,
        streams: [],
      };
    }
    if (r.server_id) {
      episodes[r.episode_id].streams.push({
        server_id: r.server_id,
        server_name: r.server_name,
        server_type: r.server_type,
        quality: r.quality,
        link_embed: r.link_embed,
        link_m3u8: r.link_m3u8,
      });
    }
  });

  return {
    ...movie,
    categories: catRes.rows,
    countries: countryRes.rows,
    people: peopleRes.rows,
    episodes: Object.values(episodes),
  };
};

export const getAllMovies = async ({ q = "", page = 1, limit = 10 }) => {
  page = parseInt(page);
  limit = parseInt(limit);
  const offset = (page - 1) * limit;

  let where = "";
  const values = [];
  if (q) {
    where = "WHERE name ILIKE $1";
    values.push(`%${q}%`);
  }

  const totalRes = await pool.query(
    `SELECT COUNT(*) FROM movies ${where}`,
    values,
  );
  const total = parseInt(totalRes.rows[0].count);

  const res = await pool.query(
    `SELECT * FROM movies ${where} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  return { total, page, limit, movies: res.rows };
};
