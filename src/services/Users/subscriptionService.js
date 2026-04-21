import pool from "../../config/db.js";

export const createSubscriptionService = async (userId, planId, days) => {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);

  const res = await pool.query(
    `
    INSERT INTO subscriptions(user_id, plan_id, start_date, end_date, status)
    VALUES($1,$2,$3,$4,'active')
    RETURNING *
    `,
    [userId, planId, start, end],
  );

  return res.rows[0];
};

export const expireSubscriptionsService = async () => {
  const res = await pool.query(`
    UPDATE subscriptions
    SET status='expired'
    WHERE status='active'
    AND end_date < NOW()
    RETURNING *
  `);

  return res.rowCount;
};

export const revokePremiumUsersService = async () => {
  await pool.query(`
    UPDATE users
    SET is_premium = false
    WHERE id IN (
      SELECT user_id FROM subscriptions WHERE status = 'expired'
    )
    AND id NOT IN (
      -- Loại trừ những user VẪN CÒN gói active chưa hết hạn
      SELECT user_id FROM subscriptions WHERE status = 'active' AND end_date > NOW()
    )
  `);
};
