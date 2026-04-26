import * as planService from "../../services/Admin/planService.js";

export const createPlan = async (req, res) => {
  try {
    const plan = await planService.createPlanService(req.body);

    res.json({
      message: "Tạo gói thành công",
      data: plan,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updatePlan = async (req, res) => {
  try {
    const plan = await planService.updatePlanService(req.params.id, req.body);

    if (!plan) {
      return res.status(404).json({ message: "Không tìm thấy gói" });
    }

    res.json({
      message: "Cập nhật thành công",
      data: plan,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getAllPlansAdmin = async (req, res) => {
  try {
    const { page, limit, keyword, status, sort_by, order } = req.query;
    const result = await planService.getAllPlansAdminService({
      page,
      limit,
      keyword,
      status,
      sort_by,
      order,
    });

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const plan = await planService.getPlanByIdService(req.params.id);

    if (!plan) {
      return res.status(404).json({ message: "Không tìm thấy gói" });
    }

    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const togglePlanStatus = async (req, res) => {
  try {
    const plan = await planService.togglePlanStatusService(req.params.id);

    if (!plan) {
      return res.status(404).json({ message: "Không tìm thấy gói" });
    }

    res.json({
      message:
        plan.status === "active"
          ? "Kích hoạt gói thành công"
          : "Đã vô hiệu hóa gói",
      data: plan,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
