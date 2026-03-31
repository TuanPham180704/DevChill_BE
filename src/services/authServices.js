import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendRegisterCodeEmail } from "../utils/sendRegisterCodeEmail.js";
import { sendResetEmail } from "../utils/sendResetEmail.js";

const SALT = 10;
export const register = async (username, email, password, confirmPassword) => {
  if (password !== confirmPassword) {
    throw new Error("Mật khẩu nhập lại không khớp");
  }

  const exist = await pool.query("SELECT id FROM users WHERE email=$1", [
    email,
  ]);
  if (exist.rows.length) throw new Error("Email đã tồn tại");
  const hashed = await bcrypt.hash(password, SALT);
  await pool.query(
    `INSERT INTO users (username,email,password,is_active)
     VALUES ($1,$2,$3,false)`,
    [username, email, hashed],
  );

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  await pool.query(
    `INSERT INTO email_verifications (email,code,expires_at)
     VALUES ($1,$2,$3)`,
    [email, code, expires],
  );

  await sendRegisterCodeEmail(email, code);

  return { message: "Đã gửi OTP" };
};

export const verifyOtp = async (email, code) => {
  const res = await pool.query(
    `SELECT * FROM email_verifications 
     WHERE email=$1 AND code=$2
     ORDER BY created_at DESC LIMIT 1`,
    [email, code],
  );

  if (!res.rows.length) throw new Error("OTP không đúng");

  const record = res.rows[0];

  if (new Date(record.expires_at) < new Date()) {
    throw new Error("OTP đã hết hạn");
  }

  await pool.query("UPDATE users SET is_active=true WHERE email=$1", [email]);

  await pool.query("DELETE FROM email_verifications WHERE email=$1", [email]);

  return { message: "Xác thực thành công" };
};

export const resendOtp = async (email) => {
  const user = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (!user.rows.length) throw new Error("Email không tồn tại");
  const existing = await pool.query(
    "SELECT expires_at FROM email_verifications WHERE email=$1",
    [email],
  );
  if (existing.rows.length) {
    const expiresAt = new Date(existing.rows[0].expires_at);
    const now = new Date();
    if (expiresAt > now) {
      const remaining = Math.ceil((expiresAt - now) / 1000);
      throw new Error(`Vui lòng đợi ${remaining}s trước khi gửi lại OTP`);
    }
    await pool.query("DELETE FROM email_verifications WHERE email=$1", [email]);
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(
    `INSERT INTO email_verifications (email,code,expires_at)
     VALUES ($1,$2,$3)`,
    [email, code, expires],
  );

  await sendRegisterCodeEmail(email, code);

  return { message: "Đã gửi lại OTP" };
};

export const login = async (email, password) => {
  const res = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (!res.rows.length) throw new Error("Sai email hoặc mật khẩu");

  const user = res.rows[0];

  if (!user.is_active) throw new Error("Chưa xác thực email");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Sai email hoặc mật khẩu");

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  return { token, user };
};

export const forgotPassword = async (email) => {
  const res = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (!res.rows.length) throw new Error("Email không tồn tại");

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 60 * 1000);

  await pool.query(
    "UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3",
    [token, expires, email],
  );

  await sendResetEmail(email, token);

  return { message: "Đã gửi mail reset password" };
};
export const resetPassword = async (token, newPassword) => {
  const res = await pool.query(
    "SELECT id, reset_token_expires FROM users WHERE reset_token=$1",
    [token],
  );

  if (!res.rows.length) throw new Error("Token không hợp lệ");

  const user = res.rows[0];

  if (new Date(user.reset_token_expires) < new Date()) {
    throw new Error("Token hết hạn");
  }

  const hashed = await bcrypt.hash(newPassword, SALT);

  await pool.query(
    `UPDATE users 
     SET password=$1, reset_token=NULL, reset_token_expires=NULL 
     WHERE id=$2`,
    [hashed, user.id],
  );

  return { message: "Reset password thành công" };
};
