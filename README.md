# DeepBlueStream

A personal Stremio addon that combines [TMDB](https://www.themoviedb.org/) metadata with [Torbox](https://torbox.app/) for cached/uncached torrent playback, [Prowlarr](https://prowlarr.com/) for fallback torrent search, and [OpenSubtitles](https://www.opensubtitles.com/) for subtitles.

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

3. Start the addon:

   ```bash
   npm start
   ```

   By default the addon serves on `http://127.0.0.1:7001`.

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
src/
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
test/                       # Manual test scripts for individual services
```

## Disclaimer

This is a personal project intended for private/legal use with content you have the right to access. It is not affiliated with Stremio, TMDB, Torbox, Prowlarr, or OpenSubtitles.
