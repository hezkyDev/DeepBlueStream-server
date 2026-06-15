const axios = require("axios");

const API_KEY = process.env.TORBOX_API_KEY;

async function testConnection() {
    const response = await axios.get(
        "https://api.torbox.app/v1/api/user/me",
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`
            }
        }
    );

    return response.data;
}

async function getMyTorrents() {
    const response = await axios.get(
        "https://api.torbox.app/v1/api/torrents/mylist",
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`
            }
        }
    );

    return response.data.data || [];
}

async function requestDownloadLink(torrentId, fileId) {
    const response = await axios.get(
        "https://api.torbox.app/v1/api/torrents/requestdl",
        {
            params: {
                token: API_KEY,
                torrent_id: torrentId,
                file_id: fileId,
                redirect: false,
                append_name: true
            }
        }
    );

    return response.data.data;
}

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[._\-()[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeTitle(text) {
    return normalizeText(text)
        .replace(/\b(720p|1080p|2160p|4k|webrip|webdl|web|bluray|brrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|ddp|aac|dts|10bit|8bit|proper|repack|extended|remux)\b/g, "")
        .replace(/\b(19\d{2}|20\d{2})\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isVideoFile(file) {
    const name = (file.name || "").toLowerCase();
    const mimetype = (file.mimetype || "").toLowerCase();

    return (
        mimetype.startsWith("video/") ||
        name.endsWith(".mkv") ||
        name.endsWith(".mp4") ||
        name.endsWith(".avi") ||
        name.endsWith(".mov") ||
        name.endsWith(".webm")
    );
}

function formatBytes(bytes) {
    if (!bytes) return "Unknown size";

    const gb = bytes / (1024 * 1024 * 1024);

    if (gb >= 1) {
        return `${gb.toFixed(1)} GB`;
    }

    const mb = bytes / (1024 * 1024);

    return `${mb.toFixed(0)} MB`;
}

function detectQuality(name) {
    const lower = String(name || "").toLowerCase();

    if (lower.includes("2160p") || lower.includes("4k")) return "4K";
    if (lower.includes("1080p")) return "1080p";
    if (lower.includes("720p")) return "720p";
    if (lower.includes("480p")) return "480p";

    return "Unknown";
}

function detectCodec(name) {
    const lower = String(name || "").toLowerCase();

    if (lower.includes("x265") || lower.includes("h265") || lower.includes("hevc")) return "x265";
    if (lower.includes("x264") || lower.includes("h264")) return "x264";

    return "";
}

function extractYear(name) {
    const match = String(name || "").match(/\b(19\d{2}|20\d{2})\b/);
    return match ? match[1] : undefined;
}

function cleanDisplayName(name) {
    return String(name || "")
        .replace(/\.[a-z0-9]{2,4}$/i, "")
        .replace(/[._-]/g, " ")
        .replace(/\b(720p|1080p|2160p|4k|webrip|web dl|webdl|web|bluray|blu ray|brrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|ddp|aac|dts|10bit|8bit|proper|repack|extended|remux)\b/gi, "")
        .replace(/\b(5 1|7 1|2 0)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanMovieTitle(name) {
    const year = extractYear(name);

    let cleaned = String(name || "")
        .replace(/\[[^\]]*\]/g, " ")
        .replace(/\([^\)]*(1080p|720p|2160p|4k|webrip|web-dl|bluray|x264|x265|h264|h265|aac|ddp|dts)[^\)]*\)/gi, " ")
        .replace(/[._-]/g, " ");

    if (year) {
        cleaned = cleaned.split(year)[0];
    }

    cleaned = cleaned
        .replace(/\b(www|uindex|org|com|net|yts|bz|proxies|official|site)\b/gi, " ")
        .replace(/\b(720p|1080p|2160p|4k|webrip|web dl|webdl|web-dl|web|bluray|blu ray|brrip|hdrip|dvdrip|x264|x265|h264|h265|hevc|ddp|aac|dts|10bit|8bit|proper|repack|extended|remux|amzn|nf|dsnp|hulu|rarbg|yify)\b/gi, " ")
        .replace(/\b(5 1|7 1|2 0)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned;
}

function isEpisodeLike(name) {
    return (
        /\bS\d{1,2}E\d{1,3}\b/i.test(name) ||
        /\bSeason\b/i.test(name) ||
        /\bEpisode\b/i.test(name)
    );
}

function isLikelyMovieMatch(torrentName, movieTitle, movieYear) {
    const cleanedTorrentTitle = cleanMovieTitle(torrentName);

    const normalizedTorrent = normalizeText(cleanedTorrentTitle);
    const normalizedMovie = normalizeText(movieTitle);

    const torrentYear = extractYear(torrentName);

    const titleMatches =
        normalizedTorrent === normalizedMovie ||
        normalizedTorrent.startsWith(`${normalizedMovie} `);

    const yearMatches =
        !movieYear ||
        !torrentYear ||
        String(torrentYear) === String(movieYear);

    return titleMatches && yearMatches && !isEpisodeLike(torrentName);
}

async function findMatchingTorrents(movieTitle, movieYear) {
    const torrents = await getMyTorrents();

    return torrents.filter(torrent => {
        if (!torrent.cached || !torrent.download_finished) {
            return false;
        }

        if (!Array.isArray(torrent.files) || !torrent.files.some(isVideoFile)) {
            return false;
        }

        return isLikelyMovieMatch(torrent.name || "", movieTitle, movieYear);
    });
}

async function checkCached(hashes) {
    const response = await axios.get(
        "https://api.torbox.app/v1/api/torrents/checkcached",
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`
            },
            params: {
                hash: hashes.join(","),
                format: "object",
                list_files: true
            }
        }
    );

    return response.data;
}

function buildMagnetFromHash(infoHash, title) {
    return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}`;
}

async function createTorrentFromMagnet(magnet) {
    const formData = new URLSearchParams();

    formData.append("magnet", magnet);
    formData.append("seed", "3");
    formData.append("allow_zip", "false");

    const response = await axios.post(
        "https://api.torbox.app/v1/api/torrents/createtorrent",
        formData,
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }
    );

    return response.data;
}

async function deleteTorrent(torrentId) {
    const response = await axios.post(
        "https://api.torbox.app/v1/api/torrents/controltorrent",
        {
            torrent_id: torrentId,
            operation: "delete"
        },
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data;
}

async function getTorrentById(torrentId) {
    const torrents = await getMyTorrents();

    return torrents.find(torrent => torrent.id === torrentId);
}

async function findTorrentByHash(infoHash) {
    const normalizedHash = infoHash.toLowerCase();
    const torrents = await getMyTorrents();

    return torrents.find(torrent => {
        const hashes = [
            torrent.hash,
            ...(torrent.alternative_hashes || [])
        ]
            .filter(Boolean)
            .map(hash => hash.toLowerCase());

        return hashes.includes(normalizedHash);
    });
}

function getCachedEntriesFromCheckCached(checkCachedResponse) {
    if (!checkCachedResponse || !checkCachedResponse.data) {
        return [];
    }

    return Object.values(checkCachedResponse.data);
}

module.exports = {
    testConnection,
    getMyTorrents,
    requestDownloadLink,
    findMatchingTorrents,
    isVideoFile,
    formatBytes,
    detectQuality,
    detectCodec,
    extractYear,
    cleanDisplayName,
    cleanMovieTitle,
    checkCached,
    buildMagnetFromHash,
    createTorrentFromMagnet,
    findTorrentByHash,
    getTorrentById,
    deleteTorrent,
    getCachedEntriesFromCheckCached
};