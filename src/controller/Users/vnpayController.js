import crypto from "crypto";
import qs from "qs";
import pool from "../../config/db.js";
import { processSuccessfulPaymentService } from "../../services/Users/planUserServies.js";
import dotenv from "dotenv";
import cron from "node-cron";

dotenv.config();
cron.schedule("*/5 * * * *", async () => {
  try {
    const result = await pool.query(`
      UPDATE payments 
      SET status = 'expired', 
          failure_reason = 'Hết thời gian thanh toán (Hệ thống tự động hủy)' 
      WHERE status = 'pending' 
        AND created_at < NOW() - INTERVAL '15 minutes'
    `);

    if (result.rowCount > 0) {
      console.log(
        `[Cronjob VNPay] Đã tự động dọn dẹp ${result.rowCount} đơn hàng treo (quá 15 phút).`,
      );
    }
  } catch (error) {
    console.error(
      "[Cronjob VNPay Error] Lỗi khi auto expire giao dịch:",
      error,
    );
  }
});
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

const getVnPayErrorMessage = (vnp_ResponseCode) => {
  switch (vnp_ResponseCode) {
    case "00":
      return "Giao dịch thành công";
    case "07":
      return "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).";
    case "09":
      return "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.";
    case "10":
      return "Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần";
    case "11":
      return "Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.";
    case "12":
      return "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.";
    case "13":
      return "Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).";
    case "24":
      return "Giao dịch không thành công do: Khách hàng hủy giao dịch";
    case "51":
      return "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.";
    case "65":
      return "Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.";
    case "75":
      return "Ngân hàng thanh toán đang bảo trì.";
    case "79":
      return "Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.";
    case "99":
      return "Các lỗi khác (lỗi hệ thống, v.v.)";
    default:
      return "Lỗi không xác định";
  }
};

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

      const newSub = await processSuccessfulPaymentService(
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

      console.log(`[VNPay] Thanh toán thành công cho đơn hàng: ${txnRef}`);
    } else {
      const errorMessage = getVnPayErrorMessage(code);
      let paymentStatus = "failed";

      if (code === "24") {
        paymentStatus = "cancelled";
      } else if (code === "11") {
        paymentStatus = "expired";
      }

      console.log(
        `[VNPay] Giao dịch ${paymentStatus}: Đơn hàng ${txnRef} - Lỗi: ${errorMessage} (Mã: ${code})`,
      );

      await pool.query(
        `UPDATE payments 
         SET status = $1, 
             vnp_response_code = $2, 
             raw_response = $3,
             failure_reason = $4
         WHERE vnp_txn_ref = $5`,
        [
          paymentStatus,
          code,
          JSON.stringify(originalParams),
          errorMessage,
          txnRef,
        ],
      );
    }

    return res.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (err) {
    console.error("IPN Error:", err);
    return res.status(500).json({ RspCode: "99", Message: "Lỗi hệ thống" });
  }
};
