require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connectPg = require('connect-pg-simple');

// Cache for keyword IDs and movie keyword checks
const keywordCache = new Map();
const movieKeywordCache = new Map();

// Sexual content keywords to filter out
const SEXUAL_CONTENT_KEYWORDS = [
    'erotica',
    'erotic thriller', 
    'pornography',
    'pornographic film',
    'sexploitation',
    'explicit sex',
    'softcore',
    'hardcore',
    'XXX',
    'sexual intercourse',
    'graphic sex'
];

let sexualKeywordIds = new Set();

const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

// Trust proxy for secure cookies in production
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.static('public'));

//Database connection (moved before session configuration)
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

// Session configuration (after pool initialization)
const PgSession = connectPg(session);
app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET environment variable is required'); })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Local strategy for username/password authentication
passport.use(new LocalStrategy(
    {
        usernameField: 'email',
        passwordField: 'password'
    },
    async (email, password, done) => {
        try {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
            
            if (result.rows.length === 0) {
                return done(null, false, { message: 'Invalid email or password' });
            }
            
            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (!isValidPassword) {
                return done(null, false, { message: 'Invalid email or password' });
            }
            
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const result = await pool.query('SELECT id, first_name, last_name, email, profile_image_url FROM users WHERE id = $1', [id]);
        done(null, result.rows[0]);
    } catch (error) {
        done(error);
    }
});

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Authentication required' });
};

// Database connection moved above

// Initialize sexual content keyword IDs at startup
async function initializeSexualKeywords() {
    try {
        console.log('Initializing sexual content keyword filters...');
        for (const keyword of SEXUAL_CONTENT_KEYWORDS) {
            try {
                const response = await axios.get(
                    `https://api.themoviedb.org/3/search/keyword?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(keyword)}`,
                    { timeout: 5000 }
                );
                
                // Find exact match for the keyword
                const exactMatch = response.data.results.find(k => k.name.toLowerCase() === keyword.toLowerCase());
                if (exactMatch) {
                    sexualKeywordIds.add(exactMatch.id);
                    console.log(`Found keyword ID ${exactMatch.id} for "${keyword}"`);
                }
            } catch (error) {
                console.log(`Could not resolve keyword "${keyword}": ${error.message}`);
            }
        }
        console.log(`Initialized ${sexualKeywordIds.size} sexual content keyword filters`);
    } catch (error) {
        console.error('Error initializing sexual keywords:', error);
    }
}

// Check if a movie has sexual content keywords
async function hasSexualContentKeywords(tmdbId) {
    // Check cache first
    const cacheKey = `movie_${tmdbId}`;
    if (movieKeywordCache.has(cacheKey)) {
        return movieKeywordCache.get(cacheKey);
    }
    
    try {
        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${tmdbId}/keywords?api_key=${process.env.TMDB_API_KEY}`,
            { timeout: 5000 }
        );
        
        const movieKeywordIds = response.data.keywords.map(k => k.id);
        const hasSexualContent = movieKeywordIds.some(id => sexualKeywordIds.has(id));
        
        // Cache result for 24 hours
        movieKeywordCache.set(cacheKey, hasSexualContent);
        setTimeout(() => movieKeywordCache.delete(cacheKey), 24 * 60 * 60 * 1000);
        
        return hasSexualContent;
    } catch (error) {
        console.log(`Could not get keywords for movie ${tmdbId}, allowing by default`);
        return false; // Default to allow if we can't check keywords
    }
}

//Authentication routes

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        // Validate input
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }
        
        // Check if user already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await pool.query(
            'INSERT INTO users (first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, first_name, last_name, email',
            [firstName, lastName, email, passwordHash]
        );
        
        res.status(201).json({ 
            message: 'User created successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login endpoint
app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.status(500).json({ message: 'Internal server error' });
        }
        
        if (!user) {
            return res.status(401).json({ message: info.message || 'Invalid credentials' });
        }
        
        req.logIn(user, (err) => {
            if (err) {
                return res.status(500).json({ message: 'Login failed' });
            }
            
            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email
                }
            });
        });
    })(req, res, next);
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: 'Session destroy failed' });
            }
            res.clearCookie('connect.sid');
            res.json({ message: 'Logout successful' });
        });
    });
});

// Get current user endpoint
app.get('/api/auth/user', isAuthenticated, (req, res) => {
    res.json({
        id: req.user.id,
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        email: req.user.email,
        profileImageUrl: req.user.profile_image_url
    });
});

//the api endpoints

// Step 1: Create the API Search Endpoint
// This endpoint will handle requests from your frontend to search the TMDB API.
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q; // Get the search query from the URL
        
        // Check if keyword filtering is ready
        if (sexualKeywordIds.size === 0) {
            return res.status(503).json({ error: 'Content filtering is initializing, please try again shortly' });
        }
        
        const response = await axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
        );
        
        // Filter out adult content
        let filteredResults = response.data.results.filter(movie => !movie.adult);
        
        // Additional filtering: check for sexual content keywords
        const keywordPromises = filteredResults.map(async (movie) => {
            try {
                const hasSexualContent = await hasSexualContentKeywords(movie.id);
                return hasSexualContent ? null : movie; // Remove if has sexual content
            } catch (error) {
                console.log(`Could not check keywords for movie ${movie.id}, including by default`);
                return movie; // Include movie if we can't check keywords
            }
        });
        
        // Wait for all keyword checks to complete and filter out nulls
        const keywordResults = await Promise.all(keywordPromises);
        filteredResults = keywordResults.filter(movie => movie !== null);
        
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
        
        // Check if keyword filtering is ready
        if (sexualKeywordIds.size === 0) {
            return res.status(503).json({ error: 'Content filtering is initializing, please try again shortly' });
        }
        
        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`
        );
        
        // Filter out adult content
        if (response.data.adult) {
            res.status(404).json({ error: 'Content not available' });
            return;
        }
        
        // Check for sexual content keywords
        const hasSexualContent = await hasSexualContentKeywords(tmdbId);
        if (hasSexualContent) {
            res.status(404).json({ error: 'Content not available' });
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
app.get('/api/movies', isAuthenticated, async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query('SELECT * FROM movies WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(result.rows); // Send the movies from your database back to the frontend
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Step 3: Create the Add/Delete Movies Endpoints
// These endpoints handle saving and deleting movies in your database.
app.post('/api/movies', isAuthenticated, async (req, res) => {
    const { tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review, poster_path, release_date } = req.body;
    const userId = req.user.id;
    
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
        INSERT INTO movies (tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review, poster_path, release_date, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
    `;
    try {
        const result = await pool.query(sql, [tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review, poster_path, release_date, userId]);
        res.json({ id: result.rows[0].id, message: 'Movie added successfully!' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/movies/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params; // Get the movie ID from the URL
    const userId = req.user.id;
    const sql = 'DELETE FROM movies WHERE id = $1 AND user_id = $2';
    try {
        const result = await pool.query(sql, [id, userId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Movie not found or unauthorized' });
        } else {
            res.json({ message: 'Movie deleted successfully!' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update movie list (move between watchlist and watched)
app.put('/api/movies/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { list_name, no_of_times_watched } = req.body;
    const userId = req.user.id;
    
    const sql = 'UPDATE movies SET list_name = $1, no_of_times_watched = $2 WHERE id = $3 AND user_id = $4';
    try {
        const result = await pool.query(sql, [list_name, no_of_times_watched || 0, id, userId]);
        if (result.rowCount === 0) {
            res.status(404).json({ error: 'Movie not found or unauthorized' });
        } else {
            res.json({ message: 'Movie updated successfully!' });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Initialize sexual content keywords before starting server
initializeSexualKeywords().then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server is listening on port ${port}`);
    });
}).catch((error) => {
    console.error('Failed to initialize content filtering:', error);
    process.exit(1);
});
