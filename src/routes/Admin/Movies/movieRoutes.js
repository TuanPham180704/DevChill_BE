import express from "express";
import * as controller from "../../../controller/Admin/Movies/movieController.js";
import {
  authenticate,
  authorization,
} from "../../../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorization(["admin"]),
  controller.createMovie,
);
router.put(
  "/:id/info",
  authenticate,
  authorization(["admin"]),
  controller.updateInfo,
);
router.put(
  "/:id/meta",
  authenticate,
  authorization(["admin"]),
  controller.updateMeta,
);
router.put(
  "/:id/media",
  authenticate,
  authorization(["admin"]),
  controller.updateMedia,
);
router.put(
  "/:id/setting",
  authenticate,
  authorization(["admin"]),
  controller.updateSetting,
);
router.get("/", authenticate, controller.getAll);
router.get("/:id", authenticate, controller.getById);
router.get("/:id/recommend", authenticate, controller.recommend);

export default router;
