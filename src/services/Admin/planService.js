import pool from "../../config/db.js";

const validatePlanInput = (data, isUpdate = false) => {
  const { name, price, duration_days, description, is_popular, status } = data;
  if (!isUpdate) {
    if (!name || price === undefined || duration_days === undefined) {
      return "Thiếu các trường bắt buộc (name, price, duration_days)";
    }
  }
  if (name !== undefined && typeof name !== "string") {
    return "Tên gói phải là chuỗi";
  }
  if (price !== undefined && typeof price !== "number") {
    return "Giá phải là số";
  }
  if (duration_days !== undefined && typeof duration_days !== "number") {
    return "Số ngày phải là số";
  }
  if (is_popular !== undefined && typeof is_popular !== "boolean") {
    return "is_popular phải là true/false";
  }
  if (status !== undefined && !["active", "inactive"].includes(status)) {
    return "Trạng thái không hợp lệ (active/inactive)";
  }
  if (description !== undefined) {
    if (typeof description !== "object" || description === null) {
      return "Mô tả phải là object";
    }

    if (!description.features || !Array.isArray(description.features)) {
      return "description.features phải là mảng";
    }

    for (const item of description.features) {
      if (typeof item !== "string") {
        return "Mỗi feature phải là chuỗi";
      }
    }
  }

  return null;
};

export const createPlanService = async (data) => {
  const error = validatePlanInput(data);
  if (error) throw new Error(error);

  const { name, price, duration_days, description, is_popular } = data;

  const result = await pool.query(
    `
    INSERT INTO plans (name, price, duration_days, description, is_popular)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [name, price, duration_days, description || null, is_popular || false],
  );

  return result.rows[0];
};
export const updatePlanService = async (id, data) => {
  const error = validatePlanInput(data, true);
  if (error) throw new Error(error);

  const fields = [];
  const values = [];
  let index = 1;

  for (const key in data) {
    fields.push(`${key} = $${index}`);
    values.push(data[key]);
    index++;
  }

  if (!fields.length) {
    throw new Error("Không có dữ liệu để cập nhật");
  }

  values.push(id);

  const result = await pool.query(
    `
    UPDATE plans
    SET ${fields.join(", ")}
    WHERE id = $${index}
    RETURNING *
    `,
    values,
  );

  return result.rows[0];
};
export const getAllPlansAdminService = async ({
  page = 1,
  limit = 10,
  status,
  sort_by,
  order,
}) => {
  const safePage = Math.max(parseInt(page) || 1, 1);
  const safeLimit = Math.min(parseInt(limit) || 10, 100);
  const offset = (safePage - 1) * safeLimit;
  const conditions = [];
  const values = [];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const ALLOWED_SORT_COLUMNS = {
    id: "id",
    name: "name",
    price: "price",
    duration_days: "duration_days",
    status: "status",
    created_at: "created_at",
  };
  const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "created_at";
  const sortDirection = (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const [dataQuery, countQuery] = await Promise.all([
    pool.query(
      `
      SELECT * FROM plans
      ${where}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `,
      [...values, safeLimit, offset],
    ),
    pool.query(`SELECT COUNT(*) FROM plans ${where}`, values),
  ]);

  const totalRecords = parseInt(countQuery.rows[0].count);
  return {
    data: dataQuery.rows,
    pagination: {
      total: totalRecords,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(totalRecords / safeLimit),
    },
  };
};
export const getPlanByIdService = async (id) => {
  const result = await pool.query(`SELECT * FROM plans WHERE id = $1`, [id]);

  return result.rows[0];
};
export const togglePlanStatusService = async (id) => {
  const result = await pool.query(
    `
    UPDATE plans
    SET status = CASE
      WHEN status = 'active' THEN 'inactive'
      ELSE 'active'
    END
    WHERE id = $1
    RETURNING *
    `,
    [id],
  );

  return result.rows[0];
};
