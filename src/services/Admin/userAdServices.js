import pool from "../../config/db.js";
import bcrypt from "bcrypt";
import validator from "validator";
import { sendLockEmail } from "../../utils/sendLockEmail.js";
import { sendUnlockEmail } from "../../utils/sendUnlockEmail.js";

const SALT = 10;

export async function getAllUsers({
  page = 1,
  limit = 10,
  sort_by,
  order,
}) {
  const offset = (page - 1) * limit;
  const ALLOWED_SORT_COLUMNS = {
    id: "id",
    username: "username",
    email: "email",
    role: "role",
    is_premium: "is_premium",
    is_active: "is_active",
    created_at: "created_at",
  };
  const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "id";
  const sortDirection = (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const dataRes = await pool.query(
    `
    SELECT id, username, email, gender, avatar_url,
           role, is_premium, is_active, is_locked, block_reason, lock_until,
           created_at, updated_at
    FROM users
    WHERE deleted_at IS NULL
    ORDER BY ${sortColumn} ${sortDirection} NULLS LAST
    LIMIT $1 OFFSET $2
  `,
    [limit, offset],
  );

  const countRes = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM users
    WHERE deleted_at IS NULL
  `,
  );

  return {
    data: dataRes.rows,
    total: Number(countRes.rows[0].total),
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(countRes.rows[0].total / limit),
  };
}

export async function getUserById(id) {
  const res = await pool.query(
    `SELECT * FROM users WHERE id=$1 AND deleted_at IS NULL`,
    [id],
  );
  return res.rows[0];
}

export async function updateUser(id, data) {
  const fields = [];
  const values = [];
  let index = 1;
  if (data.email) {
    if (!validator.isEmail(data.email)) {
      const err = new Error("Email không hợp lệ");
      err.status = 400;
      throw err;
    }
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [data.email, id],
    );

    if (existing.rows.length > 0) {
      const err = new Error("Email đã tồn tại");
      err.status = 409;
      throw err;
    }

    fields.push(`email=$${index++}`);
    values.push(data.email);
  }

  if (data.password) {
    if (data.password.length < 8) {
      const err = new Error("Password phải >= 8 ký tự");
      err.status = 400;
      throw err;
    }
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
  if (data.role && ["user", "admin"].includes(data.role)) {
    fields.push(`role=$${index++}`);
    values.push(data.role);
  }
  if (!fields.length) {
    const err = new Error("No fields to update");
    err.status = 400;
    throw err;
  }
  values.push(id);
  try {
    const res = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id=$${index} RETURNING *`,
      values,
    );
    if (res.rows.length === 0) {
      const err = new Error("User không tồn tại");
      err.status = 404;
      throw err;
    }

    return res.rows[0];
  } catch (error) {
    if (error.code === "23505") {
      const err = new Error("Email đã tồn tại");
      err.status = 409;
      throw err;
    }
    throw error;
  }
}

export async function lockUser(id, { lock_until, block_reason }) {
  let formattedLockUntil = null;

  if (lock_until && lock_until.trim() !== "") {
    const lockDate = new Date(lock_until);
    const now = new Date();

    if (isNaN(lockDate.getTime())) {
      const err = new Error("Ngày khóa không hợp lệ");
      err.status = 400;
      throw err;
    }

    if (lockDate <= now) {
      const err = new Error("Ngày khóa phải lớn hơn thời gian hiện tại");
      err.status = 400;
      throw err;
    }

    formattedLockUntil = lockDate;
  }

  const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [id]);
  const email = userRes.rows[0]?.email;

  if (!email) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

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
    [formattedLockUntil, block_reason, id],
  );

  try {
    await sendLockEmail(email, block_reason, formattedLockUntil);
  } catch (err) {
    console.error("Email lock lỗi:", err.message);
  }

  return res.rows[0];
}

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
  const userRes = await pool.query(`SELECT email FROM users WHERE id=$1`, [id]);
  if (userRes.rows.length === 0) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }
  const email = userRes.rows[0]?.email;
  if (!email) {
    const err = new Error("Người dùng không tồn tại hoặc chưa có email");
    err.status = 404;
    throw err;
  }

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

  try {
    await sendUnlockEmail(email);
  } catch (err) {
    console.error("Email unlock lỗi:", err.message);
  }

  return res.rows[0];
}
