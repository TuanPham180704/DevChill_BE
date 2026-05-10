import * as supportService from "../../services/Users/supportService.js";
import { sendAutoReplyEmail } from "../../utils/sendAutoReplyEmail.js";

export const createTicket = async (req, res) => {
  try {
    const { category, description, guest_email } = req.body;
    const user = req.user;

    if (!user && !guest_email) {
      return res
        .status(400)
        .json({ message: "Khách vãng lai vui lòng nhập email liên hệ" });
    }

    const result = await supportService.createTicketService(req.body, user);

    res.status(201).json({
      message: "Gửi yêu cầu thành công",
      ticket_code: result.ticket.ticket_code,
    });
    sendAutoReplyEmail(
      result.emailToSend,
      result.ticket.ticket_code,
      category,
      result.isGuest,
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyTickets = async (req, res) => {
  try {
    const tickets = await supportService.getUserTicketsService(req.user.id);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const notifs = await supportService.getUserNotificationsService(
      req.user.id,
    );
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const replyTicket = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;
    const { content_response, attachments } = req.body;

    if (!content_response) {
      return res
        .status(400)
        .json({ message: "Nội dung phản hồi không được để trống" });
    }

    const result = await supportService.replyTicketClientService(
      ticketId,
      userId,
      content_response,
      attachments,
    );

    res.status(201).json({
      message: "Gửi phản hồi thành công",
      data: result.reply,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const getTicketDetail = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id;

    const ticketDetail = await supportService.getTicketDetailClientService(
      ticketId,
      userId,
    );

    res.status(200).json(ticketDetail);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notifId = req.params.id;
    const userId = req.user.id;

    const updatedNotif = await supportService.markNotificationReadClientService(
      notifId,
      userId,
    );
    res.status(200).json({
      message: "Đã đánh dấu đọc thông báo thành công",
      data: updatedNotif,
    });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};
export const closeTicketClient = async (req, res) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.id; 

    const result = await supportService.closeTicketClientService(
      ticketId,
      userId,
    );

    return res.status(200).json({
      success: true,
      message: "Đã đóng vé hỗ trợ thành công",
      data: result,
    });
  } catch (error) {
    console.error("Lỗi closeTicketClient:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi đóng vé hỗ trợ",
    });
  }
};
