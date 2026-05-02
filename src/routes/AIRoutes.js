// src/routes/ai.routes.js
import express from "express";
import { chatAI } from "../controller/AIController.js";
import { authenticateOptional } from "../middlewares/authMiddleware.js";
const router = express.Router();

// Sử dụng authenticateOptional để vừa cho phép Guest, vừa nhận diện User
router.post("/chat", authenticateOptional, chatAI);

export default router;
