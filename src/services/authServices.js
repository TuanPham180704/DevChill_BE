import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendRegisterCodeEmail } from "../utils/sendRegisterCodeEmail.js";
import { sendResetEmail } from "../utils/sendResetEmail.js";

const SALT = 10;
export const register = async (username, email, password, confirmPassword) => {
  try {
    if (password !== confirmPassword) {
      const err = new Error("Mật khẩu nhập lại không khớp");
      err.status = 400;
      throw err;
    }

    const exist = await pool.query(
      "SELECT id, is_active FROM users WHERE email=$1",
      [email],
    );
    if (exist.rows.length) {
      const user = exist.rows[0];
      if (user.is_active) {
        const err = new Error("Email đã tồn tại");
        err.status = 400;
        throw err;
      }
      const existingOtp = await pool.query(
        `SELECT * FROM email_verifications
         WHERE email=$1
         ORDER BY created_at DESC
         LIMIT 1`,
        [email],
      );

      if (existingOtp.rows.length) {
        const expiresAt = new Date(existingOtp.rows[0].expires_at);
        const now = new Date();

        if (expiresAt > now) {
          const remaining = Math.ceil((expiresAt - now) / 1000);
          const err = new Error(
            `Vui lòng đợi ${remaining}s trước khi gửi lại OTP`,
          );
          err.status = 400;
          throw err;
        }
      }
      await pool.query("DELETE FROM email_verifications WHERE email=$1", [
        email,
      ]);

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 5 * 60 * 1000);

      await pool.query(
        `INSERT INTO email_verifications (email,code,expires_at)
         VALUES ($1,$2,$3)`,
        [email, code, expires],
      );

      await sendRegisterCodeEmail(email, code);

      return {
        message: "Email chưa xác thực, đã gửi lại OTP",
        otp_expire: expires,
      };
    }
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

    return { message: "Đã gửi OTP", otp_expire: expires };
  } catch (error) {
    throw error;
  }
};
export const verifyOtp = async (email, code) => {
  try {
    const res = await pool.query(
      `SELECT * FROM email_verifications 
       WHERE email=$1 AND code=$2
       ORDER BY created_at DESC LIMIT 1`,
      [email, code],
    );
    if (!res.rows.length) {
      const err = new Error("OTP không đúng");
      err.status = 400;
      throw err;
    }
    const record = res.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      const err = new Error("OTP đã hết hạn");
      err.status = 400;
      throw err;
    }
    await pool.query("UPDATE users SET is_active=true WHERE email=$1", [email]);
    await pool.query("DELETE FROM email_verifications WHERE email=$1", [email]);

    return { message: "Xác thực thành công" };
  } catch (error) {
    throw error;
  }
};
export const resendOtp = async (email) => {
  try {
    const user = await pool.query("SELECT id FROM users WHERE email=$1", [
      email,
    ]);

    if (!user.rows.length) {
      const err = new Error("Email không tồn tại");
      err.status = 404;
      throw err;
    }
    const existing = await pool.query(
      `SELECT * FROM email_verifications 
       WHERE email=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    );
    if (existing.rows.length) {
      const expiresAt = new Date(existing.rows[0].expires_at);
      const now = new Date();

      if (expiresAt > now) {
        const remaining = Math.ceil((expiresAt - now) / 1000);
        const err = new Error(
          `Vui lòng đợi ${remaining}s trước khi gửi lại OTP`,
        );
        err.status = 400;
        throw err;
      }
    }
    await pool.query("DELETE FROM email_verifications WHERE email=$1", [email]);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `INSERT INTO email_verifications (email,code,expires_at)
       VALUES ($1,$2,$3)`,
      [email, code, expires],
    );
    await sendRegisterCodeEmail(email, code);
    return { message: "Đã gửi lại OTP", otp_expire: expires };
  } catch (error) {
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    const res = await pool.query("SELECT * FROM users WHERE email=$1", [email]);

    if (!res.rows.length) {
      const err = new Error("Sai email hoặc mật khẩu");
      err.status = 400;
      throw err;
    }

    const user = res.rows[0];

    if (user.is_locked) {
      const err = new Error(
        `Tài khoản đang bị khóa tới ${user.lock_until ? new Date(user.lock_until).toLocaleString("vi-VN") : "thời gian chưa xác định"}`,
      );
      err.status = 403;
      throw err;
    }

    if (!user.is_active) {
      const err = new Error("Tài khoản chưa được kích hoạt");
      err.status = 403;
      throw err;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const err = new Error("Sai email hoặc mật khẩu");
      err.status = 400;
      throw err;
    }
    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_premium: user.is_premium,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" },
    );
    await pool.query("UPDATE users SET refresh_token=$1 WHERE id=$2", [
      refreshToken,
      user.id,
    ]);
    return {
      accessToken: accessToken,
      refreshToken,
      user,
    };
  } catch (error) {
    throw error;
  }
};
export const refreshTokenService = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const res = await pool.query("SELECT * FROM users WHERE id=$1", [
      decoded.id,
    ]);

    const user = res.rows[0];

    if (!user || user.refresh_token !== refreshToken) {
      throw new Error("Refresh token không hợp lệ");
    }

    const newAccessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        is_premium: user.is_premium,
        username: user.username,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    return { accessToken: newAccessToken };
  } catch (err) {
    throw err;
  }
};
export const forgotPassword = async (email) => {
  try {
    const res = await pool.query(
      "SELECT id, reset_token_expires FROM users WHERE email=$1",
      [email],
    );

    if (!res.rows.length) {
      const err = new Error("Email không tồn tại");
      err.status = 404;
      throw err;
    }

    const user = res.rows[0];
    if (user.reset_token_expires) {
      const now = new Date();
      const expiresAt = new Date(user.reset_token_expires);

      if (expiresAt > now) {
        const remaining = Math.ceil((expiresAt - now) / 1000);
        const err = new Error(
          `Vui lòng đợi ${remaining}s trước khi gửi lại email reset`,
        );
        err.status = 400;
        throw err;
      }
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await pool.query(
      `UPDATE users 
       SET reset_token=$1, reset_token_expires=$2 
       WHERE email=$3`,
      [token, expires, email],
    );
    await sendResetEmail(email, token);
    return { message: "Đã gửi mail reset password", expires };
  } catch (error) {
    throw error;
  }
};
export const resetPassword = async (token, newPassword) => {
  try {
    const res = await pool.query(
      "SELECT id, reset_token_expires FROM users WHERE reset_token=$1",
      [token],
    );
    if (!res.rows.length) {
      const err = new Error("Token không hợp lệ");
      err.status = 400;
      throw err;
    }
    const user = res.rows[0];
    if (new Date(user.reset_token_expires) < new Date()) {
      const err = new Error("Token hết hạn");
      err.status = 400;
      throw err;
    }

    const hashed = await bcrypt.hash(newPassword, SALT);
    await pool.query(
      `UPDATE users 
       SET password=$1, reset_token=NULL, reset_token_expires=NULL 
       WHERE id=$2`,
      [hashed, user.id],
    );

    return { message: "Reset password thành công" };
  } catch (error) {
    throw error;
  }
};
