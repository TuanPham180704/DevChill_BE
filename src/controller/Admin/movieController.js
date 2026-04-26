import * as movieService from "../../services/Admin/movieService.js";

export const createMovie = async (req, res) => {
  try {
    const movie = await movieService.createMovie(req.body);

    res.status(201).json({
      success: true,
      data: {
        movie_id: movie.id,
        slug: movie.slug,
        status: movie.status,
        lifecycle_status: movie.lifecycle_status,
      },
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
    const allowed = [
      "status",
      "lifecycle_status",
      "production_status",
      "is_available",
      "is_premium",
      "source",
    ];

    const filtered = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        filtered[key] = req.body[key];
      }
    }

    const movie = await movieService.updateSetting(req.params.id, filtered);

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
      stats: result.stats,
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
    const is_public = req.query.is_public === "true";
    const movie = await movieService.getById(req.params.id, is_public);

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
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
