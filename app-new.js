// Global variables
let searchTimeout = null;
let cachedMovies = [];

// Utility functions
const API_BASE = '';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Show/hide elements
const show = (element) => element?.classList.remove('hidden');
const hide = (element) => element?.classList.add('hidden');

// Initialize app based on current page
document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    switch (currentPage) {
        case 'index.html':
        case '':
            initHomePage();
            break;
        case 'watchlist.html':
            initWatchlistPage();
            break;
        case 'watched.html':
            initWatchedPage();
            break;
        case 'film.html':
            initFilmPage();
            break;
    }
});

// Home Page Functions
function initHomePage() {
    const searchInput = $('#searchInput');
    const clearSearchBtn = $('#clearSearch');
    const searchHint = $('#searchHint');
    const resultsGrid = $('#resultsGrid');
    const loadingRow = $('#loadingRow');
    const emptyState = $('#emptyState');

    if (!searchInput) return;

    // Search input handler
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length === 0) {
            clearSearch();
            return;
        }

        show(clearSearchBtn);
        hide(searchHint);
        
        // Debounce search
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchMovies(query);
        }, 300);
    });

    // Clear search button
    clearSearchBtn?.addEventListener('click', clearSearch);

    function clearSearch() {
        searchInput.value = '';
        hide(clearSearchBtn);
        show(searchHint);
        resultsGrid.innerHTML = '';
        show(emptyState);
        emptyState.textContent = 'Start typing to search for a movie.';
    }

    async function searchMovies(query) {
        show(loadingRow);
        hide(emptyState);
        resultsGrid.innerHTML = '';

        try {
            const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
            const movies = await response.json();

            hide(loadingRow);

            if (!movies || movies.length === 0) {
                show(emptyState);
                emptyState.textContent = 'No movies found. Try a different search.';
                return;
            }

            displaySearchResults(movies);
        } catch (error) {
            console.error('Search error:', error);
            hide(loadingRow);
            show(emptyState);
            emptyState.textContent = 'Error searching movies. Please try again.';
        }
    }

    function displaySearchResults(movies) {
        resultsGrid.innerHTML = movies.map(movie => `
            <div class="movie-card poster-hover" onclick="goToMovieDetails(${movie.id})">
                <a class="movie-poster-link">
                    <img 
                        src="${movie.poster_path ? TMDB_IMAGE_BASE + movie.poster_path : '/api/placeholder/300/450'}" 
                        alt="${movie.title}"
                        class="movie-card-poster"
                        onerror="this.src='/api/placeholder/300/450'"
                    >
                </a>
                <div class="movie-card-content">
                    <h3 class="movie-card-title">${movie.title}</h3>
                    <p class="movie-card-year">${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}</p>
                </div>
            </div>
        `).join('');
    }
}

// Watchlist Page Functions
function initWatchlistPage() {
    const watchlistGrid = $('#watchlistGrid');
    const emptyWatchlist = $('#emptyWatchlist');
    const clearWatchlistBtn = $('#clearWatchlist');

    loadMoviesByList('watchlist', watchlistGrid, emptyWatchlist);

    clearWatchlistBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your entire watchlist?')) {
            clearMoviesList('watchlist');
        }
    });
}

// Watched Page Functions
function initWatchedPage() {
    const watchedGrid = $('#watchedGrid');
    const emptyWatched = $('#emptyWatched');
    const clearWatchedBtn = $('#clearWatched');

    loadMoviesByList('watched', watchedGrid, emptyWatched);

    clearWatchedBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your entire watched list?')) {
            clearMoviesList('watched');
        }
    });
}

// Film Details Page Functions
function initFilmPage() {
    const movieId = getMovieIdFromUrl();
    if (movieId) {
        loadMovieDetails(movieId);
    }
}

// Shared Functions
async function loadMoviesByList(listType, gridElement, emptyElement) {
    if (!gridElement || !emptyElement) return;

    try {
        const response = await fetch(`${API_BASE}/api/movies`);
        const allMovies = await response.json();
        const filteredMovies = allMovies.filter(movie => movie.list_name === listType);

        if (filteredMovies.length === 0) {
            show(emptyElement);
            gridElement.innerHTML = '';
            return;
        }

        hide(emptyElement);
        displayMovieGrid(filteredMovies, gridElement);
    } catch (error) {
        console.error(`Error loading ${listType}:`, error);
        show(emptyElement);
        emptyElement.textContent = `Error loading ${listType}. Please refresh the page.`;
    }
}

function displayMovieGrid(movies, gridElement) {
    gridElement.innerHTML = movies.map(movie => `
        <div class="movie-card poster-hover">
            <a href="film.html?id=${movie.tmdb_id}" class="movie-poster-link">
                <img 
                    src="${movie.poster_path ? TMDB_IMAGE_BASE + movie.poster_path : '/api/placeholder/300/450'}" 
                    alt="${movie.title}"
                    class="movie-card-poster"
                    onerror="this.src='/api/placeholder/300/450'"
                >
            </a>
            <div class="movie-card-content">
                <h3 class="movie-card-title">${movie.title}</h3>
                <p class="movie-card-year">${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Year unknown'}</p>
                ${movie.user_rating ? `<p class="movie-card-year">⭐ ${movie.user_rating}/10</p>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadMovieDetails(tmdbId) {
    const movieDetails = $('#movieDetails');
    if (!movieDetails) return;

    try {
        // First try to get from our database
        const dbResponse = await fetch(`${API_BASE}/api/movies`);
        const userMovies = await dbResponse.json();
        const userMovie = userMovies.find(movie => movie.tmdb_id == tmdbId);

        // Get full details from TMDB
        const tmdbResponse = await fetch(`${API_BASE}/api/search?q=${tmdbId}`);
        const tmdbMovies = await tmdbResponse.json();
        const tmdbMovie = tmdbMovies.find(movie => movie.id == tmdbId) || tmdbMovies[0];

        if (!tmdbMovie) {
            movieDetails.innerHTML = '<p>Movie not found.</p>';
            return;
        }

        displayMovieDetails(tmdbMovie, userMovie);
    } catch (error) {
        console.error('Error loading movie details:', error);
        movieDetails.innerHTML = '<p>Error loading movie details.</p>';
    }
}

function displayMovieDetails(movie, userMovie) {
    const movieDetails = $('#movieDetails');
    const isInCollection = !!userMovie;

    movieDetails.innerHTML = `
        <div class="movie-details-grid">
            <div>
                <img 
                    src="${movie.poster_path ? TMDB_IMAGE_BASE + movie.poster_path : '/api/placeholder/300/450'}" 
                    alt="${movie.title}"
                    class="movie-card-poster"
                    style="border-radius: 1rem;"
                    onerror="this.src='/api/placeholder/300/450'"
                >
            </div>
            <div class="details-info">
                <h1 class="details-title">${movie.title}</h1>
                <p class="details-year">${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Year unknown'}</p>
                
                ${movie.vote_average ? `<p>⭐ ${movie.vote_average.toFixed(1)}/10 (TMDB Rating)</p>` : ''}
                ${userMovie?.user_rating ? `<p>🎯 Your Rating: ${userMovie.user_rating}/10</p>` : ''}
                ${userMovie?.no_of_times_watched > 0 ? `<p>👁️ Watched ${userMovie.no_of_times_watched} time(s)</p>` : ''}
                
                <h3 class="details-plot-title">Plot</h3>
                <p class="details-plot">${movie.overview || 'No plot description available.'}</p>
                
                ${movie.genre_ids && movie.genre_ids.length > 0 ? `
                    <div class="details-genres">
                        ${movie.genre_ids.map(genreId => `<span class="genre-tag">Genre ${genreId}</span>`).join('')}
                    </div>
                ` : ''}
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    ${!isInCollection ? `
                        <button onclick="addToList('watchlist', ${movie.id})" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border-radius: 0.5rem;">
                            Add to Watchlist
                        </button>
                        <button onclick="addToList('watched', ${movie.id})" class="btn btn-secondary" style="padding: 0.75rem 1.5rem; border-radius: 0.5rem;">
                            Mark as Watched
                        </button>
                    ` : `
                        <p style="color: #6ee7b7;">✓ In your ${userMovie.list_name} list</p>
                        <button onclick="removeFromCollection(${userMovie.id})" class="btn clear-btn-main" style="padding: 0.75rem 1.5rem; border-radius: 0.5rem;">
                            Remove from Collection
                        </button>
                    `}
                </div>
                
                ${userMovie?.user_review ? `
                    <div style="margin-top: 1.5rem; padding: 1rem; background-color: rgba(255,255,255,0.05); border-radius: 0.5rem;">
                        <h4>Your Review:</h4>
                        <p style="color: rgba(255,255,255,0.8); margin-top: 0.5rem;">${userMovie.user_review}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Action Functions
async function addToList(listType, tmdbId) {
    try {
        // Get movie details first
        const response = await fetch(`${API_BASE}/api/search?q=${tmdbId}`);
        const movies = await response.json();
        const movie = movies.find(m => m.id == tmdbId) || movies[0];

        if (!movie) {
            alert('Movie not found');
            return;
        }

        const movieData = {
            tmdb_id: movie.id,
            title: movie.title,
            director: '',
            actors: '',
            description: movie.overview || '',
            genre: movie.genre_ids ? movie.genre_ids.join(',') : '',
            list_name: listType,
            no_of_times_watched: listType === 'watched' ? 1 : 0,
            user_rating: null,
            user_review: ''
        };

        const addResponse = await fetch(`${API_BASE}/api/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(movieData)
        });

        const result = await addResponse.json();

        if (addResponse.ok) {
            alert(`Movie added to ${listType}!`);
            // Reload current page
            window.location.reload();
        } else {
            alert('Error adding movie: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error adding movie:', error);
        alert('Error adding movie to collection.');
    }
}

async function removeFromCollection(movieId) {
    if (!confirm('Are you sure you want to remove this movie from your collection?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/movies/${movieId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok) {
            alert('Movie removed from collection!');
            window.location.reload();
        } else {
            alert('Error removing movie: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error removing movie:', error);
        alert('Error removing movie from collection.');
    }
}

async function clearMoviesList(listType) {
    try {
        const response = await fetch(`${API_BASE}/api/movies`);
        const allMovies = await response.json();
        const moviesToDelete = allMovies.filter(movie => movie.list_name === listType);

        for (const movie of moviesToDelete) {
            await fetch(`${API_BASE}/api/movies/${movie.id}`, {
                method: 'DELETE'
            });
        }

        alert(`${listType} cleared!`);
        window.location.reload();
    } catch (error) {
        console.error(`Error clearing ${listType}:`, error);
        alert(`Error clearing ${listType}.`);
    }
}

// Navigation Functions
function goToMovieDetails(tmdbId) {
    window.location.href = `film.html?id=${tmdbId}`;
}

function getMovieIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Export functions for global access
window.addToList = addToList;
window.removeFromCollection = removeFromCollection;
window.goToMovieDetails = goToMovieDetails;
