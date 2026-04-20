import crypto from "crypto";
import qs from "qs";
import pool from "../../config/db.js";
import { createSubscriptionService } from "../../services/Users/subscriptionService.js";
import dotenv from "dotenv";
dotenv.config();

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

export const vnpayIPN = async (req, res) => {
  try {
    const originalParams = { ...req.query };
    let vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    vnp_Params = sortObject(vnp_Params);
    const sign = qs.stringify(vnp_Params, { encode: false });
    const check = crypto
      .createHmac("sha512", process.env.VNP_HASH_SECRET)
      .update(Buffer.from(sign, "utf-8"))
      .digest("hex");

    if (check !== secureHash) {
      return res.json({ RspCode: "97", Message: "Sai chữ ký" });
    }

    const txnRef = originalParams.vnp_TxnRef;
    const code = originalParams.vnp_ResponseCode;
    const transactionNo = originalParams.vnp_TransactionNo || null;
    const bankCode = originalParams.vnp_BankCode || null;

    const paymentResult = await pool.query(
      `SELECT * FROM payments WHERE vnp_txn_ref=$1`,
      [txnRef],
    );
    const payment = paymentResult.rows[0];

    if (!payment) {
      return res.json({ RspCode: "01", Message: "Không tồn tại đơn hàng" });
    }
    if (payment.status !== "pending") {
      return res.json({
        RspCode: "02",
        Message: "Đơn hàng đã được cập nhật trước đó",
      });
    }

    if (code === "00") {
      await pool.query(
        `UPDATE payments 
         SET status = 'success', 
             vnp_transaction_no = $1,
             vnp_response_code = $2,
             vnp_bank_code = $3,
             paid_at = NOW(),
             raw_response = $4
         WHERE vnp_txn_ref = $5`,
        [transactionNo, code, bankCode, JSON.stringify(originalParams), txnRef],
      );
      await pool.query(`UPDATE users SET is_premium = true WHERE id = $1`, [
        payment.user_id,
      ]);
      const planResult = await pool.query(`SELECT * FROM plans WHERE id=$1`, [
        payment.plan_id,
      ]);
      const plan = planResult.rows[0];
      const newSub = await createSubscriptionService(
        payment.user_id,
        payment.plan_id,
        plan.duration_days,
      );
      await pool.query(
        `UPDATE payments 
         SET subscription_id = $1, 
             payment_method = 'VNPAY',
             transaction_code = $2
         WHERE vnp_txn_ref = $3`,
        [newSub.id, transactionNo, txnRef],
      );
    } else {
      await pool.query(
        `UPDATE payments 
         SET status = 'failed', vnp_response_code = $1, raw_response = $2
         WHERE vnp_txn_ref = $3`,
        [code, JSON.stringify(originalParams), txnRef],
      );
    }

    return res.json({ RspCode: "00", Message: "OK" });
  } catch (err) {
    console.error("IPN Error:", err);
    return res.status(500).json({ RspCode: "99", Message: "Lỗi hệ thống" });
  }
};
