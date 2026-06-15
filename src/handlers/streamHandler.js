const {
    getMovieDetails,
    getSeriesDetails,
    getMovieByImdbId,
    getSeriesByImdbId
} = require("../services/tmdb");

const { findMatchingTorrents, isVideoFile } = require("../services/torbox");

const {
    searchCachedStreamsForMovie,
    searchCachedStreamsForSeriesEpisode
} = require("../services/searchStreams");

const { findFavoriteByTmdbId } = require("../services/favorites");
const { onFavoritePlayback, trackEpisodeTorrent } = require("../services/favoritesScheduler");

const {
    getMyTorrentsCached,
    getPlayableTorrents,
    groupTorrentsByMedia,
    findTorboxGroupByKey
} = require("../lib/torboxLibrary");

const {
    safeRequestDownloadLink,
    buildStreamTitle,
    parseStremioId,
    computeAbsoluteEpisode,
    strictEpisodeNumberMatches,
    episodeNumberMatches,
    torrentMatchesEpisode,
    seriesTitleMatches,
    sortCandidatesByQuality,
    dedupeStreamCandidates
} = require("../lib/streamHelpers");

const { mapLimit } = require("../utils");

const { MAX_STREAMS_PER_ITEM, DOWNLOAD_LINK_CONCURRENCY } = require("../constants");

function collectEpisodeCandidates(torrents, season, episode, absoluteEpisode, matchFn) {
    const candidates = [];

    for (const torrent of torrents) {
        const videoFiles = torrent.files
            .filter(isVideoFile)
            .filter(file =>
                season === undefined && episode === undefined
                    ? true
                    : torrentMatchesEpisode(torrent, file, season, episode, absoluteEpisode, matchFn)
            )
            .slice(0, 2);

        for (const file of videoFiles) {
            candidates.push({ torrent, file });
        }
    }

    return candidates;
}

async function buildStreamsFromTorrents(torrents, prefix, { season, episode, absoluteEpisode } = {}) {
    let candidates;

    if (season === undefined && episode === undefined) {
        candidates = collectEpisodeCandidates(torrents, season, episode, absoluteEpisode);
    } else {
        // Prefer strict SxxExx/"EP N" matches; only fall back to the looser
        // dash-number pattern (which can false-positive on specials/OVAs
        // titled like "... - 01") if nothing strict was found.
        candidates = collectEpisodeCandidates(torrents, season, episode, absoluteEpisode, strictEpisodeNumberMatches);

        if (candidates.length === 0) {
            candidates = collectEpisodeCandidates(torrents, season, episode, absoluteEpisode, episodeNumberMatches);
        }
    }

    const getSourceName = ({ torrent, file }) => file.name || torrent.name;

    candidates = sortCandidatesByQuality(candidates, getSourceName);
    candidates = dedupeStreamCandidates(candidates, getSourceName, ({ file }) => file.size);
    candidates = candidates.slice(0, MAX_STREAMS_PER_ITEM);

    const results = await mapLimit(candidates, DOWNLOAD_LINK_CONCURRENCY, async ({ torrent, file }) => {
        const url = await safeRequestDownloadLink(torrent.id, file.id);

        if (!url) {
            return null;
        }

        return {
            title: buildStreamTitle(prefix, file, torrent),
            url,
            behaviorHints: {
                notWebReady: false
            }
        };
    });

    return results.filter(Boolean);
}

async function streamFromImdbMovie(imdbId) {
    const movieSearchResult = await getMovieByImdbId(imdbId);

    if (!movieSearchResult) {
        console.log("No TMDB movie found for IMDb ID:", imdbId);
        return { streams: [] };
    }

    const movie = await getMovieDetails(movieSearchResult.id);

    const movieYear = movie.release_date
        ? movie.release_date.slice(0, 4)
        : undefined;

    console.log("Searching Torbox for IMDb movie:", movie.title, movieYear || "");

    const matchingTorrents = await findMatchingTorrents(movie.title, movieYear);

    const streams = await buildStreamsFromTorrents(matchingTorrents, "Torbox");

    if (streams.length === 0) {
        console.log("No mylist stream found. Searching Prowlarr + Torbox cache...");

        const cachedSearchStreams = await searchCachedStreamsForMovie(movie);

        streams.push(...cachedSearchStreams);
    }

    console.log("Final streams returned:", streams.length);
    return { streams };
}

async function resolveSeriesEpisodeStreams(series, type, season, episode) {
    const absoluteEpisode = computeAbsoluteEpisode(series, season, episode);

    console.log(
        "Searching Torbox for series/anime:",
        series.name,
        "S",
        season,
        "E",
        episode,
        "(absolute:",
        absoluteEpisode,
        ")"
    );

    const torrents = await getMyTorrentsCached();

    const matchingGroups = groupTorrentsByMedia(getPlayableTorrents(torrents))
        .filter(group => seriesTitleMatches(group.title, series.name));

    console.log("Matching series groups:", matchingGroups.length);

    const streams = [];

    for (const group of matchingGroups) {
        streams.push(...await buildStreamsFromTorrents(group.torrents, "Torbox Library", {
            season,
            episode,
            absoluteEpisode
        }));
    }

    if (streams.length === 0 && season !== undefined && episode !== undefined) {
        console.log("No Torbox Library episode found. Searching Prowlarr + Torbox cache...");

        const cachedSearchStreams = await searchCachedStreamsForSeriesEpisode(
            series,
            season,
            episode,
            absoluteEpisode
        );

        streams.push(...cachedSearchStreams);
    }

    const playedTorrentId = streams.find(stream => stream.torrentId)?.torrentId;

    if ((type === "anime" || type === "series") && season !== undefined && episode !== undefined && playedTorrentId) {
        // Track every resolved series-episode torrent (favorites or not) so
        // that when the user reports progress on a newer episode, we can
        // auto-remove this one from their Torbox library.
        trackEpisodeTorrent(`${type}:${series.id}`, season, episode, playedTorrentId);
    }

    const favoriteType = (type === "anime" || type === "series")
        ? findFavoriteByTmdbId(type, series.id)
        : undefined;

    if (favoriteType && season !== undefined && episode !== undefined) {
        onFavoritePlayback(series, season, episode, playedTorrentId);
    }

    for (const stream of streams) {
        delete stream.torrentId;
    }

    console.log("Final streams returned:", streams.length);
    return { streams };
}

async function streamFromImdbSeries(imdbId, type, season, episode) {
    const seriesSearchResult = await getSeriesByImdbId(imdbId);

    if (!seriesSearchResult) {
        console.log("No TMDB series found for IMDb ID:", imdbId);
        return { streams: [] };
    }

    const series = await getSeriesDetails(seriesSearchResult.id);

    return resolveSeriesEpisodeStreams(series, type, season, episode);
}

async function streamFromTorboxGroup(groupKey) {
    const group = await findTorboxGroupByKey(groupKey);

    if (!group) {
        return { streams: [] };
    }

    const streams = await buildStreamsFromTorrents(group.torrents, "Torbox Library");

    console.log("Final streams returned:", streams.length);
    return { streams };
}

async function streamFromTorboxTorrent(torrentId) {
    const torrents = await getMyTorrentsCached();
    const torrent = torrents.find(t => t.id === torrentId);

    if (!torrent) {
        console.log("Torbox Library torrent not found.");
        return { streams: [] };
    }

    const videoFiles = torrent.files
        .filter(isVideoFile)
        .slice(0, MAX_STREAMS_PER_ITEM);

    const results = await mapLimit(videoFiles, DOWNLOAD_LINK_CONCURRENCY, async file => {
        const url = await safeRequestDownloadLink(torrent.id, file.id);

        if (!url) {
            return null;
        }

        return {
            title: buildStreamTitle("Torbox Library", file, torrent),
            url,
            behaviorHints: {
                notWebReady: false
            }
        };
    });

    const streams = results.filter(Boolean);

    console.log("Final streams returned:", streams.length);
    return { streams };
}

async function streamFromDbsSeries(tmdbId, type, season, episode) {
    const series = await getSeriesDetails(tmdbId);

    return resolveSeriesEpisodeStreams(series, type, season, episode);
}

async function streamFromDbsMovie(tmdbId) {
    const movie = await getMovieDetails(tmdbId);

    const movieYear = movie.release_date
        ? movie.release_date.slice(0, 4)
        : undefined;

    console.log("Searching Torbox for:", movie.title, movieYear || "");

    const matchingTorrents = await findMatchingTorrents(movie.title, movieYear);

    console.log("Matches found:", matchingTorrents.length);

    const streams = await buildStreamsFromTorrents(matchingTorrents, "Torbox");

    if (streams.length === 0) {
        console.log("No mylist stream found. Searching Prowlarr + Torbox cache...");

        const cachedSearchStreams = await searchCachedStreamsForMovie(movie);

        streams.push(...cachedSearchStreams);
    }

    console.log("Final streams returned:", streams.length);
    return { streams };
}

async function streamHandler({ type, id }) {
    console.log("========== STREAM REQUEST ==========");
    console.log("type =", type);
    console.log("id =", id);
    console.log("===================================");

    try {
        if (id.startsWith("tt")) {
            const parsed = parseStremioId(id);
            const imdbId = parsed.imdbId;
            const season = parsed.season;
            const episode = parsed.episode;

            console.log("IMDb/Cinemeta stream request:", type, id);
            console.log("Parsed IMDb ID:", imdbId, "Season:", season, "Episode:", episode);

            if (type === "movie") {
                return streamFromImdbMovie(imdbId);
            }

            if (type === "series" || type === "anime") {
                return streamFromImdbSeries(imdbId, type, season, episode);
            }

            return { streams: [] };
        }

        if (id.startsWith("tbg:")) {
            return streamFromTorboxGroup(id.replace("tbg:", ""));
        }

        if (id.startsWith("tb:")) {
            return streamFromTorboxTorrent(Number(id.replace("tb:", "")));
        }

        if (id.startsWith("dbs-series:") || id.startsWith("dbs-anime:")) {
            const seriesType = id.startsWith("dbs-anime:") ? "anime" : "series";
            const idPrefix = seriesType === "anime" ? "dbs-anime:" : "dbs-series:";
            const parts = id.replace(idPrefix, "").split(":");

            const tmdbId = parts[0];
            const season = parts[1] !== undefined ? Number(parts[1]) : undefined;
            const episode = parts[2] !== undefined ? Number(parts[2]) : undefined;

            console.log("Parsed DBS series ID:", tmdbId, "Season:", season, "Episode:", episode);

            return streamFromDbsSeries(tmdbId, seriesType, season, episode);
        }

        if (id.startsWith("dbs:")) {
            return streamFromDbsMovie(id.replace("dbs:", ""));
        }

        return { streams: [] };

    } catch (err) {
        console.error("Stream error:", err.response?.data || err.message);
        return { streams: [] };
    }
}

module.exports = streamHandler;
