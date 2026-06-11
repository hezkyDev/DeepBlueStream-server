require("dotenv").config();

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const {
    getTrendingMovies,
    getTrendingSeries,
    getMovieDetails,
    getSeriesDetails,
    searchMovie,
    searchSeries,
    getMovieByImdbId,
    getSeriesByImdbId
} = require("./services/tmdb");

const {
    getMyTorrents,
    findMatchingTorrents,
    requestDownloadLink,
    isVideoFile,
    formatBytes,
    detectQuality,
    detectCodec,
    extractYear,
    cleanMovieTitle
} = require("./services/torbox");

const {
    searchCachedStreamsForMovie,
    searchCachedStreamsForSeriesEpisode
} = require("./services/searchStreams");

const PORT = 7001;

const PLACEHOLDER_POSTER =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/800px-Placeholder_view_vector.svg.png";

const TORBOX_LIBRARY_LIMIT = 30;
const TORBOX_RECENT_LIMIT = 20;
const TORRENTS_CACHE_TTL_MS = 60 * 1000;
const MAX_STREAMS_PER_ITEM = 8;
const TORBOX_REQUEST_DELAY_MS = 700;

let torrentsCache = {
    data: null,
    loadedAt: 0
};

const enrichCache = new Map();

const manifest = {
    id: "com.deepbluestream",
    version: "1.0.0",
    name: "DeepBlueStream",
    description: "Personal Streaming Platform",

    resources: ["catalog", "meta", "stream"],

    types: ["movie", "series", "anime"],

    idPrefixes: ["tt", "dbs", "dbs-series", "dbs-anime", "tb", "tbg"],

    catalogs: [
        {
            type: "movie",
            id: "torbox-trending",
            name: "DeepBlueStream - Trending Movies",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "series",
            id: "torbox-trending-series",
            name: "DeepBlueStream - Trending Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "anime",
            id: "torbox-trending-anime",
            name: "DeepBlueStream - Trending Anime",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "torbox-movies",
            name: "DeepBlueStream - Movies"
        },
        {
            type: "series",
            id: "torbox-series",
            name: "DeepBlueStream - Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "anime",
            id: "torbox-anime",
            name: "DeepBlueStream - Anime",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "torbox-recent-movies",
            name: "DeepBlueStream - Recently Added Movies"
        },
        {
            type: "series",
            id: "torbox-recent-series",
            name: "DeepBlueStream - Recently Added Series"
        },
        {
            type: "anime",
            id: "torbox-recent-anime",
            name: "DeepBlueStream - Recently Added Anime"
        }
    ]
};

const builder = new addonBuilder(manifest);

async function getMyTorrentsCached() {
    const now = Date.now();

    if (
        torrentsCache.data &&
        now - torrentsCache.loadedAt < TORRENTS_CACHE_TTL_MS
    ) {
        return torrentsCache.data;
    }

    const torrents = await getMyTorrents();

    torrentsCache = {
        data: torrents,
        loadedAt: now
    };

    return torrents;
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[._\-()[\]{}:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeRequestDownloadLink(torrentId, fileId) {
    try {
        await sleep(TORBOX_REQUEST_DELAY_MS);
        return await requestDownloadLink(torrentId, fileId);
    } catch (err) {
        console.error(
            "requestDownloadLink failed:",
            err.response?.data || err.message
        );

        return null;
    }
}

function isEpisodeLike(name) {
    const text = String(name || "");

    return (
        /\bS\d{1,2}E\d{1,3}\b/i.test(text) ||
        /\bSeason\b/i.test(text) ||
        /\bEpisode\b/i.test(text) ||
        /\bE\d{2,4}\b/i.test(text) ||
        /\b\d{2,4}\s*(mkv|mp4|avi|webm)\b/i.test(text) ||
        /\b\d{2,4}\s*[~\-]\s*\d{2,4}\b/i.test(text)
    );
}

function detectKnownSeriesTitle(name) {
    return null;
}

function detectKnownAnimeTitle(name) {
    const text = String(name || "").toLowerCase();

    if (text.includes("one piece")) return "One Piece";
    if (text.includes("fist of the north star")) return "Fist of the North Star";
    if (text.includes("hokuto no ken")) return "Fist of the North Star";

    return null;
}

function cleanSeriesTitle(name) {
    const knownAnime = detectKnownAnimeTitle(name);

    if (knownAnime) {
        return knownAnime;
    }

    const knownSeries = detectKnownSeriesTitle(name);

    if (knownSeries) {
        return knownSeries;
    }

    let cleaned = String(name || "");

    cleaned = cleaned
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\([^\)]*\)/g, " ")
        .replace(/[._-]/g, " ");

    cleaned = cleaned.replace(/\bS\d{1,2}E\d{1,3}\b.*$/i, " ");
    cleaned = cleaned.replace(/\bSeason\s*\d+\b.*$/i, " ");
    cleaned = cleaned.replace(/\bEpisode\s*\d+\b.*$/i, " ");
    cleaned = cleaned.replace(/\b\d{2,4}\s*[~\-]\s*\d{2,4}\b.*$/i, " ");
    cleaned = cleaned.replace(/\b\d{2,4}\b.*$/i, " ");

    cleaned = cleaned
        .replace(/\b(720p|1080p|2160p|4k|webrip|web dl|webdl|web-dl|web|bluray|blu ray|brrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|ddp|aac|dts|10bit|8bit|proper|repack|extended|remux|amzn|nf|dsnp|hulu|rarbg|yify)\b/gi, " ")
        .replace(/\b(mkv|mp4|avi|mov|webm)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned;
}

function detectLibraryType(torrent) {
    const name = torrent.name || "";

    if (detectKnownAnimeTitle(name)) {
        return "anime";
    }

    if (/\[anime/i.test(name) || /anime/i.test(name)) {
        return "anime";
    }

    if (isEpisodeLike(name)) {
        return "series";
    }

    return "movie";
}

function getPlayableTorrents(torrents) {
    return torrents.filter(torrent => {
        return (
            torrent.cached &&
            torrent.download_finished &&
            Array.isArray(torrent.files) &&
            torrent.files.some(isVideoFile)
        );
    });
}

function getTorrentGroupKey(torrent) {
    const libraryType = detectLibraryType(torrent);

    if (libraryType === "anime" || libraryType === "series") {
        const seriesTitle = cleanSeriesTitle(torrent.name);
        const normalizedSeriesTitle = normalizeText(seriesTitle || torrent.name);

        return `${libraryType}-${normalizedSeriesTitle}`;
    }

    const cleanTitle = cleanMovieTitle(torrent.name);
    const year = extractYear(torrent.name);
    const normalizedTitle = normalizeText(cleanTitle || torrent.name);

    return `movie-${normalizedTitle}-${year || "unknown"}`;
}

function extractEpisodeNumber(name) {
    const text = String(name || "");

    const sxeMatch = text.match(/\bS\d{1,2}E(\d{1,4})\b/i);
    if (sxeMatch) {
        return Number(sxeMatch[1]);
    }

    const episodeMatch = text.match(/\bEpisode\s*(\d{1,4})\b/i);
    if (episodeMatch) {
        return Number(episodeMatch[1]);
    }

    const rangeMatch = text.match(/\b(\d{2,4})\s*[~\-]\s*(\d{2,4})\b/i);
    if (rangeMatch) {
        return Number(rangeMatch[1]);
    }

    const animeFileMatch = text.match(/\b(\d{2,4})\s*(mkv|mp4|avi|webm)\b/i);
    if (animeFileMatch) {
        return Number(animeFileMatch[1]);
    }

    const numbers = [...text.matchAll(/\b(\d{2,4})\b/g)]
        .map(match => Number(match[1]))
        .filter(num => num < 1900 || num > 2099);

    if (numbers.length > 0) {
        return numbers[numbers.length - 1];
    }

    return undefined;
}

function groupTorrentsByMedia(torrents) {
    const groups = new Map();

    for (const torrent of torrents) {
        const key = getTorrentGroupKey(torrent);
        const libraryType = detectLibraryType(torrent);

        const title =
            libraryType === "anime" || libraryType === "series"
                ? cleanSeriesTitle(torrent.name)
                : cleanMovieTitle(torrent.name);

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                type: libraryType,
                title: title || torrent.name,
                year: libraryType === "movie" ? extractYear(torrent.name) : undefined,
                torrents: []
            });
        }

        groups.get(key).torrents.push(torrent);
    }

    const groupedItems = Array.from(groups.values());

    for (const group of groupedItems) {
        group.torrents.sort((a, b) => {
            const episodeA = extractEpisodeNumber(a.name || "");
            const episodeB = extractEpisodeNumber(b.name || "");

            if (episodeA !== undefined && episodeB !== undefined) {
                return episodeA - episodeB;
            }

            if (episodeA !== undefined) {
                return -1;
            }

            if (episodeB !== undefined) {
                return 1;
            }

            return new Date(b.created_at) - new Date(a.created_at);
        });
    }

    return groupedItems;
}

async function enrichTorboxGroup(group) {
    const cacheKey = `${group.type}-${normalizeText(group.title)}-${group.year || "unknown"}`;

    if (enrichCache.has(cacheKey)) {
        return enrichCache.get(cacheKey);
    }

    const enriched = {
        cleanTitle: group.title,
        year: group.year,
        poster: PLACEHOLDER_POSTER,
        background: undefined,
        description: `${group.torrents.length} cached item(s) available in Torbox.`,
        tmdbId: undefined
    };

    try {
        if (!group.title) {
            enrichCache.set(cacheKey, enriched);
            return enriched;
        }

        if (group.type === "series" || group.type === "anime") {
            enriched.description = `${group.torrents.length} episode/file item(s) available in Torbox.`;
            enrichCache.set(cacheKey, enriched);
            return enriched;
        }

        const results = await searchMovie(group.title, group.year);

        if (!results || results.length === 0) {
            enrichCache.set(cacheKey, enriched);
            return enriched;
        }

        const movie = results[0];

        enriched.tmdbId = movie.id;

        if (movie.poster_path) {
            enriched.poster = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
        }

        if (movie.backdrop_path) {
            enriched.background = `https://image.tmdb.org/t/p/original${movie.backdrop_path}`;
        }

        enriched.description =
            movie.overview ||
            `${group.torrents.length} cached item(s) available in Torbox.`;

        enrichCache.set(cacheKey, enriched);
        return enriched;

    } catch (err) {
        console.error("TMDB match error:", group.title, err.response?.data || err.message);
        enrichCache.set(cacheKey, enriched);
        return enriched;
    }
}

async function mapLimit(items, limit, mapper) {
    const results = [];
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const currentIndex = index++;
            results[currentIndex] = await mapper(items[currentIndex]);
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        () => worker()
    );

    await Promise.all(workers);

    return results;
}

function getStremioTypeFromLibraryType(libraryType) {
    if (libraryType === "anime") {
        return "anime";
    }

    if (libraryType === "series") {
        return "series";
    }

    return "movie";
}

async function buildTorboxGroupedCatalog(limit, libraryTypeFilter = null) {
    const torrents = await getMyTorrentsCached();

    const playableTorrents = getPlayableTorrents(torrents)
        .filter(torrent => {
            if (!libraryTypeFilter) {
                return true;
            }

            return detectLibraryType(torrent) === libraryTypeFilter;
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const groupedItems = groupTorrentsByMedia(playableTorrents)
        .slice(0, limit);

    return mapLimit(
        groupedItems,
        5,
        async group => {
            const enriched = await enrichTorboxGroup(group);

            return {
                id: `tbg:${group.key}`,
                type: getStremioTypeFromLibraryType(group.type),
                name: enriched.cleanTitle || group.title,
                poster: enriched.poster || PLACEHOLDER_POSTER,
                background: enriched.background,
                description: enriched.description
            };
        }
    );
}

async function findTorboxGroupByKey(groupKey) {
    const torrents = await getMyTorrentsCached();
    const playableTorrents = getPlayableTorrents(torrents);
    const groupedItems = groupTorrentsByMedia(playableTorrents);

    return groupedItems.find(group => group.key === groupKey);
}

function buildStreamTitle(prefix, file, torrent) {
    const sourceName = file.name || torrent.name;
    const quality = detectQuality(sourceName);
    const codec = detectCodec(sourceName);
    const size = formatBytes(file.size);
    const episodeNumber = extractEpisodeNumber(sourceName);

    const codecText = codec ? ` | ${codec}` : "";
    const episodeText = episodeNumber !== undefined ? ` | EP ${episodeNumber}` : "";

    return `DeepBlueStream\n${prefix}${episodeText} | ${quality} | ${size}${codecText}`;
}

function parseStremioId(id) {
    const parts = String(id || "").split(":");

    return {
        imdbId: parts[0],
        season: parts[1] ? Number(parts[1]) : undefined,
        episode: parts[2] ? Number(parts[2]) : undefined
    };
}

function torrentMatchesEpisode(torrent, file, season, episode) {
    const text = `${torrent.name || ""} ${file.name || ""}`;

    if (!episode) {
        return true;
    }

    const sxePattern = new RegExp(
        `S0?${season || 1}E0?${episode}\\b`,
        "i"
    );

    if (sxePattern.test(text)) {
        return true;
    }

    const episodePattern = new RegExp(
        `\\b(Episode\\s*)?0?${episode}\\b`,
        "i"
    );

    return episodePattern.test(text);
}

function seriesTitleMatches(groupTitle, tmdbTitle) {
    const normalizedGroupTitle = normalizeText(groupTitle);
    const normalizedTmdbTitle = normalizeText(tmdbTitle);

    return (
        normalizedGroupTitle === normalizedTmdbTitle ||
        normalizedGroupTitle.includes(normalizedTmdbTitle) ||
        normalizedTmdbTitle.includes(normalizedGroupTitle)
    );
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
    console.log("CATALOG REQUEST:", id, "TYPE:", type, "EXTRA:", extra);

    try {
        if (id === "torbox-trending" || id === "deepbluestream") {
            if (extra && extra.search) {
                const searchResults = await searchMovie(extra.search);

                return {
                    metas: searchResults.map(movie => ({
                        id: `dbs:${movie.id}`,
                        type: "movie",
                        name: movie.title,
                        poster: movie.poster_path
                            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                            : PLACEHOLDER_POSTER,
                        background: movie.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
                            : undefined,
                        description: movie.overview || undefined,
                        releaseInfo: movie.release_date || undefined
                    }))
                };
            }

            const tmdbMovies = await getTrendingMovies();

            return {
                metas: tmdbMovies.map(movie => ({
                    id: `dbs:${movie.id}`,
                    type: "movie",
                    name: movie.title,
                    poster: movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: movie.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
                        : undefined,
                    description: movie.overview || undefined,
                    releaseInfo: movie.release_date || undefined
                }))
            };
        }

        if (id === "torbox-trending-series") {
            const tmdbSeries = extra && extra.search
                ? await searchSeries(extra.search)
                : await getTrendingSeries();

            return {
                metas: tmdbSeries.map(series => ({
                    id: `dbs-series:${series.id}`,
                    type: "series",
                    name: series.name,
                    poster: series.poster_path
                        ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: series.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                        : undefined,
                    description: series.overview || undefined,
                    releaseInfo: series.first_air_date || undefined
                }))
            };
        }

        if (id === "torbox-trending-anime") {
            if (extra && extra.search) {
                const searchResults = await searchSeries(extra.search);

                return {
                    metas: searchResults.map(series => ({
                        id: `dbs-anime:${series.id}`,
                        type: "anime",
                        name: series.name,
                        poster: series.poster_path
                            ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                            : PLACEHOLDER_POSTER,
                        background: series.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                            : undefined,
                        description: series.overview || undefined,
                        releaseInfo: series.first_air_date || undefined
                    }))
                };
            }

            return { metas: [] };
        }

        if (id === "torbox-movies") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_LIBRARY_LIMIT, "movie")
            };
        }

        if (id === "torbox-series") {
            if (extra && extra.search) {
                const searchResults = await searchSeries(extra.search);

                return {
                    metas: searchResults.map(series => ({
                        id: `dbs-series:${series.id}`,
                        type: "series",
                        name: series.name,
                        poster: series.poster_path
                            ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                            : PLACEHOLDER_POSTER,
                        background: series.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                            : undefined,
                        description: series.overview || undefined,
                        releaseInfo: series.first_air_date || undefined
                    }))
                };
            }

            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_LIBRARY_LIMIT, "series")
            };
        }

        if (id === "torbox-anime") {
            if (extra && extra.search) {
                const searchResults = await searchSeries(extra.search);

                return {
                    metas: searchResults.map(series => ({
                        id: `dbs-anime:${series.id}`,
                        type: "anime",
                        name: series.name,
                        poster: series.poster_path
                            ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                            : PLACEHOLDER_POSTER,
                        background: series.backdrop_path
                            ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                            : undefined,
                        description: series.overview || undefined,
                        releaseInfo: series.first_air_date || undefined
                    }))
                };
            }

            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_LIBRARY_LIMIT, "anime")
            };
        }

        if (id === "torbox-recent-movies") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_RECENT_LIMIT, "movie")
            };
        }

        if (id === "torbox-recent-series") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_RECENT_LIMIT, "series")
            };
        }

        if (id === "torbox-recent-anime") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_RECENT_LIMIT, "anime")
            };
        }

        return { metas: [] };

    } catch (err) {
        console.error("Catalog error:", err.response?.data || err.message);
        return { metas: [] };
    }
});

builder.defineMetaHandler(async ({ id }) => {
    console.log("META REQUEST:", id);

    try {
        if (id.startsWith("dbs-series:")) {
            const tmdbId = id.replace("dbs-series:", "");
            const series = await getSeriesDetails(tmdbId);

            return {
                meta: {
                    id,
                    type: "series",
                    name: series.name,
                    poster: series.poster_path
                        ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: series.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                        : undefined,
                    description: series.overview,
                    releaseInfo: series.first_air_date,
                    genres: series.genres ? series.genres.map(g => g.name) : []
                }
            };
        }

        if (id.startsWith("dbs-anime:")) {
            const tmdbId = id.replace("dbs-anime:", "");
            const series = await getSeriesDetails(tmdbId);

            return {
                meta: {
                    id,
                    type: "anime",
                    name: series.name,
                    poster: series.poster_path
                        ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: series.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                        : undefined,
                    description: series.overview,
                    releaseInfo: series.first_air_date,
                    genres: series.genres ? series.genres.map(g => g.name) : []
                }
            };
        }

        if (id.startsWith("dbs:")) {
            const tmdbId = id.replace("dbs:", "");
            const movie = await getMovieDetails(tmdbId);

            return {
                meta: {
                    id,
                    type: "movie",
                    name: movie.title,
                    poster: movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: movie.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
                        : undefined,
                    description: movie.overview,
                    releaseInfo: movie.release_date,
                    runtime: movie.runtime ? `${movie.runtime} min` : undefined,
                    genres: movie.genres ? movie.genres.map(g => g.name) : []
                }
            };
        }

        if (id.startsWith("tbg:")) {
            const groupKey = id.replace("tbg:", "");
            const group = await findTorboxGroupByKey(groupKey);

            if (!group) {
                return { meta: null };
            }

            const enriched = await enrichTorboxGroup(group);

            return {
                meta: {
                    id,
                    type: getStremioTypeFromLibraryType(group.type),
                    name: enriched.cleanTitle || group.title,
                    poster: enriched.poster || PLACEHOLDER_POSTER,
                    background: enriched.background,
                    description:
                        enriched.description ||
                        `Cached in Torbox. ${group.torrents.length} version(s) available.`,
                    releaseInfo: enriched.year
                }
            };
        }

        if (id.startsWith("tb:")) {
            const torrentId = Number(id.replace("tb:", ""));

            const torrents = await getMyTorrentsCached();
            const torrent = torrents.find(t => t.id === torrentId);

            if (!torrent) {
                return { meta: null };
            }

            const torrentLibraryType = detectLibraryType(torrent);

            const group = {
                key: getTorrentGroupKey(torrent),
                type: torrentLibraryType,
                title:
                    torrentLibraryType === "series" || torrentLibraryType === "anime"
                        ? cleanSeriesTitle(torrent.name)
                        : cleanMovieTitle(torrent.name),
                year: torrentLibraryType === "movie" ? extractYear(torrent.name) : undefined,
                torrents: [torrent]
            };

            const enriched = await enrichTorboxGroup(group);
            const videoFiles = torrent.files.filter(isVideoFile);
            const firstVideo = videoFiles[0];

            return {
                meta: {
                    id,
                    type: getStremioTypeFromLibraryType(group.type),
                    name: enriched.cleanTitle || torrent.name,
                    poster: enriched.poster || PLACEHOLDER_POSTER,
                    background: enriched.background,
                    description:
                        enriched.description ||
                        `Cached in Torbox. ${videoFiles.length} playable video file(s). Size: ${
                            firstVideo ? formatBytes(firstVideo.size) : "Unknown"
                        }.`,
                    releaseInfo: enriched.year
                }
            };
        }

        return { meta: null };

    } catch (err) {
        console.error("Meta error:", err.response?.data || err.message);
        return { meta: null };
    }
});

builder.defineStreamHandler(async ({ type, id }) => {
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

                const streams = [];

                for (const torrent of matchingTorrents) {
                    if (streams.length >= MAX_STREAMS_PER_ITEM) {
                        break;
                    }

                    const videoFiles = torrent.files
                        .filter(isVideoFile)
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
                            title: buildStreamTitle("Torbox", file, torrent),
                            url,
                            behaviorHints: {
                                notWebReady: false
                            }
                        });
                    }
                }

                if (streams.length === 0) {
                    console.log("No mylist stream found. Searching Prowlarr + Torbox cache...");

                    const cachedSearchStreams = await searchCachedStreamsForMovie(movie);

                    streams.push(...cachedSearchStreams);
                }

                console.log("Final streams returned:", streams.length);
                return { streams };
            }

            if (type === "series" || type === "anime") {
                const seriesSearchResult = await getSeriesByImdbId(imdbId);

                if (!seriesSearchResult) {
                    console.log("No TMDB series found for IMDb ID:", imdbId);
                    return { streams: [] };
                }

                const series = await getSeriesDetails(seriesSearchResult.id);

                console.log(
                    "Searching Torbox for IMDb series/anime:",
                    series.name,
                    "S",
                    season,
                    "E",
                    episode
                );

                const torrents = await getMyTorrentsCached();

                const matchingGroups = groupTorrentsByMedia(getPlayableTorrents(torrents))
                    .filter(group => seriesTitleMatches(group.title, series.name));

                console.log("Matching series groups:", matchingGroups.length);

                const streams = [];

                for (const group of matchingGroups) {
                    for (const torrent of group.torrents) {
                        if (streams.length >= MAX_STREAMS_PER_ITEM) {
                            break;
                        }

                        const videoFiles = torrent.files
                            .filter(isVideoFile)
                            .filter(file => torrentMatchesEpisode(torrent, file, season, episode))
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
                                title: buildStreamTitle("Torbox Library", file, torrent),
                                url,
                                behaviorHints: {
                                    notWebReady: false
                                }
                            });
                        }
                    }
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

				console.log("Final streams returned:", streams.length);
				return { streams };
            }

            return { streams: [] };
        }

        if (id.startsWith("tbg:")) {
            const groupKey = id.replace("tbg:", "");
            const group = await findTorboxGroupByKey(groupKey);

            if (!group) {
                return { streams: [] };
            }

            const streams = [];

            for (const torrent of group.torrents) {
                if (streams.length >= MAX_STREAMS_PER_ITEM) {
                    break;
                }

                const videoFiles = torrent.files
                    .filter(isVideoFile)
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
                        title: buildStreamTitle("Torbox Library", file, torrent),
                        url,
                        behaviorHints: {
                            notWebReady: false
                        }
                    });
                }
            }

            console.log("Final streams returned:", streams.length);
            return { streams };
        }

        if (id.startsWith("tb:")) {
            const torrentId = Number(id.replace("tb:", ""));

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

        if (id.startsWith("dbs-series:") || id.startsWith("dbs-anime:")) {
            const tmdbId = id
                .replace("dbs-series:", "")
                .replace("dbs-anime:", "");

            const series = await getSeriesDetails(tmdbId);

            console.log("Searching Torbox for series/anime:", series.name);

            const torrents = await getMyTorrentsCached();

            const matchingGroups = groupTorrentsByMedia(getPlayableTorrents(torrents))
                .filter(group => seriesTitleMatches(group.title, series.name));

            const streams = [];

            for (const group of matchingGroups) {
                for (const torrent of group.torrents) {
                    if (streams.length >= MAX_STREAMS_PER_ITEM) {
                        break;
                    }

                    const videoFiles = torrent.files
                        .filter(isVideoFile)
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
                            title: buildStreamTitle("Torbox Library", file, torrent),
                            url,
                            behaviorHints: {
                                notWebReady: false
                            }
                        });
                    }
                }
            }
			
			if (streams.length === 0) {
			    console.log("No Torbox Library series stream found.");

			    // Catalog-based series cards do not include selected season/episode yet.
			    // For now, we do not run Prowlarr fallback here because there is no episode number.
			}

            console.log("Final streams returned:", streams.length);
            return { streams };
        }

        if (id.startsWith("dbs:")) {
            const tmdbId = id.replace("dbs:", "");
            const movie = await getMovieDetails(tmdbId);

            const movieYear = movie.release_date
                ? movie.release_date.slice(0, 4)
                : undefined;

            console.log("Searching Torbox for:", movie.title, movieYear || "");

            const matchingTorrents = await findMatchingTorrents(movie.title, movieYear);

            console.log("Matches found:", matchingTorrents.length);

            const streams = [];

            for (const torrent of matchingTorrents) {
                if (streams.length >= MAX_STREAMS_PER_ITEM) {
                    break;
                }

                const videoFiles = torrent.files
                    .filter(isVideoFile)
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
                        title: buildStreamTitle("Torbox", file, torrent),
                        url,
                        behaviorHints: {
                            notWebReady: false
                        }
                    });
                }
            }

            if (streams.length === 0) {
                console.log("No mylist stream found. Searching Prowlarr + Torbox cache...");

                const cachedSearchStreams = await searchCachedStreamsForMovie(movie);

                streams.push(...cachedSearchStreams);
            }

            console.log("Final streams returned:", streams.length);
            return { streams };
        }

        return { streams: [] };

    } catch (err) {
        console.error("Stream error:", err.response?.data || err.message);
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), {
    port: PORT
});

console.log(`DeepBlueStream running on port ${PORT}`);
console.log("TMDB Loaded:", !!process.env.TMDB_API_KEY);
console.log("TORBOX Loaded:", !!process.env.TORBOX_API_KEY);