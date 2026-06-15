const express = require("express");
const { searchMovie, searchSeries, searchAnime, isAnimeResult } = require("../../src/services/tmdb");
const { movieToMeta, seriesToMeta } = require("../../src/lib/metaMappers");

const router = express.Router();

router.get("/", async (req, res) => {
    const query = req.query.q;
    const type = req.query.type;

    if (!query) {
        return res.json({ results: [] });
    }

    if (type === "movie") {
        const movies = await searchMovie(query);
        return res.json({ results: movies.map(movieToMeta) });
    }

    if (type === "series") {
        const series = await searchSeries(query);
        const nonAnime = series.filter(item => !isAnimeResult(item));
        return res.json({ results: nonAnime.map(item => seriesToMeta(item, "series")) });
    }

    if (type === "anime") {
        const anime = await searchAnime(query);
        return res.json({ results: anime.map(item => seriesToMeta(item, "anime")) });
    }

    const [movies, series] = await Promise.all([searchMovie(query), searchSeries(query)]);

    const results = [
        ...movies.map(movieToMeta),
        ...series.map(item => seriesToMeta(item, isAnimeResult(item) ? "anime" : "series"))
    ];

    res.json({ results });
});

module.exports = router;
