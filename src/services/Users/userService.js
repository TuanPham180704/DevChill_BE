import pool from "../../config/db.js";
import bcrypt from "bcrypt";

const SALT = 10;
export const getProfile = async (userId) => {
  const res = await pool.query(
    `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.gender,
      u.avatar_url,
      u.is_premium,
      TO_CHAR(u.birth_date, 'YYYY-MM-DD') AS birth_date,

      s.end_date AS subscription_end_date,
      s.start_date AS subscription_start_date,
      s.status AS subscription_status,

      p.name AS plan_name
    FROM users u
    LEFT JOIN subscriptions s 
      ON s.user_id = u.id 
      AND s.status = 'active'
      AND s.end_date >= NOW()
    LEFT JOIN plans p 
      ON p.id = s.plan_id
    WHERE u.id = $1 
      AND u.deleted_at IS NULL
    ORDER BY s.end_date DESC
    LIMIT 1
    `,
    [userId],
  );

  if (!res.rows.length) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const user = res.rows[0];
  if (!user.subscription_end_date) {
    return {
      ...user,
      premium_message: "Bạn chưa có gói Premium",
      remaining_days: 0,
    };
  }
  const now = new Date();
  const end = new Date(user.subscription_end_date);
  const diffMs = end - now;
  const remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  let premium_message = "";
  if (remainingDays <= 0) {
    premium_message = "Gói Premium đã hết hạn, hãy gia hạn";
  } else if (remainingDays <= 3) {
    premium_message = `Còn ${remainingDays} ngày, hãy gia hạn gói Premium`;
  } else {
    premium_message = `Gói Premium còn ${remainingDays} ngày`;
  }
  return {
    ...user,
    remaining_days: remainingDays,
    premium_message,
  };
};
export const updateProfile = async (
  userId,
  username,
  gender,
  avatar_url,
  birth_date,
) => {
  const res = await pool.query(
    `UPDATE users
   SET username=$1,
       gender=$2,
       avatar_url=$3,
       birth_date=$4::date
   WHERE id=$5
   RETURNING id, username, email, gender, avatar_url, birth_date`,
    [username, gender, avatar_url, birth_date ? birth_date : null, userId],
  );

  if (!res.rows.length) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  return res.rows[0];
};
export const changePassword = async (userId, oldPassword, newPassword) => {
  const res = await pool.query(`SELECT password FROM users WHERE id=$1`, [
    userId,
  ]);

  if (!res.rows.length) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const user = res.rows[0];
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) {
    const err = new Error("Old password is incorrect");
    err.status = 400;
    throw err;
  }

  const hashed = await bcrypt.hash(newPassword, SALT);
  await pool.query(`UPDATE users SET password=$1 WHERE id=$2`, [
    hashed,
    userId,
  ]);

  return { message: "Password changed successfully" };
};
