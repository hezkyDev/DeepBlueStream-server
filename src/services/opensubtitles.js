const axios = require("axios");

const API_KEY = process.env.OPENSUBTITLES_API_KEY;
const BASE_URL = "https://api.opensubtitles.com/api/v1";
const USER_AGENT = "DeepBlueStream v1.0.0";

const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const searchCache = new Map();

async function searchByHash(videoHash) {
    const response = await axios.get(`${BASE_URL}/subtitles`, {
        params: {
            moviehash: videoHash
        },
        headers: {
            "Api-Key": API_KEY,
            "User-Agent": USER_AGENT
        }
    });

    return response.data?.data || [];
}

async function getDownloadUrl(fileId) {
    const response = await axios.post(
        `${BASE_URL}/download`,
        { file_id: fileId },
        {
            headers: {
                "Api-Key": API_KEY,
                "User-Agent": USER_AGENT,
                "Content-Type": "application/json"
            }
        }
    );

    return response.data?.link;
}

function pickBestPerLanguage(results) {
    const byLanguage = new Map();

    for (const item of results) {
        const attributes = item.attributes || {};
        const language = attributes.language;

        if (!language || !attributes.files?.[0]?.file_id) {
            continue;
        }

        const existing = byLanguage.get(language);
        const downloadCount = attributes.download_count || 0;

        if (!existing || downloadCount > (existing.attributes.download_count || 0)) {
            byLanguage.set(language, item);
        }
    }

    return [...byLanguage.values()];
}

async function getSubtitlesByHash(videoHash) {
    if (!API_KEY || !videoHash) {
        return [];
    }

    const cached = searchCache.get(videoHash);

    if (cached && Date.now() - cached.loadedAt < SEARCH_CACHE_TTL_MS) {
        return cached.data;
    }

    const results = await searchByHash(videoHash);
    const bestMatches = pickBestPerLanguage(results);

    const subtitles = [];

    for (const item of bestMatches) {
        const fileId = item.attributes.files[0].file_id;

        try {
            const url = await getDownloadUrl(fileId);

            if (url) {
                subtitles.push({
                    id: `opensubtitles-${item.id}`,
                    url,
                    lang: item.attributes.language
                });
            }
        } catch (err) {
            console.error(
                "OpenSubtitles download link failed:",
                err.response?.data || err.message
            );
        }
    }

    searchCache.set(videoHash, { data: subtitles, loadedAt: Date.now() });

    return subtitles;
}

module.exports = {
    getSubtitlesByHash
};
