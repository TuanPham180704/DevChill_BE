import nodemailer from "nodemailer";

export const sendLockEmail = async (toEmail, reason, lockUntil) => {
  if (!toEmail) throw new Error("Không có email người nhận");

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const unlockTime = new Date(lockUntil).toLocaleString("vi-VN");

    const emailText = `
Xin chào ${toEmail},

Tài khoản của bạn trên DevChill đã bị khóa bởi quản trị viên.

Lý do:${reason}

Thời gian mở khóa:${unlockTime}

Trong thời gian này, bạn sẽ không thể đăng nhập vào hệ thống.

Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ với chúng tôi.

Trân trọng,
DevChill
`;

    const emailHtml = `
      <h1>DevChill</h1>
      <p>Xin chào <b>${toEmail}</b>,</p>
      <p>Tài khoản của bạn đã bị <span style="color:red;"><b>KHÓA</b></span>.</p>

      <p><b>Lý do:</b></p>
      <p>${reason}</p>

      <p><b>Thời gian mở khóa:</b></p>
      <p style="color:#1e90ff;">${unlockTime}</p>

      <p>Trong thời gian này, bạn sẽ không thể sử dụng tài khoản.</p>

      <p>Nếu có thắc mắc, vui lòng liên hệ hỗ trợ.</p>

      <p>DevChill — KaiJun</p>
    `;

    await transporter.sendMail({
      from: `"DevChill" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Tài khoản của bạn đã bị khóa",
      text: emailText,
      html: emailHtml,
    });

    console.log(`Đã gửi email khóa tài khoản tới ${toEmail}`);
  } catch (err) {
    console.error("Gửi email thất bại:", err);
    throw new Error("Không thể gửi email");
  }
};
