import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../config/db.js";

dotenv.config();

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Token hết hạn hoặc không hợp lệ" });

  const token = authHeader.split(" ")[1];

  try {
    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    const userRes = await pool.query(
      `SELECT id, role, is_premium, is_locked, lock_until, block_reason
       FROM users WHERE id=$1`,
      [decoded.id],
    );

    const user = userRes.rows[0];

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (user.is_locked) {
      let msg = "Tài khoản đã bị khóa";
      if (user.lock_until) {
        msg += ` đến ${user.lock_until.toISOString()}`;
      }
      if (user.block_reason) {
        msg += `, lý do: ${user.block_reason}`;
      }
      return res.status(403).json({ message: msg });
    }
    req.user = {
      ...user,
      is_premium: user.is_premium === true,
    };
    next();
  } catch (error) {
    console.error(error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token hết hạn" });
    }
    return res.status(403).json({ message: "Token không hợp lệ" });
  }
}
export function authenticateOptional(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    next();
  }
}

export function authorization(role = []) {
  return (req, res, next) => {
    if (!role.includes(req.user.role))
      return res.status(403).json({ message: "Không có quyền truy cập" });
    next();
  };
}
