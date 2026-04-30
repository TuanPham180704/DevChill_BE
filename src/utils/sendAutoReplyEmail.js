import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const sendAutoReplyEmail = async (
  toEmail,
  ticketCode,
  category,
  isGuest = false,
) => {
  if (!toEmail) return;

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    const guestNotice = isGuest
      ? `
      <div style="background:#fff8e1; border-left:4px solid #ffc107; padding:15px; margin:25px 0; border-radius:4px 8px 8px 4px;">
        <p style="margin:0; font-size:14px; color:#856404; line-height:1.5;">
          💡 <b>Lưu ý dành cho khách:</b><br/>
          Vì bạn gửi yêu cầu khi chưa đăng nhập, vui lòng lưu lại mã vé <b>#${ticketCode}</b> cùng email này để tra cứu tiến độ xử lý trên website DevChill nhé.
        </p>
      </div>
      `
      : "";
    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05)">
        
        <!-- Header -->
        <div style="background:#1e90ff;color:#fff;padding:25px 20px;text-align:center">
          <h1 style="margin:0;font-size:26px;letter-spacing:1px;">DevChill 🎬</h1>
          <p style="margin:8px 0 0 0;font-size:15px;opacity:0.9;">Trung Tâm Hỗ Trợ Khách Hàng</p>
        </div>

        <!-- Body Content -->
        <div style="padding:30px 25px;color:#333;line-height:1.6;">
          <p style="font-size:16px;">Xin chào,</p>
          
          <p style="font-size:16px;">
            Cảm ơn bạn đã liên hệ. Hệ thống đã tiếp nhận yêu cầu hỗ trợ của bạn với chủ đề: <b>${category}</b>.
          </p>

          <!-- Khối hiển thị Mã Vé (Ticket Code) nổi bật -->
          <div style="text-align:center;margin:35px 0">
            <p style="margin:0 0 10px 0; font-size:14px; color:#666;">Mã yêu cầu của bạn là:</p>
            <span style="
              display:inline-block;
              font-size:28px;
              letter-spacing:3px;
              font-weight:bold;
              color:#1e90ff;
              background:#f0f8ff;
              padding:15px 30px;
              border-radius:8px;
              border: 1px dashed #1e90ff;
            ">
              ${ticketCode}
            </span>
          </div>

          <!-- Thông tin tiến trình -->
          <p style="font-size:15px; margin-top:20px;"><b>⏳ Tiến trình xử lý:</b></p>
          <ul style="font-size:15px; color:#444; padding-left:20px; margin-top:10px;">
            <li style="margin-bottom:8px;">Đội ngũ quản trị viên đang tiến hành kiểm tra thông tin.</li>
            <li style="margin-bottom:8px;">Chúng tôi sẽ phản hồi sớm nhất trong vòng <b>12 đến 24 giờ làm việc</b>.</li>
          </ul>

          ${guestNotice}

          <p style="margin-top:35px; font-size:15px;">
            Trân trọng,<br/>
            <b style="color:#1e90ff; font-size:16px;">Đội ngũ DevChill</b>
          </p>
        </div>

        <!-- Footer -->
        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
          <p style="margin:0 0 5px 0;">Email này được gửi tự động từ hệ thống DevChill. Vui lòng không trả lời trực tiếp.</p>
          <p style="margin:0;">© ${new Date().getFullYear()} DevChill. All rights reserved.</p>
        </div>

      </div>
    `;

    await transporter.sendMail({
      from: `"DevChill Support" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `[DevChill] Tiếp nhận yêu cầu hỗ trợ #${ticketCode}`,
      html: emailHtml,
    });

    console.log(
      `[MAILER] Đã gửi thông báo tạo vé ${ticketCode} tới ${toEmail}`,
    );
  } catch (err) {
    console.error("Lỗi gửi mail tạo vé:", err);
  }
};
