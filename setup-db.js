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

async function setupDatabase() {
    try {
        console.log('🚀 Setting up database schema...');
        const client = await pool.connect();
        
        // Check if movies table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'movies'
            );
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('✅ Movies table already exists');
            const movieCount = await client.query('SELECT COUNT(*) FROM movies');
            console.log(`📊 Current movies in database: ${movieCount.rows[0].count}`);
        } else {
            console.log('🔨 Creating movies table...');
            
            await client.query(`
                CREATE TABLE movies (
                    id SERIAL PRIMARY KEY,
                    tmdb_id INTEGER NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    director VARCHAR(255),
                    actors TEXT,
                    description TEXT,
                    genre VARCHAR(255),
                    list_name VARCHAR(20) NOT NULL CHECK (list_name IN ('watchlist', 'watched', 'favorites')),
                    no_of_times_watched INTEGER DEFAULT 0,
                    user_rating DECIMAL(3,1),
                    user_review TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (tmdb_id, list_name)
                );
            `);
            
            console.log('✅ Movies table created successfully');
            
            // Create trigger function for updated_at
            await client.query(`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql';
            `);
            
            // Create trigger
            await client.query(`
                CREATE TRIGGER update_movies_updated_at 
                BEFORE UPDATE ON movies 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
            `);
            
            console.log('✅ Database triggers created successfully');
        }
        
        client.release();
        await pool.end();
        console.log('🎉 Database setup completed successfully!');
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

setupDatabase();
