import * as movieService from "../services/moviePublicServices.js";

export const getPublicMovies = async (req, res) => {
  try {
    const result = await movieService.getPublicMovies(req.query);

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

export const getPublicMovieById = async (req, res) => {
  try {
    const movie = await movieService.getPublicMovieById(req.params.id);

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
