require('dotenv').config();
const { Pool } = require('pg');

console.log('Environment variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Not set');
console.log('NODE_ENV:', process.env.NODE_ENV);

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

async function testConnection() {
    try {
        console.log('\nTesting database connection...');
        const client = await pool.connect();
        console.log('✅ Successfully connected to PostgreSQL database!');
        
        // Test a simple query
        const result = await client.query('SELECT NOW() as current_time');
        console.log('✅ Test query successful. Current time:', result.rows[0].current_time);
        
        // Check if movies table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'movies'
            );
        `);
        
        if (tableCheck.rows[0].exists) {
            console.log('✅ Movies table exists');
            const movieCount = await client.query('SELECT COUNT(*) FROM movies');
            console.log(`📊 Movies in database: ${movieCount.rows[0].count}`);
        } else {
            console.log('❌ Movies table does not exist - needs to be created');
        }
        
        client.release();
        await pool.end();
        console.log('\n🎉 Database test completed successfully!');
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testConnection();
