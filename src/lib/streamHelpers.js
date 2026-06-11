const { requestDownloadLink, detectQuality, detectCodec, formatBytes } = require("../services/torbox");
const { sleep, normalizeText } = require("../utils");
const { extractEpisodeNumber } = require("./torboxLibrary");
const { TORBOX_REQUEST_DELAY_MS } = require("../constants");

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

function computeAbsoluteEpisode(series, season, episode) {
    if (!series || !Array.isArray(series.seasons) || !season || !episode) {
        return undefined;
    }

    let absolute = episode;

    for (const seasonInfo of series.seasons) {
        if (
            seasonInfo.season_number > 0 &&
            seasonInfo.season_number < season &&
            typeof seasonInfo.episode_count === "number"
        ) {
            absolute += seasonInfo.episode_count;
        }
    }

    return absolute;
}

function episodeNumberMatches(text, episodeNumber) {
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

    if (taggedEpisodePattern.test(text)) {
        return true;
    }

    const dashEpisodePattern = new RegExp(
        `[\\s._-]0*${episodeNumber}\\b(?!\\d)`,
        "i"
    );

    return dashEpisodePattern.test(text);
}

function torrentMatchesEpisode(torrent, file, season, episode, absoluteEpisode) {
    const text = `${torrent.name || ""} ${file.name || ""}`;

    if (!episode) {
        return true;
    }

    if (absoluteEpisode && absoluteEpisode !== episode) {
        return episodeNumberMatches(text, absoluteEpisode);
    }

    return episodeNumberMatches(text, episode);
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

module.exports = {
    safeRequestDownloadLink,
    buildStreamTitle,
    parseStremioId,
    computeAbsoluteEpisode,
    episodeNumberMatches,
    torrentMatchesEpisode,
    seriesTitleMatches
};
