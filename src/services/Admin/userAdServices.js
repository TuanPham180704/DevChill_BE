import pool from "../../config/db.js";
import bcrypt from "bcrypt";
import { sendLockEmail } from "../../utils/sendLockEmail.js";
import { sendUnlockEmail } from "../../utils/sendUnlockEmail.js";

const SALT = 10;

/* =========================
   GET ALL USERS
========================= */
export async function getAllUsers({ page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;

  const res = await pool.query(
    `
    SELECT id, username, email, gender, avatar_url,
           role, is_premium, is_active, is_locked
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY id DESC
    LIMIT $1 OFFSET $2
  `,
    [limit, offset],
  );

  return res.rows;
}

/* =========================
   GET USER BY ID
========================= */
export async function getUserById(id) {
  const res = await pool.query(
    `SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL`,
    [id],
  );
  return res.rows[0];
}

/* =========================
   UPDATE USER
========================= */
export async function updateUser(id, data) {
  const fields = [];
  const values = [];
  let index = 1;

  if (data.email) {
    fields.push(`email=$${index++}`);
    values.push(data.email);
  }

  if (data.password) {
    const hash = await bcrypt.hash(data.password, SALT);
    fields.push(`password=$${index++}`);
    values.push(hash);
  }

  if (typeof data.is_premium === "boolean") {
    fields.push(`is_premium=$${index++}`);
    values.push(data.is_premium);
  }

  if (typeof data.is_locked === "boolean") {
    fields.push(`is_locked=$${index++}`);
    values.push(data.is_locked);

    if (data.is_locked === false) {
      fields.push(`lock_until=NULL`);
      fields.push(`block_reason=NULL`);
    }
  }

  if (!fields.length) return null;

  values.push(id);

  const res = await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id=$${index} RETURNING *`,
    values,
  );

  return res.rows[0];
}

/* =========================
   LOCK USER + EMAIL
========================= */
export async function lockUser(id, { lock_until, block_reason }) {
  const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [id]);

  const email = userRes.rows[0]?.email;

  const res = await pool.query(
    `
    UPDATE users
    SET is_locked = TRUE,
        lock_until = $1,
        block_reason = $2,
        blocked_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `,
    [lock_until, block_reason, id],
  );

  // gửi mail
  try {
    await sendLockEmail(email, block_reason, lock_until);
  } catch (err) {
    console.error("Email lock lỗi:", err.message);
  }

  return res.rows[0];
}

/* =========================
   AUTO UNLOCK + EMAIL
========================= */
export async function autoUnlockUsers() {
  const res = await pool.query(`
    UPDATE users
    SET is_locked = FALSE,
        lock_until = NULL,
        block_reason = NULL
    WHERE is_locked = TRUE
      AND lock_until < CURRENT_TIMESTAMP
    RETURNING id, email
  `);

  for (const user of res.rows) {
    try {
      await sendUnlockEmail(user.email);
    } catch (err) {
      console.error("Email unlock lỗi:", err.message);
    }
  }

  return res.rows;
}

export async function unlockUser(id) {
  // Lấy email user
  const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [id]);
  const email = userRes.rows[0]?.email;

  if (!email) throw new Error("Người dùng không tồn tại hoặc chưa có email");

  // Cập nhật DB
  const res = await pool.query(
    `
    UPDATE users
    SET is_locked = FALSE,
        lock_until = NULL,
        block_reason = NULL
    WHERE id = $1
    RETURNING *
  `,
    [id],
  );

  // Gửi email thông báo
  try {
    await sendUnlockEmail(email);
  } catch (err) {
    console.error("Email unlock lỗi:", err.message);
  }

  return res.rows[0];
}
