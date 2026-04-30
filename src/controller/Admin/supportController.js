import * as supportService from "../../services/Admin/supportService.js";
import { sendSupportReplyEmail } from "../../utils/mailer.js";

export const getUnreadCount = async (req, res) => {
  try {
    const unread_count = await supportService.getUnreadCountService();
    res.json({ unread_count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllTickets = async (req, res) => {
  try {
    const data = await supportService.getAllTicketsService(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getTicketById = async (req, res) => {
  try {
    const data = await supportService.getTicketByIdService(req.params.id);
    if (!data) return res.status(404).json({ message: "Ticket not found" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const replyTicket = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { content_response, attachments = [], status } = req.body;

    if (!content_response) {
      return res.status(400).json({ message: "Content response is required" });
    }

    const result = await supportService.replyTicketService(
      req.params.id,
      adminId,
      content_response,
      attachments,
      status,
    );
    res.json({
      message: result.message,
      data: result.reply,
    });
    if (result.receiverEmail) {
      sendSupportReplyEmail(
        result.receiverEmail,
        result.ticketCode,
        content_response,
        result.statusUpdated,
      );
    }
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
