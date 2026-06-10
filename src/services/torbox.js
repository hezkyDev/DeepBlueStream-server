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

function normalizeTitle(text) {
    return text
        .toLowerCase()
        .replace(/[._-]/g, " ")
        .replace(/\b(720p|1080p|2160p|4k|webrip|webdl|web|bluray|hdrip|x264|x265|h264|h265|ddp|aac|dts|10bit|8bit)\b/g, "")
        .replace(/\b(2020|2021|2022|2023|2024|2025|2026)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isVideoFile(file) {
    const name = file.name || "";
    const mimetype = file.mimetype || "";

    return (
        mimetype.startsWith("video/") ||
        name.endsWith(".mkv") ||
        name.endsWith(".mp4") ||
        name.endsWith(".avi")
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
    const lower = name.toLowerCase();

    if (lower.includes("2160p") || lower.includes("4k")) return "4K";
    if (lower.includes("1080p")) return "1080p";
    if (lower.includes("720p")) return "720p";
    if (lower.includes("480p")) return "480p";

    return "Unknown";
}

function detectCodec(name) {
    const lower = name.toLowerCase();

    if (lower.includes("x265") || lower.includes("h265") || lower.includes("hevc")) return "x265";
    if (lower.includes("x264") || lower.includes("h264")) return "x264";

    return "";
}

async function findMatchingTorrents(movieTitle) {
    const torrents = await getMyTorrents();

    const normalizedMovieTitle = normalizeTitle(movieTitle);

    return torrents.filter(torrent => {
        if (!torrent.cached || !torrent.download_finished) {
            return false;
        }

        const normalizedTorrentName = normalizeTitle(torrent.name || "");

        return normalizedTorrentName.includes(normalizedMovieTitle);
    });
}

module.exports = {
    testConnection,
    getMyTorrents,
    requestDownloadLink,
    findMatchingTorrents,
    isVideoFile,
    formatBytes,
    detectQuality,
    detectCodec
};