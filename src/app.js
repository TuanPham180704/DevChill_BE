import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";

import profileRoutes from "./routes/Users/userRoutes.js";
dotenv.config();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/me", profileRoutes);

app.get("/", (req, res) => {
  res.send("DevChill");
});

export default app;
