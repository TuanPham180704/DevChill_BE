import express from "express";
import * as controller from "../controller/moviePublicController.js";

const router = express.Router();

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.get("/:id/recommend", controller.recommend);

export default router;
