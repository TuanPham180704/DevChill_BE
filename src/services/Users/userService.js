import pool from "../../config/db.js";
import bcrypt from "bcrypt";

const SALT = 10;
export const getProfile = async (userId) => {
  const res = await pool.query(
    `SELECT id, username, email, gender, avatar_url, is_premium,
            TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date
     FROM users
     WHERE id=$1 AND deleted_at IS NULL`,
    [userId],
  );

  if (!res.rows.length) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  return res.rows[0];
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
