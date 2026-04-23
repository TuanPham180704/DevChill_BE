import express from "express";
import * as showtimeController from "../../controller/Admin/showtimeController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));

router.post("/", showtimeController.create);
router.get("/", showtimeController.getAll);
router.get("/:id", showtimeController.getById);
router.put("/:id", showtimeController.update);

export default router;
