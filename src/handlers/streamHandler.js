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
const { onFavoritePlayback } = require("../services/favoritesScheduler");

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
    torrentMatchesEpisode,
    seriesTitleMatches
} = require("../lib/streamHelpers");

const { MAX_STREAMS_PER_ITEM } = require("../constants");

async function buildStreamsFromTorrents(torrents, prefix, { season, episode, absoluteEpisode } = {}) {
    const streams = [];

    for (const torrent of torrents) {
        if (streams.length >= MAX_STREAMS_PER_ITEM) {
            break;
        }

        const videoFiles = torrent.files
            .filter(isVideoFile)
            .filter(file =>
                season === undefined && episode === undefined
                    ? true
                    : torrentMatchesEpisode(torrent, file, season, episode, absoluteEpisode)
            )
            .slice(0, 2);

        for (const file of videoFiles) {
            if (streams.length >= MAX_STREAMS_PER_ITEM) {
                break;
            }

            const url = await safeRequestDownloadLink(torrent.id, file.id);

            if (!url) {
                continue;
            }

            streams.push({
                title: buildStreamTitle(prefix, file, torrent),
                url,
                behaviorHints: {
                    notWebReady: false
                }
            });
        }
    }

    return streams;
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

async function streamFromImdbSeries(imdbId, type, season, episode) {
    const seriesSearchResult = await getSeriesByImdbId(imdbId);

    if (!seriesSearchResult) {
        console.log("No TMDB series found for IMDb ID:", imdbId);
        return { streams: [] };
    }

    const series = await getSeriesDetails(seriesSearchResult.id);

    const absoluteEpisode = computeAbsoluteEpisode(series, season, episode);

    console.log(
        "Searching Torbox for IMDb series/anime:",
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

    if (streams.length === 0) {
        console.log("No Torbox Library episode found. Searching Prowlarr + Torbox cache...");

        const cachedSearchStreams = await searchCachedStreamsForSeriesEpisode(
            series,
            season,
            episode
        );

        streams.push(...cachedSearchStreams);
    }

    const favoriteType = (type === "anime" || type === "series")
        ? findFavoriteByTmdbId(type, series.id)
        : undefined;

    if (favoriteType && season !== undefined && episode !== undefined) {
        const playedTorrentId = streams.find(stream => stream.torrentId)?.torrentId;
        onFavoritePlayback(series, season, episode, playedTorrentId);
    }

    for (const stream of streams) {
        delete stream.torrentId;
    }

    console.log("Final streams returned:", streams.length);
    return { streams };
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

    const streams = [];

    for (const file of videoFiles) {
        const url = await safeRequestDownloadLink(torrent.id, file.id);

        if (!url) {
            continue;
        }

        streams.push({
            title: buildStreamTitle("Torbox Library", file, torrent),
            url,
            behaviorHints: {
                notWebReady: false
            }
        });
    }

    console.log("Final streams returned:", streams.length);
    return { streams };
}

async function streamFromDbsSeries(tmdbId) {
    const series = await getSeriesDetails(tmdbId);

    console.log("Searching Torbox for series/anime:", series.name);

    const torrents = await getMyTorrentsCached();

    const matchingGroups = groupTorrentsByMedia(getPlayableTorrents(torrents))
        .filter(group => seriesTitleMatches(group.title, series.name));

    const streams = [];

    for (const group of matchingGroups) {
        streams.push(...await buildStreamsFromTorrents(group.torrents, "Torbox Library"));
    }

    if (streams.length === 0) {
        console.log("No Torbox Library series stream found.");

        // Catalog-based series cards do not include selected season/episode yet,
        // so there is no episode number to run the Prowlarr fallback against here.
    }

    console.log("Final streams returned:", streams.length);
    return { streams };
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
            const tmdbId = id
                .replace("dbs-series:", "")
                .replace("dbs-anime:", "");

            return streamFromDbsSeries(tmdbId);
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
