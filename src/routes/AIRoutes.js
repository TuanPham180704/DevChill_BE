import express from "express";
import { chatAI } from "../controller/AIController.js";
import { authenticateOptional } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post("/chat", authenticateOptional, chatAI);

export default router;
