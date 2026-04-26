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
    const is_public = req.query.is_public === "true";
    const movie = await movieService.getPublicMovieById(
      req.params.id,
      is_public,
    );

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

export const getCategories = async (req, res) => {
  try {
    const data = await movieService.getCategories();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getCountries = async (req, res) => {
  try {
    const data = await movieService.getCountries();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getYears = async (req, res) => {
  try {
    const data = await movieService.getYears();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
export const watchMovie = async (req, res) => {
  try {
    const { slug } = req.params;
    const user = req.user || null;

    const data = await movieService.getMovieWatch(slug, req.query, user);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dữ liệu",
      });
    }

    if (data.locked) {
      return res.status(403).json({
        success: false,
        ...data,
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
    });
  }
};
