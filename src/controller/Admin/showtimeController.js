import * as showtimeService from "../../services/Admin/showtimeServie.js";

export const create = async (req, res) => {
  try {
    const result = await showtimeService.createShowtime({
      ...req.body,
      created_by: req.user.id,
    });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const result = await showtimeService.getAllShowtimes(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    const result = await showtimeService.getShowtimeById(req.params.id);
    if (!result) return res.status(404).json({ message: "Không tìm thấy" });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const result = await showtimeService.updateShowtime(
      req.params.id,
      req.body,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
