require("dotenv").config();

const { searchMovies } = require("./src/services/prowlarr");

(async () => {
    try {
        const results = await searchMovies("In the Grey", "2026");

        console.log("Results found:", results.length);

        console.log(
            JSON.stringify(results.slice(0, 5), null, 2)
        );
    } catch (err) {
        console.error(
            err.response?.data || err.message
        );
    }
})();