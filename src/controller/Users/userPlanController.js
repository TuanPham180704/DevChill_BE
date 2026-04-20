import * as service from "../../services/Users/planUserServies.js";

export const getAllPlans = async (req, res) => {
  try {
    const data = await service.getAllPlansService();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy danh sách gói" });
  }
};

export const getPlanById = async (req, res) => {
  try {
    const data = await service.getPlanByIdService(req.params.id);
    if (!data) return res.status(404).json({ message: "Không tìm thấy gói" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy chi tiết gói" });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const data = await service.getMySubscriptionService(userId);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy subscription" });
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { txnRef } = req.params;

    const data = await service.getPaymentStatusService(txnRef);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lấy trạng thái thanh toán" });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const data = await service.getPaymentHistoryService(userId);

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Lỗi lịch sử thanh toán" });
  }
};
