// src/controllers/ai.controller.js
import { askAI } from "../services/AIServices.js";
import * as movieService from "../services/moviePublicServices.js";
import { watchHistoryService } from "../services/Users/watchHistoryServices.js";

const extractData = (result) => {
  if (!result) return null;
  if (result.data && result.data.data) return result.data.data;
  if (result.data) return result.data;
  return result;
};
const cleanKeyword = (kw) => {
  if (!kw) return kw;
  return kw
    .replace(
      /mở phim|xem phim|cho tui|cho tao|cho tôi|đi|nhé|nha|với|tôi muốn xem|chi tiết về phim|chi tiết về|chi tiết|bộ phim/gi,
      "",
    )
    .trim();
};

export const chatAI = async (req, res) => {
  try {
    const { message, history } = req.body;
    const user = req.user;

    const ai = await askAI(message, history);
    console.log("=== AI INTENT ===", JSON.stringify(ai, null, 2));

    const aiParams = ai.params || ai || {};

    let action = ai.action;
    if (!action) {
      if (ai.type === "ask_user" || ai.message || aiParams.message) {
        action = "ask_user";
      } else if (
        aiParams.keyword ||
        aiParams.country ||
        aiParams.category ||
        aiParams.limit ||
        aiParams.type
      ) {
        action = "search_movies";
      } else {
        action = "ask_user";
      }
    }
    if (aiParams.keyword) {
      aiParams.keyword = cleanKeyword(aiParams.keyword);
    }

    switch (action) {
      case "auto_play":
      case "get_detail": {
        if (!aiParams.keyword) {
          return res.json({
            action: "ask_user",
            message: "Bạn muốn xem phim gì cơ?",
          });
        }

        const resData = await movieService.getPublicMovies({
          keyword: aiParams.keyword,
          limit: 1,
        });
        const movieArr = extractData(resData);

        if (!movieArr || movieArr.length === 0) {
          return res.json({
            action: "ask_user",
            message: `DevChill không tìm thấy phim "${aiParams.keyword}". Bạn kiểm tra lại tên giúp mình nha!`,
          });
        }

        const movieFound = movieArr[0];

        if (action === "auto_play") {
          return res.json({
            action: "redirect_play",
            slug: movieFound.slug,
            message: `Đang mở ${movieFound.name} cho bạn đây! Chúc bạn xem phim vui vẻ 🍿`,
          });
        } else {
          return res.json({
            action: "redirect_detail",
            slug: movieFound.slug,
            message: `Đang tải trang thông tin chi tiết của ${movieFound.name}...`,
          });
        }
      }

      case "get_actors": {
        if (!aiParams.keyword) {
          return res.json({
            action: "ask_user",
            message: "Bạn muốn xem diễn viên của phim nào?",
          });
        }

        const searchRes = await movieService.getPublicMovies({
          keyword: aiParams.keyword,
          limit: 1,
        });
        const movieArr = extractData(searchRes);

        if (!movieArr || movieArr.length === 0) {
          return res.json({
            action: "ask_user",
            message: `Mình không tìm thấy phim "${aiParams.keyword}" để xem diễn viên.`,
          });
        }

        const detailRes = await movieService.getPublicMovieById(movieArr[0].id);
        const detailData = extractData(detailRes);

        if (
          !detailData ||
          !detailData.people ||
          detailData.people.length === 0
        ) {
          return res.json({
            action: "ask_user",
            message: `Hiện tại hệ thống chưa cập nhật danh sách diễn viên cho phim ${movieArr[0].name}.`,
          });
        }

        const actors = detailData.people
          .filter((p) => p.role === "actor" || !p.role)
          .map((p) => p.name)
          .join(", ");

        return res.json({
          action: "ask_user",
          message: `Bộ phim ${movieArr[0].name} có sự tham gia của các diễn viên: ${actors}.`,
        });
      }

      case "search_movies":
      case "getPublicMovies": {
        const cleanParams = { ...aiParams };
        if (!cleanParams.keyword || cleanParams.keyword.trim() === "") {
          delete cleanParams.keyword;
        }
        const resData = await movieService.getPublicMovies(cleanParams);
        return res.json(extractData(resData) || []);
      }

      case "getPublicMovieById": {
        const resData = await movieService.getPublicMovieById(aiParams.id);
        return res.json(extractData(resData));
      }

      case "getMovieWatch": {
        const resData = await movieService.getMovieWatch(
          aiParams.slug,
          aiParams,
          user,
        );
        return res.json(extractData(resData));
      }

      case "getCategories": {
        const resData = await movieService.getCategories();
        return res.json(extractData(resData) || []);
      }

      case "getCountries": {
        const resData = await movieService.getCountries();
        return res.json(extractData(resData) || []);
      }

      case "getUserHistory": {
        if (!user || !user.id) {
          return res.json({
            action: "ask_user",
            message:
              "Bạn cần đăng nhập để xem lại lịch sử phim của mình nhé! 🎬",
          });
        }

        const limit = aiParams.limit || 10;
        const page = aiParams.page || 1;
        const offset = (page - 1) * limit;

        const historyResult = await watchHistoryService.getUserHistory(
          user.id,
          limit,
          offset,
        );
        const historyData = extractData(historyResult);

        if (!historyData || historyData.length === 0) {
          return res.json({
            action: "ask_user",
            message: "Tài khoản của bạn chưa xem bộ phim nào trên DevChill cả.",
          });
        }
        return res.json(historyData);
      }

      case "clearAllHistory": {
        if (!user || !user.id) {
          return res.json({
            action: "ask_user",
            message: "Bạn chưa đăng nhập nên mình không có lịch sử nào để xoá.",
          });
        }
        await watchHistoryService.clearAllHistory(user.id);
        return res.json({
          action: "ask_user",
          message: "Đã xoá toàn bộ lịch sử xem phim của bạn thành công!",
        });
      }

      case "ask_user":
        return res.json({
          action: "ask_user",
          message:
            ai.message || aiParams.message || "DevChill đang nghe đây...",
        });

      default:
        return res.json({
          action: "ask_user",
          message:
            ai.message ||
            aiParams.message ||
            "DevChill chưa hiểu ý bạn, bạn nói lại nhé?",
        });
    }
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "Lỗi hệ thống AI" });
  }
};
