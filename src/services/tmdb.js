const axios = require("axios");

const API_KEY = process.env.TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map();

async function withCache(key, fn) {
    const cached = cache.get(key);

    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.data;
    }

    const data = await fn();

    cache.set(key, { data, loadedAt: Date.now() });

    return data;
}

async function testConnection() {
    const response = await axios.get(`${BASE_URL}/configuration`, {
        params: { api_key: API_KEY }
    });

    return response.data;
}

async function getTrendingMovies() {
    return withCache("trending:movie", async () => {
        const response = await axios.get(`${BASE_URL}/trending/movie/week`, {
            params: {
                api_key: API_KEY,
                language: "en-US"
            }
        });

        return response.data.results || [];
    });
}

async function getTrendingSeries() {
    return withCache("trending:series", async () => {
        const response = await axios.get(`${BASE_URL}/trending/tv/week`, {
            params: {
                api_key: API_KEY,
                language: "en-US"
            }
        });

        return response.data.results || [];
    });
}

async function getMovieDetails(movieId) {
    return withCache(`movie:${movieId}`, async () => {
        const response = await axios.get(`${BASE_URL}/movie/${movieId}`, {
            params: {
                api_key: API_KEY,
                language: "en-US"
            }
        });

        return response.data;
    });
}

async function getSeriesDetails(seriesId) {
    return withCache(`series:${seriesId}`, async () => {
        const response = await axios.get(`${BASE_URL}/tv/${seriesId}`, {
            params: {
                api_key: API_KEY,
                language: "en-US"
            }
        });

        return response.data;
    });
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

async function discoverMovies({ genreId, page = 1 } = {}) {
    return withCache(`discover:movie:${genreId || "all"}:${page}`, async () => {
        const params = {
            api_key: API_KEY,
            language: "en-US",
            sort_by: "popularity.desc",
            include_adult: false,
            page
        };

        if (genreId) {
            params.with_genres = genreId;
        }

        const response = await axios.get(`${BASE_URL}/discover/movie`, { params });

        return response.data.results || [];
    });
}

async function discoverSeries({ genreId, page = 1 } = {}) {
    return withCache(`discover:series:${genreId || "all"}:${page}`, async () => {
        const params = {
            api_key: API_KEY,
            language: "en-US",
            sort_by: "popularity.desc",
            include_adult: false,
            page
        };

        if (genreId) {
            params.with_genres = genreId;
        }

        const response = await axios.get(`${BASE_URL}/discover/tv`, { params });

        return response.data.results || [];
    });
}

async function getMovieVideos(movieId) {
    return withCache(`movie-videos:${movieId}`, async () => {
        const response = await axios.get(`${BASE_URL}/movie/${movieId}/videos`, {
            params: {
                api_key: API_KEY,
                language: "en-US"
            }
        });

        return response.data.results || [];
    });
}

async function getSeriesVideos(seriesId) {
    return withCache(`series-videos:${seriesId}`, async () => {
        const response = await axios.get(`${BASE_URL}/tv/${seriesId}/videos`, {
            params: {
                api_key: API_KEY,
                language: "en-US"
            }
        });

        return response.data.results || [];
    });
}

function extractTrailers(videos) {
    return videos
        .filter(video => video.site === "YouTube" && video.type === "Trailer")
        .map(video => ({ title: video.name || "Trailer", ytId: video.key }));
}

async function getMovieByImdbId(imdbId) {
    return withCache(`movie-imdb:${imdbId}`, async () => {
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
    });
}

async function getSeriesByImdbId(imdbId) {
    return withCache(`series-imdb:${imdbId}`, async () => {
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
    });
}

module.exports = {
    testConnection,
    getTrendingMovies,
    getTrendingSeries,
    getMovieDetails,
    getSeriesDetails,
    searchMovie,
    searchSeries,
    getMovieByImdbId,
    getSeriesByImdbId,
    discoverMovies,
    discoverSeries,
    getMovieVideos,
    getSeriesVideos,
    extractTrailers
};