# 🎬 Movie Tracker

A web application to track and manage your personal movie collection using The Movie Database (TMDB) API. Search for movies, add them to custom lists, rate them, and write reviews.

## Features

- 🔍 Search movies using TMDB API
- 📝 Add movies to personal lists (Watchlist, Watched, Favorites)
- ⭐ Rate movies on a scale of 1-10
- 📖 Write personal reviews
- 🗂️ Filter movies by list type
- 🎯 Track how many times you've watched each movie

## Prerequisites

Before running this application, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [MySQL](https://www.mysql.com/) or [MariaDB](https://mariadb.org/)
- A [TMDB API key](https://www.themoviedb.org/settings/api)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/RV-Spidey/movie-tracker.git
   cd movie-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Fill in your database password and TMDB API key:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env`:
   ```
   DB_PASSWORD=your_database_password
   TMDB_API_KEY=your_tmdb_api_key
   PORT=3000
   ```

4. **Set up the database**
   
   Create a MySQL/MariaDB database and table:
   ```sql
   CREATE DATABASE movie_tracker;
   USE movie_tracker;
   
   CREATE TABLE movies (
       id INT AUTO_INCREMENT PRIMARY KEY,
       tmdb_id INT NOT NULL,
       title VARCHAR(255) NOT NULL,
       director VARCHAR(255),
       actors TEXT,
       description TEXT,
       genre VARCHAR(255),
       list_name ENUM('watchlist', 'watched', 'favorites') NOT NULL,
       no_of_times_watched INT DEFAULT 0,
       user_rating DECIMAL(3,1),
       user_review TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       UNIQUE KEY unique_movie_list (tmdb_id, list_name)
   );
   ```

## Usage

1. **Start the server**
   ```bash
   npm start
   ```

2. **Open your browser**
   Navigate to `http://localhost:3000`

3. **Start tracking movies!**
   - Search for movies using the search bar
   - Click on a movie to see details and add it to your collection
   - View your collection in the "My Movie Collection" section
   - Filter by list type (Watchlist, Watched, Favorites)

## API Endpoints

### Movie Search
- `GET /api/search?q=movie_name` - Search movies via TMDB API

### Personal Movies
- `GET /api/movies` - Get all movies from your collection
- `POST /api/movies` - Add a movie to your collection
- `DELETE /api/movies/:id` - Remove a movie from your collection

## Project Structure

```
movie-tracker/
├── server.js              # Express server and API endpoints
├── package.json           # Node.js dependencies and scripts
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore file
├── README.md             # Project documentation
└── public/               # Frontend files
    ├── index.html        # Main HTML file
    ├── app.js            # Client-side JavaScript
    └── styles.css        # CSS styles
```

## Database Schema

The `movies` table includes the following fields:

| Field | Type | Description |
|-------|------|-------------|
| id | INT (PK) | Auto-incrementing primary key |
| tmdb_id | INT | The Movie Database ID |
| title | VARCHAR(255) | Movie title |
| director | VARCHAR(255) | Movie director |
| actors | TEXT | Cast members |
| description | TEXT | Movie overview/plot |
| genre | VARCHAR(255) | Movie genres |
| list_name | ENUM | Collection list (watchlist, watched, favorites) |
| no_of_times_watched | INT | Number of times watched |
| user_rating | DECIMAL(3,1) | Personal rating (1.0-10.0) |
| user_review | TEXT | Personal review |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

## Getting TMDB API Key

1. Go to [The Movie Database](https://www.themoviedb.org/)
2. Create an account or log in
3. Go to Settings → API
4. Request an API key
5. Copy your API key to the `.env` file

## Development

### Running in Development Mode
```bash
npm run dev
```

### Dependencies
- **Express.js** - Web framework
- **MySQL2** - Database driver
- **Axios** - HTTP client for API requests
- **Dotenv** - Environment variable management

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgments

- [The Movie Database (TMDB)](https://www.themoviedb.org/) for providing the movie data API
- [Express.js](https://expressjs.com/) for the web framework
- [MySQL](https://www.mysql.com/) for the database system

---

Happy movie tracking! 🍿
