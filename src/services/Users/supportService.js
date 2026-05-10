import pool from "../../config/db.js";

export const createTicketService = async (data, user) => {
  const { category, description, guest_email, attachments = [] } = data;
  let priority = "low";
  if (category.includes("Thanh toán") || category.includes("Premium"))
    priority = "high";
  else if (category.includes("Tài khoản") || category.includes("Đăng nhập"))
    priority = "medium";

  const ticketCode = `DC-${Math.floor(100000 + Math.random() * 900000)}`;
  const userId = user ? user.id : null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticketRes = await client.query(
      `INSERT INTO support_requests (ticket_code, user_id, guest_email, category, description, attachments, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        ticketCode,
        userId,
        guest_email,
        category,
        description,
        attachments,
        priority,
      ],
    );

    let emailToSend = guest_email;
    if (userId) {
      const userRes = await client.query(
        `SELECT email FROM users WHERE id = $1`,
        [userId],
      );
      emailToSend = userRes.rows[0].email;

      await client.query(
        `INSERT INTO notifications (user_id, title, content, type, reference_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          "Đã gửi yêu cầu hỗ trợ",
          `Hệ thống đã nhận yêu cầu "${category}" của bạn. Mã vé: ${ticketCode}.`,
          "support",
          ticketRes.rows[0].id,
        ],
      );
    }

    await client.query("COMMIT");
    return { ticket: ticketRes.rows[0], emailToSend, isGuest: !userId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const getUserTicketsService = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM support_requests WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
};
export const getUserNotificationsService = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
  return result.rows;
};

export const replyTicketClientService = async (
  ticketId,
  userId,
  contentResponse,
  attachments = [],
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const ticketRes = await client.query(
      `SELECT * FROM support_requests WHERE id = $1 AND user_id = $2`,
      [ticketId, userId],
    );

    if (ticketRes.rows.length === 0) {
      throw new Error(
        "Không tìm thấy vé hỗ trợ hoặc bạn không có quyền truy cập",
      );
    }
    const replyRes = await client.query(
      `INSERT INTO support_responses (request_id, sender_id, is_admin_reply, content_response, attachments)
       VALUES ($1, $2, false, $3, $4) RETURNING *`,
      [ticketId, userId, contentResponse, attachments],
    );
    await client.query(
      `UPDATE support_requests 
       SET status = 'open', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [ticketId],
    );

    await client.query("COMMIT");

    return {
      success: true,
      reply: replyRes.rows[0],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
export const getTicketDetailClientService = async (ticketId, userId) => {
  const ticketRes = await pool.query(
    `SELECT * FROM support_requests WHERE id = $1 AND user_id = $2`,
    [ticketId, userId],
  );

  if (ticketRes.rows.length === 0) {
    throw new Error("Không tìm thấy vé hỗ trợ hoặc bạn không có quyền xem!");
  }
  const responsesRes = await pool.query(
    `SELECT * FROM support_responses WHERE request_id = $1 ORDER BY created_at ASC`,
    [ticketId],
  );
  return {
    ...ticketRes.rows[0],
    responses: responsesRes.rows,
  };
};

export const markNotificationReadClientService = async (notifId, userId) => {
  const result = await pool.query(
    `UPDATE notifications 
     SET is_read = true 
     WHERE id = $1 AND user_id = $2 
     RETURNING *`,
    [notifId, userId],
  );

  if (result.rows.length === 0) {
    throw new Error(
      "Không tìm thấy thông báo hoặc bạn không có quyền thao tác!",
    );
  }

  return result.rows[0];
};
export const closeTicketClientService = async (ticketId, userId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ticketCheck = await client.query(
      `SELECT status FROM support_requests WHERE id = $1 AND user_id = $2`,
      [ticketId, userId],
    );

    if (ticketCheck.rows.length === 0) {
      throw new Error(
        "Không tìm thấy vé hỗ trợ hoặc bạn không có quyền thao tác!",
      );
    }

    if (ticketCheck.rows[0].status === "closed") {
      throw new Error("Vé hỗ trợ này đã được đóng từ trước!");
    }
    const updatedTicket = await client.query(
      `UPDATE support_requests 
       SET status = 'closed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [ticketId, userId],
    );
    await client.query(
      `INSERT INTO support_responses (request_id, sender_id, is_admin_reply, content_response)
       VALUES ($1, $2, false, $3)`,
      [
        ticketId,
        userId,
        "Hệ thống: Khách hàng đã chủ động đóng vé hỗ trợ này.",
      ],
    );

    await client.query("COMMIT");
    return updatedTicket.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
