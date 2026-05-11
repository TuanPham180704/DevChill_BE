import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import "./services/cron/unlockUsersCron.js";
import authRoutes from "./routes/authRoutes.js";

import adminUserRoutes from "./routes/Admin/userAdRoutes.js";
import adminContractRoutes from "./routes/Admin/contractRoutes.js";
import adminMovieRoutes from "./routes/Admin/movieAdminRoutes.js";
import adminPlanRoutes from "./routes/Admin/adminPlanRoutes.js";
import adminShowimeRoutes from "./routes/Admin/showtimeRoutes.js";
import adminSupportRoutes from "./routes/Admin/supportRoutes.js";
import paymentRoutes from "./routes/admin/paymentRoutes.js";

import planRoutes from "./routes/Users/userPlanRoutes.js";
import profileRoutes from "./routes/Users/userRoutes.js";
import showtimesRoutes from "./routes/Users/showtimeRoutes.js";
import publicMoviesRoutes from "./routes/moviePublicRoutes.js";
import watchHistoryRoutes from "./routes/Users/watchHistoryRoutes.js";
import supportRoutes from "./routes/Users/supportRoutes.js";
import aiRoutes from "./routes/AIRoutes.js";
import adminOverView from "./routes/Admin/overViewRoutes.js";
dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/auth", authRoutes);

app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/contracts", adminContractRoutes);
app.use("/api/admin/movies", adminMovieRoutes);
app.use("/api/admin/plans", adminPlanRoutes);
app.use("/api/admin/payments", paymentRoutes);
app.use("/api/admin/showtimes", adminShowimeRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/showtimes", showtimesRoutes);
app.use("/api/history", watchHistoryRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/movies", publicMoviesRoutes);
app.use("/api/admin/overview", adminOverView);

app.get("/", (req, res) => {
  res.send("DevChill");
});

export default app;
