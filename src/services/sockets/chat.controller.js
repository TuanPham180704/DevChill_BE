import { chatService } from "../../services/redis.service";

export const handleChatEvents = (io, socket) => {
  socket.on("join_premiere_room", async ({ roomId, user }) => {
    if (!user) return;

    const roomName = `room_premiere_${roomId}`;
    socket.join(roomName);
    console.log(
      `[Socket] User ${user.username} (ID: ${socket.id}) joined ${roomName}`,
    );
    const historyData = await chatService.getRecentMessages(roomId);
    socket.emit("chat_history", historyData);
  });
  socket.on("send_message", async ({ roomId, user, text }) => {
    if (!user || !text.trim()) return;

    const roomName = `room_premiere_${roomId}`;
    const newMessage = {
      id: Date.now().toString() + Math.random().toString(36).substring(2),
      socketId: socket.id,
      userId: user._id,
      username: user.username,
      text: text,
      timestamp: new Date().toISOString(),
      isSystem: false,
    };
    io.to(roomName).emit("receive_message", newMessage);
    chatService
      .saveMessage(roomId, newMessage)
      .catch((err) => console.error("Lỗi lưu tin nhắn Redis:", err));
  });

  socket.on("leave_premiere_room", ({ roomId }) => {
    const roomName = `room_premiere_${roomId}`;
    socket.leave(roomName);
  });
};
