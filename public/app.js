// Global variables
let searchTimeout = null;
let cachedMovies = [];
let currentUser = null;

// Utility functions
const API_BASE = '';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

// DOM helpers
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Show/hide elements
const show = (element) => element?.classList.remove('hidden');
const hide = (element) => element?.classList.add('hidden');

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
            currentUser = await response.json();
            updateNavigation(true);
        } else {
            currentUser = null;
            updateNavigation(false);
        }
    } catch (error) {
        console.log('Not authenticated');
        currentUser = null;
        updateNavigation(false);
    }
}

function updateNavigation(isAuthenticated) {
    const loginBtn = $('#loginBtn');
    const registerBtn = $('#registerBtn');
    const logoutBtn = $('#logoutBtn');
    
    if (isAuthenticated) {
        loginBtn?.style.setProperty('display', 'none');
        registerBtn?.style.setProperty('display', 'none');
        logoutBtn?.style.setProperty('display', 'block');
    } else {
        loginBtn?.style.setProperty('display', 'block');
        registerBtn?.style.setProperty('display', 'block');
        logoutBtn?.style.setProperty('display', 'none');
    }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        updateNavigation(false);
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Initialize app based on current page
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication status first
    checkAuthStatus();
    
    // Set up logout button handler
    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
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
        // Filter out any adult content as an additional safety measure
        const filteredMovies = movies.filter(movie => !movie.adult);
        
        resultsGrid.innerHTML = filteredMovies.map(movie => `
            <div class="movie-card poster-hover">
                <div onclick="goToMovieDetails(${movie.id})" class="movie-poster-link" style="cursor: pointer;">
                    <img 
                        src="${movie.poster_path ? TMDB_IMAGE_BASE + movie.poster_path : '/api/placeholder/300/450'}" 
                        alt="${movie.title}"
                        class="movie-card-poster"
                        onerror="this.src='/api/placeholder/300/450'"
                    >
                </div>
                <div class="movie-card-content">
                    <h3 class="movie-card-title">${movie.title}</h3>
                    <p class="movie-card-year">${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown'}</p>
                    <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button onclick="addToList('watchlist', ${movie.id}, ${JSON.stringify(movie).replace(/"/g, '&quot;')})" class="btn btn-primary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                            Watchlist
                        </button>
                        <button onclick="addToList('watched', ${movie.id}, ${JSON.stringify(movie).replace(/"/g, '&quot;')})" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                            Watched
                        </button>
                    </div>
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
        displayMovieGrid(filteredMovies, gridElement, listType);
    } catch (error) {
        console.error(`Error loading ${listType}:`, error);
        show(emptyElement);
        emptyElement.textContent = `Error loading ${listType}. Please refresh the page.`;
    }
}

function displayMovieGrid(movies, gridElement, listType = null) {
    gridElement.innerHTML = movies.map(movie => {
        // Use poster_path from our database or construct TMDB URL from stored path
        let posterSrc = '/api/placeholder/300/450';
        if (movie.poster_path) {
            // If it's already a full URL, use it; otherwise construct TMDB URL
            posterSrc = movie.poster_path.startsWith('http') ? movie.poster_path : TMDB_IMAGE_BASE + movie.poster_path;
        }
        
        // Determine what actions to show based on current list
        let actionButtons = '';
        if (listType === 'watchlist') {
            actionButtons = `
                <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button onclick="moveToWatched(${movie.id})" class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; flex: 1;">
                        ✓ Mark as Watched
                    </button>
                    <button onclick="removeFromCollection(${movie.id})" class="btn clear-btn-main" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                        Remove
                    </button>
                </div>
            `;
        } else if (listType === 'watched') {
            actionButtons = `
                <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button onclick="moveToWatchlist(${movie.id})" class="btn btn-primary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem; flex: 1;">
                        ← Back to Watchlist
                    </button>
                    <button onclick="removeFromCollection(${movie.id})" class="btn clear-btn-main" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                        Remove
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="movie-card poster-hover">
                <a href="film.html?id=${movie.tmdb_id}" class="movie-poster-link">
                    <img 
                        src="${posterSrc}" 
                        alt="${movie.title}"
                        class="movie-card-poster"
                        onerror="this.src='/api/placeholder/300/450'"
                    >
                </a>
                <div class="movie-card-content">
                    <h3 class="movie-card-title">${movie.title}</h3>
                    <p class="movie-card-year">${movie.release_date ? new Date(movie.release_date).getFullYear() : 'Year unknown'}</p>
                    ${movie.user_rating ? `<p class="movie-card-year">⭐ ${movie.user_rating}/10</p>` : ''}
                    ${actionButtons}
                </div>
            </div>
        `;
    }).join('');
}

async function loadMovieDetails(tmdbId) {
    const movieDetails = $('#movieDetails');
    if (!movieDetails) return;

    // Show loading state
    movieDetails.innerHTML = '<p>Loading movie details...</p>';

    try {
        // First try to get from our database
        const dbResponse = await fetch(`${API_BASE}/api/movies`);
        const userMovies = await dbResponse.json();
        const userMovie = userMovies.find(movie => movie.tmdb_id == tmdbId);

        let tmdbMovie;
        
        if (userMovie) {
            // If we have the movie in our database, search by title for more reliable results
            const tmdbResponse = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(userMovie.title)}`);
            const tmdbMovies = await tmdbResponse.json();
            tmdbMovie = tmdbMovies.find(movie => movie.id == tmdbId) || tmdbMovies[0];
        } else {
            // If we don't have it in database, get directly by TMDB ID
            const tmdbResponse = await fetch(`${API_BASE}/api/movie/${tmdbId}`);
            if (tmdbResponse.ok) {
                tmdbMovie = await tmdbResponse.json();
            }
        }

        if (!tmdbMovie) {
            movieDetails.innerHTML = '<div class="empty-state">Movie not found. Please try searching from the home page.</div>';
            return;
        }

        displayMovieDetails(tmdbMovie, userMovie);
    } catch (error) {
        console.error('Error loading movie details:', error);
        movieDetails.innerHTML = '<div class="empty-state">Error loading movie details. Please try again.</div>';
    }
}

function displayMovieDetails(movie, userMovie) {
    const movieDetails = $('#movieDetails');
    const isInCollection = !!userMovie;

    // Handle genres - TMDB API returns different formats
    let genresDisplay = '';
    if (movie.genres && movie.genres.length > 0) {
        // Direct API call returns genre objects with name property
        genresDisplay = `
            <div class="details-genres">
                ${movie.genres.map(genre => `<span class="genre-tag">${genre.name}</span>`).join('')}
            </div>
        `;
    } else if (movie.genre_ids && movie.genre_ids.length > 0) {
        // Search API returns genre IDs
        genresDisplay = `
            <div class="details-genres">
                ${movie.genre_ids.map(genreId => `<span class="genre-tag">Genre ${genreId}</span>`).join('')}
            </div>
        `;
    }

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
                
                ${genresDisplay}
                
                <div style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    ${!isInCollection ? `
                        <button onclick="addToList('watchlist', ${movie.id}, ${JSON.stringify(movie).replace(/"/g, '&quot;')})" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border-radius: 0.5rem;">
                            Add to Watchlist
                        </button>
                        <button onclick="addToList('watched', ${movie.id}, ${JSON.stringify(movie).replace(/"/g, '&quot;')})" class="btn btn-secondary" style="padding: 0.75rem 1.5rem; border-radius: 0.5rem;">
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
async function addToList(listType, tmdbId, movieData = null) {
    try {
        let movie = movieData;
        
        // If no movie data provided, try to fetch it
        if (!movie) {
            try {
                // First try to get movie directly by TMDB ID
                const directResponse = await fetch(`${API_BASE}/api/movie/${tmdbId}`);
                if (directResponse.ok) {
                    movie = await directResponse.json();
                } else {
                    // Fallback: try searching by ID (less reliable)
                    const searchResponse = await fetch(`${API_BASE}/api/search?q=${tmdbId}`);
                    const movies = await searchResponse.json();
                    movie = movies.find(m => m.id == tmdbId) || movies[0];
                }
            } catch (fetchError) {
                console.error('Error fetching movie data:', fetchError);
            }
        }

        if (!movie) {
            alert('Movie not found. Please try searching again.');
            return;
        }
        
        // Filter out adult content
        if (movie.adult) {
            alert('This content is not available.');
            return;
        }

        // Handle genres from different API responses
        let genreString = '';
        if (movie.genre_ids && movie.genre_ids.length > 0) {
            // Search API returns genre IDs
            genreString = movie.genre_ids.join(',');
        } else if (movie.genres && movie.genres.length > 0) {
            // Direct API returns genre objects with names
            genreString = movie.genres.map(g => g.name).join(',');
        }

        const dbMovieData = {
            tmdb_id: movie.id,
            title: movie.title,
            director: '',
            actors: '',
            description: movie.overview || '',
            genre: genreString,
            list_name: listType,
            no_of_times_watched: listType === 'watched' ? 1 : 0,
            user_rating: null,
            user_review: '',
            poster_path: movie.poster_path || '',
            release_date: movie.release_date || ''
        };

        const addResponse = await fetch(`${API_BASE}/api/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dbMovieData)
        });

        const result = await addResponse.json();

        if (addResponse.ok) {
            alert(`Movie added to ${listType}!`);
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

// Move movie from watchlist to watched
async function moveToWatched(movieId) {
    try {
        const response = await fetch(`${API_BASE}/api/movies/${movieId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                list_name: 'watched',
                no_of_times_watched: 1
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Movie moved to watched list!');
            window.location.reload();
        } else {
            alert('Error moving movie: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error moving movie to watched:', error);
        alert('Error moving movie to watched list.');
    }
}

// Move movie from watched back to watchlist
async function moveToWatchlist(movieId) {
    try {
        const response = await fetch(`${API_BASE}/api/movies/${movieId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                list_name: 'watchlist',
                no_of_times_watched: 0
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Movie moved back to watchlist!');
            window.location.reload();
        } else {
            alert('Error moving movie: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error moving movie to watchlist:', error);
        alert('Error moving movie to watchlist.');
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
window.moveToWatched = moveToWatched;
window.moveToWatchlist = moveToWatchlist;
