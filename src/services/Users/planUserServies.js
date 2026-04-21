import pool from "../../config/db.js";

export const getAllPlansService = async () => {
  const result = await pool.query(
    "SELECT * FROM plans WHERE status = 'active'",
  );
  return result.rows;
};

export const getPlanByIdService = async (id) => {
  const result = await pool.query(
    "SELECT * FROM plans WHERE id = $1 AND status = 'active'",
    [id],
  );
  return result.rows[0];
};

export const getMySubscriptionService = async (userId) => {
  const result = await pool.query(
    `SELECT s.*, p.name FROM subscriptions s 
     JOIN plans p ON p.id = s.plan_id 
     WHERE s.user_id = $1 AND s.status = 'active'
     LIMIT 1`,
    [userId],
  );

  const sub = result.rows[0];
  if (!sub) return null;

  const now = new Date();
  const endDate = new Date(sub.end_date);
  const diffTime = endDate - now;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    ...sub,
    days_left: daysLeft > 0 ? daysLeft : 0,
    should_warn: daysLeft <= 3 && daysLeft > 0,
  };
};

export const getPaymentStatusService = async (txnRef) => {
  const result = await pool.query(
    "SELECT * FROM payments WHERE vnp_txn_ref = $1",
    [txnRef],
  );

  return result.rows[0];
};

export const getPaymentHistoryService = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM payments
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  return result.rows;
};

export const processSuccessfulPaymentService = async (
  userId,
  planId,
  planDurationDays,
) => {
  const activeSub = await pool.query(
    "SELECT * FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1",
    [userId],
  );

  let newEndDate;
  let subscriptionId;

  if (activeSub.rows.length > 0) {
    subscriptionId = activeSub.rows[0].id; 
    const currentEndDate = new Date(activeSub.rows[0].end_date);
    currentEndDate.setDate(currentEndDate.getDate() + planDurationDays);
    newEndDate = currentEndDate;

    await pool.query(
      "UPDATE subscriptions SET end_date = $1, plan_id = $2 WHERE id = $3",
      [newEndDate, planId, subscriptionId],
    );
  } else {
    newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + planDurationDays);

    const insertResult = await pool.query(
      "INSERT INTO subscriptions (user_id, plan_id, end_date, status) VALUES ($1, $2, $3, 'active') RETURNING id",
      [userId, planId, newEndDate],
    );
    subscriptionId = insertResult.rows[0].id;
  }

  return { id: subscriptionId };
};
