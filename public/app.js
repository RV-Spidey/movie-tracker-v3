// Global variables
let currentMovie = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const personalMovies = document.getElementById('personalMovies');
const listFilter = document.getElementById('listFilter');
const movieModal = document.getElementById('movieModal');
const movieDetails = document.getElementById('movieDetails');
const addMovieForm = document.getElementById('addMovieForm');
const closeModal = document.querySelector('.close');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadPersonalMovies();
});

searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchMovies();
    }
});

listFilter.addEventListener('change', filterPersonalMovies);
closeModal.addEventListener('click', closeMovieModal);
addMovieForm.addEventListener('submit', addMovieToCollection);

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    if (event.target === movieModal) {
        closeMovieModal();
    }
});

// Search movies using TMDB API
async function searchMovies() {
    const query = searchInput.value.trim();
    if (!query) return;

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const movies = await response.json();
        displaySearchResults(movies);
    } catch (error) {
        console.error('Error searching movies:', error);
        searchResults.innerHTML = '<p class="error">Error searching movies. Please try again.</p>';
    }
}

// Display search results
function displaySearchResults(movies) {
    if (!movies || movies.length === 0) {
        searchResults.innerHTML = '<p class="no-results">No movies found.</p>';
        return;
    }

    searchResults.innerHTML = movies.map(movie => `
        <div class="movie-card" onclick="openMovieModal(${JSON.stringify(movie).replace(/"/g, '&quot;')})">
            <img src="https://image.tmdb.org/t/p/w200${movie.poster_path}" 
                 alt="${movie.title}" 
                 onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p class="release-date">${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}</p>
                <p class="rating">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</p>
            </div>
        </div>
    `).join('');
}

// Load personal movies from database
async function loadPersonalMovies() {
    try {
        const response = await fetch('/api/movies');
        const movies = await response.json();
        displayPersonalMovies(movies);
    } catch (error) {
        console.error('Error loading personal movies:', error);
        personalMovies.innerHTML = '<p class="error">Error loading your movies.</p>';
    }
}

// Display personal movies
function displayPersonalMovies(movies) {
    if (!movies || movies.length === 0) {
        personalMovies.innerHTML = '<p class="no-results">No movies in your collection yet.</p>';
        return;
    }

    personalMovies.innerHTML = movies.map(movie => `
        <div class="movie-card personal-movie">
            <div class="movie-poster">
                <img src="https://image.tmdb.org/t/p/w200${movie.poster_path || ''}" 
                     alt="${movie.title}" 
                     onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            </div>
            <div class="movie-info">
                <h3>${movie.title}</h3>
                <p class="list-badge">${movie.list_name}</p>
                <p class="user-rating">Your Rating: ${movie.user_rating ? movie.user_rating + '/10' : 'Not rated'}</p>
                <p class="times-watched">Watched ${movie.no_of_times_watched} time(s)</p>
                <button class="delete-btn" onclick="deleteMovie(${movie.id})">Remove</button>
            </div>
        </div>
    `).join('');
}

// Filter personal movies by list
function filterPersonalMovies() {
    const filterValue = listFilter.value;
    loadPersonalMovies().then(() => {
        if (filterValue) {
            const movieCards = personalMovies.querySelectorAll('.movie-card');
            movieCards.forEach(card => {
                const listBadge = card.querySelector('.list-badge');
                if (listBadge && listBadge.textContent.toLowerCase() === filterValue.toLowerCase()) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }
    });
}

// Open movie modal
function openMovieModal(movie) {
    currentMovie = movie;
    
    movieDetails.innerHTML = `
        <div class="movie-detail-content">
            <img src="https://image.tmdb.org/t/p/w300${movie.poster_path}" 
                 alt="${movie.title}"
                 onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
            <div class="movie-detail-info">
                <h2>${movie.title}</h2>
                <p><strong>Release Date:</strong> ${movie.release_date || 'Unknown'}</p>
                <p><strong>Rating:</strong> ⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}/10</p>
                <p><strong>Overview:</strong></p>
                <p class="overview">${movie.overview || 'No overview available.'}</p>
            </div>
        </div>
    `;
    
    movieModal.style.display = 'block';
}

// Close movie modal
function closeMovieModal() {
    movieModal.style.display = 'none';
    addMovieForm.reset();
    currentMovie = null;
}

// Add movie to collection
async function addMovieToCollection(event) {
    event.preventDefault();
    
    if (!currentMovie) return;
    
    const movieData = {
        tmdb_id: currentMovie.id,
        title: currentMovie.title,
        director: '', // We would need to fetch this from TMDB credits API
        actors: '', // We would need to fetch this from TMDB credits API
        description: currentMovie.overview || '',
        genre: currentMovie.genre_ids ? currentMovie.genre_ids.join(',') : '',
        list_name: document.getElementById('listName').value,
        no_of_times_watched: parseInt(document.getElementById('timesWatched').value) || 0,
        user_rating: parseFloat(document.getElementById('userRating').value) || null,
        user_review: document.getElementById('userReview').value || ''
    };
    
    try {
        const response = await fetch('/api/movies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(movieData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Movie added to your collection!');
            closeMovieModal();
            loadPersonalMovies();
        } else {
            alert('Error adding movie: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error adding movie:', error);
        alert('Error adding movie to collection.');
    }
}

// Delete movie from collection
async function deleteMovie(movieId) {
    if (!confirm('Are you sure you want to remove this movie from your collection?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/movies/${movieId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Movie removed from your collection!');
            loadPersonalMovies();
        } else {
            alert('Error removing movie: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting movie:', error);
        alert('Error removing movie from collection.');
    }
}
