import dotenv from "dotenv";
dotenv.config();
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { chatService } from "./services/redis.service.js";
import { chatAI } from "./controller/AIController.js";

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
});

const updateViewerCount = (roomName) => {
  const clientsInRoom = io.sockets.adapter.rooms.get(roomName);
  const count = clientsInRoom ? clientsInRoom.size : 0;
  io.to(roomName).emit("viewer_count", count);
};

io.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on("join_premiere_room", async (data) => {
    const roomName =
      typeof data === "string" ? data : `room_premiere_${data.roomId}`;
    const roomId =
      typeof data === "string"
        ? data.replace("room_premiere_", "")
        : data.roomId;
    const user = data.user;

    socket.join(roomName);
    updateViewerCount(roomName);

    if (user && roomId) {
      const historyData = await chatService.getRecentMessages(roomId);
      socket.emit("chat_history", historyData);
    }
  });

  socket.on("send_message", async ({ roomId, user, text }) => {
    if (!user || !text.trim()) return;

    const roomName = `room_premiere_${roomId}`;
    const newMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      socketId: socket.id,
      userId: user.id || user._id,
      username: user.username,
      avatar_url: user.avatar_url || null,
      text: text,
      timestamp: new Date().toISOString(),
      isSystem: false,
      reactions: {},
    };

    io.to(roomName).emit("receive_message", newMessage);

    chatService
      .saveMessage(roomId, newMessage)
      .catch((err) => console.error("[Redis] Lỗi lưu tin nhắn:", err));
  });

  socket.on("send_reaction", ({ roomId, emoji }) => {
    const roomName = `room_premiere_${roomId}`;
    socket.broadcast.to(roomName).emit("receive_reaction", emoji);
  });

  socket.on("react_to_message", async ({ roomId, messageId, emoji }) => {
    const roomName = `room_premiere_${roomId}`;
    io.to(roomName).emit("update_message_reaction", { messageId, emoji });
    await chatService.addMessageReaction(roomId, messageId, emoji);
  });

  socket.on("leave_premiere_room", (data) => {
    const roomName =
      typeof data === "string" ? data : `room_premiere_${data.roomId}`;
    socket.leave(roomName);
    updateViewerCount(roomName);
  });
  socket.on("ask_ai_bot", (data) => {
    chatAI(socket, data);
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((roomName) => {
      if (roomName.startsWith("room_premiere_")) {
        const clientsInRoom = io.sockets.adapter.rooms.get(roomName);
        const count = clientsInRoom ? clientsInRoom.size - 1 : 0;
        io.to(roomName).emit("viewer_count", Math.max(0, count));
      }
    });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Server] Running on Port http://localhost:${PORT}`);
});
