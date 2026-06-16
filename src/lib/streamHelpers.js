const axios = require("axios");

const { requestDownloadLink, detectQuality, detectCodec, formatBytes } = require("../services/torbox");
const { sleep, normalizeText } = require("../utils");
const { extractEpisodeNumber } = require("./torboxLibrary");
const { TORBOX_REQUEST_DELAY_MS, CDN_CHECK_TIMEOUT_MS } = require("../constants");

// Torbox returns download URLs with the `filename` query value left literal
// (spaces, brackets, etc.), which is a malformed URL. Lenient players cope, but
// stricter HTTP clients reject it. Re-serialise through the URL parser so the
// query is properly percent-encoded before we hand it to clients.
function normalizeDownloadUrl(rawUrl) {
    try {
        return new URL(rawUrl).toString();
    } catch {
        return rawUrl;
    }
}

async function isCdnUrlReachable(url) {
    try {
        await axios.get(url, {
            timeout: CDN_CHECK_TIMEOUT_MS,
            headers: { Range: "bytes=0-1" },
            responseType: "stream"
        }).then(response => response.data.destroy());

        return true;
    } catch (err) {
        console.error("CDN node unreachable, skipping:", url.split("?")[0], "-", err.message);
        return false;
    }
}

const DOWNLOAD_LINK_ATTEMPTS = 2;

async function safeRequestDownloadLink(torrentId, fileId) {
    for (let attempt = 1; attempt <= DOWNLOAD_LINK_ATTEMPTS; attempt++) {
        try {
            await sleep(TORBOX_REQUEST_DELAY_MS);
            const rawUrl = await requestDownloadLink(torrentId, fileId);
            const url = rawUrl ? normalizeDownloadUrl(rawUrl) : rawUrl;

            if (url && (await isCdnUrlReachable(url))) {
                return url;
            }
        } catch (err) {
            console.error(
                "requestDownloadLink failed:",
                err.response?.data || err.message
            );
        }

        // Torbox's DATABASE_ERROR responses and CDN ECONNRESET errors are
        // usually transient, so retry once before giving up on this candidate.
        if (attempt < DOWNLOAD_LINK_ATTEMPTS) {
            console.log("Retrying requestDownloadLink for torrent", torrentId, "file", fileId);
        }
    }

    return null;
}

function buildStreamTitle(prefix, file, torrent) {
    const sourceName = file.name || torrent.name;
    const quality = detectQuality(sourceName);
    const codec = detectCodec(sourceName);
    const size = formatBytes(file.size);
    const episodeNumber = extractEpisodeNumber(sourceName);

    const codecText = codec ? ` | ${codec}` : "";
    const episodeText = episodeNumber !== undefined ? ` | EP ${episodeNumber}` : "";

    return `${quality}${episodeText}\n${prefix} | ${size}${codecText}`;
}

function parseStremioId(id) {
    const parts = String(id || "").split(":");

    return {
        imdbId: parts[0],
        season: parts[1] ? Number(parts[1]) : undefined,
        episode: parts[2] ? Number(parts[2]) : undefined
    };
}

function computeAbsoluteEpisode(series, season, episode) {
    if (!series || !Array.isArray(series.seasons) || !season || !episode) {
        return undefined;
    }

    let cumulativeBefore = 0;

    for (const seasonInfo of series.seasons) {
        if (
            seasonInfo.season_number > 0 &&
            seasonInfo.season_number < season &&
            typeof seasonInfo.episode_count === "number"
        ) {
            cumulativeBefore += seasonInfo.episode_count;
        }
    }

    // Some long-running anime number episodes absolutely even within TMDB's
    // season groupings (e.g. One Piece season 21 covers episodes 892-1088,
    // not 1-197). If the episode number already exceeds the cumulative count
    // of prior seasons, it's already an absolute episode number.
    if (episode > cumulativeBefore) {
        return episode;
    }

    return cumulativeBefore + episode;
}

function strictEpisodeNumberMatches(text, episodeNumber) {
    if (!episodeNumber) {
        return false;
    }

    const sxePattern = new RegExp(
        `\\bS\\d{1,2}E0*${episodeNumber}\\b`,
        "i"
    );

    if (sxePattern.test(text)) {
        return true;
    }

    const taggedEpisodePattern = new RegExp(
        `\\b(?:E|EP|Episode)\\s*0*${episodeNumber}\\b`,
        "i"
    );

    return taggedEpisodePattern.test(text);
}

function episodeNumberMatches(text, episodeNumber) {
    if (!episodeNumber) {
        return false;
    }

    if (strictEpisodeNumberMatches(text, episodeNumber)) {
        return true;
    }

    // Negative lookbehinds avoid matching decimal audio-channel tags like
    // "5.1" / "7.1" / "DDP5 1 Atmos" and multi-part markers like "(Part 1)" /
    // "(Pt 1)", which would otherwise look like a "- 1" or ". 1" episode
    // marker for episode 1.
    const dashEpisodePattern = new RegExp(
        `(?<![\\d.])(?<!part)(?<!pt)[\\s._-]0*${episodeNumber}\\b(?!\\d)`,
        "i"
    );

    return dashEpisodePattern.test(text);
}

function torrentMatchesEpisode(torrent, file, season, episode, absoluteEpisode, matchFn = episodeNumberMatches) {
    const text = `${torrent.name || ""} ${file.name || ""}`;

    if (!episode) {
        return true;
    }

    if (absoluteEpisode && absoluteEpisode !== episode) {
        return matchFn(text, absoluteEpisode);
    }

    return matchFn(text, episode);
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

// Order of preference for the DEFAULT (auto-played) source. 1080p is ranked
// highest as the best balance of quality vs bandwidth; 4K is deprioritised
// because its bitrate buffers badly on slower links (it's still offered, just
// lower in the list). Users can always pick another source.
const QUALITY_RANK = {
    "1080p": 4,
    "720p": 3,
    "4K": 2,
    "480p": 1,
    "Unknown": 0
};

function getQualityRank(name) {
    return QUALITY_RANK[detectQuality(name)] ?? 0;
}

function sortCandidatesByQuality(candidates, getSourceName) {
    return [...candidates].sort((a, b) => getQualityRank(getSourceName(b)) - getQualityRank(getSourceName(a)));
}

function dedupeStreamCandidates(candidates, getSourceName, getSize) {
    const seenKeys = new Set();
    const deduped = [];

    for (const candidate of candidates) {
        const key = `${detectQuality(getSourceName(candidate))}|${getSize(candidate)}`;

        if (seenKeys.has(key)) {
            continue;
        }

        seenKeys.add(key);
        deduped.push(candidate);
    }

    return deduped;
}

module.exports = {
    safeRequestDownloadLink,
    buildStreamTitle,
    parseStremioId,
    computeAbsoluteEpisode,
    strictEpisodeNumberMatches,
    episodeNumberMatches,
    torrentMatchesEpisode,
    seriesTitleMatches,
    getQualityRank,
    sortCandidatesByQuality,
    dedupeStreamCandidates
};
