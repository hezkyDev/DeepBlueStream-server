const express = require("express");
const db = require("../db");
const { requireProfile } = require("../middleware/profile");
const { PROGRESS_MIN_RATIO, PROGRESS_DONE_RATIO } = require("../constants");

const router = express.Router();

router.use(requireProfile);

router.get("/", (req, res) => {
    const rows = db
        .prepare(
            `SELECT media_id, type, season, episode, position_seconds, duration_seconds, updated_at
             FROM watch_progress
             WHERE profile_id = ?
             ORDER BY updated_at DESC`
        )
        .all(req.profileId)
        .filter(row => {
            if (!row.duration_seconds) {
                return true;
            }

            const ratio = row.position_seconds / row.duration_seconds;
            return ratio >= PROGRESS_MIN_RATIO && ratio <= PROGRESS_DONE_RATIO;
        })
        .map(row => ({
            mediaId: row.media_id,
            type: row.type,
            season: row.season,
            episode: row.episode,
            positionSeconds: row.position_seconds,
            durationSeconds: row.duration_seconds,
            updatedAt: row.updated_at
        }));

    res.json(rows);
});

router.post("/", (req, res) => {
    const { mediaId, type, season, episode, positionSeconds, durationSeconds } = req.body || {};

    if (!mediaId || !type || positionSeconds === undefined) {
        return res.status(400).json({ error: "mediaId, type, and positionSeconds are required" });
    }

    db.prepare(
        `INSERT INTO watch_progress (profile_id, media_id, type, season, episode, position_seconds, duration_seconds, updated_at)
         VALUES (@profileId, @mediaId, @type, @season, @episode, @positionSeconds, @durationSeconds, strftime('%s','now'))
         ON CONFLICT(profile_id, media_id, IFNULL(season, -1), IFNULL(episode, -1))
         DO UPDATE SET position_seconds = @positionSeconds, duration_seconds = @durationSeconds, updated_at = strftime('%s','now')`
    ).run({
        profileId: req.profileId,
        mediaId,
        type,
        season: season ?? null,
        episode: episode ?? null,
        positionSeconds,
        durationSeconds: durationSeconds ?? null
    });

    res.status(204).end();
});

router.delete("/:mediaId", (req, res) => {
    const { season, episode } = req.query;

    db.prepare(
        `DELETE FROM watch_progress
         WHERE profile_id = ? AND media_id = ?
           AND season IS ? AND episode IS ?`
    ).run(
        req.profileId,
        req.params.mediaId,
        season !== undefined ? Number(season) : null,
        episode !== undefined ? Number(episode) : null
    );

    res.status(204).end();
});

module.exports = router;
