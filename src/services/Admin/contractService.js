import pool from "../../config/db.js";
import fs from "fs";

export async function createContract({
  name,
  start_date,
  end_date,
  status,
  file_url,
  created_by,
}) {
  if (!name)
    throw Object.assign(new Error("Tên hợp đồng bắt buộc"), { status: 400 });
  const now = new Date();
  const startDate = start_date ? new Date(start_date) : null;
  const endDate = end_date ? new Date(end_date) : null;
  if (endDate && endDate < now)
    throw Object.assign(new Error("Ngày kết thúc không được ở quá khứ"), {
      status: 400,
    });
  if (startDate && endDate && endDate < startDate)
    throw Object.assign(new Error("Ngày kết thúc phải sau ngày bắt đầu"), {
      status: 400,
    });
  const res = await pool.query(
    `INSERT INTO contracts (name, start_date, end_date, status, file_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name, startDate, endDate, status || "draft", file_url, created_by],
  );

  return res.rows[0];
}

export async function getContracts({
  name,
  status,
  start_date,
  end_date,
  sort_by,
  order,
  page = 1,
  limit = 10,
}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const values = [];

  if (name) {
    values.push(`%${name}%`);
    conditions.push(`name ILIKE $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (start_date) {
    values.push(start_date);
    conditions.push(`start_date >= $${values.length}`);
  }
  if (end_date) {
    values.push(end_date);
    conditions.push(`end_date <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const ALLOWED_SORT_COLUMNS = {
    id: "id",
    name: "name",
    status: "status",
    start_date: "start_date",
    end_date: "end_date",
  };

  const sortColumn = ALLOWED_SORT_COLUMNS[sort_by] || "id";
  const sortDirection = (order || "").toLowerCase() === "asc" ? "ASC" : "DESC";
  const dataRes = await pool.query(
    `SELECT * FROM contracts ${where} ORDER BY ${sortColumn} ${sortDirection} NULLS LAST LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset],
  );

  const countRes = await pool.query(
    `SELECT COUNT(*) AS total FROM contracts ${where}`,
    values,
  );

  const statsRes = await pool.query(`
  SELECT
    COUNT(*) FILTER (WHERE status = 'draft') AS draft,
    COUNT(*) FILTER (WHERE status = 'active') AS active,
    COUNT(*) FILTER (WHERE status = 'expired') AS expired,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    COUNT(*) AS total
  FROM contracts
  `);

  return {
    data: dataRes.rows,
    total: Number(countRes.rows[0].total),
    page,
    limit,
    totalPages: Math.ceil(countRes.rows[0].total / limit),
    stats: {
      draft: Number(statsRes.rows[0].draft),
      active: Number(statsRes.rows[0].active),
      expired: Number(statsRes.rows[0].expired),
      cancelled: Number(statsRes.rows[0].cancelled),
      total: Number(statsRes.rows[0].total),
    },
  };
}

export async function getContractById(id) {
  const res = await pool.query(`SELECT * FROM contracts WHERE id=$1`, [id]);
  if (res.rows.length === 0)
    throw Object.assign(new Error("Không tìm thấy hợp đồng"), { status: 404 });
  return res.rows[0];
}

export async function getContractFilePath(id) {
  const contract = await getContractById(id);

  if (!contract.file_url)
    throw Object.assign(new Error("File không tồn tại"), { status: 404 });

  const filePath = contract.file_url.replace(/^\//, "");

  if (!fs.existsSync(filePath))
    throw Object.assign(new Error("File không tồn tại trên server"), {
      status: 404,
    });

  return filePath;
}

export async function updateContract(
  id,
  { name, start_date, end_date, status, file_url },
) {
  const contract = await getContractById(id);
  const fields = [];
  const values = [];
  let idx = 1;

  if (name) {
    fields.push(`name=$${idx++}`);
    values.push(name);
  }

  if (start_date) {
    const startDate = new Date(start_date);
    fields.push(`start_date=$${idx++}`);
    values.push(startDate);
  }

  if (end_date) {
    const endDate = new Date(end_date);
    const now = new Date(); // FIX
    const startDate = start_date ? new Date(start_date) : contract.start_date;
    if (endDate < now)
      throw Object.assign(new Error("Ngày kết thúc không được ở quá khứ"), {
        status: 400,
      });
    if (endDate < startDate)
      throw Object.assign(new Error("Ngày kết thúc phải sau ngày bắt đầu"), {
        status: 400,
      });

    fields.push(`end_date=$${idx++}`);
    values.push(endDate);
  }

  if (status) {
    fields.push(`status=$${idx++}`);
    values.push(status);
  }

  if (file_url) {
    if (contract.file_url) {
      const oldPath = contract.file_url.replace(/^\//, "");
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    fields.push(`file_url=$${idx++}`);
    values.push(file_url);
  }
  if (!fields.length)
    throw Object.assign(new Error("Không có dữ liệu cập nhật"), {
      status: 400,
    });
  values.push(id);

  const res = await pool.query(
    `UPDATE contracts 
     SET ${fields.join(", ")}, updated_at=CURRENT_TIMESTAMP 
     WHERE id=$${idx} RETURNING *`,
    values,
  );
  return res.rows[0];
}

export async function autoExpireContracts() {
  const now = new Date();

  const res = await pool.query(
    `UPDATE contracts 
     SET status='expired' 
     WHERE end_date < $1 AND status != 'expired' 
     RETURNING *`,
    [now],
  );

  const expiredContracts = res.rows;

  for (const contract of expiredContracts) {
    await pool.query(
      `UPDATE movies 
       SET status='hidden' 
       WHERE contract_id=$1`,
      [contract.id],
    );
  }

  return expiredContracts;
}
