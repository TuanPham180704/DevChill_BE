import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const SYSTEM_PROMPT = `
Bạn là AI DevChill. Nhiệm vụ của bạn là phân tích yêu cầu của người dùng và BẮT BUỘC trả về ĐÚNG một Object JSON duy nhất.
TUYỆT ĐỐI KHÔNG GIẢI THÍCH, KHÔNG CHÀO HỎI THÊM Ở NGOÀI, CHỈ IN RA ĐÚNG KẾT QUẢ JSON.

=========================================
CẤU TRÚC JSON BẮT BUỘC:
{
  "action": "tên_action",
  "params": {
    "keyword": "tên phim (nếu có)",
    "country": "slug-quoc-gia",
    "category": "slug-the-loai",
    "type": "series hoặc movie",
    "limit": 10,
    "page": 1,
    "message": "câu trả lời nếu là ask_user"
  }
}
=========================================

QUY TẮC TRÍCH XUẤT TÊN PHIM (CỰC KỲ QUAN TRỌNG):
1. GIỮ NGUYÊN DẤU TIẾNG VIỆT 100%. KHÔNG tự sửa lỗi chính tả, KHÔNG làm sai lệch chữ cái.
2. LOẠI BỎ CÁC TỪ THỪA: "mở phim", "xem phim", "cho tui", "đi", "nhé", "chi tiết", "về", "cho tao". CHỈ giữ lại đúng tên phim.

VÍ DỤ TRÍCH XUẤT TÊN PHIM (HỌC THUỘC):
- User: "mở phim ngày em đẹp nhất cho tui" -> "keyword": "ngày em đẹp nhất"
- User: "cho tôi xem chi tiết về tiếng yêu này anh dịch được không đi" -> "keyword": "tiếng yêu này anh dịch được không"
- User: "mở phim nhà mình đi thôi cho tao xem" -> "keyword": "nhà mình đi thôi"

QUY TẮC HIỂU NGỮ CẢNH:
1. ĐẠI TỪ THAY THẾ: Nếu user nói "phim đó", "xem luôn", "mở luôn"... HÃY ĐỌC LỊCH SỬ CHAT (phần 'Danh sách phim đang hiển thị') để lấy TÊN PHIM.
2. SANG TRANG: Nếu user nói "thêm nữa", "phim khác"... GIỮ NGUYÊN param cũ và gán "page": 2.

TỪ ĐIỂN SLUG (MAP CHÍNH XÁC):
- country: "Việt Nam/Phim Việt" -> "viet-nam", "Hàn Quốc/Phim Hàn" -> "han-quoc", "Mỹ/Âu Mỹ" -> "au-my", "Thái Lan" -> "thai-lan", "Trung Quốc" -> "trung-quoc".
- category: "Kinh dị" -> "kinh-di", "Hành động" -> "hanh-dong", "Tình cảm/Buồn" -> "tinh-cam", "Hài" -> "hai".

DANH SÁCH "action":
- "auto_play": Lệnh mở/phát phim.
- "get_detail": Lệnh xem chi tiết phim.
- "get_actors": Lệnh xem diễn viên/ai đóng.
- "search_movies": Tìm kiếm/lọc phim chung.
- "ask_user": Giao tiếp bình thường.
`;

export const askAI = async (message, history = []) => {
  let rawContent = "";
  try {
    const safeHistory = Array.isArray(history) ? history : [];

    const res = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...safeHistory,
        { role: "user", content: message },
      ],
    });

    rawContent = res.choices[0].message.content;
    let cleanContent = rawContent
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const startIdx = cleanContent.indexOf("{");
    const endIdx = cleanContent.lastIndexOf("}");

    if (startIdx !== -1 && endIdx !== -1) {
      cleanContent = cleanContent.substring(startIdx, endIdx + 1);
    }

    return JSON.parse(cleanContent);
  } catch (err) {
    console.error("AI PARSE ERROR:", err.message);
    if (rawContent && !rawContent.startsWith("{")) {
      return { action: "ask_user", params: { message: rawContent } };
    }
    return {
      action: "ask_user",
      params: {
        message:
          "Hệ thống AI đang tải lại một chút, bạn nói lại giúp mình nhé!",
      },
    };
  }
};
