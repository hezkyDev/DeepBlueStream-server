const axios = require("axios");

const API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

async function getTrendingMovies() {
    const response = await axios.get(`${BASE_URL}/trending/movie/week`, {
        params: {
            api_key: API_KEY,
            language: "en-US"
        }
    });

    return response.data.results || [];
}

async function getTrendingSeries() {
    const response = await axios.get(`${BASE_URL}/trending/tv/week`, {
        params: {
            api_key: API_KEY,
            language: "en-US"
        }
    });

    return response.data.results || [];
}

async function getMovieDetails(movieId) {
    const response = await axios.get(`${BASE_URL}/movie/${movieId}`, {
        params: {
            api_key: API_KEY,
            language: "en-US"
        }
    });

    return response.data;
}

async function getSeriesDetails(seriesId) {
    const response = await axios.get(`${BASE_URL}/tv/${seriesId}`, {
        params: {
            api_key: API_KEY,
            language: "en-US"
        }
    });

    return response.data;
}

async function searchMovie(query, year) {
    const params = {
        api_key: API_KEY,
        language: "en-US",
        query,
        include_adult: false
    };

    if (year) {
        params.year = year;
    }

    const response = await axios.get(`${BASE_URL}/search/movie`, {
        params
    });

    return response.data.results || [];
}

async function searchSeries(query, year) {
    const params = {
        api_key: API_KEY,
        language: "en-US",
        query,
        include_adult: false
    };

    if (year) {
        params.first_air_date_year = year;
    }

    const response = await axios.get(`${BASE_URL}/search/tv`, {
        params
    });

    return response.data.results || [];
}

async function getMovieByImdbId(imdbId) {
    const response = await axios.get(`${BASE_URL}/find/${imdbId}`, {
        params: {
            api_key: API_KEY,
            external_source: "imdb_id",
            language: "en-US"
        }
    });

    const movies = response.data.movie_results || [];

    if (movies.length === 0) {
        return null;
    }

    return movies[0];
}

async function getSeriesByImdbId(imdbId) {
    const response = await axios.get(`${BASE_URL}/find/${imdbId}`, {
        params: {
            api_key: API_KEY,
            external_source: "imdb_id",
            language: "en-US"
        }
    });

    const series = response.data.tv_results || [];

    if (series.length === 0) {
        return null;
    }

    return series[0];
}

module.exports = {
    getTrendingMovies,
    getTrendingSeries,
    getMovieDetails,
    getSeriesDetails,
    searchMovie,
    searchSeries,
    getMovieByImdbId,
    getSeriesByImdbId
};