const { getMyTorrents, isVideoFile, extractYear, cleanMovieTitle } = require("../services/torbox");
const { searchMovie } = require("../services/tmdb");
const { normalizeText, mapLimit } = require("../utils");
const { PLACEHOLDER_POSTER, TORRENTS_CACHE_TTL_MS } = require("../constants");

let torrentsCache = {
    data: null,
    loadedAt: 0
};

const enrichCache = new Map();

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

module.exports = {
    getMyTorrentsCached,
    isEpisodeLike,
    detectKnownAnimeTitle,
    cleanSeriesTitle,
    detectLibraryType,
    getPlayableTorrents,
    getTorrentGroupKey,
    extractEpisodeNumber,
    groupTorrentsByMedia,
    enrichTorboxGroup,
    getStremioTypeFromLibraryType,
    buildTorboxGroupedCatalog,
    findTorboxGroupByKey
};
