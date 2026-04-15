import * as movieService from "../../../services/movieService.js";

export const createMovie = async (req, res) => {
  try {
    const movie = await movieService.createMovie(req.body);

    res.status(201).json({
      success: true,
      data: { movie_id: movie.id },
    });
  } catch (err) {
    res.status(err.status || 400).json({
      success: false,
      message: err.message,
    });
  }
};

export const updateInfo = async (req, res) => {
  try {
    const movie = await movieService.updateInfo(req.params.id, req.body);
    if (!movie) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }
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
