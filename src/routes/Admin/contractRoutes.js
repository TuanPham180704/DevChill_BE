import express from "express";
import * as ctrl from "../../controller/Admin/contractController.js";
import {
  authenticate,
  authorization,
} from "../../middlewares/authMiddleware.js";
import multer from "multer";
import fs from "fs";

const router = express.Router();
const uploadFolder = "uploads/contracts/";
if (!fs.existsSync(uploadFolder))
  fs.mkdirSync(uploadFolder, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

router.use(authenticate, authorization(["admin"]));

router.post("/", upload.single("file"), ctrl.createContract);
router.get("/", ctrl.getContracts);
router.get("/:id", ctrl.getContractById);
router.patch("/:id", upload.single("file"), ctrl.updateContract);
router.get("/:id/file", ctrl.downloadContractFile);

export default router;
