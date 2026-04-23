import pool from "../../config/db.js";
import cron from "node-cron";

const getDurationInMinutes = (durationStr) => {
  if (!durationStr) return 120;
  const match = durationStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 120;
};

export const createShowtime = async (data) => {
  const { movie_id, episode_id, start_time, is_premiere, created_by } = data;
  const startTimeObj = new Date(start_time);
  const now = new Date();

  if (startTimeObj <= now) {
    throw new Error("Thời gian bắt đầu phải lớn hơn thời gian hiện tại.");
  }
  const movieRes = await pool.query(
    `SELECT duration FROM movies WHERE id = $1`,
    [movie_id],
  );
  if (movieRes.rowCount === 0) throw new Error("Phim không tồn tại");

  const durationMin = getDurationInMinutes(movieRes.rows[0].duration);
  const endTimeObj = new Date(startTimeObj.getTime() + durationMin * 60000);

  const res = await pool.query(
    `INSERT INTO showtimes (movie_id, episode_id, start_time, end_time, is_premiere, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
     RETURNING *`,
    [
      movie_id,
      episode_id,
      startTimeObj,
      endTimeObj,
      is_premiere || false,
      created_by,
    ],
  );
  return res.rows[0];
};

export const getAllShowtimes = async (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 10, 50);
  const offset = (page - 1) * limit;

  const dataQuery = `
    SELECT s.*, m.name AS movie_name, m.duration, e.name AS episode_name, e.episode_number
    FROM showtimes s
    JOIN movies m ON s.movie_id = m.id
    JOIN episodes e ON s.episode_id = e.id
    ORDER BY s.start_time DESC
    LIMIT $1 OFFSET $2
  `;
  const countQuery = `SELECT COUNT(*) FROM showtimes`;

  const dataRes = await pool.query(dataQuery, [limit, offset]);
  const countRes = await pool.query(countQuery);

  return {
    data: dataRes.rows,
    pagination: { total: parseInt(countRes.rows[0].count), page, limit },
  };
};

export const getShowtimeById = async (id) => {
  const res = await pool.query(
    `SELECT s.*, m.name AS movie_name, m.duration, e.name AS episode_name, e.episode_number,
     (SELECT json_agg(es) FROM episode_streams es WHERE es.episode_id = s.episode_id) as streams
     FROM showtimes s
     JOIN movies m ON s.movie_id = m.id
     JOIN episodes e ON s.episode_id = e.id
     WHERE s.id = $1`,
    [id],
  );
  return res.rows[0];
};

export const updateShowtime = async (id, data) => {
  const currentShowtime = await pool.query(
    `SELECT s.movie_id, m.duration, s.start_time, s.end_time, s.status, s.is_premiere 
     FROM showtimes s 
     JOIN movies m ON s.movie_id = m.id 
     WHERE s.id = $1`,
    [id],
  );

  if (currentShowtime.rowCount === 0) throw new Error("Showtime không tồn tại");

  const current = currentShowtime.rows[0];
  const movieDuration = current.duration;
  const durationMin = getDurationInMinutes(movieDuration);

  const fields = [];
  const values = [];
  let i = 1;
  if (data.start_time) {
    const newStart = new Date(data.start_time);
    const currentStart = new Date(current.start_time);
    if (newStart.getTime() !== currentStart.getTime()) {
      const now = new Date();
      if (newStart <= now) {
        throw new Error("Thời gian bắt đầu mới không được ở quá khứ.");
      }

      const newEnd = new Date(newStart.getTime() + durationMin * 60000);

      fields.push(`start_time=$${i++}`);
      values.push(newStart);
      fields.push(`end_time=$${i++}`);
      values.push(newEnd);
    }
  }
  if (data.status && data.status !== current.status) {
    fields.push(`status=$${i++}`);
    values.push(data.status);
  }
  if (
    data.is_premiere !== undefined &&
    data.is_premiere !== current.is_premiere
  ) {
    fields.push(`is_premiere=$${i++}`);
    values.push(data.is_premiere);
  }
  if (fields.length === 0) {
    return current;
  }

  values.push(id);
  const res = await pool.query(
    `UPDATE showtimes SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
    values,
  );
  return res.rows[0];
};
cron.schedule("* * * * *", async () => {
  try {
    const liveUpdate = await pool.query(`
      UPDATE showtimes 
      SET status = 'live', updated_at = NOW() 
      WHERE status = 'scheduled' 
        AND start_time <= NOW() 
        AND end_time > NOW()
      RETURNING id;
    `);

    const endedUpdate = await pool.query(`
      UPDATE showtimes 
      SET status = 'ended', updated_at = NOW() 
      WHERE status IN ('scheduled', 'live') 
        AND end_time <= NOW()
      RETURNING id;
    `);
  } catch (error) {
    // console.error("[Cron Error]", error);
  }
});
