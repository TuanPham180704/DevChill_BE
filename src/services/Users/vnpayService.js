import crypto from "crypto";
import qs from "qs";
import dayjs from "dayjs";
// Import thêm plugin để xử lý múi giờ chuẩn Việt Nam khi đưa lên Server
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";

// Kích hoạt plugin cho dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

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

export const buildVnpayUrl = ({ orderId, amount, orderInfo }) => {
  const tmn = process.env.VNP_TMNCODE;
  const secret = process.env.VNP_HASH_SECRET;
  const url = process.env.VNP_URL;
  const returnUrl = process.env.VNP_RETURN_URL;

  let params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmn,
    vnp_Amount: amount * 100,
    vnp_CurrCode: "VND",
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: "127.0.0.1",
    vnp_CreateDate: dayjs().tz("Asia/Ho_Chi_Minh").format("YYYYMMDDHHmmss"),
  };
  params = sortObject(params);
  const sign = qs.stringify(params, { encode: false });
  const hash = crypto
    .createHmac("sha512", secret)
    .update(Buffer.from(sign, "utf-8"))
    .digest("hex");
  params.vnp_SecureHash = hash;
  return `${url}?${qs.stringify(params, { encode: false })}`;
};
