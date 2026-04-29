import { watchHistoryService } from "../../services/Users/watchHistoryServices.js";

export const watchHistoryController = {
  updateProgress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { movieId, episodeId, watchedDuration, totalDuration } = req.body;
      if (!movieId || !episodeId || watchedDuration === undefined) {
        return res.status(400).json({
          success: false,
          message: "Thiếu movieId, episodeId hoặc watchedDuration",
        });
      }
      const numWatched = Number(watchedDuration);
      const numTotal = Number(totalDuration) || 0;

      if (isNaN(numWatched) || numWatched < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Thời gian xem không hợp lệ" });
      }

      const history = await watchHistoryService.saveProgress(
        userId,
        movieId,
        episodeId,
        numWatched,
        numTotal,
      );

      return res.status(200).json({ success: true, data: history });
    } catch (error) {
      console.error("[WatchHistory] Error updating progress:", error);
      return res
        .status(500)
        .json({ success: false, message: "Lỗi server khi lưu lịch sử" });
    }
  },

  getHistory: async (req, res) => {
    try {
      const userId = req.user.id;
      const limit = Math.max(1, parseInt(req.query.limit) || 20);
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const offset = (page - 1) * limit;

      const result = await watchHistoryService.getUserHistory(
        userId,
        limit,
        offset,
      );

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          currentPage: page,
          limit: limit,
          ...result.pagination,
        },
      });
    } catch (error) {
      console.error("[WatchHistory] Error getting history:", error);
      return res
        .status(500)
        .json({ success: false, message: "Lỗi server khi lấy lịch sử xem" });
    }
  },

  getSingleProgress: async (req, res) => {
    try {
      const userId = req.user.id;
      const { episodeId } = req.params;

      if (!episodeId || isNaN(episodeId)) {
        return res
          .status(400)
          .json({ success: false, message: "Episode ID không hợp lệ" });
      }

      const watchedDuration = await watchHistoryService.getEpisodeProgress(
        userId,
        episodeId,
      );

      return res.status(200).json({ success: true, watchedDuration });
    } catch (error) {
      console.error("[WatchHistory] Error getting progress:", error);
      return res.status(500).json({ success: false, message: "Lỗi server" });
    }
  },
  deleteItem: async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      if (!id || isNaN(id)) {
        return res
          .status(400)
          .json({ success: false, message: "ID lịch sử không hợp lệ" });
      }

      const isDeleted = await watchHistoryService.deleteHistoryItem(userId, id);

      if (!isDeleted) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy lịch sử hoặc không có quyền xóa",
        });
      }

      return res
        .status(200)
        .json({ success: true, message: "Xóa lịch sử thành công" });
    } catch (error) {
      console.error("[WatchHistory] Error deleting item:", error);
      return res
        .status(500)
        .json({ success: false, message: "Lỗi server khi xóa lịch sử" });
    }
  },
  clearAll: async (req, res) => {
    try {
      const userId = req.user.id;
      await watchHistoryService.clearAllHistory(userId);
      return res
        .status(200)
        .json({ success: true, message: "Đã xóa toàn bộ lịch sử xem phim" });
    } catch (error) {
      console.error("[WatchHistory] Error clearing all history:", error);
      return res.status(500).json({
        success: false,
        message: "Lỗi server khi xóa toàn bộ lịch sử",
      });
    }
  },
};
