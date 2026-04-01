import pool from "../../config/db.js";
import bcrypt from "bcrypt";

const SALT = 10;

export const getProfile = async (userId) => {
  const res = await pool.query(
    `SELECT id, username, email, gender, avatar_url, is_premium, role
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
  email,
  gender,
  avatar_url,
) => {
  const exist = await pool.query(
    `SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND id != $2`,
    [email, userId],
  );

  if (exist.rows.length) {
    const err = new Error("Email already in use");
    err.status = 400;
    throw err;
  }
  const res = await pool.query(
    `UPDATE users
     SET username=$1,
         email=$2,
         gender=$3,
         avatar_url=$4
     WHERE id=$5
     RETURNING id, username, email, gender, avatar_url`,
    [username, email, gender, avatar_url, userId],
  );
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
