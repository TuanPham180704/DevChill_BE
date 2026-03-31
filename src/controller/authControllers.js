import * as authService from "../services/authServices.js";

export const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    const data = await authService.register(
      username,
      email,
      password,
      confirmPassword,
    );
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    const data = await authService.verifyOtp(email, code);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const data = await authService.resendOtp(email);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await authService.login(email, password);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const data = await authService.forgotPassword(email);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const data = await authService.resetPassword(token, newPassword);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
