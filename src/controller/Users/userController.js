import * as userService from "../../services/Users/userService.js";

export const getProfileController = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

export const updateProfileController = async (req, res) => {
  const { username, gender, avatar_url, birth_date } = req.body;
  if (!username && !gender && !avatar_url && !birth_date) {
    return res.status(400).json({ message: "No fields to update" });
  }
  try {
    const user = await userService.updateProfile(
      req.user.id,
      username,
      gender,
      avatar_url,
      birth_date, 
    );
    res.json(user);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};

export const changePasswordController = async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Missing fields" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Password mismatch" });
  }

  try {
    const result = await userService.changePassword(
      req.user.id,
      oldPassword,
      newPassword,
    );
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
};
