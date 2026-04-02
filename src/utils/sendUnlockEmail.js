import nodemailer from "nodemailer";

export const sendUnlockEmail = async (toEmail) => {
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

    const emailText = `
Xin chào ${toEmail},

Tài khoản của bạn trên DevChill đã được mở khóa.

Bạn có thể đăng nhập và sử dụng lại hệ thống bình thường.

Lưu ý:
Vui lòng tuân thủ các quy định và tiêu chuẩn cộng đồng của DevChill để tránh bị khóa lại trong tương lai.

Trân trọng,
DevChill
`;

    const emailHtml = `
      <h1>DevChill</h1>
      <p>Xin chào <b>${toEmail}</b>,</p>

      <p>Tài khoản của bạn đã được 
        <span style="color:green;"><b>MỞ KHÓA</b></span>.
      </p>

      <p>Bạn có thể đăng nhập và sử dụng lại hệ thống.</p>

      <hr/>

      <p style="color:#ff6600;"><b>Lưu ý quan trọng:</b></p>
      <p>
        Vui lòng tuân thủ các quy định và tiêu chuẩn cộng đồng của DevChill.
        Nếu vi phạm, tài khoản có thể bị khóa lại.
      </p>

      <p>Nếu cần hỗ trợ, vui lòng liên hệ với chúng tôi.</p>

      <p>DevChill — KaiJun</p>
    `;

    await transporter.sendMail({
      from: `"DevChill" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Tài khoản của bạn đã được mở khóa",
      text: emailText,
      html: emailHtml,
    });

    console.log(`Đã gửi email mở khóa tới ${toEmail}`);
  } catch (err) {
    console.error("Gửi email unlock thất bại:", err);
    throw new Error("Không thể gửi email mở khóa");
  }
};
