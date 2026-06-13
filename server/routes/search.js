const express = require("express");
const { searchMovie } = require("../../src/services/tmdb");
const { movieToMeta } = require("../../src/lib/metaMappers");

const router = express.Router();

router.get("/", async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.json({ results: [] });
    }

    const results = await searchMovie(query);
    res.json({ results: results.map(movieToMeta) });
});

module.exports = router;
