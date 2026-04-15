import express from "express";
import * as controller from "../../controller/Admin/movieController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";

const router = express.Router();
router.use(authenticate, authorization(["admin"]));
router.post("/", controller.createMovie);
router.put("/:id/info", controller.updateInfo);
router.put("/:id/meta", controller.updateMeta);
router.put("/:id/media", controller.updateMedia);
router.put("/:id/setting", controller.updateSetting);
router.get("/", controller.getAll);
router.get("/:id", controller.getById);

export default router;
