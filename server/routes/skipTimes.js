const express = require("express");
const { getSkipTimes } = require("../../src/services/skipTimes");

const router = express.Router();

router.get("/:type/:tmdbId/:season/:episode", async (req, res) => {
    const { type, tmdbId, season, episode } = req.params;
    const episodeDurationSeconds = Number(req.query.episodeLength) || 0;

    try {
        const result = await getSkipTimes({
            type,
            tmdbId,
            season: Number(season),
            episode: Number(episode),
            episodeDurationSeconds
        });

        res.json(result);
    } catch (err) {
        console.error("skipTimes route failed:", err.message);
        res.status(500).json({ error: "Failed to fetch skip times" });
    }
});

module.exports = router;
