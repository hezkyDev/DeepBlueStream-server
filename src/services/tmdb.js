const axios = require("axios");

const API_KEY = process.env.TMDB_API_KEY;

async function getTrendingMovies() {

    const response = await axios.get(
        "https://api.themoviedb.org/3/trending/movie/week",
        {
            params: {
                api_key: API_KEY
            }
        }
    );

    return response.data.results;
}

async function getMovieDetails(movieId) {

    const response = await axios.get(
        `https://api.themoviedb.org/3/movie/${movieId}`,
        {
            params: {
                api_key: API_KEY
            }
        }
    );

    return response.data;
}

module.exports = {
    getTrendingMovies,
    getMovieDetails
};