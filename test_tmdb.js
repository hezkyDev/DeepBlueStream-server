require("dotenv").config();

const { getTrendingMovies } = require("./src/services/tmdb");

(async () => {

    const movies = await getTrendingMovies();

    console.log(movies.slice(0,5));

})();