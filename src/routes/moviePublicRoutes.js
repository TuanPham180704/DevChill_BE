import express from "express";
import * as controller from "../controller/moviePublicController.js";
import { authenticate } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", controller.getPublicMovies);
router.get("/category", controller.getCategories);
router.get("/country", controller.getCountries);
router.get("/year", controller.getYears);
router.get("/watch/:slug", authenticate, controller.watchMovie);
router.get("/:id", controller.getPublicMovieById);

export default router;
