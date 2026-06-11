const axios = require("axios");

const PROWLARR_URL = process.env.PROWLARR_URL;
const PROWLARR_API_KEY = process.env.PROWLARR_API_KEY;

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

async function searchMovies(query, year) {
    const searchQuery = year ? `${query} ${year}` : query;

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

    return normalizeSearchResults(response.data || []);
}

module.exports = {
    searchMovies
};