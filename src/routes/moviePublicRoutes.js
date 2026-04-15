import express from "express";
import * as controller from "../controller/moviePublicController.js";

const router = express.Router();

router.get("/", controller.getPublicMovies);
router.get("/:id", controller.getPublicMovieById);

export default router;
