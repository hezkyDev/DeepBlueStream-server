const express = require("express");
const db = require("../db");
const { requireProfile } = require("../middleware/profile");
const { getTrendingMovies, getMovieDetails, discoverMovies } = require("../../src/services/tmdb");
const { movieToMeta } = require("../../src/lib/metaMappers");
const { MOVIE_GENRES } = require("../../src/constants");
const { PROGRESS_MIN_RATIO, PROGRESS_DONE_RATIO } = require("../constants");

const router = express.Router();

const HOME_GENRES = ["Action", "Comedy", "Sci-Fi", "Horror"];

router.get("/home", requireProfile, async (req, res) => {
    try {
        const [continueWatching, trendingMovies, myList, genreRows] = await Promise.all([
            buildContinueWatching(req.profileId),
            buildTrendingMovies(),
            buildMyList(req.profileId),
            buildGenreRows()
        ]);

        res.json({
            rows: [
                { id: "continue-watching", title: "Continue Watching", items: continueWatching },
                { id: "trending-movies", title: "Trending Movies", items: trendingMovies },
                { id: "my-list", title: "My List", items: myList },
                ...genreRows
            ]
        });
    } catch (err) {
        console.error("Home catalog error:", err.response?.data || err.message);
        res.status(500).json({ error: "Failed to build home catalog" });
    }
});

async function buildContinueWatching(profileId) {
    const rows = db
        .prepare(
            `SELECT media_id, position_seconds, duration_seconds
             FROM watch_progress
             WHERE profile_id = ? AND type = 'movie'
             ORDER BY updated_at DESC`
        )
        .all(profileId)
        .filter(row => {
            if (!row.duration_seconds) {
                return true;
            }

            const ratio = row.position_seconds / row.duration_seconds;
            return ratio >= PROGRESS_MIN_RATIO && ratio <= PROGRESS_DONE_RATIO;
        });

    const items = await Promise.all(
        rows.map(async row => {
            try {
                const tmdbId = row.media_id.replace("dbs:", "");
                const movie = await getMovieDetails(tmdbId);

                return {
                    ...movieToMeta(movie),
                    progress: {
                        positionSeconds: row.position_seconds,
                        durationSeconds: row.duration_seconds
                    }
                };
            } catch (err) {
                console.error("Continue watching enrich error:", err.message);
                return null;
            }
        })
    );

    return items.filter(Boolean);
}

async function buildTrendingMovies() {
    const movies = await getTrendingMovies();
    return movies.map(movieToMeta);
}

async function buildGenreRows() {
    const rows = await Promise.all(
        HOME_GENRES.map(async genre => {
            const movies = await discoverMovies({ genreId: MOVIE_GENRES[genre] });
            return { id: `genre-${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, title: genre, items: movies.map(movieToMeta) };
        })
    );

    return rows;
}

async function buildMyList(profileId) {
    const rows = db
        .prepare("SELECT tmdb_id FROM favorites WHERE profile_id = ? AND type = 'movie' ORDER BY added_at DESC")
        .all(profileId);

    const items = await Promise.all(
        rows.map(async row => {
            try {
                const movie = await getMovieDetails(row.tmdb_id);
                return movieToMeta(movie);
            } catch (err) {
                console.error("My list enrich error:", err.message);
                return null;
            }
        })
    );

    return items.filter(Boolean);
}

module.exports = router;
