import * as userService from "../../services/Admin/userAdServices.js";

export const getAllUsers = async (req, res) => {
  try {
    const data = await userService.getAllUsers(req.query);
    res.json(data);
  } catch (err) {
    console.error("getAllUsers error:", err);
    res.status(500).json({
      message: "Lỗi server khi lấy danh sách user",
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy user",
      });
    }

    res.json(user);
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({
      message: "Lỗi server khi lấy user",
    });
  }
};
export const updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);

    if (!user) {
      return res.status(400).json({
        message: "Không có dữ liệu hợp lệ để cập nhật",
      });
    }

    res.json(user);
  } catch (err) {
    console.error("updateUser error:", err);
    res.status(500).json({
      message: "Lỗi server khi cập nhật user",
    });
  }
};

export const lockUser = async (req, res) => {
  try {
    const { lock_until, block_reason } = req.body;

    if (!lock_until || !block_reason) {
      return res.status(400).json({
        message: "Thiếu thời gian khóa hoặc lý do khóa",
      });
    }

    const user = await userService.lockUser(req.params.id, req.body);

    if (!user) {
      return res.status(404).json({
        message: "User không tồn tại",
      });
    }

    res.json({
      message: "Đã khóa user thành công",
      user,
    });
  } catch (err) {
    console.error("lockUser error:", err);

    res.status(err.status || 500).json({
      message: err.message || "Lỗi server khi khóa user",
    });
  }
};
export const unlockUser = async (req, res) => {
  try {
    const user = await userService.unlockUser(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    res.json({ message: "Người dùng đã được mở khóa thành công", user });
  } catch (err) {
    console.error("unlockUser error:", err);
    res.status(500).json({ message: "Lỗi server khi mở khóa user" });
  }
};
