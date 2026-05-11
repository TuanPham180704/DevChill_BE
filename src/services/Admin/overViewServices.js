import pool from "../../config/db.js";

export const getDashboard24hService = async () => {
  const kpiAlertQuery = `
    SELECT
      (SELECT COUNT(*) FROM users WHERE DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS new_users,
      (SELECT COUNT(*) FROM payments WHERE status = 'success' AND DATE(paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS total_transactions,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'success' AND DATE(paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS revenue,
      (SELECT COUNT(*) FROM payments WHERE status = 'failed' AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS payment_failed,
      (SELECT COUNT(*) FROM support_requests WHERE status = 'open') AS open_tickets
  `;
  const timeSeries = `
    SELECT generate_series(
      date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh'),
      date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') + INTERVAL '23 hours',
      '1 hour'::interval
    ) AS hour_slot
  `;
  const viewsByHourQuery = `
    WITH hours AS (${timeSeries})
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, COUNT(DISTINCT wh.user_id) AS views
    FROM hours h
    LEFT JOIN watch_history wh 
      ON EXTRACT(HOUR FROM wh.last_watched_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot)
      AND DATE(wh.last_watched_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY h.hour_slot ORDER BY h.hour_slot ASC
  `;
  const revenueByHourQuery = `
    WITH hours AS (${timeSeries})
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, COALESCE(SUM(p.amount), 0) AS revenue
    FROM hours h
    LEFT JOIN payments p 
      ON EXTRACT(HOUR FROM p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot)
      AND p.status = 'success'
      AND DATE(p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY h.hour_slot ORDER BY h.hour_slot ASC
  `;
  const transByHourQuery = `
    WITH hours AS (${timeSeries})
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, COUNT(p.id) AS trans_count
    FROM hours h
    LEFT JOIN payments p 
      ON EXTRACT(HOUR FROM p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot)
      AND p.status = 'success'
      AND DATE(p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY h.hour_slot ORDER BY h.hour_slot ASC
  `;
  const usersByHourQuery = `
    WITH hours AS (${timeSeries})
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, COUNT(u.id) AS user_count
    FROM hours h
    LEFT JOIN users u 
      ON EXTRACT(HOUR FROM u.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot)
      AND DATE(u.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY h.hour_slot ORDER BY h.hour_slot ASC
  `;
  const alertsByHourQuery = `
    WITH hours AS (${timeSeries}) 
    SELECT TO_CHAR(h.hour_slot, 'HH24:00') AS hour, 
      (SELECT COUNT(id) FROM payments p WHERE EXTRACT(HOUR FROM p.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot) AND p.status = 'failed' AND DATE(p.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) +
      (SELECT COUNT(id) FROM support_requests sr WHERE EXTRACT(HOUR FROM sr.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = EXTRACT(HOUR FROM h.hour_slot) AND DATE(sr.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AS alert_count
    FROM hours h ORDER BY h.hour_slot ASC
  `;
  const topMoviesQuery = `
    SELECT m.id, m.name, m.poster_url, COUNT(DISTINCT wh.user_id) AS views
    FROM watch_history wh
    JOIN movies m ON wh.movie_id = m.id
    WHERE DATE(wh.last_watched_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = DATE(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')
    GROUP BY m.id, m.name, m.poster_url
    ORDER BY views DESC LIMIT 5
  `;
  const [
    kpiAlertRes,
    viewsRes,
    revenueRes,
    transRes,
    usersRes,
    alertsRes,
    topMoviesRes,
  ] = await Promise.all([
    pool.query(kpiAlertQuery),
    pool.query(viewsByHourQuery),
    pool.query(revenueByHourQuery),
    pool.query(transByHourQuery),
    pool.query(usersByHourQuery),
    pool.query(alertsByHourQuery),
    pool.query(topMoviesQuery),
  ]);

  const kpiAlertData = kpiAlertRes.rows[0];

  return {
    kpi: {
      new_users: Number(kpiAlertData.new_users),
      total_transactions: Number(kpiAlertData.total_transactions),
      revenue: Number(kpiAlertData.revenue),
    },
    alerts: {
      payment_failed: Number(kpiAlertData.payment_failed),
      open_tickets: Number(kpiAlertData.open_tickets),
    },
    views_by_hour: viewsRes.rows.map((r) => ({
      hour: r.hour,
      views: Number(r.views),
    })),
    revenue_by_hour: revenueRes.rows.map((r) => ({
      hour: r.hour,
      revenue: Number(r.revenue),
    })),
    trans_by_hour: transRes.rows.map((r) => ({
      hour: r.hour,
      count: Number(r.trans_count),
    })),
    users_by_hour: usersRes.rows.map((r) => ({
      hour: r.hour,
      count: Number(r.user_count),
    })),
    alerts_by_hour: alertsRes.rows.map((r) => ({
      hour: r.hour,
      count: Number(r.alert_count),
    })),
    top_movies: topMoviesRes.rows.map((r) => ({
      ...r,
      views: Number(r.views),
    })),
  };
};

export const getReportService = async ({ from_date, to_date, type }) => {
  let intervalType = "1 day";
  let groupFormat = "YYYY-MM-DD";

  if (type === "week") {
    intervalType = "1 week";
    groupFormat = "IYYY-IW";
  } else if (type === "month") {
    intervalType = "1 month";
    groupFormat = "YYYY-MM";
  } else if (type === "year") {
    intervalType = "1 year";
    groupFormat = "YYYY";
  }

  const timeSeriesCTE = `WITH time_series AS (SELECT generate_series($1::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', $2::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', '${intervalType}'::interval) AS slot)`;

  const viewsQuery = `${timeSeriesCTE} SELECT TO_CHAR(ts.slot, '${groupFormat}') AS label, COUNT(DISTINCT wh.user_id) AS views FROM time_series ts LEFT JOIN watch_history wh ON TO_CHAR(wh.last_watched_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}') GROUP BY ts.slot ORDER BY ts.slot`;
  const revenueQuery = `${timeSeriesCTE} SELECT TO_CHAR(ts.slot, '${groupFormat}') AS label, COALESCE(SUM(p.amount), 0) AS revenue FROM time_series ts LEFT JOIN payments p ON TO_CHAR(p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}') AND p.status = 'success' GROUP BY ts.slot ORDER BY ts.slot`;
  const usersQuery = `${timeSeriesCTE} SELECT TO_CHAR(ts.slot, '${groupFormat}') AS label, COUNT(u.id) AS users FROM time_series ts LEFT JOIN users u ON TO_CHAR(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}') GROUP BY ts.slot ORDER BY ts.slot`;
  const ticketsQuery = `${timeSeriesCTE} SELECT TO_CHAR(ts.slot, '${groupFormat}') AS label, COUNT(sr.id) AS tickets FROM time_series ts LEFT JOIN support_requests sr ON TO_CHAR(sr.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFormat}') = TO_CHAR(ts.slot, '${groupFormat}') GROUP BY ts.slot ORDER BY ts.slot`;

  const topMoviesQuery = `SELECT m.id, m.name, m.poster_url, COUNT(DISTINCT wh.user_id) AS views FROM watch_history wh JOIN movies m ON wh.movie_id = m.id WHERE wh.last_watched_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' BETWEEN $1::timestamp AND $2::timestamp GROUP BY m.id, m.name, m.poster_url ORDER BY views DESC LIMIT 10`;
  const plansDistributionQuery = `SELECT pl.id, pl.name as plan_name, COUNT(p.id) as total_sold, COALESCE(SUM(p.amount), 0) as total_revenue FROM plans pl LEFT JOIN payments p ON pl.id = p.plan_id AND p.status = 'success' AND p.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh' BETWEEN $1::timestamp AND $2::timestamp GROUP BY pl.id, pl.name ORDER BY total_revenue DESC, pl.id ASC`;

  const [viewsRes, revenueRes, usersRes, ticketsRes, topMoviesRes, plansRes] =
    await Promise.all([
      pool.query(viewsQuery, [from_date, to_date]),
      pool.query(revenueQuery, [from_date, to_date]),
      pool.query(usersQuery, [from_date, to_date]),
      pool.query(ticketsQuery, [from_date, to_date]),
      pool.query(topMoviesQuery, [from_date, to_date]),
      pool.query(plansDistributionQuery, [from_date, to_date]),
    ]);

  return {
    views: viewsRes.rows.map((r) => ({
      label: r.label,
      views: Number(r.views),
    })),
    revenue: revenueRes.rows.map((r) => ({
      label: r.label,
      revenue: Number(r.revenue),
    })),
    users: usersRes.rows.map((r) => ({
      label: r.label,
      users: Number(r.users),
    })),
    tickets: ticketsRes.rows.map((r) => ({
      label: r.label,
      tickets: Number(r.tickets),
    })),
    top_movies: topMoviesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      poster_url: r.poster_url,
      views: Number(r.views),
    })),
    plans_distribution: plansRes.rows.map((r) => ({
      id: r.id,
      name: r.plan_name,
      total_sold: Number(r.total_sold),
      total_revenue: Number(r.total_revenue),
    })),
  };
};
