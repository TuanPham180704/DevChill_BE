import nodemailer from "nodemailer";

export const sendSupportReplyEmail = async (
  toEmail,
  ticketCode,
  replyContent,
  statusUpdated,
) => {
  if (!toEmail) return;

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
    const statusMap = {
      open: "Đang chờ xử lý",
      in_progress: "Đang xử lý",
      resolved: "Đã giải quyết",
      closed: "Đã đóng",
    };
    const displayStatus = statusMap[statusUpdated] || statusUpdated;
    const statusColor =
      statusUpdated === "resolved"
        ? "#28a745" 
        : statusUpdated === "in_progress"
          ? "#1e90ff" 
          : "#6c757d";

    const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #eee;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05)">
      
      <!-- Header giống form Register -->
      <div style="background:#1e90ff;color:#fff;padding:25px 20px;text-align:center">
        <h1 style="margin:0;font-size:26px;letter-spacing:1px;">DevChill 🎬</h1>
        <p style="margin:8px 0 0 0;font-size:15px;opacity:0.9;">Trung Tâm Hỗ Trợ Khách Hàng</p>
      </div>

      <!-- Body Content -->
      <div style="padding:30px 25px;color:#333;line-height:1.6;">
        <p style="font-size:16px;">Xin chào,</p>
        
        <p style="font-size:16px;">
          Cảm ơn bạn đã kiên nhẫn chờ đợi. Yêu cầu hỗ trợ có mã vé <b>#${ticketCode}</b> của bạn vừa có cập nhật mới từ hệ thống.
        </p>

        <!-- Trạng thái Ticket -->
        <p style="font-size:16px; margin-top:20px;">
          Trạng thái hiện tại: 
          <span style="display:inline-block; padding:5px 15px; border-radius:20px; font-size:13px; font-weight:bold; color:#fff; background-color:${statusColor}; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            ${displayStatus}
          </span>
        </p>

        <!-- Khối Nội dung phản hồi được Highlight đẹp mắt -->
        <div style="background:#f0f8ff; border-left:5px solid #1e90ff; padding:20px; margin:25px 0; border-radius:4px 8px 8px 4px;">
          <p style="margin:0 0 10px 0; font-size:15px; color:#1e90ff;"><b>Phản hồi từ Ban Quản Trị:</b></p>
          <div style="font-size:15px; color:#2c3e50;">
            ${replyContent.replace(/\n/g, "<br/>")} 
          </div>
        </div>

        <!-- Phần thông tin thêm cho Email dài và chuyên nghiệp -->
        <p style="font-size:15px; margin-top:30px;"><b>💡 Hướng dẫn tiếp theo:</b></p>
        <ul style="font-size:14px; color:#555; padding-left:20px; margin-top:10px;">
          <li style="margin-bottom:8px;">Nếu vấn đề đã được giải quyết, bạn không cần trả lời email này.</li>
          <li style="margin-bottom:8px;">Nếu bạn cần trao đổi thêm, vui lòng truy cập website và sử dụng mã vé <b>#${ticketCode}</b> để gửi phản hồi mới.</li>
          <li style="margin-bottom:8px;">Yêu cầu hỗ trợ sẽ tự động đóng sau <b>7 ngày</b> nếu không có phản hồi tiếp theo.</li>
        </ul>

        <p style="margin-top:35px; font-size:15px;">
          Trân trọng,<br/>
          <b style="color:#1e90ff; font-size:16px;">Đội ngũ DevChill</b>
        </p>
      </div>

      <!-- Footer y hệt Register -->
      <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:12px;color:#777;border-top:1px solid #eee;">
        <p style="margin:0 0 5px 0;">Email này được gửi tự động từ hệ thống DevChill. Vui lòng không trả lời trực tiếp.</p>
        <p style="margin:0;">© ${new Date().getFullYear()} DevChill. All rights reserved.</p>
      </div>

    </div>
    `;

    await transporter.sendMail({
      from: `"DevChill Support" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `[DevChill] Cập nhật yêu cầu hỗ trợ #${ticketCode}`,
      html: emailHtml,
    });

    console.log(`[MAILER] Đã gửi phản hồi ticket ${ticketCode} tới ${toEmail}`);
  } catch (err) {
    console.error("Gửi email hỗ trợ thất bại:", err);
  }
};
