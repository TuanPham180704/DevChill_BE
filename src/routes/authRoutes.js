import express from "express";
import * as authController from "../controller/authControllers.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/verify", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshToken);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

export default router;
