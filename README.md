# Movie Tracker

Personal movie management application with user authentication, TMDB integration, and PostgreSQL backend. Search movies, organize into lists, rate and review with secure user sessions.

## Development Commands

### Environment Setup
```bash
# Clone repository
git clone https://github.com/RV-Spidey/movie-tracker.git
cd movie-tracker

# Install Node.js dependencies
npm install

# Setup environment variables (see Environment Variables section)
# For Replit: Use Secrets panel
# For local: Create .env file with required variables
```

### Running the Application
```bash
# Start production server (binds to 0.0.0.0:5000)
npm start

# Start development server (same as production)
npm run dev

# Test database connection
export DATABASE_URL="your_database_url_here"
export SESSION_SECRET="your_session_secret"
export TMDB_API_KEY="your_tmdb_key"
node test-db.js
```

### Database Setup and Management

#### Initial Schema Setup
```bash
# Setup movies table, triggers, and constraints
node setup-db.js

# Setup user authentication tables (users, sessions)
node setup-users.js

# Verify all tables created correctly
node test-db.js
```

#### Manual Database Schema (PostgreSQL)
```sql
-- Connect to PostgreSQL
psql "postgresql://user:pass@host:port/database"

-- Create users table
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

-- Create movies table with user relationship
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
    poster_path TEXT,
    release_date DATE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tmdb_id, list_name, user_id)
);

-- Create sessions table for express-session + connect-pg-simple
CREATE TABLE sessions (
    sid VARCHAR NOT NULL COLLATE "default",
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

ALTER TABLE sessions ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IDX_session_expire ON sessions (expire);

-- Create trigger function for updated_at automation
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to movies table
CREATE TRIGGER update_movies_updated_at 
BEFORE UPDATE ON movies 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Database Operations
```bash
# Reset database (destructive - removes all data)
psql $DATABASE_URL -c "DROP TABLE IF EXISTS movies, users, sessions CASCADE;"
node setup-db.js && node setup-users.js

# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
psql $DATABASE_URL < backup_file.sql

# Check table status
psql $DATABASE_URL -c "\dt"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM movies;"
```

### Deployment Commands

#### Replit Deployment
```bash
# Environment setup in Replit Secrets:
# DATABASE_URL=postgresql://user:pass@host:port/db
# SESSION_SECRET=your_32_char_random_string
# TMDB_API_KEY=your_tmdb_api_key
# NODE_ENV=production

# Application auto-deploys via workflow configured for port 5000
# Verify deployment: Check workflow logs and access preview URL
```

#### Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Create PostgreSQL service
railway add postgresql

# Deploy application
railway up

# Set environment variables in Railway dashboard:
# TMDB_API_KEY=your_key
# NODE_ENV=production
# (DATABASE_URL automatically provided by PostgreSQL service)

# Connect to production database
railway connect postgresql
```

#### Manual Cloud Deployment
```bash
# Build for production (no build step required)
echo "Static files served from public/ directory"

# Production startup command
NODE_ENV=production PORT=5000 npm start

# Health check endpoint
curl https://your-domain.com/api/auth/user  # Should return 401
```

## Environment Variables

### Local Development
Required variables in `.env` file or export statements:
```bash
# Database connection (individual variables)
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=postgres
export DB_PASSWORD=your_password
export DB_NAME=movie_tracker

# Or use connection string (overrides individual variables)
export DATABASE_URL="postgresql://postgres:password@localhost:5432/movie_tracker"

# API integration
export TMDB_API_KEY=your_tmdb_api_key_from_themoviedb_org

# Security and sessions
export SESSION_SECRET=generate_random_32_character_string

# Application configuration
export NODE_ENV=development
export PORT=5000
```

### Production Environment
Cloud platforms typically provide:
```bash
# Auto-provided by cloud database services
DATABASE_URL=postgresql://user:pass@host:port/database

# Auto-assigned by platform
PORT=5000

# Manually configured in platform dashboard
TMDB_API_KEY=your_production_api_key
SESSION_SECRET=production_session_secret_32_chars
NODE_ENV=production
```

### Environment Variable Validation
```bash
# Test all required variables are set
node -e "
const required = ['DATABASE_URL', 'SESSION_SECRET', 'TMDB_API_KEY'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing required environment variables:', missing);
  process.exit(1);
} else {
  console.log('All required environment variables are set');
}
"
```

## API Reference and Testing

### Authentication Endpoints
```bash
# Register new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john@example.com",
    "password": "password123"
  }'

# Login user (creates session)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get current user (requires session)
curl -X GET http://localhost:5000/api/auth/user \
  -b cookies.txt

# Logout user
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt
```

### Movie Search and Management
```bash
# Search movies via TMDB (no auth required)
curl "http://localhost:5000/api/search?q=batman"

# Get movie details by TMDB ID
curl "http://localhost:5000/api/movie/155"

# Get user's movie collection (requires auth)
curl -X GET http://localhost:5000/api/movies \
  -b cookies.txt

# Add movie to collection (requires auth)
curl -X POST http://localhost:5000/api/movies \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "tmdb_id": 155,
    "title": "The Dark Knight",
    "director": "Christopher Nolan",
    "actors": "Christian Bale, Heath Ledger",
    "description": "Batman raises the stakes...",
    "genre": "Action, Crime, Drama",
    "list_name": "watchlist",
    "no_of_times_watched": 0,
    "user_rating": null,
    "user_review": null,
    "poster_path": "/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    "release_date": "2008-07-18"
  }'

# Move movie between lists (watchlist -> watched)
curl -X PUT http://localhost:5000/api/movies/1 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "list_name": "watched",
    "no_of_times_watched": 1
  }'

# Remove movie from collection
curl -X DELETE http://localhost:5000/api/movies/1 \
  -b cookies.txt
```

### TMDB API Direct Testing
```bash
# Test TMDB API key validity
curl "https://api.themoviedb.org/3/search/movie?api_key=$TMDB_API_KEY&query=batman&include_adult=false"

# Get movie details from TMDB
curl "https://api.themoviedb.org/3/movie/155?api_key=$TMDB_API_KEY"

# Search for content keywords (used for filtering)
curl "https://api.themoviedb.org/3/search/keyword?api_key=$TMDB_API_KEY&query=erotica"
```

## Architecture Deep Dive

### Application Structure
Multi-page web application with traditional server-rendered architecture:

**Backend Components (`server.js`)**:
- Single Express.js server handling both API and static file serving
- PostgreSQL connection pool with automatic SSL detection based on environment
- Passport.js authentication with local strategy (email/password)
- Session management using connect-pg-simple (PostgreSQL session store)
- TMDB API proxy with adult content filtering and keyword-based content blocking
- Bcrypt password hashing with salt rounds for security

**Frontend Components (`public/` directory)**:
- `index.html`: Movie search interface with real-time TMDB integration
- `login.html` / `register.html`: Authentication forms with client-side validation
- `watchlist.html` / `watched.html`: User's movie collection management
- `film.html`: Individual movie details and review interface
- `app.js`: Client-side routing, API communication, and DOM manipulation
- `styles.css`: Responsive CSS Grid/Flexbox layout with mobile-first design

**Database Architecture**:
- Users table: Authentication and profile information with bcrypt password hashing
- Movies table: User-specific movie collections with TMDB integration
- Sessions table: Server-side session storage for secure authentication
- Foreign key constraints: `movies.user_id` references `users.id` with CASCADE delete
- Unique constraints: Prevent duplicate movies per user per list type

### Data Flow and Request Lifecycle

**Authentication Flow**:
1. User submits credentials → `POST /api/auth/login`
2. Passport LocalStrategy validates email/password against users table
3. bcrypt compares plaintext password with stored hash
4. Success: Session created in sessions table, user object stored in session
5. Subsequent requests: connect-pg-simple retrieves session from PostgreSQL

**Movie Search Flow**:
1. User types search query → Frontend debounces input (prevents excessive API calls)
2. `GET /api/search?q=query` → Server proxies to TMDB API
3. Adult content filtered: `include_adult=false` parameter + adult flag check
4. Sexual content filtering: Server checks movie keywords against predefined blacklist
5. Results cached: Movie keyword checks cached for 24 hours to improve performance
6. Response: Filtered movie array returned to frontend

**Movie Management Flow**:
1. User adds movie → `POST /api/movies` with TMDB data + personal metadata
2. Server validates user session and TMDB ID uniqueness per list
3. Database insert: Movie record created with user_id foreign key relationship
4. Frontend updates: Movie appears in appropriate list without page reload
5. List transfers: `PUT /api/movies/:id` moves movies between watchlist/watched/favorites

### Security Implementation

**Password Security**:
```javascript
// Registration: Hash with salt rounds
const saltRounds = 10;
const passwordHash = await bcrypt.hash(password, saltRounds);

// Login: Compare with stored hash
const isValidPassword = await bcrypt.compare(password, user.password_hash);
```

**Session Security**:
```javascript
// Production: Secure cookies with SSL
cookie: {
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
    sameSite: 'lax',                                // CSRF protection
    maxAge: 30 * 24 * 60 * 60 * 1000               // 30 day expiration
}
```

**SQL Injection Prevention**:
```javascript
// Parameterized queries throughout
const result = await pool.query('SELECT * FROM movies WHERE user_id = $1', [userId]);
```

**Content Filtering**:
```javascript
// Multi-layer adult content filtering
const SEXUAL_CONTENT_KEYWORDS = ['erotica', 'explicit sex', 'hardcore', ...];
// TMDB API adult flag + keyword-based filtering
const filteredResults = results.filter(movie => !movie.adult && !hasSexualContent);
```

### Performance Optimizations

**Database Performance**:
- Connection pooling: Single PostgreSQL pool shared across requests
- Indexed columns: Primary keys, foreign keys, and session expiration automatically indexed
- Query optimization: LIMIT clauses and specific column selection where appropriate

**API Performance**:
- Request caching: TMDB keyword checks cached in memory for 24 hours
- Debounced search: Frontend delays API calls until user stops typing
- Connection reuse: Axios HTTP client maintains connection pools to TMDB

**Frontend Performance**:
- Static asset serving: Express.static middleware with efficient file serving
- Minimal JavaScript: Vanilla JS without heavy frameworks reduces bundle size
- Responsive images: TMDB CDN integration for optimized movie poster delivery

## Development Guidelines

### Code Organization and Patterns

**Backend Patterns (`server.js`)**:
```javascript
// Environment-based configuration
const pool = new Pool(
    process.env.DATABASE_URL ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    } : {
        host: process.env.DB_HOST || 'localhost',
        // ... fallback to individual variables
    }
);

// Middleware-based authentication
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Authentication required' });
};

// Promise-based database operations
app.get('/api/movies', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM movies WHERE user_id = $1', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

**Frontend Patterns (`public/app.js`)**:
```javascript
// Page-based routing
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    switch (currentPage) {
        case 'index.html': initHomePage(); break;
        case 'watchlist.html': initWatchlistPage(); break;
        // ...
    }
});

// Debounced search implementation
let searchTimeout = null;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchMovies(e.target.value), 300);
});

// Fetch-based API communication
async function addToList(movieData, listName) {
    try {
        const response = await fetch('/api/movies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...movieData, list_name: listName })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}
```

### Database Migration and Schema Changes

**Adding New Columns**:
```sql
-- Add new column with default value (safe operation)
ALTER TABLE movies ADD COLUMN poster_path TEXT;
ALTER TABLE movies ADD COLUMN release_date DATE;

-- Update existing records if needed
UPDATE movies SET poster_path = NULL WHERE poster_path IS NULL;
```

**Schema Version Control**:
```bash
# Create migration script
cat > migrations/001_add_user_auth.sql << 'EOF'
-- Migration: Add user authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE movies ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
EOF

# Apply migration
psql $DATABASE_URL < migrations/001_add_user_auth.sql
```

### Testing and Quality Assurance

**Manual Testing Checklist**:
```bash
# 1. Database connectivity
node test-db.js  # Should connect and show table status

# 2. Authentication flow
curl -X POST localhost:5000/api/auth/register -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"testpass123"}' -H "Content-Type: application/json"

# 3. Movie search functionality
curl "localhost:5000/api/search?q=batman"  # Should return TMDB results

# 4. Protected endpoints
curl localhost:5000/api/movies  # Should return 401 without session
```

**Performance Testing**:
```bash
# Database query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM movies WHERE user_id = 1;"

# API response time testing
time curl "localhost:5000/api/search?q=batman"

# Concurrent request testing
for i in {1..10}; do curl "localhost:5000/api/search?q=movie$i" & done; wait
```

### Troubleshooting Guide

**Common Issues and Solutions**:

*Database Connection Errors*:
```bash
# Check environment variables
echo $DATABASE_URL | sed 's/:[^:]*@/:***@/'  # Print URL with hidden password

# Test direct connection
psql "$DATABASE_URL" -c "SELECT NOW();"

# Check SSL requirements
psql "$DATABASE_URL?sslmode=require" -c "SELECT NOW();"
```

*TMDB API Issues*:
```bash
# Validate API key
curl -i "https://api.themoviedb.org/3/configuration?api_key=$TMDB_API_KEY"

# Check rate limits (TMDB allows 40 requests per 10 seconds)
curl -i "https://api.themoviedb.org/3/search/movie?api_key=$TMDB_API_KEY&query=test"
# Look for X-RateLimit headers in response
```

*Session/Authentication Problems*:
```bash
# Check session table
psql $DATABASE_URL -c "SELECT COUNT(*) FROM sessions; SELECT expire FROM sessions ORDER BY expire DESC LIMIT 5;"

# Verify session secret length (should be 32+ characters)
echo $SESSION_SECRET | wc -c

# Test cookie handling
curl -v -X POST localhost:5000/api/auth/login -d '{"email":"test@example.com","password":"testpass"}' -H "Content-Type: application/json" -c cookies.txt
```

*Port and Network Issues*:
```bash
# Check if port 5000 is in use
lsof -i :5000

# Test server binding
netstat -tlnp | grep :5000

# Verify server accessibility
curl -i localhost:5000/
```

### TMDB API Integration Details

**API Key Setup**:
1. Visit [themoviedb.org](https://www.themoviedb.org/)
2. Create account and verify email
3. Go to Settings → API → Create → Developer
4. Fill application details (personal use allowed)
5. Copy API Key (v3 auth) to environment variables

**Rate Limiting and Best Practices**:
- Rate limit: 40 requests per 10 seconds per IP
- Caching: Implement 24-hour cache for keyword checks
- Error handling: Graceful fallbacks when API unavailable
- Content filtering: Both client and server-side filtering implemented

**API Endpoints Used**:
```bash
# Movie search with adult content filtering
GET https://api.themoviedb.org/3/search/movie?api_key={key}&query={query}&include_adult=false

# Movie details retrieval
GET https://api.themoviedb.org/3/movie/{movie_id}?api_key={key}

# Keyword search for content filtering
GET https://api.themoviedb.org/3/search/keyword?api_key={key}&query={keyword}

# Movie keywords for content verification
GET https://api.themoviedb.org/3/movie/{movie_id}/keywords?api_key={key}
```

## Production Deployment Checklist

### Pre-deployment Verification
- [ ] All environment variables configured (`DATABASE_URL`, `TMDB_API_KEY`, `SESSION_SECRET`)
- [ ] Database schema applied (`node setup-db.js && node setup-users.js`)
- [ ] TMDB API key validated and has sufficient quota
- [ ] `NODE_ENV=production` set for secure cookies and SSL database connections
- [ ] Session secret is cryptographically secure (32+ random characters)

### Security Hardening
- [ ] Database uses SSL connections in production
- [ ] Session cookies are secure (`secure: true` when `NODE_ENV=production`)
- [ ] API keys are not exposed in frontend JavaScript
- [ ] Password hashing uses sufficient salt rounds (bcrypt default: 10)
- [ ] SQL injection prevention through parameterized queries verified

### Performance and Monitoring
- [ ] Database connection pooling configured and tested under load
- [ ] TMDB API request caching implemented to prevent rate limit issues
- [ ] Frontend assets served efficiently through Express static middleware
- [ ] Database query performance optimized with appropriate indexes

### Backup and Recovery
- [ ] Database backup strategy implemented (`pg_dump` automation)
- [ ] Environment variable backup stored securely
- [ ] Rollback plan documented for critical issues
- [ ] Health check endpoints available for monitoring

This comprehensive guide provides everything needed to develop, deploy, and maintain the Movie Tracker application in any environment.