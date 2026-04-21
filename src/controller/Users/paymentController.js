import pool from "../../config/db.js";
import { buildVnpayUrl } from "../../services/Users/vnpayService.js";

export const createPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    const plan = await pool.query(
      `SELECT * FROM plans WHERE id=$1 AND status='active'`,
      [planId],
    );

    if (!plan.rows[0]) {
      return res.status(400).json({
        message: "Gói không hợp lệ",
      });
    }

    const orderId = `ORDER_${Date.now()}`;

    await pool.query(
      `INSERT INTO payments(user_id, plan_id, amount, status, vnp_txn_ref)
       VALUES($1,$2,$3,'pending',$4)`,
      [userId, planId, plan.rows[0].price, orderId],
    );

    const url = buildVnpayUrl({
      orderId,
      amount: plan.rows[0].price,
      orderInfo: `Thanh toan ${plan.rows[0].name}`,
    });

    return res.json({
      message: "Tạo thanh toán thành công",
      vnpUrl: url,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Lỗi payment",
      error: err.message,
    });
  }
};
