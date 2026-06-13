const express = require("express");
const db = require("../db");
const { requireProfile } = require("../middleware/profile");
const { getMovieDetails, getSeriesDetails } = require("../../src/services/tmdb");
const { movieToMeta, seriesToMeta } = require("../../src/lib/metaMappers");

const router = express.Router();

router.use(requireProfile);

router.get("/", async (req, res) => {
    const favorites = db
        .prepare("SELECT type, tmdb_id, added_at FROM favorites WHERE profile_id = ? ORDER BY added_at DESC")
        .all(req.profileId);

    const items = await Promise.all(
        favorites.map(async favorite => {
            try {
                if (favorite.type === "movie") {
                    const movie = await getMovieDetails(favorite.tmdb_id);
                    return { ...movieToMeta(movie), addedAt: favorite.added_at };
                }

                const series = await getSeriesDetails(favorite.tmdb_id);
                return { ...seriesToMeta(series, favorite.type), addedAt: favorite.added_at };
            } catch (err) {
                console.error("Favorites enrich error:", err.message);
                return null;
            }
        })
    );

    res.json(items.filter(Boolean));
});

router.post("/", (req, res) => {
    const { type, tmdbId } = req.body || {};

    if (!type || !tmdbId) {
        return res.status(400).json({ error: "type and tmdbId are required" });
    }

    db.prepare(
        `INSERT OR IGNORE INTO favorites (profile_id, type, tmdb_id) VALUES (?, ?, ?)`
    ).run(req.profileId, type, String(tmdbId));

    res.status(204).end();
});

router.delete("/:type/:tmdbId", (req, res) => {
    db.prepare(
        "DELETE FROM favorites WHERE profile_id = ? AND type = ? AND tmdb_id = ?"
    ).run(req.profileId, req.params.type, req.params.tmdbId);

    res.status(204).end();
});

module.exports = router;
