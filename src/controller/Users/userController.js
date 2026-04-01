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
  const { username, email, gender, avatar_url } = req.body;

  try {
    const user = await userService.updateProfile(
      req.user.id,
      username,
      email,
      gender,
      avatar_url,
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
