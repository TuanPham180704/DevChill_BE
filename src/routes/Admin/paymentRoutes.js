// routes/admin/paymentRoutes.js
import express from "express";
import * as paymentController from "../../controller/Admin/paymentController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorization("admin"),
  paymentController.getAllPayments,
);

router.get(
  "/:id",
  authenticate,
  authorization("admin"),
  paymentController.getPaymentById,
);

router.post(
  "/:id/verify",
  authenticate,
  authorization("admin"),
  paymentController.verifyPayment,
);

export default router;
