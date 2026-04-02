import express from "express";
import * as userController from "../../controller/Users/userController.js";
import { authenticate } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticate, userController.getProfileController);
router.put("/", authenticate, userController.updateProfileController);
router.put(
  "/change-password",
  authenticate,
  userController.changePasswordController,
);
export default router;
