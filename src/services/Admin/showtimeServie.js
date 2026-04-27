import pool from "../../config/db.js";
import cron from "node-cron";
import { io } from "../../server.js";

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
  const { keyword, status, sort_by, order } = query;
  const conditions = [];
  const values = [];

  if (keyword) {
    values.push(`%${keyword}%`);
    conditions.push(`m.name ILIKE $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`s.status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const ALLOWED_SORT_COLUMNS = {
    id: "s.id",
    start_time: "s.start_time",
    end_time: "s.end_time",
    status: "s.status",
    movie_name: "m.name",
    episode_number: "e.episode_number",
  };
  const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "s.start_time";
  const sortDirection = (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const baseFromJoins = `
    FROM showtimes s
    LEFT JOIN movies m ON s.movie_id = m.id
    LEFT JOIN episodes e ON s.episode_id = e.id
    ${where}
  `;
  const statsQuery = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled,
      COUNT(*) FILTER (WHERE status = 'live') AS live,
      COUNT(*) FILTER (WHERE status = 'ended') AS ended
    FROM showtimes
  `;
  const [dataRes, countRes, statsRes] = await Promise.all([
    pool.query(
      `
        SELECT s.*, m.name AS movie_name, m.duration, e.name AS episode_name, e.episode_number
        ${baseFromJoins}
        ORDER BY ${sortColumn} ${sortDirection} NULLS LAST
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    ),
    pool.query(`SELECT COUNT(*) AS total ${baseFromJoins}`, values),
    pool.query(statsQuery),
  ]);

  const totalRecords = parseInt(countRes.rows[0].total);
  const statsRow = statsRes.rows[0];
  return {
    data: dataRes.rows,
    pagination: {
      total: totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
    },
    stats: {
      total: Number(statsRow.total) || 0,
      scheduled: Number(statsRow.scheduled) || 0,
      live: Number(statsRow.live) || 0,
      ended: Number(statsRow.ended) || 0,
    },
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
  if (data.status && data.status !== current.status && io) {
    io.to(`room_premiere_${id}`).emit("room_status_changed", {
      roomId: parseInt(id),
      status: data.status,
    });
  }

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

    if (liveUpdate.rowCount > 0 && io) {
      liveUpdate.rows.forEach((row) => {
        io.to(`room_premiere_${row.id}`).emit("room_status_changed", {
          roomId: row.id,
          status: "live",
        });
      });
    }

    const endedUpdate = await pool.query(`
      UPDATE showtimes 
      SET status = 'ended', updated_at = NOW() 
      WHERE status IN ('scheduled', 'live') 
        AND end_time <= NOW()
      RETURNING id;
    `);

    if (endedUpdate.rowCount > 0 && io) {
      endedUpdate.rows.forEach((row) => {
        io.to(`room_premiere_${row.id}`).emit("room_status_changed", {
          roomId: row.id,
          status: "ended",
        });
      });
    }
  } catch (error) {
    // console.error("[Cron Error]", error);
  }
});
