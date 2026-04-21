// controllers/admin/paymentController.js
import * as paymentService from "../../services/Admin/paymentService.js";

export const getAllPayments = async (req, res) => {
  try {
    const data = await paymentService.getAllPaymentsService(req.query);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const data = await paymentService.getPaymentByIdService(req.params.id);
    if (!data) return res.status(404).json({ message: "Not found" });

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { note } = req.body;

    const result = await paymentService.verifyPaymentService(
      req.params.id,
      adminId,
      note,
    );

    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
