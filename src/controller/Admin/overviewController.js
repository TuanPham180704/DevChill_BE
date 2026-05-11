import * as service from "../../services/Admin/overViewServices.js";

export const getDashboard24h = async (req, res) => {
  try {
    const data = await service.getDashboard24hService();
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Dashboard 24h Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Lỗi hệ thống khi lấy dữ liệu 24h." });
  }
};

export const getReport = async (req, res) => {
  try {
    const { from_date, to_date, type = "day" } = req.query;

    if (!from_date || !to_date) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu from_date hoặc to_date" });
    }

    const data = await service.getReportService({ from_date, to_date, type });
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Report Error:", error);
    res.status(500).json({ success: false, message: "Lỗi truy xuất báo cáo." });
  }
};
