# DeepBlueStream-server

A personal backend that combines [TMDB](https://www.themoviedb.org/) metadata with [Torbox](https://torbox.app/) for cached/uncached torrent playback, [Prowlarr](https://prowlarr.com/) for fallback torrent search, and [OpenSubtitles](https://www.opensubtitles.com/) for subtitles.

It hosts **two independent servers** from the same codebase:

| Server | Entry point | Start command | Default port | Consumer |
| --- | --- | --- | --- | --- |
| **Stremio add-on** | `src/addon.js` | `npm start` | `7001` | Stremio (via `/manifest.json`) |
| **Client API** | `server/index.js` | `npm run start:server` | `7002` | the [DeepBlueStream-client](https://github.com/hezkyDev/DeepBlueStream-client) app (REST under `/api`) |

Both share the same service layer (TMDB, Torbox, Prowlarr, OpenSubtitles) but expose it differently: the add-on speaks the Stremio add-on protocol, while the client API is a plain JSON REST API.

## Features

- **Catalogs** for Movies, Series, and Anime: Trending, Discover (with genre filters), Recently Added, and Favorites
- **Search** across movies, series, and anime catalogs
- **Streams** sourced from your Torbox library, with automatic Prowlarr-based fallback search and caching for titles not yet in Torbox
- **Quality-based sorting** of stream results (4K > 1080p > 720p > 480p)
- **Trailers** (YouTube) shown on movie/series/anime detail pages
- **Subtitles** via OpenSubtitles, matched by file hash
- **Favorites** with playback-triggered pre-caching of the next episode and automatic cleanup of watched episodes from Torbox to save storage

## Requirements

- Node.js 18+
- A [TMDB API key](https://www.themoviedb.org/settings/api)
- A [Torbox API key](https://torbox.app/)
- A [Prowlarr](https://prowlarr.com/) instance with its URL and API key
- An [OpenSubtitles API key](https://www.opensubtitles.com/en/consumers)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your API keys:

   ```bash
   cp .env.example .env
   ```

3. Start the server(s) you need:

   ```bash
   # Stremio add-on (port 7001)
   npm start

   # Client API used by DeepBlueStream-client (port 7002)
   npm run start:server
   ```

   The add-on serves on `http://127.0.0.1:7001` and the client API on `http://127.0.0.1:7002`. They run as separate processes — start the add-on for Stremio, the client API for the app, or both.

## Client API

The client API (`server/index.js`, port `7002`) backs the DeepBlueStream-client app. It mounts the following routers under `/api`:

| Route | Purpose |
| --- | --- |
| `/api/profiles` | Profile management |
| `/api/progress` | Playback progress tracking |
| `/api/favorites` | Favorites (My List) |
| `/api` (catalog) | Home rows and catalogs |
| `/api/meta` | Title metadata / details |
| `/api/stream` | Stream sources for a title |
| `/api/search` | Search across movies, series, anime |
| `/api/skip-times` | Intro/outro skip markers |

Persistent client data lives in `server/data/` (SQLite, managed via `server/db`). The client points at this server via its `API_BASE_URL` (defaults to `http://127.0.0.1:7002`).

## Installing in Stremio

1. Make sure the addon is reachable from wherever Stremio is running. For local-only use, the manifest URL is:

   ```
   http://127.0.0.1:7001/manifest.json
   ```

   To use it on other devices (mobile, TV) or with the Stremio web app, expose your local port publicly using a tunnel such as [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) (ngrok's free tier injects an HTML interstitial that breaks Stremio's JSON requests, so it is **not** recommended).

2. In Stremio, go to **Addons**, paste the manifest URL into the search bar, and click **Install**.

## Running persistently (macOS)

A sample `launchd` plist is recommended for keeping the addon running in the background and restarting it on crash/login. Create `~/Library/LaunchAgents/com.deepbluestream.addon.plist` pointing at `node src/addon.js` in this project directory, then load it with:

```bash
launchctl load ~/Library/LaunchAgents/com.deepbluestream.addon.plist
```

If exposing the addon publicly via Tailscale Funnel, ensure Tailscale is running and connected (it auto-starts on login by default), then run:

```bash
tailscale funnel --bg 7001
```

## Project structure

```
src/                        # Stremio add-on (port 7001)
  addon.js                 # Stremio addon manifest, catalog/meta/stream/subtitle handlers
  data/
    favorites.json          # Favorites store (managed via favorites service)
  services/
    tmdb.js                  # TMDB API client (trending, discover, details, trailers)
    torbox.js                # Torbox API client (cache check, torrent management)
    prowlarr.js              # Prowlarr search client
    searchStreams.js          # Builds streams from Prowlarr + Torbox results
    opensubtitles.js          # OpenSubtitles client
    favorites.js              # Favorites CRUD (JSON-backed)
    favoritesScheduler.js     # Pre-cache next episode / cleanup watched episodes
    skipTimes.js              # Intro/outro skip-time lookup
server/                     # Client REST API (port 7002)
  index.js                 # Express app, mounts /api routers
  routes/                  # profiles, progress, favorites, catalog, meta, stream, search, skipTimes
  db/                      # SQLite access layer (better-sqlite3)
  data/                    # Persistent client data (SQLite database)
  middleware/              # Express middleware
test/                       # Manual test scripts for individual services
```

## Disclaimer

This is a personal project intended for private/legal use with content you have the right to access. It is not affiliated with Stremio, TMDB, Torbox, Prowlarr, or OpenSubtitles.
