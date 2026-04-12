import * as movieService from "../../services/Admin/movieService.js";
export const createMovie = async (req, res) => {
  try {
    if (!req.body.contract_id) {
      return res.status(400).json({
        status: false,
        msg: "contract_id is required",
      });
    }
    const movieId = await movieService.createMovie(req.body);
    const movie = await movieService.getMovieById(movieId);

    res.status(201).json({
      status: true,
      data: movie,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      msg: err.message,
    });
  }
};
export const updateMovie = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        status: false,
        msg: "Invalid movie ID",
      });
    }

    await movieService.updateMovie(id, req.body);
    const movie = await movieService.getMovieById(id);

    res.json({
      status: true,
      data: movie,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      msg: err.message,
    });
  }
};
export const getAllMovies = async (req, res) => {
  try {
    const { q, page, limit, country, category } = req.query;

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;

    const data = await movieService.getAllMovies({
      q,
      page: pageNum,
      limit: limitNum,
      country,
      category,
    });

    res.json({
      status: true,
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      msg: err.message,
    });
  }
};

export const getMovieById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        status: false,
        msg: "Invalid movie ID",
      });
    }

    const movie = await movieService.getMovieById(id);
    if (!movie) {
      return res.status(404).json({
        status: false,
        msg: "Movie not found",
      });
    }

    res.json({
      status: true,
      data: movie,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      msg: err.message,
    });
  }
};
