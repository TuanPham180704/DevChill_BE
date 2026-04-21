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
  const allActiveSubs = await pool.query(
    `SELECT s.id, s.plan_id, s.start_date, s.end_date, s.status, p.name 
     FROM subscriptions s 
     JOIN plans p ON p.id = s.plan_id 
     WHERE s.user_id = $1 AND s.status = 'active' AND s.end_date > NOW()
     ORDER BY s.start_date ASC`,
    [userId],
  );
  if (allActiveSubs.rows.length === 0) return null;
  const now = new Date();
  const maxEndDate = new Date(
    allActiveSubs.rows[allActiveSubs.rows.length - 1].end_date,
  );
  const diffTime = maxEndDate - now;
  const totalDaysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const currentPlan = allActiveSubs.rows[0];
  const upcomingPlans = allActiveSubs.rows.slice(1);
  return {
    total_days_left: totalDaysLeft > 0 ? totalDaysLeft : 0,
    max_end_date: maxEndDate,
    should_warn: totalDaysLeft <= 3 && totalDaysLeft > 0,
    current_plan: currentPlan,
    upcoming_plans: upcomingPlans,
    all_details: allActiveSubs.rows,
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
  const latestSub = await pool.query(
    `SELECT end_date FROM subscriptions 
     WHERE user_id = $1 AND status = 'active' 
     ORDER BY end_date DESC LIMIT 1`,
    [userId],
  );

  let newStartDate = new Date();
  if (
    latestSub.rows.length > 0 &&
    new Date(latestSub.rows[0].end_date) > new Date()
  ) {
    newStartDate = new Date(latestSub.rows[0].end_date);
  }
  const newEndDate = new Date(newStartDate);
  newEndDate.setDate(newEndDate.getDate() + planDurationDays);
  const insertResult = await pool.query(
    `INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, status) 
     VALUES ($1, $2, $3, $4, 'active') RETURNING id`,
    [userId, planId, newStartDate, newEndDate],
  );

  return { id: insertResult.rows[0].id };
};
