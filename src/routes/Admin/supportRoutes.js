import express from "express";
import * as supportController from "../../controller/Admin/supportController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
  "/unread-count",
  authenticate,
  authorization("admin"),
  supportController.getUnreadCount,
);

router.get(
  "/",
  authenticate,
  authorization("admin"),
  supportController.getAllTickets,
);

router.get(
  "/:id",
  authenticate,
  authorization("admin"),
  supportController.getTicketById,
);

router.post(
  "/:id/reply",
  authenticate,
  authorization("admin"),
  supportController.replyTicket,
);

export default router;
