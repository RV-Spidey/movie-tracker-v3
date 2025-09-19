# Overview

Movie Tracker is a personal movie management web application that allows users to search for movies using The Movie Database (TMDB) API and organize them into custom lists. Users can maintain watchlists, track watched movies, add ratings and reviews, and monitor viewing frequency. The application provides a clean, modern interface for discovering and cataloging films with personal metadata.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Static Web App**: Multi-page application using vanilla HTML, CSS, and JavaScript
- **Page Structure**: Separate pages for home (search), watchlist, watched movies, and individual film details
- **Client-Side Routing**: Page-based navigation with JavaScript initialization based on current URL
- **Responsive Design**: CSS Grid and Flexbox layout with mobile-first responsive design
- **State Management**: Global variables and DOM manipulation for UI state
- **API Communication**: Fetch API calls to backend endpoints for movie data

## Backend Architecture
- **Node.js/Express Server**: RESTful API server handling movie operations and TMDB integration
- **Static File Serving**: Express static middleware serving frontend assets from public directory
- **API Proxy Pattern**: Backend acts as proxy between frontend and TMDB API to hide API keys
- **Environment Configuration**: dotenv for managing sensitive configuration data

## Data Storage
- **PostgreSQL Database**: Primary data store for user's movie lists and metadata
- **Connection Pool**: pg library with connection pooling for efficient database access
- **Schema Design**: Single movies table with columns for TMDB ID, personal ratings, reviews, list categorization, and view counts
- **Deployment Flexibility**: Supports both Railway cloud PostgreSQL and local development setups

## Movie Data Integration
- **TMDB API Integration**: Real-time movie search and metadata retrieval
- **Adult Content Filtering**: Client and server-side filtering to exclude adult content
- **Image Handling**: TMDB CDN integration for movie posters and artwork
- **Data Normalization**: Mapping between TMDB data structure and internal database schema

## Deployment Configuration
- **Railway Platform**: Cloud deployment with automatic PostgreSQL provisioning
- **Environment Detection**: Different database connection strategies for local vs production
- **Process Management**: Railway.json configuration for deployment and restart policies
- **SSL Configuration**: Conditional SSL settings based on environment

# External Dependencies

## Third-Party Services
- **The Movie Database (TMDB) API**: Primary data source for movie information, search, and imagery
- **Railway**: Cloud hosting platform providing PostgreSQL database and application hosting
- **Font Awesome**: Icon library for UI components
- **Google Fonts (Inter)**: Typography and font rendering

## Core Dependencies
- **Express.js**: Web server framework for API endpoints and static file serving
- **PostgreSQL (pg)**: Database driver for connection management and query execution
- **Axios**: HTTP client for TMDB API communication
- **dotenv**: Environment variable management for configuration

## Development Tools
- **Node.js Runtime**: JavaScript execution environment (v14+ required)
- **npm Package Manager**: Dependency management and script execution
- **Railway CLI**: Deployment and database management tools

## Database Requirements
- **PostgreSQL**: Primary database system with support for connection pooling
- **SSL Support**: Required for production deployments on Railway platform
- **Schema Migrations**: Manual database setup through provided scripts