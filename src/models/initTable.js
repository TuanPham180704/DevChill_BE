import pool from "../config/db.js";

const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        gender VARCHAR(10) DEFAULT 'unknown',
        role VARCHAR(20) DEFAULT 'user',
        avatar_url TEXT,
        is_premium BOOLEAN DEFAULT FALSE,
        reset_token TEXT,
        reset_token_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        deleted_at TIMESTAMP
      );
    `);

    console.log(" Table users created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
  } finally {
    await pool.end();
  }
};

initTables();
