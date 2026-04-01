import pool from "../config/db.js";

const initTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        gender VARCHAR(10) DEFAULT 'unknown' 
          CHECK (gender IN ('male', 'female', 'other', 'unknown')),
        role VARCHAR(20) DEFAULT 'user'
          CHECK (role IN ('user', 'admin')),
        avatar_url TEXT,
        is_premium BOOLEAN DEFAULT FALSE,
        reset_token TEXT,
        reset_token_expires TIMESTAMP,
        is_active BOOLEAN DEFAULT FALSE,
        deleted_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id SERIAL PRIMARY KEY,
        email VARCHAR(150) NOT NULL,
        code VARCHAR(10) NOT NULL,
        type VARCHAR(20) DEFAULT 'register'
          CHECK (type IN ('register', 'reset')),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY, 

        entity_type VARCHAR(50),
        entity_id INTEGER,

        action VARCHAR(50),

        performed_by INTEGER REFERENCES users(id),

        old_data JSONB,
        new_data JSONB,

        reason TEXT,

        ip_address VARCHAR(50),
        user_agent TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email 
      ON users(email);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_email_verifications_email 
      ON email_verifications(email);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_entity 
      ON audit_logs(entity_type, entity_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_user 
      ON audit_logs(performed_by);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_created_at 
      ON audit_logs(created_at);
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger 
          WHERE tgname = 'trigger_update_users_updated_at'
        ) THEN
          CREATE TRIGGER trigger_update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $$;
    `);

    console.log(" Tables & indexes created successfully");
  } catch (err) {
    console.error(" Error creating tables:", err);
  }
};

initTables();
