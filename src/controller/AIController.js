import { askAI } from "../services/AIServices.js";
import * as movieService from "../services/moviePublicServices.js";
import { watchHistoryService } from "../services/Users/watchHistoryServices.js";
import * as planService from "../services/Users/planUserServies.js";

const extractData = (result) => {
  if (!result) return null;
  if (result.data && result.data.data) return result.data.data;
  if (result.data) return result.data;
  return result;
};
const normalizeVi = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
};

const personalizeText = (text, user) => {
  if (!text) return text;
  let cleanText = text
    .replace(/giửp/g, "giúp")
    .replace(/họ7m/g, "hôm")
    .replace(/đưưùc/g, "được")
    .replace(/kô\b/gi, "không");
  if (
    cleanText.includes("có thể") &&
    (cleanText.includes("hôm") || cleanText.includes("nay"))
  ) {
    cleanText = "Chào bạn! DevChill có thể giúp gì cho bạn hôm nay?";
  }
  if (!user || (!user.name && !user.username)) return cleanText;
  const n = user.name || user.username;
  return cleanText
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

const sendSocketReply = (socket, payload, user) => {
  if (payload.message) {
    payload.message = personalizeText(payload.message, user);
  }
  socket.emit("bot_reply", payload);
};

export const chatAI = async (socket, data) => {
  try {
    const { message, history, user } = data;

    socket.emit("bot_typing", { isTyping: true });

    if (history && Array.isArray(history) && history.length > 0) {
      const lastMsg = history[history.length - 1];

      if (lastMsg.role === "assistant") {
        const botText = lastMsg.content.toLowerCase();
        const cleanMsg = message
          .toLowerCase()
          .replace(/[.,!?;:\-]/g, "")
          .trim();
        const acceptWords = [
          "ok",
          "oke",
          "oki",
          "okla",
          "okela",
          "yes",
          "có",
          "đồng ý",
          "mua",
          "mua luôn",
          "được",
          "đc",
          "chuyển",
          "chuyển đi",
          "triển",
          "cần",
          "ừ",
          "um",
          "uhm",
          "uk",
          "ukm",
          "chơi",
          "chốt",
          "duyệt",
          "tiến hành",
        ];
        const rejectWords = [
          "không",
          "ko",
          "khum",
          "hong",
          "k",
          "no",
          "thôi",
          "thui",
          "khỏi",
          "không cần",
          "từ chối",
          "hủy",
          "dẹp",
          "đéo",
          "chưa",
          "không mua",
        ];
        const prefixRegex = "(dạ |vâng |thế |vậy |ừ thì |ờ thì )?";
        const acceptSuffixRegex = "( nhé| nha| đi| luôn| ạ| bạn| rùi| rồi)?";
        const rejectSuffixRegex = "( cần| đâu| nha| nhé| ạ| bạn| nữa)?";

        const acceptRegex = new RegExp(
          `^${prefixRegex}(${acceptWords.join("|")})${acceptSuffixRegex}$`,
          "i",
        );
        const rejectRegex = new RegExp(
          `^${prefixRegex}(${rejectWords.join("|")})${rejectSuffixRegex}$`,
          "i",
        );

        const isAccept = acceptRegex.test(cleanMsg);
        const isReject = rejectRegex.test(cleanMsg);

        if (
          botText.includes("premium") ||
          botText.includes("thanh toán") ||
          botText.includes("nâng cấp")
        ) {
          if (isAccept) {
            return sendSocketReply(
              socket,
              {
                action: "redirect_premium",
                message: `Ok bạn! Mình đang chuyển hướng bạn đến trang mua gói Premium nhé...`,
              },
              user,
            );
          }
        }
        if (
          botText.includes("hỗ trợ") ||
          botText.includes("admin") ||
          botText.includes("chuyên viên")
        ) {
          if (isAccept) {
            return sendSocketReply(
              socket,
              {
                action: "redirect_support",
                message: `Ok bạn! Mình đang chuyển bạn đến trang Hỗ trợ để liên hệ trực tiếp với Admin...`,
              },
              user,
            );
          }
        }
        if (
          (botText.includes("premium") ||
            botText.includes("thanh toán") ||
            botText.includes("hỗ trợ") ||
            botText.includes("admin")) &&
          isReject
        ) {
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `Dạ vâng, vậy bạn cứ tiếp tục trải nghiệm DevChill nhé. Cần giúp gì cứ gọi mình nha!`,
            },
            user,
          );
        }
      }
    }

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
      case "redirect_premium":
        return sendSocketReply(
          socket,
          {
            action: "redirect_premium",
            message: `Ok bạn! Mình đang chuyển hướng bạn đến trang mua gói Premium...`,
          },
          user,
        );

      case "suggest_from_history": {
        if (!user || !user.id) {
          return sendSocketReply(
            socket,
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
          return sendSocketReply(
            socket,
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
        if (detailData?.categories?.length > 0) {
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
            return sendSocketReply(
              socket,
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
        return sendSocketReply(
          socket,
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
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `Bạn muốn xem phim gì cơ? Gõ tên phim giúp mình nhé.`,
            },
            user,
          );
        }
        const resData = await movieService.getPublicMovies({
          keyword: aiParams.keyword,
          limit: 20,
        });
        const movieArr = extractData(resData) || [];

        if (movieArr.length === 0) {
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `DevChill không tìm thấy phim "${aiParams.keyword.replace(/\|/g, " ")}". Bạn kiểm tra lại tên giúp mình nha!`,
            },
            user,
          );
        }
        const normKeyword = normalizeVi(aiParams.keyword.replace(/\|/g, " "));
        const searchWords = normKeyword
          .split(/\s+/)
          .filter((w) => w.length > 1);

        let bestMatch = null;
        let maxScore = 0;

        for (const movie of movieArr) {
          const normName = normalizeVi(movie.name);
          const normOriginName = normalizeVi(movie.origin_name);
          let score = 0;
          if (
            normName === normKeyword ||
            normOriginName === normKeyword ||
            normName.includes(normKeyword) ||
            normOriginName.includes(normKeyword)
          ) {
            score += 100;
          }
          searchWords.forEach((w) => {
            if (normName.includes(w) || normOriginName.includes(w)) {
              score += 1;
            }
          });
          if (score > maxScore) {
            maxScore = score;
            bestMatch = movie;
          }
        }
        if (!bestMatch || maxScore === 0) {
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `Mình đã lục tìm nhưng hiện tại DevChill chưa có phim "${aiParams.keyword.replace(/\|/g, " ")}". Bạn thử tìm siêu phẩm khác xem sao nhé!`,
            },
            user,
          );
        }
        const movieFound = bestMatch;
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

            return sendSocketReply(
              socket,
              {
                action: "suggest_movies",
                message: `Phim "${movieFound.name}" đang trong trạng thái sắp chiếu, bạn vui lòng chờ đợi thêm chút thời gian nha! Trong lúc chờ, bạn xem thử mấy bộ này nhé:`,
                payload: similar,
              },
              user,
            );
          }

          if (movieFound.is_premium && (!user || !user.is_premium)) {
            return sendSocketReply(
              socket,
              {
                action: "ask_user",
                message: `Bạn chưa có gói Premium để xem phim "${movieFound.name}". Bạn có muốn chuyển sang trang nâng cấp Premium không?`,
              },
              user,
            );
          }

          return sendSocketReply(
            socket,
            {
              action: "redirect_play",
              slug: movieFound.slug,
              message: `Đang mở ${movieFound.name} cho bạn đây! Chúc bạn xem phim vui vẻ 🍿`,
            },
            user,
          );
        } else {
          return sendSocketReply(
            socket,
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
        if (!aiParams.keyword)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: "Bạn muốn xem diễn viên của phim nào?",
            },
            user,
          );

        const searchRes = await movieService.getPublicMovies({
          keyword: aiParams.keyword,
          limit: 1,
        });
        const movieArr = extractData(searchRes);

        if (!movieArr || movieArr.length === 0) {
          return sendSocketReply(
            socket,
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
          return sendSocketReply(
            socket,
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
        return sendSocketReply(
          socket,
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

        if (cleanParams.keyword) {
          let kwArray = cleanParams.keyword
            .toLowerCase()
            .split("|")
            .map((w) => w.trim());
          const trashWords = [
            "lồng",
            "tiếng",
            "thuyết",
            "minh",
            "vietsub",
            "dub",
            "raw",
            "hay",
            "hot",
            "mới",
            "nào",
            "phim",
          ];
          kwArray = kwArray.filter((w) => !trashWords.includes(w));
          if (kwArray.length === 0) {
            delete cleanParams.keyword;
          } else {
            cleanParams.keyword = kwArray.join("|");
          }
        }
        if (!cleanParams.keyword || cleanParams.keyword.trim() === "")
          delete cleanParams.keyword;

        const resData = await movieService.getPublicMovies(cleanParams);
        const resultArr = extractData(resData) || [];

        if (resultArr.length === 0) {
          if (cleanParams.keyword) {
            const kwDisplay = cleanParams.keyword.replace(/\|/g, ", ");
            return sendSocketReply(
              socket,
              {
                action: "ask_user",
                message: `Mình đã tìm kỹ nội dung "${kwDisplay}" nhưng chưa thấy phim nào khớp trong kho. Bạn thử từ khóa khác nhé!`,
              },
              user,
            );
          }
          if (cleanParams.category)
            return sendSocketReply(
              socket,
              {
                action: "ask_user",
                message:
                  "Hiện tại kho phim thể loại này đang trống, bạn xem thử thể loại khác để giải trí nhé!",
              },
              user,
            );
          if (cleanParams.lang)
            return sendSocketReply(
              socket,
              {
                action: "ask_user",
                message:
                  "Hiện tại DevChill chưa cập nhật phim có định dạng ngôn ngữ này. Bạn thử xem định dạng khác nhé!",
              },
              user,
            );

          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message:
                "Mình không tìm thấy bộ phim nào khớp với yêu cầu của bạn. Bạn thử gợi ý khác xem sao!",
            },
            user,
          );
        }

        let replyMsg = "DevChill tìm thấy các kết quả này cho bạn:";
        if (cleanParams.category === "hai")
          replyMsg =
            "Đang vui lại càng thêm vui! Triển ngay mấy bộ tấu hài cực bựa này cho rộn ràng nhé! 😂";
        else if (cleanParams.category === "tinh-cam")
          replyMsg =
            "Tâm trạng đang vui vẻ phơi phới đúng không? Thêm chút ngọt ngào lãng mạn với list siêu phẩm này nhé! 💕";
        else if (cleanParams.category === "tam-ly")
          replyMsg =
            "Có những ngày tâm trạng hơi chùng xuống... Để DevChill vỗ về bạn bằng mấy bộ phim sâu lắng này nha 🥺";
        else if (cleanParams.category === "gia-dinh")
          replyMsg =
            "Cần một chút bình yên chữa lành? Mấy bộ phim gia đình nhẹ nhàng này là chuẩn bài luôn! 🏡";
        else if (cleanParams.category === "kinh-di")
          replyMsg =
            "Chuẩn bị tinh thần tỉnh ngủ chưa? Đóng cửa tắt đèn cày mấy bộ rùng rợn này nhé! 👻";
        else if (
          cleanParams.category === "hanh-dong" ||
          cleanParams.category === "hinh-su"
        )
          replyMsg =
            "Thích cảm giác mạnh à? List phim hành động cháy nổ đùng đùng này sinh ra để dành cho bạn! 🔥";
        else if (cleanParams.category === "hoat-hinh")
          replyMsg =
            "Xin vé đi tuổi thơ hay tìm phim cho bé nhà mình xem? List hoạt hình siêu dễ thương này là chân ái luôn nha! 🧸✨";
        else if (cleanParams.country === "viet-nam")
          replyMsg =
            "Người Việt ủng hộ phim Việt nào! Điểm danh ngay những siêu phẩm điện ảnh và truyền hình hot nhất nước mình nhé 🇻🇳🍿";
        else if (cleanParams.country === "han-quoc")
          replyMsg =
            "Mê phim Hàn thì bơi hết vào đây! Toàn siêu phẩm oppa cực phẩm thôi nhé 🇰🇷";
        else if (cleanParams.country === "trung-quoc")
          replyMsg =
            "Các tỷ tỷ và ca ca Hoa Ngữ đang chờ bạn cày view trong list phim hot này nè 🇨🇳";
        else if (cleanParams.country === "au-my")
          replyMsg =
            "Chuẩn gu Âu Mỹ Hollywood rồi, đổi gió với list phim đỉnh cao này nha 🎬";
        else if (cleanParams.country) {
          const countryName = cleanParams.country.replace(/-/g, " "); 
          replyMsg = `Kho phim ${countryName} đầy hấp dẫn cho bạn đây. Đổi gió với list siêu phẩm này nhé! 🍿`;
        } else if (cleanParams.keyword)
          replyMsg = `Mình đã lục tung kho và nhặt ra các phim sát với cốt truyện "${cleanParams.keyword.replace(/\|/g, " ")}" nhất, bạn ưng bộ nào không?`;
        else if (cleanParams.year)
          replyMsg = `Hàng nóng hổi đây! Danh sách các phim nổi bật của năm ${cleanParams.year} cho bạn nè:`;

        return sendSocketReply(
          socket,
          { action: "suggest_movies", message: replyMsg, payload: resultArr },
          user,
        );
      }

      case "getPublicMovieById":
        return socket.emit(
          "bot_reply",
          extractData(await movieService.getPublicMovieById(aiParams.id)),
        );

      case "getMovieWatch":
        return socket.emit(
          "bot_reply",
          extractData(
            await movieService.getMovieWatch(aiParams.slug, aiParams, user),
          ),
        );

      case "getCategories":
        return socket.emit(
          "bot_reply",
          extractData(await movieService.getCategories()) || [],
        );

      case "getCountries":
        return socket.emit(
          "bot_reply",
          extractData(await movieService.getCountries()) || [],
        );

      case "getUserHistory": {
        if (!user || !user.id)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `Bạn cần đăng nhập để xem lại lịch sử phim nhé! 🎬`,
            },
            user,
          );
        const limit = aiParams.limit || 10;
        const page = aiParams.page || 1;
        const historyData = extractData(
          await watchHistoryService.getUserHistory(
            user.id,
            limit,
            (page - 1) * limit,
          ),
        );

        if (!historyData || historyData.length === 0) {
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `Tài khoản của bạn chưa xem bộ phim nào trên DevChill cả.`,
            },
            user,
          );
        }
        return socket.emit("bot_reply", {
          action: "user_history",
          payload: historyData,
        });
      }

      case "clearAllHistory": {
        if (!user || !user.id)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: `Bạn chưa đăng nhập nên mình không có lịch sử nào để xoá.`,
            },
            user,
          );
        await watchHistoryService.clearAllHistory(user.id);
        return sendSocketReply(
          socket,
          {
            action: "ask_user",
            message: `Đã xoá toàn bộ lịch sử xem phim của bạn thành công!`,
          },
          user,
        );
      }

      case "info_premium": {
        try {
          const plansData = await planService.getAllPlansService();
          const activePlans = plansData.filter((p) => p.status === "active");

          if (activePlans.length === 0)
            return sendSocketReply(
              socket,
              {
                action: "ask_user",
                message:
                  "Hiện tại hệ thống DevChill chưa mở bán gói Premium nào. Bạn chờ thông báo sau nhé!",
              },
              user,
            );

          let planMsg =
            "Chào bạn! Hiện tại DevChill đang cung cấp các gói VIP siêu ưu đãi sau:\n";
          let popularPlan = null;

          activePlans.forEach((p) => {
            const priceFormat = new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
            }).format(p.price);
            planMsg += `⭐ ${p.name}: ${priceFormat}\n`;
            if (p.is_popular) popularPlan = p;
          });

          if (popularPlan) {
            const priceFormat = new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
            }).format(popularPlan.price);
            planMsg += `\n💡 Lời khuyên: Đa số thành viên DevChill đang chọn gói [${popularPlan.name}] với giá chỉ ${priceFormat} nhưng hưởng trọn vẹn đặc quyền: ${popularPlan.description.features.join(", ")}.\n\nBạn có muốn chuyển sang trang Thanh toán để xem chi tiết không?`;
          } else {
            planMsg +=
              "\nBạn có muốn chuyển sang trang Thanh toán để nâng cấp không?";
          }
          return sendSocketReply(
            socket,
            { action: "ask_user", message: planMsg },
            user,
          );
        } catch (error) {
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message:
                "Đang có chút trục trặc khi lấy thông tin gói cước. Bạn thử lại sau nhé!",
            },
            user,
          );
        }
      }

      case "payment_issue_step_1":
        return sendSocketReply(
          socket,
          {
            action: "ask_user",
            message:
              "Rất xin lỗi vì sự bất tiện này! Đôi khi hệ thống cần chút thời gian để đồng bộ. Bạn vui lòng thử tải lại trang (F5) hoặc đăng xuất rồi đăng nhập lại xem tài khoản đã lên VIP chưa nhé. Nếu vẫn chưa được, hãy báo lại cho mình biết!",
          },
          user,
        );

      case "payment_issue_step_2":
        return sendSocketReply(
          socket,
          {
            action: "ask_user",
            message:
              "Thật xin lỗi vì lỗi vẫn còn. Trường hợp này mình cần chuyên viên vào kiểm tra giao dịch của bạn. Bạn có muốn chuyển sang trang Hỗ trợ (Support) để nhắn tin trực tiếp với Admin không?",
          },
          user,
        );

      case "account_issue":
        return sendSocketReply(
          socket,
          {
            action: "ask_user",
            message:
              "Để thay đổi mật khẩu, bạn vui lòng tự thao tác trong phần 'Thông tin cá nhân' nhé. Tuy nhiên, nếu bạn cần thay đổi địa chỉ Email, để đảm bảo an toàn, bạn phải liên hệ với Admin để được hỗ trợ xác minh. Bạn có muốn mình chuyển bạn sang trang Hỗ trợ để gặp Admin luôn không?",
          },
          user,
        );

      case "redirect_support":
        return sendSocketReply(
          socket,
          {
            action: "redirect_support",
            message: `Ok bạn! Mình đang chuyển bạn đến trang Hỗ trợ để liên hệ với Admin...`,
          },
          user,
        );

      case "continue_watching": {
        if (!user || !user.id)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message:
                "Bạn cần đăng nhập để mình biết bạn đang xem dở phim gì nhé! 🍿",
            },
            user,
          );
        const historyData =
          extractData(
            await watchHistoryService.getUserHistory(user.id, 1, 0),
          ) || [];
        if (historyData.length === 0)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message:
                "Mình kiểm tra thì chưa thấy bạn xem dở bộ phim nào cả. Cùng chọn một siêu phẩm mới nhé!",
            },
            user,
          );
        return sendSocketReply(
          socket,
          {
            action: "redirect_play",
            slug: historyData[0].movie_slug,
            message: `Mình đang mở lại "${historyData[0].movie_name}" cho bạn xem tiếp nhé!`,
          },
          user,
        );
      }

      case "get_upcoming": {
        let finalLimit = aiParams.limit || 10;
        if (finalLimit < 5) finalLimit = 10;
        const upcomingMovies =
          extractData(
            await movieService.getPublicMovies({
              ...aiParams,
              limit: finalLimit,
              lifecycle_status: "upcoming",
            }),
          ) || [];
        if (upcomingMovies.length === 0)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message:
                "Hiện tại hệ thống chưa cập nhật bộ phim sắp chiếu nào. Bạn xem tạm các siêu phẩm đang hot nhé!",
            },
            user,
          );
        return sendSocketReply(
          socket,
          {
            action: "suggest_movies",
            message:
              "Đây là danh sách các siêu phẩm sắp đổ bộ trên DevChill, bạn hóng thử nhé:",
            payload: upcomingMovies,
          },
          user,
        );
      }

      case "random_surprise": {
        const moviesArr =
          extractData(await movieService.getPublicMovies({ limit: 30 })) || [];
        if (moviesArr.length === 0)
          return sendSocketReply(
            socket,
            {
              action: "ask_user",
              message: "Kho phim đang bảo trì nhẹ, bạn quay lại sau nhé!",
            },
            user,
          );
        return sendSocketReply(
          socket,
          {
            action: "random_surprise",
            message:
              "DevChill đã dùng nhân phẩm quay cho bạn siêu phẩm này! Nhấn Phát để xem ngay nào 🍿",
            payload: [moviesArr[Math.floor(Math.random() * moviesArr.length)]],
          },
          user,
        );
      }

      case "easter_egg_about_dev":
        return sendSocketReply(
          socket,
          {
            action: "ask_user",
            message:
              "Hehe ngại quá! Hệ thống siêu cấp VIP Pro này được thiết kế và phát triển bởi đội ngũ DevChill cực kỳ tâm huyết đó. Từ giao diện mang hơi hướng Glassmorphism sang xịn, đến backend mạnh mẽ... tất cả để mang lại trải nghiệm xem phim mượt mà nhất cho bạn! 💻✨",
          },
          user,
        );

      case "ask_user": {
        let finalMessage =
          ai.message || aiParams.message || "DevChill đang nghe đây...";
        finalMessage = finalMessage.replace(/\[Hệ thống.*\]/gi, "").trim();
        return sendSocketReply(
          socket,
          { action: "ask_user", message: finalMessage },
          user,
        );
      }

      default:
        return sendSocketReply(
          socket,
          {
            action: "ask_user",
            message: "DevChill chưa hiểu ý bạn, bạn nói lại nhé?",
          },
          user,
        );
    }
  } catch (err) {
    console.error("AI ERROR:", err);
    return socket.emit("bot_error", { error: "Lỗi hệ thống AI" });
  }
};
