import pool from "../../config/db.js";

export const watchHistoryService = {
  saveProgress: async (
    userId,
    movieId,
    episodeId,
    watchedDuration,
    totalDuration,
  ) => {
    let progress =
      totalDuration > 0 ? (watchedDuration / totalDuration) * 100 : 0;
    progress = Math.min(progress, 100);

    const query = `
      INSERT INTO watch_history 
        (user_id, movie_id, episode_id, watched_duration, total_duration, progress)
      VALUES 
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, episode_id) 
      DO UPDATE SET 
        watched_duration = EXCLUDED.watched_duration,
        total_duration = EXCLUDED.total_duration,
        progress = EXCLUDED.progress,
        last_watched_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      userId,
      movieId,
      episodeId,
      Math.floor(watchedDuration),
      Math.floor(totalDuration),
      progress,
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  getUserHistory: async (userId, limit, offset) => {
    const countQuery = `SELECT COUNT(*) FROM watch_history WHERE user_id = $1`;
    const { rows: countRows } = await pool.query(countQuery, [userId]);
    const totalRecords = parseInt(countRows[0].count, 10);
    const dataQuery = `
      SELECT 
        wh.id, wh.watched_duration, wh.total_duration, wh.progress, wh.last_watched_at,
        m.id as movie_id, m.name as movie_name, m.slug as movie_slug, m.thumb_url,
        e.id as episode_id, e.name as episode_name, e.episode_number
      FROM watch_history wh
      JOIN movies m ON wh.movie_id = m.id
      JOIN episodes e ON wh.episode_id = e.id
      WHERE wh.user_id = $1
      ORDER BY wh.last_watched_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const { rows: data } = await pool.query(dataQuery, [userId, limit, offset]);

    return {
      data,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      },
    };
  },

  getEpisodeProgress: async (userId, episodeId) => {
    const query = `SELECT watched_duration FROM watch_history WHERE user_id = $1 AND episode_id = $2;`;
    const { rows } = await pool.query(query, [userId, episodeId]);
    return rows[0] ? rows[0].watched_duration : 0;
  },
  deleteHistoryItem: async (userId, historyId) => {
    const query = `DELETE FROM watch_history WHERE user_id = $1 AND id = $2 RETURNING id;`;
    const { rows } = await pool.query(query, [userId, historyId]);
    return rows.length > 0;
  },

  clearAllHistory: async (userId) => {
    const query = `DELETE FROM watch_history WHERE user_id = $1;`;
    await pool.query(query, [userId]);
    return true;
  },
};
