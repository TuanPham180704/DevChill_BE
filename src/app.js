import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import "./services/cron/unlockUsersCron.js";
import authRoutes from "./routes/authRoutes.js";

import adminUserRoutes from "./routes/Admin/userAdRoutes.js";
import adminContractRoutes from "./routes/Admin/contractRoutes.js";
import profileRoutes from "./routes/Users/userRoutes.js";
dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);

app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/contract", adminContractRoutes);

app.use("/api/profile", profileRoutes);

app.get("/", (req, res) => {
  res.send("DevChill");
});

export default app;
