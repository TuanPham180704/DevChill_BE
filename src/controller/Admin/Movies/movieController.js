import * as movieService from "../../../services/Admin/Movies/movieService.js";

/* ================= CREATE ================= */
export const createMovie = async (req, res) => {
  try {
    const id = await movieService.createMovie(req.body);

    res.status(201).json({
      success: true,
      data: { movie_id: id },
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= UPDATE INFO ================= */
export const updateInfo = async (req, res) => {
  try {
    const movie = await movieService.updateInfo(req.params.id, req.body);

    res.json({
      success: true,
      data: movie, // 🔥 trả luôn data giống contract
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= UPDATE META ================= */
export const updateMeta = async (req, res) => {
  try {
    const movie = await movieService.updateMeta(req.params.id, req.body);

    res.json({
      success: true,
      data: movie,
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= UPDATE MEDIA ================= */
export const updateMedia = async (req, res) => {
  try {
    const movie = await movieService.updateMedia(req.params.id, req.body);

    res.json({
      success: true,
      data: movie,
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= UPDATE SETTING ================= */
export const updateSetting = async (req, res) => {
  try {
    const movie = await movieService.updateSetting(req.params.id, req.body);

    res.json({
      success: true,
      data: movie,
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= GET ALL ================= */
export const getAll = async (req, res) => {
  try {
    const result = await movieService.getAll(req.query);

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= GET BY ID ================= */
export const getById = async (req, res) => {
  try {
    const movie = await movieService.getById(req.params.id);

    res.json({
      success: true,
      data: movie,
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

/* ================= RECOMMEND ================= */
export const recommend = async (req, res) => {
  try {
    const movies = await movieService.recommend(req.params.id);

    res.json({
      success: true,
      data: movies,
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};
