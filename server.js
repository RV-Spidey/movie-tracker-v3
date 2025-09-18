require('dotenv').config();
const axios = require('axios');
const mysql = require('mysql2');

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

//Database connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Replace with a more secure user in the future
    password: process.env.DB_PASSWORD, // Use a .env variable for security
    database: 'movie_tracker' // The name of your database
});

connection.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to MariaDB as id', connection.threadId);
});

//the api endpoints

// Step 1: Create the API Search Endpoint
// This endpoint will handle requests from your frontend to search the TMDB API.
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q; // Get the search query from the URL
        const response = await axios.get(
            `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${query}`
        );
        res.json(response.data.results); // Send the search results back as JSON
    } catch (error) {
        console.error('TMDB API Error:', error);
        res.status(500).json({ error: 'An error occurred while fetching data from the movie database.' });
    }
});

// Step 2: Create the Get Movies Endpoint
// This endpoint fetches all the movies from your personal MariaDB database.
app.get('/api/movies', (req, res) => {
    const sql = 'SELECT * FROM movies';
    connection.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results); // Send the movies from your database back to the frontend
    });
});

// Step 3: Create the Add/Delete Movies Endpoints
// These endpoints handle saving and deleting movies in your database.
app.post('/api/movies', (req, res) => {
    const { tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review } = req.body;
    const sql = `
        INSERT INTO movies (tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    connection.query(sql, [tmdb_id, title, director, actors, description, genre, list_name, no_of_times_watched, user_rating, user_review], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: result.insertId, message: 'Movie added successfully!' });
    });
});

app.delete('/api/movies/:id', (req, res) => {
    const { id } = req.params; // Get the movie ID from the URL
    const sql = 'DELETE FROM movies WHERE id = ?';
    connection.query(sql, id, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Movie deleted successfully!' });
    });
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
