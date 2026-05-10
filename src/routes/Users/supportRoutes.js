import express from "express";
import * as supportController from "../../controller/Users/supportController.js";
import {
  authenticate,
  authenticateOptional,
} from "../../middlewares/authMiddleware.js";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post("/", authenticateOptional, supportController.createTicket);
router.get("/my-tickets", authenticate, supportController.getMyTickets);
router.get("/my-tickets/:id", authenticate, supportController.getTicketDetail);
router.get(
  "/notifications",
  authenticate,
  supportController.getMyNotifications,
);
router.put(
  "/notifications/:id/read",
  authenticate,
  supportController.markNotificationAsRead,
);
router.post("/:id/reply", authenticate, supportController.replyTicket);
router.put("/:id/close", authenticate, supportController.closeTicketClient);
export default router;
