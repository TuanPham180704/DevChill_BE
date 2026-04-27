import pool from "../../config/db.js";
import cron from "node-cron";
import { io } from "../../server.js";

export const getPublicShowtimes = async (query = {}) => {
  const limit = Math.min(parseInt(query.limit) || 12, 50);
  const offset = (Math.max(parseInt(query.page) || 1, 1) - 1) * limit;

  const sql = `
    SELECT 
      s.id, s.start_time, s.end_time, s.status,
      m.name AS movie_name, m.poster_url, m.is_premium AS movie_is_premium,
      m.content AS description,
      e.name AS episode_name, e.episode_number,
      
      COALESCE(
        (
          SELECT json_agg(
            json_build_object('id', p.id, 'name', p.name)
          )
          FROM movie_people mp
          JOIN people p ON p.id = mp.person_id
          WHERE mp.movie_id = m.id AND mp.role = 'actor'
        ), 
        '[]'::json
      ) AS actors

    FROM showtimes s
    JOIN movies m ON s.movie_id = m.id
    JOIN episodes e ON s.episode_id = e.id
    WHERE s.is_premiere = TRUE 
      AND s.status IN ('scheduled', 'live')
      AND s.end_time > NOW()
    ORDER BY s.start_time ASC
    LIMIT $1 OFFSET $2;
  `;
  const res = await pool.query(sql, [limit, offset]);
  return res.rows;
};

export const getShowtimeWatchDetail = async (id) => {
  const query = `
    SELECT 
      s.*, 
      m.name AS movie_name, m.poster_url, m.is_premium AS movie_is_premium,
      m.content AS description,
      e.name AS episode_name, e.episode_number, e.season,
      
      COALESCE(
        (
          SELECT json_agg(
            json_build_object('id', p.id, 'name', p.name)
          )
          FROM movie_people mp
          JOIN people p ON p.id = mp.person_id
          WHERE mp.movie_id = m.id AND mp.role = 'actor'
        ), 
        '[]'::json
      ) AS actors,
      
      CASE 
        WHEN s.status = 'live' THEN 
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'server_name', srv.name,
                  'quality', es.quality,
                  'lang', es.lang,
                  'link_embed', es.link_embed,
                  'link_m3u8', es.link_m3u8
                )
              )
              FROM episode_streams es
              JOIN servers srv ON srv.id = es.server_id
              WHERE es.episode_id = s.episode_id
            ),
            '[]'::json
          )
        ELSE '[]'::json 
      END AS streams

    FROM showtimes s
    JOIN movies m ON s.movie_id = m.id
    JOIN episodes e ON s.episode_id = e.id
    WHERE s.id = $1 AND s.is_premiere = TRUE;
  `;
  const res = await pool.query(query, [id]);
  return res.rows[0];
};
cron.schedule("* * * * *", async () => {
  try {
    const liveRes = await pool.query(`
      UPDATE showtimes 
      SET status = 'live', updated_at = NOW() 
      WHERE status = 'scheduled' AND start_time <= NOW() AND end_time > NOW()
      RETURNING id
    `);

    if (liveRes.rowCount > 0 && io) {
      liveRes.rows.forEach((row) => {
        io.to(`room_premiere_${row.id}`).emit("room_status_changed", {
          roomId: row.id,
          status: "live",
        });
      });
    }
    const endedRes = await pool.query(`
      UPDATE showtimes 
      SET status = 'ended', updated_at = NOW() 
      WHERE status IN ('scheduled', 'live') AND end_time <= NOW()
      RETURNING id
    `);

    if (endedRes.rowCount > 0 && io) {
      endedRes.rows.forEach((row) => {
        io.to(`room_premiere_${row.id}`).emit("room_status_changed", {
          roomId: row.id,
          status: "ended",
        });
      });
    }
    const lockedRecords = await pool.query(`
      SELECT DISTINCT s.movie_id, s.episode_id
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN episodes e ON s.episode_id = e.id
      WHERE s.status = 'ended'
        AND (m.lifecycle_status = 'upcoming' OR e.is_published = FALSE)
    `);

    if (lockedRecords.rowCount > 0) {
      const episodeIds = [
        ...new Set(lockedRecords.rows.map((row) => row.episode_id)),
      ];
      const movieIds = [
        ...new Set(lockedRecords.rows.map((row) => row.movie_id)),
      ];

      if (episodeIds.length > 0) {
        await pool.query(
          `
          UPDATE episodes SET is_published = TRUE
          WHERE id = ANY($1) AND is_published = FALSE
        `,
          [episodeIds],
        );
      }

      if (movieIds.length > 0) {
        for (const movieId of movieIds) {
          const movieInfo = await pool.query(
            `
            SELECT lifecycle_status, COALESCE(episode_total, 1) as episode_total 
            FROM movies WHERE id = $1
          `,
            [movieId],
          );

          if (movieInfo.rowCount === 0) continue;

          const { lifecycle_status, episode_total } = movieInfo.rows[0];
          const publishedCountRes = await pool.query(
            `
            SELECT COUNT(*) FROM episodes WHERE movie_id = $1 AND is_published = TRUE
          `,
            [movieId],
          );

          const publishedCount = parseInt(publishedCountRes.rows[0].count);
          let newStatus = "ongoing";
          if (publishedCount >= episode_total) {
            newStatus = "completed";
          }
          if (lifecycle_status !== newStatus) {
            await pool.query(
              `
              UPDATE movies SET lifecycle_status = $1, updated_at = NOW()
              WHERE id = $2
            `,
              [newStatus, movieId],
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("[Cron Error]", error);
  }
});
