import express from "express";
import * as userController from "../../controller/Users/userController.js";
import { authenticate } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/me", authenticate, userController.getProfileController);
router.put("/me", authenticate, userController.updateProfileController);
router.put(
  "/change-password",
  authenticate,
  userController.changePasswordController,
);
export default router;
