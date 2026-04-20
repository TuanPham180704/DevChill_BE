import express from "express";
import * as userController from "../../controller/Users/userPlanController.js";

import { createPayment } from "../../controller/Users/paymentController.js";
import { vnpayIPN } from "../../controller/Users/vnpayController.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
const router = express.Router();
router.get("/", userController.getAllPlans);
router.get("/:id", userController.getPlanById);
router.post("/payment/create", authenticate, createPayment);
router.get("/vnpay/ipn", vnpayIPN);
router.get("/me/subscription", authenticate, userController.getMySubscription);
router.get(
  "/payment/status/:txnRef",
  authenticate,
  userController.getPaymentStatus,
);
router.get("/payment/history", authenticate, userController.getPaymentHistory);

export default router;
