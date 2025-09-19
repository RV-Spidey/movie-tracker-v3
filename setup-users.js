require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
          }
        : {
              host: process.env.DB_HOST || 'localhost',
              port: process.env.DB_PORT || 5432,
              user: process.env.DB_USER || 'postgres',
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME || 'movie_tracker'
          }
);

async function setupUserTables() {
    try {
        console.log('🚀 Setting up user authentication tables...');
        const client = await pool.connect();
        
        // Check if users table exists
        const userTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            );
        `);
        
        if (userTableCheck.rows[0].exists) {
            console.log('✅ Users table already exists');
        } else {
            console.log('🔨 Creating users table...');
            
            await client.query(`
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    first_name VARCHAR(100) NOT NULL,
                    last_name VARCHAR(100) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    profile_image_url VARCHAR(500),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            console.log('✅ Users table created successfully');
        }
        
        // Check if sessions table exists
        const sessionTableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'sessions'
            );
        `);
        
        if (sessionTableCheck.rows[0].exists) {
            console.log('✅ Sessions table already exists');
        } else {
            console.log('🔨 Creating sessions table...');
            
            await client.query(`
                CREATE TABLE sessions (
                    sid VARCHAR NOT NULL COLLATE "default",
                    sess JSON NOT NULL,
                    expire TIMESTAMP(6) NOT NULL
                )
                WITH (OIDS=FALSE);
            `);
            
            await client.query(`
                ALTER TABLE sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
            `);
            
            await client.query(`
                CREATE INDEX IDX_session_expire ON sessions (expire);
            `);
            
            console.log('✅ Sessions table created successfully');
        }
        
        // Update movies table to include user_id
        const moviesUserIdCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='movies' AND column_name='user_id';
        `);
        
        if (moviesUserIdCheck.rows.length === 0) {
            console.log('🔨 Adding user_id to movies table...');
            await client.query(`
                ALTER TABLE movies 
                ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
            `);
            console.log('✅ User_id column added to movies table');
        } else {
            console.log('✅ Movies table already has user_id column');
        }
        
        client.release();
        await pool.end();
        console.log('🎉 User authentication setup completed successfully!');
    } catch (error) {
        console.error('❌ User setup failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

setupUserTables();