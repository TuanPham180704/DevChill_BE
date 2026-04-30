import pool from "../../config/db.js";

export const getUnreadCountService = async () => {
  const result = await pool.query(
    `SELECT COUNT(*) AS unread_count FROM support_requests WHERE status = 'open'`,
  );
  return parseInt(result.rows[0].unread_count, 10);
};

export const getAllTicketsService = async (filters) => {
  const { status, search, sort_by, order, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;
  let query = `
    SELECT sr.*, u.username as user_name, u.avatar_url, COALESCE(u.email, sr.guest_email) AS contact_email
    FROM support_requests sr
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE 1=1
  `;
  const values = [];

  if (status) {
    values.push(status);
    query += ` AND sr.status = $${values.length}`;
  }

  if (search) {
    values.push(`%${search}%`);
    query += ` AND (sr.ticket_code ILIKE $${values.length} OR u.username ILIKE $${values.length} OR sr.guest_email ILIKE $${values.length})`;
  }
  const ALLOWED_SORT_COLUMNS = {
    id: "sr.id",
    status: "sr.status",
    priority: "sr.priority",
    created_at: "sr.created_at",
    ticket_code: "sr.ticket_code",
  };

  if (!sort_by) {
    query += ` ORDER BY 
      CASE WHEN sr.status IN ('open', 'in_progress') THEN 1 ELSE 2 END,
      CASE sr.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      sr.created_at DESC`;
  } else {
    const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "sr.created_at";
    const sortDirection =
      (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
    query += ` ORDER BY ${sortColumn} ${sortDirection} NULLS LAST`;
  }
  const dataValues = [...values];
  dataValues.push(limit);
  query += ` LIMIT $${dataValues.length}`;
  dataValues.push(offset);
  query += ` OFFSET $${dataValues.length}`;
  const result = await pool.query(query, dataValues);
  let countQuery = `
    SELECT COUNT(*) FROM support_requests sr
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE 1=1
  `;
  if (status) countQuery += ` AND sr.status = '${status}'`; 
  if (search)
    countQuery += ` AND (sr.ticket_code ILIKE '%${search}%' OR u.username ILIKE '%${search}%' OR sr.guest_email ILIKE '%${search}%')`;

  const countResult = await pool.query(countQuery);
  const total = parseInt(countResult.rows[0].count, 10);
  let statsQuery = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'open') as unread,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE status = 'closed') as closed
    FROM support_requests sr
    LEFT JOIN users u ON u.id = sr.user_id
    WHERE 1=1
  `;
  if (search) {
    statsQuery += ` AND (sr.ticket_code ILIKE '%${search}%' OR u.username ILIKE '%${search}%' OR sr.guest_email ILIKE '%${search}%')`;
  }

  const statsResult = await pool.query(statsQuery);
  const statsData = statsResult.rows[0];

  return {
    tickets: result.rows,
    stats: {
      total: parseInt(statsData.total, 10),
      unread: parseInt(statsData.unread, 10),
      in_progress: parseInt(statsData.in_progress, 10),
      resolved: parseInt(statsData.resolved, 10),
      closed: parseInt(statsData.closed, 10),
    },
    pagination: {
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTicketByIdService = async (id) => {
  const ticketRes = await pool.query(
    `SELECT sr.*, u.username AS user_name, u.avatar_url, COALESCE(u.email, sr.guest_email) AS contact_email
     FROM support_requests sr
     LEFT JOIN users u ON u.id = sr.user_id
     WHERE sr.id = $1`,
    [id],
  );

  if (ticketRes.rows.length === 0) return null;

  const responsesRes = await pool.query(
    `SELECT sp.*, u.username AS sender_name, u.avatar_url AS sender_avatar
     FROM support_responses sp
     LEFT JOIN users u ON u.id = sp.sender_id
     WHERE sp.request_id = $1
     ORDER BY sp.created_at ASC`,
    [id],
  );

  return {
    ...ticketRes.rows[0],
    responses: responsesRes.rows,
  };
};

export const replyTicketService = async (
  ticketId,
  adminId,
  contentResponse,
  attachments,
  newStatus,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const ticketRes = await client.query(
      `SELECT * FROM support_requests WHERE id = $1`,
      [ticketId],
    );
    if (!ticketRes.rows[0]) throw new Error("Ticket not found");
    const replyRes = await client.query(
      `INSERT INTO support_responses (request_id, sender_id, is_admin_reply, content_response, attachments)
       VALUES ($1, $2, true, $3, $4) RETURNING *`,
      [ticketId, adminId, contentResponse, attachments],
    );
    const statusToUpdate = newStatus || "in_progress";
    const updateRes = await client.query(
      `UPDATE support_requests 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING ticket_code, guest_email, user_id`,
      [statusToUpdate, ticketId],
    );
    let receiverEmail = updateRes.rows[0].guest_email;
    if (!receiverEmail && updateRes.rows[0].user_id) {
      const userRes = await client.query(
        `SELECT email FROM users WHERE id = $1`,
        [updateRes.rows[0].user_id],
      );
      if (userRes.rows[0]) receiverEmail = userRes.rows[0].email;
    }
    if (updateRes.rows[0].user_id) {
      await client.query(
        `INSERT INTO notifications (user_id, title, content, type, reference_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          updateRes.rows[0].user_id,
          "Có phản hồi mới từ Admin",
          `Yêu cầu #${updateRes.rows[0].ticket_code} của bạn vừa được cập nhật trạng thái: ${statusToUpdate}.`,
          "support",
          ticketId,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      message: "Reply sent successfully",
      reply: replyRes.rows[0],
      ticketCode: updateRes.rows[0].ticket_code,
      receiverEmail,
      statusUpdated: statusToUpdate,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
