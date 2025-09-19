# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Environment Setup
```bash
# Copy environment template and configure
cp .env.example .env
# Edit .env with your DB_PASSWORD and TMDB_API_KEY

# Install dependencies
npm install
```

### Running the Application
```bash
# Start the server (production)
npm start

# Start in development mode
npm run dev

# Deploy to Railway (requires Railway CLI)
railway deploy

# Connect to Railway PostgreSQL
railway connect postgresql
```

### Database Setup

#### Local PostgreSQL Setup
For local development, create PostgreSQL database and table:
```sql
CREATE DATABASE movie_tracker;
\c movie_tracker;

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

-- Create trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_movies_updated_at BEFORE UPDATE
ON movies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Railway Deployment Setup
1. **Create Railway Project**: Go to [railway.app](https://railway.app) and create a new project
2. **Add PostgreSQL Database**: Add a PostgreSQL service to your project
3. **Deploy Application**: Connect your GitHub repository or deploy from CLI
4. **Environment Variables**: Set the following in Railway dashboard:
   - `TMDB_API_KEY`: Your TMDB API key
   - `NODE_ENV`: Set to `production`
   - `DATABASE_URL`: Automatically provided by Railway PostgreSQL service
5. **Run Database Setup**: Connect to Railway PostgreSQL and run the schema above

### Testing
Currently no test framework is configured. Tests would need to be set up from scratch.

## Architecture Overview

### Application Structure
This is a simple full-stack web application with a traditional client-server architecture:

- **Backend**: Node.js/Express.js server (`server.js`) serving both API endpoints and static files
- **Frontend**: Vanilla JavaScript SPA in the `public/` directory
- **Database**: MySQL/MariaDB with a single `movies` table
- **External API**: Integrates with The Movie Database (TMDB) API for movie search

### Key Components

**Server Architecture (`server.js`)**:
- Single Express server file handling all backend logic
- Direct database connection using mysql2 (no ORM)
- Three main API endpoints: search, CRUD operations for movies
- Static file serving for the frontend

**Frontend Architecture**:
- `index.html`: Single-page structure with modal-based movie details
- `app.js`: All client-side logic including API calls, DOM manipulation, and event handling
- `styles.css`: Complete styling for the application

**Data Flow**:
1. User searches movies → Frontend calls `/api/search` → Server proxies to TMDB API
2. User adds movie → Frontend posts to `/api/movies` → Server inserts to database
3. User views collection → Frontend calls `/api/movies` → Server queries database

### Database Schema
Single `movies` table with these key relationships:
- `tmdb_id`: Links to TMDB external ID
- `list_name`: ENUM determining movie categorization (watchlist/watched/favorites)
- Unique constraint on `(tmdb_id, list_name)` prevents duplicate entries per list

## Environment Variables

### Local Development
Required variables in `.env`:
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_USER`: PostgreSQL username (default: postgres)
- `DB_PASSWORD`: PostgreSQL password
- `DB_NAME`: Database name (default: movie_tracker)
- `TMDB_API_KEY`: API key from themoviedb.org
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (optional, defaults to 3000)

### Railway Production
Railway automatically provides:
- `DATABASE_URL`: Complete PostgreSQL connection string
- `PORT`: Assigned by Railway

Manually set in Railway dashboard:
- `TMDB_API_KEY`: Your TMDB API key
- `NODE_ENV`: Set to 'production'

## API Endpoints
- `GET /api/search?q={query}`: Proxy search to TMDB API
- `GET /api/movies`: Retrieve user's movie collection
- `POST /api/movies`: Add movie to collection
- `DELETE /api/movies/:id`: Remove movie from collection

## Development Guidelines

### Code Style
- Uses ES6+ features (async/await, arrow functions, template literals)
- Frontend uses vanilla JavaScript with modern DOM APIs
- Server uses CommonJS modules (require/module.exports)

### Database Operations
- No ORM - uses raw SQL queries with mysql2
- All database operations are synchronous within request handlers
- Error handling returns JSON error responses

### Frontend Patterns
- Event-driven architecture with global event listeners
- Modal-based UI for movie details and actions
- API calls use modern fetch() API
- DOM manipulation uses vanilla JavaScript methods

### Security Considerations
- API keys stored in environment variables
- Database password in environment variables
- Frontend sanitizes user input for SQL injection prevention through parameterized queries
- TMDB API key exposed to frontend (consider proxy pattern for production)
