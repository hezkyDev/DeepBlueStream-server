const { getSeriesDetails } = require("./tmdb");
const { searchCachedStreamsForSeriesEpisode } = require("./searchStreams");
const { deleteTorrent } = require("./torbox");

const DEFAULT_RUNTIME_MINUTES = 24;
const CLEANUP_BUFFER_MINUTES = 30;
const PREFETCH_DELAY_MS = 15 * 1000;

const cleanupTimers = new Map();

function getNextEpisode(series, season, episode) {
    const seasons = Array.isArray(series.seasons) ? series.seasons : [];
    const seasonInfo = seasons.find(s => s.season_number === season);

    if (seasonInfo && episode < seasonInfo.episode_count) {
        return { season, episode: episode + 1 };
    }

    const nextSeasonInfo = seasons
        .filter(s => s.season_number > season)
        .sort((a, b) => a.season_number - b.season_number)[0];

    if (nextSeasonInfo) {
        return { season: nextSeasonInfo.season_number, episode: 1 };
    }

    return null;
}

function getEpisodeRuntimeMinutes(series) {
    const runtimes = series.episode_run_time || [];
    return runtimes.length > 0 ? runtimes[0] : DEFAULT_RUNTIME_MINUTES;
}

async function prefetchNextEpisode(series, season, episode) {
    const next = getNextEpisode(series, season, episode);

    if (!next) {
        return;
    }

    console.log(`Pre-caching next episode for ${series.name}: S${next.season}E${next.episode}`);

    try {
        await searchCachedStreamsForSeriesEpisode(series, next.season, next.episode);
    } catch (err) {
        console.error("Pre-cache next episode failed:", err.response?.data || err.message);
    }
}

function scheduleTorrentCleanup(torrentId, series) {
    const existingTimer = cleanupTimers.get(torrentId);

    if (existingTimer) {
        clearTimeout(existingTimer);
    }

    const runtimeMinutes = getEpisodeRuntimeMinutes(series);
    const delayMs = (runtimeMinutes + CLEANUP_BUFFER_MINUTES) * 60 * 1000;

    const timer = setTimeout(async () => {
        cleanupTimers.delete(torrentId);

        try {
            console.log(`Cleaning up cached torrent ${torrentId} for ${series.name}`);
            await deleteTorrent(torrentId);
        } catch (err) {
            console.error("Torrent cleanup failed:", err.response?.data || err.message);
        }
    }, delayMs);

    cleanupTimers.set(torrentId, timer);
}

function onFavoritePlayback(series, season, episode, torrentId) {
    if (torrentId) {
        scheduleTorrentCleanup(torrentId, series);
    }

    // Delay so the pre-fetch search doesn't compete with the
    // current episode's stream/download-link requests on Torbox.
    setTimeout(() => {
        prefetchNextEpisode(series, season, episode);
    }, PREFETCH_DELAY_MS);
}

module.exports = {
    onFavoritePlayback,
    getNextEpisode
};
