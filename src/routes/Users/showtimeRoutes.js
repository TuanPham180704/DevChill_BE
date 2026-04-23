import express from "express";
import * as showtimeUserController from "../../controller/Users/showtimeController.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
const router = express.Router();
router.get("/", showtimeUserController.getAllPublic);
router.get("/:id", showtimeUserController.getDetail);
router.get("/watch/:id", authenticate, showtimeUserController.watchPremiere);

export default router;
