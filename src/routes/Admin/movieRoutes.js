import express from "express";
import * as ctrl from "../../controller/Admin/movieController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));
router.post("/", ctrl.createMovie);
router.patch("/:id", ctrl.updateMovie);
router.get("/", ctrl.getAllMovies);
router.get("/:id", ctrl.getMovieById);
export default router;
