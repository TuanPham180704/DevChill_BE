import pool from "../../config/db.js";

export const getPublicShowtimes = async (query = {}) => {
  const limit = Math.min(parseInt(query.limit) || 12, 50);
  const offset = (Math.max(parseInt(query.page) || 1, 1) - 1) * limit;

  const sql = `
    SELECT 
      s.id, s.start_time, s.end_time, s.status,
      m.name AS movie_name, m.poster_url, m.is_premium AS movie_is_premium,
      e.name AS episode_name, e.episode_number
    FROM showtimes s
    JOIN movies m ON s.movie_id = m.id
    JOIN episodes e ON s.episode_id = e.id
    WHERE s.is_premiere = TRUE 
      AND s.status IN ('scheduled', 'live')
      AND s.end_time > NOW() -- Safety net chặn phim đã hết giờ thực tế
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
      e.name AS episode_name, e.episode_number, e.season,
      
      -- BẢO MẬT: Chỉ trả về mảng stream nếu trạng thái đang là LIVE
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
