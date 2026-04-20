// src/routes/adminPlanRoutes.js
import express from "express";
import * as controller from "../../controller/Admin/adminPlanController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();
router.use(authenticate, authorization(["admin"]));
router.post("/", controller.createPlan);
router.put("/:id", controller.updatePlan);
router.get("/", controller.getAllPlansAdmin);
router.get("/:id", controller.getPlanById);
router.patch("/:id/toggle-status", controller.togglePlanStatus);

export default router;
