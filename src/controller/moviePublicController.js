import * as movieService from "../services/movieService.js";

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
