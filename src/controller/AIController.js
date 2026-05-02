import { askAI } from "../services/AIServices.js";
import * as movieService from "../services/moviePublicServices.js";
import { watchHistoryService } from "../services/Users/watchHistoryServices.js";

const extractData = (result) => {
  if (!result) return null;
  if (result.data && result.data.data) return result.data.data;
  if (result.data) return result.data;
  return result;
};

const personalizeText = (text, user) => {
  if (!text || !user || (!user.name && !user.username)) return text;
  const n = user.name || user.username;
  return text
    .replace(/Chào bạn/gi, `Chào ${n}`)
    .replace(/cho bạn/gi, `cho ${n}`)
    .replace(/của bạn/gi, `của ${n}`)
    .replace(/Bạn muốn/g, `${n} muốn`)
    .replace(/Bạn cần/g, `${n} cần`)
    .replace(/Bạn chưa/g, `${n} chưa`)
    .replace(/Bạn kiểm tra/g, `${n} kiểm tra`)
    .replace(/Bạn thích/g, `${n} thích`)
    .replace(/bạn vui lòng/gi, `${n} vui lòng`)
    .replace(/bạn chờ/gi, `${n} chờ`)
    .replace(/bạn xem/gi, `${n} xem`);
};

const sendReply = (res, payload, user) => {
  if (payload.message) {
    payload.message = personalizeText(payload.message, user);
  }
  return res.json(payload);
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
      aiParams.keyword = aiParams.keyword.trim();
    }

    switch (action) {
      case "redirect_premium": {
        return sendReply(
          res,
          {
            action: "redirect_premium",
            message: `Ok bạn! Mình đang chuyển hướng bạn đến trang mua gói Premium...`,
          },
          user,
        );
      }

      case "suggest_from_history": {
        if (!user || !user.id) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message:
                "Bạn cần đăng nhập tài khoản để mình phân tích sở thích và gợi ý phim cực chuẩn nhé! 🍿",
            },
            user,
          );
        }

        const historyResult = await watchHistoryService.getUserHistory(
          user.id,
          10,
          0,
        );
        const historyData = extractData(historyResult) || [];

        if (historyData.length === 0) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Tài khoản của bạn chưa xem phim nào nên mình chưa nắm được "gu". Bạn thích thể loại nào để mình tìm cho?`,
            },
            user,
          );
        }

        const lastWatched = historyData[0];
        const detailRes = await movieService.getPublicMovieById(
          lastWatched.movie_id,
        );
        const detailData = extractData(detailRes);

        let suggestCategory = "";
        if (
          detailData &&
          detailData.categories &&
          detailData.categories.length > 0
        ) {
          suggestCategory = detailData.categories[0].slug;
        }

        if (suggestCategory) {
          const suggestRes = await movieService.getPublicMovies({
            category: suggestCategory,
            limit: 15,
          });
          let suggestArr = extractData(suggestRes) || [];

          const watchedIds = historyData.map((h) => h.movie_id);
          const filteredSuggest = suggestArr
            .filter((m) => !watchedIds.includes(m.id))
            .slice(0, 10);

          if (filteredSuggest.length > 0) {
            return sendReply(
              res,
              {
                action: "suggest_movies",
                message: `Dựa trên siêu phẩm này, mình đoán bạn sẽ "ghiền" những bộ phim cùng thể loại sau:`,
                watchedMovie: {
                  movie_name: lastWatched.movie_name,
                  thumb_url: lastWatched.thumb_url,
                  slug: lastWatched.movie_slug,
                },
                payload: filteredSuggest,
              },
              user,
            );
          }
        }

        const randomRes = await movieService.getPublicMovies({ limit: 10 });
        return sendReply(
          res,
          {
            action: "suggest_movies",
            message:
              "Mình chọn ngẫu nhiên vài bộ siêu phẩm đang thịnh hành trên DevChill cho bạn nhé:",
            payload: extractData(randomRes) || [],
          },
          user,
        );
      }

      case "auto_play":
      case "get_detail": {
        if (!aiParams.keyword) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Bạn muốn xem phim gì cơ? Gõ tên phim giúp mình nhé.`,
            },
            user,
          );
        }

        const resData = await movieService.getPublicMovies({
          keyword: aiParams.keyword,
          limit: 1,
        });
        const movieArr = extractData(resData);

        if (!movieArr || movieArr.length === 0) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `DevChill không tìm thấy phim "${aiParams.keyword.replace(/\|/g, " ")}". Bạn kiểm tra lại tên giúp mình nha!`,
            },
            user,
          );
        }

        const movieFound = movieArr[0];

        if (action === "auto_play") {
          if (movieFound.lifecycle_status === "upcoming") {
            const detailRes = await movieService.getPublicMovieById(
              movieFound.id,
            );
            const detailData = extractData(detailRes);
            let similar = [];

            if (detailData?.categories?.length > 0) {
              const catSlug = detailData.categories[0].slug;
              const suggestRes = await movieService.getPublicMovies({
                category: catSlug,
                limit: 10,
              });
              const suggestArr = extractData(suggestRes) || [];
              similar = suggestArr
                .filter(
                  (m) =>
                    m.id !== movieFound.id && m.lifecycle_status !== "upcoming",
                )
                .slice(0, 5);
            }

            return sendReply(
              res,
              {
                action: "suggest_movies",
                message: `Phim "${movieFound.name}" đang trong trạng thái sắp chiếu, bạn vui lòng chờ đợi thêm chút thời gian nha! Trong lúc chờ, bạn xem thử mấy bộ này nhé:`,
                payload: similar,
              },
              user,
            );
          }

          if (movieFound.is_premium && (!user || !user.is_premium)) {
            return sendReply(
              res,
              {
                action: "ask_user",
                message: `Bạn chưa có gói Premium để xem phim "${movieFound.name}". Bạn có muốn chuyển sang trang nâng cấp Premium không?`,
              },
              user,
            );
          }

          return sendReply(
            res,
            {
              action: "redirect_play",
              slug: movieFound.slug,
              message: `Đang mở ${movieFound.name} cho bạn đây! Chúc bạn xem phim vui vẻ 🍿`,
            },
            user,
          );
        } else {
          return sendReply(
            res,
            {
              action: "redirect_detail",
              slug: movieFound.slug,
              message: `Đang tải trang thông tin chi tiết của ${movieFound.name}...`,
            },
            user,
          );
        }
      }

      case "get_actors": {
        if (!aiParams.keyword) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: "Bạn muốn xem diễn viên của phim nào?",
            },
            user,
          );
        }

        const searchRes = await movieService.getPublicMovies({
          keyword: aiParams.keyword,
          limit: 1,
        });
        const movieArr = extractData(searchRes);

        if (!movieArr || movieArr.length === 0) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Mình không tìm thấy phim "${aiParams.keyword.replace(/\|/g, " ")}" để xem diễn viên.`,
            },
            user,
          );
        }

        const detailRes = await movieService.getPublicMovieById(movieArr[0].id);
        const detailData = extractData(detailRes);

        if (
          !detailData ||
          !detailData.people ||
          detailData.people.length === 0
        ) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Hiện tại hệ thống chưa cập nhật danh sách diễn viên cho phim ${movieArr[0].name}.`,
            },
            user,
          );
        }

        const actors = detailData.people
          .filter((p) => p.role === "actor" || !p.role)
          .map((p) => p.name)
          .join(", ");

        return sendReply(
          res,
          {
            action: "ask_user",
            message: `Bộ phim ${movieArr[0].name} có sự tham gia của các diễn viên: ${actors}.`,
          },
          user,
        );
      }

      case "search_movies":
      case "getPublicMovies": {
        const cleanParams = { ...aiParams };
        cleanParams.limit = cleanParams.limit || 10;

        if (!cleanParams.keyword || cleanParams.keyword.trim() === "") {
          delete cleanParams.keyword;
        }

        const resData = await movieService.getPublicMovies(cleanParams);
        const resultArr = extractData(resData) || [];

        if (resultArr.length === 0) {
          if (cleanParams.keyword) {
            const kwDisplay = cleanParams.keyword.replace(/\|/g, ", ");
            return sendReply(
              res,
              {
                action: "ask_user",
                message: `Mình đã tìm kỹ nội dung "${kwDisplay}" nhưng chưa thấy phim nào khớp trong kho. Bạn thử từ khóa khác nhé!`,
              },
              user,
            );
          }
          if (cleanParams.category) {
            return sendReply(
              res,
              {
                action: "ask_user",
                message:
                  "Hiện tại kho phim thể loại này đang trống, bạn xem thử thể loại khác để giải trí nhé!",
              },
              user,
            );
          }
        }
        return res.json(resultArr);
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
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Bạn cần đăng nhập để xem lại lịch sử phim nhé! 🎬`,
            },
            user,
          );
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
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Tài khoản của bạn chưa xem bộ phim nào trên DevChill cả.`,
            },
            user,
          );
        }
        return res.json(historyData);
      }

      case "clearAllHistory": {
        if (!user || !user.id) {
          return sendReply(
            res,
            {
              action: "ask_user",
              message: `Bạn chưa đăng nhập nên mình không có lịch sử nào để xoá.`,
            },
            user,
          );
        }
        await watchHistoryService.clearAllHistory(user.id);
        return sendReply(
          res,
          {
            action: "ask_user",
            message: `Đã xoá toàn bộ lịch sử xem phim của bạn thành công!`,
          },
          user,
        );
      }

      case "ask_user": {
        let finalMessage =
          ai.message || aiParams.message || "DevChill đang nghe đây...";
        finalMessage = finalMessage.replace(/\[Hệ thống.*\]/gi, "").trim();
        return sendReply(
          res,
          { action: "ask_user", message: finalMessage },
          user,
        );
      }

      default:
        return sendReply(
          res,
          {
            action: "ask_user",
            message: "DevChill chưa hiểu ý bạn, bạn nói lại nhé?",
          },
          user,
        );
    }
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "Lỗi hệ thống AI" });
  }
};
