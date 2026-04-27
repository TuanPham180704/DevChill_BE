import dotenv from "dotenv";
dotenv.config();
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on("join_premiere_room", (roomName) => {
    socket.join(roomName);
    console.log(`[Socket] ${socket.id} joined ${roomName}`);
  });
  socket.on("leave_premiere_room", (roomName) => {
    socket.leave(roomName);
    console.log(`[Socket] ${socket.id} left ${roomName}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on Port http://localhost:${PORT}`);
});
