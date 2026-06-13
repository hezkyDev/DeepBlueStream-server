CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT,
    pin_hash TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS watch_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    type TEXT NOT NULL,
    season INTEGER,
    episode INTEGER,
    position_seconds REAL NOT NULL,
    duration_seconds REAL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(profile_id, media_id, season, episode)
);

CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    tmdb_id TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(profile_id, type, tmdb_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_profile ON watch_progress(profile_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_favorites_profile ON favorites(profile_id);
