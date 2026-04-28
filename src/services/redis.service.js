import dotenv from "dotenv";
dotenv.config();
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export const chatService = {
  getRecentMessages: async (roomId) => {
    try {
      const key = `premiere:${roomId}:chat`;
      const rawMessages = await redis.lrange(key, 0, 99);
      return rawMessages ? rawMessages.reverse() : [];
    } catch (error) {
      console.error("[Redis] Lỗi khi lấy lịch sử chat:", error);
      return [];
    }
  },

  saveMessage: async (roomId, messageData) => {
    try {
      const key = `premiere:${roomId}:chat`;
      const msgToSave = {
        ...messageData,
        reactions: messageData.reactions || {},
      };
      const stringifiedMsg = JSON.stringify(msgToSave);
      await redis.lpush(key, stringifiedMsg);
      await redis.ltrim(key, 0, 99);
    } catch (error) {
      console.error("[Redis] Lỗi khi lưu tin nhắn mới:", error);
    }
  },

  addMessageReaction: async (roomId, messageId, emoji) => {
    try {
      const key = `premiere:${roomId}:chat`;
      const rawMessages = await redis.lrange(key, 0, 99);

      const index = rawMessages.findIndex((msg) => {
        const parsed = typeof msg === "string" ? JSON.parse(msg) : msg;
        return parsed.id === messageId;
      });

      if (index !== -1) {
        const parsedMsg =
          typeof rawMessages[index] === "string"
            ? JSON.parse(rawMessages[index])
            : rawMessages[index];

        if (!parsedMsg.reactions) parsedMsg.reactions = {};
        parsedMsg.reactions[emoji] = (parsedMsg.reactions[emoji] || 0) + 1;
        await redis.lset(key, index, JSON.stringify(parsedMsg));
      }
    } catch (error) {
      console.error("[Redis] Lỗi khi lưu reaction:", error);
    }
  },
};
