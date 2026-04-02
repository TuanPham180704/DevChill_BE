import express from "express";
import * as ctrl from "../../controller/Admin/userAdController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authenticate, authorization(["admin"]));

router.get("/", ctrl.getAllUsers);
router.get("/:id", ctrl.getUserById);
router.patch("/:id", ctrl.updateUser);
router.patch("/:id/lock", ctrl.lockUser);
router.patch("/:id/unlock", ctrl.unlockUser);
export default router;
