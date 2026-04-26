import pool from "../config/db.js";

const initTables = async () => {
  try {
    // ================== EXISTING TABLES ==================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,

        birth_date DATE,
        gender VARCHAR(10) DEFAULT 'unknown' 
          CHECK (gender IN ('male', 'female', 'other', 'unknown')),

        role VARCHAR(20) DEFAULT 'user'
          CHECK (role IN ('user', 'admin')),

        avatar_url TEXT,

        is_premium BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT FALSE,
        is_locked BOOLEAN DEFAULT FALSE,

        lock_until TIMESTAMP,
        block_reason TEXT,
        blocked_at TIMESTAMP,

        reset_token TEXT,
        reset_token_expires TIMESTAMP,
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
      CREATE TABLE IF NOT EXISTS contracts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        file_url TEXT,
        start_date DATE,
        end_date DATE,
        status VARCHAR(20) DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'expired', 'cancelled')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS movies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        origin_name TEXT,
        slug TEXT UNIQUE NOT NULL,
        content TEXT,

        poster_url TEXT,
        thumb_url TEXT,
        trailer_url TEXT,

        type VARCHAR(20),
        status VARCHAR(20) DEFAULT 'draft'
          CHECK (status IN ('draft', 'published', 'hidden')),
        lifecycle_status VARCHAR(20) DEFAULT 'upcoming'
          CHECK (lifecycle_status IN ('upcoming', 'ongoing', 'completed')),

        release_date TIMESTAMP,
        end_date TIMESTAMP,

        production_status VARCHAR(20)
          CHECK (production_status IN ('planning', 'filming', 'post-production')),

        is_available BOOLEAN DEFAULT TRUE,
        is_premium BOOLEAN DEFAULT FALSE,

        year INTEGER,
        quality VARCHAR(50),
        lang VARCHAR(50),
        duration VARCHAR(50),
        episode_total INTEGER,
        source VARCHAR(50),

        view INTEGER DEFAULT 0,
        last_viewed_at TIMESTAMP,

        created_by INTEGER REFERENCES users(id),
        contract_id INTEGER REFERENCES contracts(id),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE,
        slug VARCHAR(100) UNIQUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS movie_countries (
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        country_id INTEGER REFERENCES countries(id) ON DELETE CASCADE,
        PRIMARY KEY (movie_id, country_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE,
        slug VARCHAR(100) UNIQUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS movie_categories (
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        PRIMARY KEY (movie_id, category_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) UNIQUE,
        slug VARCHAR(150) UNIQUE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS movie_people (
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
        role VARCHAR(20) CHECK (role IN ('actor', 'director')),
        PRIMARY KEY (movie_id, person_id, role)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, type)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id SERIAL PRIMARY KEY,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        season INTEGER DEFAULT 1,
        episode_number INTEGER,
        name VARCHAR(100),
        slug TEXT,
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(movie_id, season, episode_number)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS episode_streams (
        id SERIAL PRIMARY KEY,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
        server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
        quality VARCHAR(50),
        lang VARCHAR(20) DEFAULT 'vietsub'
          CHECK (lang IN ('vietsub', 'dub', 'raw')),
        link_embed TEXT,
        link_m3u8 TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (episode_id, server_id, quality, lang)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        episode_id INTEGER REFERENCES episodes(id),
        parent_id INTEGER REFERENCES messages(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS watch_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
        watched_duration INTEGER,
        total_duration INTEGER,
        progress FLOAT,
        last_watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, episode_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, movie_id)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        price NUMERIC,
        duration_days INTEGER,
        description JSONB,
        is_popular BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'active'
          CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER REFERENCES plans(id),
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    plan_id INTEGER REFERENCES plans(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    failure_reason TEXT,
    amount NUMERIC,
    payment_method VARCHAR(50) DEFAULT 'vnpay',
    status VARCHAR(20) DEFAULT 'pending',
    transaction_code VARCHAR(100),
    vnp_txn_ref VARCHAR(100) UNIQUE,
    vnp_transaction_no VARCHAR(100),
    vnp_response_code VARCHAR(10),
    vnp_bank_code VARCHAR(20),
    paid_at TIMESTAMP,
    raw_response JSONB,
    verified_by_admin INTEGER REFERENCES users(id),
    verified_at TIMESTAMP,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payments_status_check 
      CHECK (status IN ('pending', 'success', 'failed', 'cancelled', 'expired'))
  );
`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS showtimes (
        id SERIAL PRIMARY KEY,

        movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,

        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,

        status VARCHAR(20) DEFAULT 'scheduled'
          CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),

        allow_watch BOOLEAN DEFAULT TRUE,

        is_premiere BOOLEAN DEFAULT FALSE,
        max_viewers INTEGER,

        created_by INTEGER REFERENCES users(id),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS showtime_reminders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        showtime_id INTEGER REFERENCES showtimes(id) ON DELETE CASCADE,
        remind_before_minutes INTEGER DEFAULT 5,
        is_notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, showtime_id)
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS showtime_views (
        id SERIAL PRIMARY KEY,
        showtime_id INTEGER REFERENCES showtimes(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        left_at TIMESTAMP,
        UNIQUE(showtime_id, user_id)
      );
    `);
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_showtime_movie ON showtimes(movie_id);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_showtime_status ON showtimes(status);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_showtime_time ON showtimes(start_time, end_time);`,
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_reminder_user ON showtime_reminders(user_id);`,
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_reminder_showtime ON showtime_reminders(showtime_id);`,
    );

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_views_showtime ON showtime_views(showtime_id);`,
    );

    console.log(" FINAL DB READY + SHOWTIME SYSTEM 🚀");
  } catch (err) {
    console.error(" Error:", err);
  }
};

initTables();
