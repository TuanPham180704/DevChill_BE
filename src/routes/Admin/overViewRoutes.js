import express from "express";
import * as controller from "../../controller/Admin/overviewController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();

// 🔒 Khóa toàn bộ route này lại, chỉ Admin mới được vào
router.use(authenticate, authorization(["admin"]));

// Dashboard 24h
router.get("/dashboard/24h", controller.getDashboard24h);

// Báo cáo Analytics (Có option: day, week, month, year)
router.get("/reports", controller.getReport);

export default router;
