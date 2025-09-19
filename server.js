require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static('public'));

//Database connection
// Railway provides DATABASE_URL, but we'll also support individual variables for local development
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

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL database:', err.stack);
        return;
    }
    console.log('Connected to PostgreSQL database');
    release();
});

//the api endpoints

// Step 1: Create the API Search Endpoint
// This endpoint will handle requests from your frontend to search the TMDB API.
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q; // Get the search query from the URL
        const response = await axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${query}&include_adult=false`
        );
        
        // Filter out adult content and check age ratings
        let filteredResults = response.data.results.filter(movie => !movie.adult);
        
        // Additional filtering: check for R and NC-17 ratings by getting release dates for each movie
        const ratingPromises = filteredResults.map(async (movie) => {
            try {
                const releaseResponse = await axios.get(
                    `https://api.themoviedb.org/3/movie/${movie.id}/release_dates?api_key=${process.env.TMDB_API_KEY}`,
                    { timeout: 5000 } // Add timeout to prevent slow requests
                );
                
                // Find US certification - check all release dates, not just the first
                const usRelease = releaseResponse.data.results.find(release => release.iso_3166_1 === 'US');
                let certification = '';
                
                if (usRelease?.release_dates) {
                    // Find the first non-empty certification
                    for (const releaseDate of usRelease.release_dates) {
                        if (releaseDate.certification) {
                            certification = releaseDate.certification;
                            break;
                        }
                    }
                }
                
                // Only allow explicitly safe ratings (G, PG, PG-13) - default-deny everything else
                const allowedRatings = ['G', 'PG', 'PG-13'];
                if (!certification || !allowedRatings.includes(certification)) {
                    return null; // Mark for removal - default deny if rating unknown or restricted
                }
                
                return movie;
            } catch (error) {
                console.log(`Could not get rating for movie ${movie.id}, excluding for safety`);
                return null; // Exclude movie if we can't get rating info (default-deny)
            }
        });
        
        // Wait for all rating checks to complete and filter out nulls
        const ratedResults = await Promise.all(ratingPromises);
        filteredResults = ratedResults.filter(movie => movie !== null);
        
        res.json(filteredResults); // Send the filtered search results back as JSON
    } catch (error) {
        console.error('TMDB API Error:', error);
        res.status(500).json({ error: 'An error occurred while fetching data from the movie database.' });
    }
});

// Get movie details by TMDB ID
app.get('/api/movie/:tmdbId', async (req, res) => {
    try {
        const tmdbId = req.params.tmdbId;
        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`
        );
        
        // Filter out adult content
        if (response.data.adult) {
            res.status(404).json({ error: 'Content not available' });
            return;
        }
        
        // Check age rating - only allow G, PG, PG-13 movies
        try {
            const releaseResponse = await axios.get(
                `https://api.themoviedb.org/3/movie/${tmdbId}/release_dates?api_key=${process.env.TMDB_API_KEY}`,
                { timeout: 5000 }
            );
            
            // Find US certification - check all release dates, not just the first
            const usRelease = releaseResponse.data.results.find(release => release.iso_3166_1 === 'US');
            let certification = '';
            
            if (usRelease?.release_dates) {
                // Find the first non-empty certification
                for (const releaseDate of usRelease.release_dates) {
                    if (releaseDate.certification) {
                        certification = releaseDate.certification;
                        break;
                    }
                }
            }
            
            // Only allow explicitly safe ratings (G, PG, PG-13) - default-deny everything else
            const allowedRatings = ['G', 'PG', 'PG-13'];
            if (!certification || !allowedRatings.includes(certification)) {
                res.status(404).json({ error: 'Content not available - age restriction' });
                return;
            }
        } catch (ratingError) {
            console.log(`Could not get rating for movie ${tmdbId}, blocking access for safety`);
            res.status(404).json({ error: 'Content not available - age restriction' });
            return;
        }
        
        res.json(response.data); // Send the movie details back as JSON
    } catch (error) {
        console.error('TMDB API Error:', error);
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'Movie not found' });
        } else {
            res.status(500).json({ error: 'An error occurred while fetching movie details.' });
        }
    }
});

// Step 2: Create the Get Movies Endpoint
// This endpoint fetches all the movies from your personal PostgreSQL database.
app.get('/api/movies', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM movies ORDER BY created_at DESC');
        res.json(result.rows); // Send the movies from your database back to the frontend
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Step 3: Create the Add/Delete Movies Endpoints
// These endpoints handle saving and deleting movies in your database.
app.post('/api/movies', async (req, res) => {
    const { tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review, poster_path, release_date } = req.body;
    
    // First check if the table has the new columns, if not add them
    try {
        await pool.query(`
            ALTER TABLE movies 
            ADD COLUMN IF NOT EXISTS poster_path TEXT,
            ADD COLUMN IF NOT EXISTS release_date DATE
        `);
    } catch (alterError) {
        console.log('Table already has new columns or error:', alterError.message);
    }
    
    const sql = `
        INSERT INTO movies (tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review, poster_path, release_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
    `;
    try {
        const result = await pool.query(sql, [tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review, poster_path, release_date]);
        res.json({ id: result.rows[0].id, message: 'Movie added successfully!' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/movies/:id', async (req, res) => {
    const { id } = req.params; // Get the movie ID from the URL
    const sql = 'DELETE FROM movies WHERE id = $1';
    try {
        await pool.query(sql, [id]);
        res.json({ message: 'Movie deleted successfully!' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update movie list (move between watchlist and watched)
app.put('/api/movies/:id', async (req, res) => {
    const { id } = req.params;
    const { list_name, no_of_times_watched } = req.body;
    
    const sql = 'UPDATE movies SET list_name = $1, no_of_times_watched = $2 WHERE id = $3';
    try {
        const result = await pool.query(sql, [list_name, no_of_times_watched || 0, id]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Movie not found' });
        } else {
            res.json({ message: 'Movie updated successfully!' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is listening on port ${port}`);
});
