const axios = require("axios");

const PROWLARR_URL = process.env.PROWLARR_URL;
const PROWLARR_API_KEY = process.env.PROWLARR_API_KEY;

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

function normalizeSearchResults(results) {
    return results.map(item => {
        return {
            title: item.title,
            indexer: item.indexer,
            size: item.size,
            seeders: item.seeders,
            leechers: item.leechers,
            publishDate: item.publishDate,
            infoHash: item.infoHash,
            magnetUrl: item.magnetUrl,
            downloadUrl: item.downloadUrl,
            protocol: item.protocol
        };
    });
}

async function testConnection() {
    const response = await axios.get(`${PROWLARR_URL}/api/v1/system/status`, {
        headers: {
            "X-Api-Key": PROWLARR_API_KEY
        }
    });

    return response.data;
}

async function searchMovies(query, year) {
    const searchQuery = year ? `${query} ${year}` : query;

    const cached = cache.get(searchQuery);

    if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.data;
    }

    const response = await axios.get(
        `${PROWLARR_URL}/api/v1/search`,
        {
            headers: {
                "X-Api-Key": PROWLARR_API_KEY
            },
            params: {
                query: searchQuery,
                type: "search",
                categories: [2000]
            }
        }
    );

    const results = normalizeSearchResults(response.data || []);

    cache.set(searchQuery, { data: results, loadedAt: Date.now() });

    return results;
}

module.exports = {
    testConnection,
    searchMovies
};