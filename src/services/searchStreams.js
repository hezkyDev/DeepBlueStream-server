const { searchMovies } = require("./prowlarr");

const {
    checkCached,
    getCachedEntriesFromCheckCached,
    buildMagnetFromHash,
    createTorrentFromMagnet,
    requestDownloadLink,
    getTorrentById,
    isVideoFile,
    formatBytes,
    detectQuality,
    detectCodec,
    cleanMovieTitle,
    extractYear
} = require("./torbox");

const MAX_SEARCH_RESULTS = 5;
const MAX_SEARCH_STREAMS = 5;
const MAX_UNCACHED_ATTEMPTS = 2;
const TORBOX_REQUEST_DELAY_MS = 700;
const UNCACHED_POLL_ATTEMPTS = 4;
const UNCACHED_POLL_DELAY_MS = 2000;

const QUALITY_RANK = {
    "4K": 4,
    "1080p": 3,
    "720p": 2,
    "480p": 1,
    "Unknown": 0
};

function getQualityRank(title) {
    return QUALITY_RANK[detectQuality(title)] ?? 0;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/&amp;/g, "and")
        .replace(/&/g, "and")
        .replace(/[._\-()[\]{}:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function formatSeasonEpisode(season, episode) {
    const s = String(season || 1).padStart(2, "0");
    const e = String(episode || 1).padStart(2, "0");

    return `S${s}E${e}`;
}

function isLikelySameMovie(resultTitle, movieTitle, movieYear) {
    const cleanedResultTitle = cleanMovieTitle(resultTitle);
    const resultYear = extractYear(resultTitle);

    const normalizedResult = normalizeText(cleanedResultTitle);
    const normalizedMovie = normalizeText(movieTitle);

    const titleMatches =
        normalizedResult === normalizedMovie ||
        normalizedResult.startsWith(`${normalizedMovie} `) ||
        normalizedResult.includes(` ${normalizedMovie} `);

    const yearMatches =
        !movieYear ||
        !resultYear ||
        String(resultYear) === String(movieYear);

    const looksLikeEpisode =
        /\bS\d{1,2}E\d{1,3}\b/i.test(resultTitle) ||
        /\bSeason\b/i.test(resultTitle) ||
        /\bEpisode\b/i.test(resultTitle);

    return titleMatches && yearMatches && !looksLikeEpisode;
}

function isLikelySameSeriesEpisode(resultTitle, seriesTitle, season, episode) {
    const normalizedResult = normalizeText(resultTitle);
    const normalizedSeries = normalizeText(seriesTitle);

    const titleMatches =
        normalizedResult.includes(normalizedSeries) ||
        normalizedSeries.includes(normalizedResult);

    if (!titleMatches) {
        return false;
    }

    const s = season || 1;
    const e = episode || 1;

    const exactEpisodeMatches =
        new RegExp(`\\bS0?${s}E0?${e}\\b`, "i").test(resultTitle) ||
        new RegExp(`\\b${s}x0?${e}\\b`, "i").test(resultTitle);

    const seasonPackMatches =
        new RegExp(`\\bS0?${s}\\b(?!\\s*E\\d)`, "i").test(resultTitle) ||
        new RegExp(`\\bSeason\\s*0?${s}\\b`, "i").test(resultTitle) ||
        new RegExp(`\\bComplete\\b`, "i").test(resultTitle);

    return exactEpisodeMatches || seasonPackMatches;
}

function isLikelySameEpisodeFile(fileName, season, episode) {
    const s = season || 1;
    const e = episode || 1;

    return (
        new RegExp(`\\bS0?${s}E0?${e}\\b`, "i").test(fileName) ||
        new RegExp(`\\b${s}x0?${e}\\b`, "i").test(fileName) ||
        new RegExp(`\\bE0?${e}\\b`, "i").test(fileName)
    );
}

function buildStreamTitle(prefix, file, sourceName, indexer, episodeText = "") {
    const quality = detectQuality(sourceName);
    const codec = detectCodec(sourceName);
    const size = formatBytes(file.size);

    const codecText = codec ? ` | ${codec}` : "";
    const indexerText = indexer ? ` | ${indexer}` : "";
    const epText = episodeText ? ` | ${episodeText}` : "";

    return `DeepBlueStream\n${prefix}${epText} | ${quality} | ${size}${codecText}${indexerText}`;
}

async function safeCreateTorrentFromMagnet(magnet, title) {
    try {
        await sleep(TORBOX_REQUEST_DELAY_MS);
        return await createTorrentFromMagnet(magnet);
    } catch (err) {
        console.error(
            "createTorrentFromMagnet failed:",
            title,
            err.response?.data || err.message
        );

        return null;
    }
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

async function buildStreamsFromCachedTorrentResults(torrentResults, episodeText = "", season, episode) {
    if (torrentResults.length === 0) {
        return [];
    }

    const hashes = torrentResults.map(result => result.infoHash.toLowerCase());

    console.log("Checking Torbox cache for hashes:", hashes);

    const cacheResponse = await checkCached(hashes);

    console.log("Torbox checkCached raw response:", JSON.stringify(cacheResponse));

    const cachedEntries = getCachedEntriesFromCheckCached(cacheResponse);

    console.log("Torbox cached entries:", cachedEntries.length);

    const streams = [];

    for (const result of torrentResults) {
        if (streams.length >= MAX_SEARCH_STREAMS) {
            break;
        }

        const hash = result.infoHash.toLowerCase();

        const cachedEntry = cachedEntries.find(entry => {
            return entry.hash && entry.hash.toLowerCase() === hash;
        });

        if (!cachedEntry) {
            continue;
        }

        let videoFiles = (cachedEntry.files || []).filter(isVideoFile);

        if (season !== undefined && episode !== undefined && videoFiles.length > 1) {
            const matchingFiles = videoFiles.filter(file =>
                isLikelySameEpisodeFile(file.name || file.short_name || "", season, episode)
            );

            if (matchingFiles.length > 0) {
                videoFiles = matchingFiles;
            }
        }

        videoFiles = videoFiles.slice(0, 1);

        if (videoFiles.length === 0) {
            continue;
        }

        const magnet = buildMagnetFromHash(result.infoHash, result.title);

        const createResult = await safeCreateTorrentFromMagnet(magnet, result.title);

        const torrentId = createResult?.data?.torrent_id;

        if (!torrentId) {
            console.log("No torrent_id returned from Torbox create:", result.title);
            continue;
        }

        for (const file of videoFiles) {
            if (streams.length >= MAX_SEARCH_STREAMS) {
                break;
            }

            const url = await safeRequestDownloadLink(torrentId, file.id);

            if (!url) {
                continue;
            }

            streams.push({
                title: buildStreamTitle(
                    "Prowlarr + Torbox",
                    file,
                    result.title,
                    result.indexer,
                    episodeText
                ),
                url,
                behaviorHints: {
                    notWebReady: false
                }
            });
        }
    }

    return streams;
}

async function buildStreamsFromUncachedTorrentResults(torrentResults, episodeText = "", season, episode) {
    const streams = [];

    const candidates = torrentResults.slice(0, MAX_UNCACHED_ATTEMPTS);

    for (const result of candidates) {
        const magnet = buildMagnetFromHash(result.infoHash, result.title);

        const createResult = await safeCreateTorrentFromMagnet(magnet, result.title);

        const torrentId = createResult?.data?.torrent_id;

        if (!torrentId) {
            console.log("No torrent_id returned from Torbox create:", result.title);
            continue;
        }

        console.log("Queued uncached torrent on Torbox:", result.title, "torrent_id:", torrentId);

        let torrent = null;

        for (let attempt = 0; attempt < UNCACHED_POLL_ATTEMPTS; attempt++) {
            await sleep(UNCACHED_POLL_DELAY_MS);

            torrent = await getTorrentById(torrentId);

            if (torrent && torrent.download_finished && Array.isArray(torrent.files)) {
                break;
            }

            torrent = null;
        }

        if (!torrent) {
            console.log("Torrent not ready yet, will be available on retry:", result.title);
            continue;
        }

        let videoFiles = torrent.files.filter(isVideoFile);

        if (season !== undefined && episode !== undefined && videoFiles.length > 1) {
            const matchingFiles = videoFiles.filter(file =>
                isLikelySameEpisodeFile(file.name || file.short_name || "", season, episode)
            );

            if (matchingFiles.length > 0) {
                videoFiles = matchingFiles;
            }
        }

        videoFiles = videoFiles.slice(0, 1);

        for (const file of videoFiles) {
            const url = await safeRequestDownloadLink(torrentId, file.id);

            if (!url) {
                continue;
            }

            streams.push({
                title: buildStreamTitle(
                    "Prowlarr + Torbox (downloading)",
                    file,
                    result.title,
                    result.indexer,
                    episodeText
                ),
                url,
                behaviorHints: {
                    notWebReady: false
                }
            });
        }
    }

    return streams;
}

async function searchCachedStreamsForMovie(movie) {
    const title = movie.title;
    const year = movie.release_date ? movie.release_date.slice(0, 4) : undefined;

    console.log("Searching Prowlarr:", title, year || "");

    const prowlarrResults = await searchMovies(title, year);

    console.log("Raw Prowlarr results:", prowlarrResults.length);

    const torrentResults = prowlarrResults
        .filter(result => result.protocol === "torrent")
        .filter(result => result.infoHash)
        .filter(result => isLikelySameMovie(result.title, title, year))
        .sort((a, b) => {
            const titleA = a.title || "";
            const titleB = b.title || "";

            const qualityDiff = getQualityRank(titleB) - getQualityRank(titleA);

            if (qualityDiff !== 0) {
                return qualityDiff;
            }

            const seedersA = a.seeders || 0;
            const seedersB = b.seeders || 0;
            return seedersB - seedersA;
        })
        .slice(0, MAX_SEARCH_RESULTS);

    console.log("Filtered movie torrent results:", torrentResults.length);

    const streams = await buildStreamsFromCachedTorrentResults(torrentResults);

    console.log("Prowlarr + Torbox movie streams returned:", streams.length);

    if (streams.length > 0) {
        return streams;
    }

    console.log("No cached movie streams, falling back to uncached Torbox download...");

    const uncachedStreams = await buildStreamsFromUncachedTorrentResults(torrentResults);

    console.log("Prowlarr + Torbox uncached movie streams returned:", uncachedStreams.length);

    return uncachedStreams;
}

async function searchCachedStreamsForSeriesEpisode(series, season, episode) {
    const title = series.name;
    const seasonEpisode = formatSeasonEpisode(season, episode);
    const query = `${title} ${seasonEpisode}`;

    console.log("Searching Prowlarr series episode:", query);

    const prowlarrResults = await searchMovies(query);

    console.log("Raw Prowlarr series results:", prowlarrResults.length);
    console.log("Prowlarr series titles:");
    prowlarrResults.slice(0, 10).forEach(result => {
        console.log("-", result.title);
    });

    const torrentResults = prowlarrResults
        .filter(result => result.protocol === "torrent")
        .filter(result => result.infoHash)
        .filter(result => isLikelySameSeriesEpisode(result.title, title, season, episode))
        .sort((a, b) => {
            const titleA = a.title || "";
            const titleB = b.title || "";

            const qualityDiff = getQualityRank(titleB) - getQualityRank(titleA);

            if (qualityDiff !== 0) {
                return qualityDiff;
            }

            const seedersA = a.seeders || 0;
            const seedersB = b.seeders || 0;
            return seedersB - seedersA;
        })
        .slice(0, MAX_SEARCH_RESULTS);

    console.log("Filtered series episode torrent results:", torrentResults.length);

    const streams = await buildStreamsFromCachedTorrentResults(
        torrentResults,
        seasonEpisode,
        season,
        episode
    );

    console.log("Prowlarr + Torbox series streams returned:", streams.length);

    if (streams.length > 0) {
        return streams;
    }

    console.log("No cached series streams, falling back to uncached Torbox download...");

    const uncachedStreams = await buildStreamsFromUncachedTorrentResults(
        torrentResults,
        seasonEpisode,
        season,
        episode
    );

    console.log("Prowlarr + Torbox uncached series streams returned:", uncachedStreams.length);

    return uncachedStreams;
}

module.exports = {
    searchCachedStreamsForMovie,
    searchCachedStreamsForSeriesEpisode
};