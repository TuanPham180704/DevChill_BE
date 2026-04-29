import express from "express";
import { watchHistoryController } from "../../controller/Users/watchHistoryController.js";
import { authenticate } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/progress", authenticate, watchHistoryController.updateProgress);
router.get("/", authenticate, watchHistoryController.getHistory);
router.get(
  "/progress/:episodeId",
  authenticate,
  watchHistoryController.getSingleProgress,
);
router.delete("/", authenticate, watchHistoryController.clearAll);
router.delete("/:id", authenticate, watchHistoryController.deleteItem);

export default router;
