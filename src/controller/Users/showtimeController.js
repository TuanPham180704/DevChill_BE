import * as showtimeUserService from "../../services/Users/showtimeServices.js";

export const getAllPublic = async (req, res) => {
  try {
    const showtimes = await showtimeUserService.getPublicShowtimes(req.query);
    res.status(200).json({ success: true, data: showtimes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDetail = async (req, res) => {
  try {
    const showtime = await showtimeUserService.getShowtimeWatchDetail(
      req.params.id,
    );
    if (!showtime)
      return res.status(404).json({ message: "Không tìm thấy suất chiếu" });

    const { streams, ...safeShowtimeData } = showtime;

    res.status(200).json({
      success: true,
      data: safeShowtimeData,
      server_time: new Date(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const watchPremiere = async (req, res) => {
  try {
    const showtimeId = req.params.id;
    const user = req.user;

    const showtime =
      await showtimeUserService.getShowtimeWatchDetail(showtimeId);

    if (!showtime) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy suất chiếu" });
    }
    const movieMetadata = {
      movie_name: showtime.movie_name,
      episode_name: showtime.episode_name,
      poster_url: showtime.poster_url,
      description: showtime.description,
      actors: showtime.actors,
    };

    if (showtime.status === "cancelled") {
      return res.status(200).json({
        success: true,
        status: "cancelled",
        data: movieMetadata,
        message:
          "Suất chiếu này đã bị hủy bởi quản trị viên. Vui lòng quay lại sau.",
      });
    }

    if (showtime.movie_is_premium && !user?.is_premium) {
      return res.status(403).json({
        success: false,
        message:
          "Nội dung này dành riêng cho thành viên Premium. Vui lòng nâng cấp gói để xem.",
      });
    }

    const now = new Date();
    const start = new Date(showtime.start_time);
    const end = new Date(showtime.end_time);

    if (now < start) {
      return res.status(200).json({
        success: true,
        status: "scheduled",
        data: movieMetadata, 
        start_time: showtime.start_time,
        message: "Phim chưa đến giờ công chiếu. Vui lòng quay lại sau.",
      });
    }

    if (now > end || showtime.status === "ended") {
      return res.status(200).json({
        success: true,
        status: "ended",
        data: movieMetadata,
        message: "Suất chiếu đã kết thúc.",
      });
    }

    const currentOffset = Math.floor((now - start) / 1000);

    if (!showtime.streams || showtime.streams.length === 0) {
      console.warn(
        `[WARNING] Showtime ${showtimeId} is playing but stream is empty. Check DB status update cronjob!`,
      );
    }

    res.status(200).json({
      success: true,
      status: "live",
      data: {
        ...movieMetadata,
        current_offset: currentOffset,
        streams: showtime.streams,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
