// services/admin/paymentService.js
import pool from "../../config/db.js";

export const getAllPaymentsService = async (filters) => {
  const { status, user_id, search, sort_by, order } = filters;

  let query = `
    SELECT p.*, u.username, pl.name as plan_name
    FROM payments p
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN plans pl ON pl.id = p.plan_id
    WHERE 1=1
  `;
  const values = [];

  if (status) {
    values.push(status);
    query += ` AND p.status = $${values.length}`;
  }

  if (user_id) {
    values.push(user_id);
    query += ` AND p.user_id = $${values.length}`;
  }

  if (search) {
    values.push(`%${search}%`);
    query += ` AND (p.vnp_txn_ref ILIKE $${values.length} OR u.username ILIKE $${values.length})`;
  }
  const ALLOWED_SORT_COLUMNS = {
    id: "p.id",
    amount: "p.amount",
    status: "p.status",
    vnp_txn_ref: "p.vnp_txn_ref",
    created_at: "p.created_at",
    username: "u.username",
    plan_name: "pl.name",
  };

  const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "p.created_at";
  const sortDirection = (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  query += ` ORDER BY ${sortColumn} ${sortDirection} NULLS LAST`;

  const result = await pool.query(query, values);
  return result.rows;
};

export const getPaymentByIdService = async (id) => {
  const result = await pool.query(
    `SELECT p.*, u.username, pl.name as plan_name
     FROM payments p
     LEFT JOIN users u ON u.id = p.user_id
     LEFT JOIN plans pl ON pl.id = p.plan_id
     WHERE p.id = $1`,
    [id],
  );

  return result.rows[0];
};

export const verifyPaymentService = async (paymentId, adminId, note) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const paymentRes = await client.query(
      `SELECT * FROM payments WHERE id = $1`,
      [paymentId],
    );
    const payment = paymentRes.rows[0];
    if (!payment) throw new Error("Payment not found");

    if (payment.status === "success") {
      throw new Error("Payment already verified");
    }
    const planRes = await client.query(
      `SELECT duration_days FROM plans WHERE id = $1`,
      [payment.plan_id],
    );

    if (!planRes.rows[0]) {
      throw new Error("Plan not found");
    }

    const duration = planRes.rows[0].duration_days;
    const latestSub = await client.query(
      `SELECT end_date FROM subscriptions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY end_date DESC LIMIT 1`,
      [payment.user_id],
    );

    let newStartDate = new Date();

    if (
      latestSub.rows.length > 0 &&
      new Date(latestSub.rows[0].end_date) > new Date()
    ) {
      newStartDate = new Date(latestSub.rows[0].end_date);
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newEndDate.getDate() + duration);
    const subRes = await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id`,
      [payment.user_id, payment.plan_id, newStartDate, newEndDate],
    );

    const newSubId = subRes.rows[0].id;
    await client.query(
      `UPDATE payments
       SET status = 'success',
           verified_by_admin = $1,
           verified_at = NOW(),
           note = $2,
           paid_at = NOW(),
           subscription_id = $3,
           failure_reason = NULL -- THÊM MỚI: Xóa lỗi nếu Admin duyệt tay thành công
       WHERE id = $4`,
      [adminId, note, newSubId, paymentId],
    );
    await client.query(
      `UPDATE users
       SET is_premium = true
       WHERE id = $1`,
      [payment.user_id],
    );
    await client.query("COMMIT");
    return {
      message: "Payment verified successfully",
      subscription_id: newSubId,
      start_date: newStartDate,
      end_date: newEndDate,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};
