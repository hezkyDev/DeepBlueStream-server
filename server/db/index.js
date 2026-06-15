const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "dbs.sqlite");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// Migration: the original UNIQUE(profile_id, media_id, season, episode) constraint
// never deduped movie rows because SQLite treats NULL season/episode as distinct.
// Collapse any resulting duplicates before enforcing the NULL-safe unique index.
db.exec(`
    DELETE FROM watch_progress
    WHERE id NOT IN (
        SELECT MAX(id) FROM watch_progress
        GROUP BY profile_id, media_id, IFNULL(season, -1), IFNULL(episode, -1)
    )
`);

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_unique
    ON watch_progress(profile_id, media_id, IFNULL(season, -1), IFNULL(episode, -1))
`);

module.exports = db;
