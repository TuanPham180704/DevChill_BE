import nodemailer from "nodemailer";

export const sendResetEmail = async (toEmail, token) => {
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
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const emailText = `
Xin chào ${toEmail},

Chúng tôi nhận được yêu cầu thiết lập lại mật khẩu cho tài khoản của bạn trên DevChill. 
Nếu bạn đã yêu cầu điều này, vui lòng nhấp vào liên kết bên dưới để thiết lập lại mật khẩu của bạn:

${resetLink}

Lưu ý:
- Liên kết sẽ hết hạn sau 30 phút kể từ thời điểm yêu cầu.
- Nếu bạn không yêu cầu thiết lập lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn an toàn và không có thay đổi nào được thực hiện.
- Nếu cần hỗ trợ thêm, hãy liên hệ với chúng tôi qua Telegram.

Cảm ơn bạn đã sử dụng DevChill!
`;

    const emailHtml = `
    <h1>DevChill</h1>
    <p>Xin chào ${toEmail},</p>
    <p>Chúng tôi nhận được yêu cầu thiết lập lại mật khẩu cho tài khoản của bạn trên <b>DevChill</b>.</p>
    <p>Nếu bạn đã yêu cầu, vui lòng nhấp vào liên kết bên dưới để thiết lập lại mật khẩu:</p>
    <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#1e90ff;color:#fff;text-decoration:none;border-radius:5px;">Thiết lập lại mật khẩu</a></p>
    <p>Lưu ý:</p>
    <ul>
    <li>Liên kết sẽ hết hạn sau 5 phút kể từ thời điểm yêu cầu.</li>
    <li>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</li>
    <li>Nếu cần hỗ trợ thêm, hãy liên hệ với chúng tôi qua Telegram.</li>
   </ul>
    <p>Cảm ơn bạn đã sử dụng DevChill!</p>
    <p>DevChill — Bản quyền nội dung thuộc về KaiJun</p>
`;

    await transporter.sendMail({
      from: `"DevChill" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Thiết lập lại mật khẩu DevChill",
      text: emailText,
      html: emailHtml,
    });

    console.log(`Email gửi đến ${toEmail} thành công`);
  } catch (err) {
    console.error("Gửi email thất bại:", err);
    throw new Error("Không thể gửi email, kiểm tra cấu hình SMTP");
  }
};
