const PORT = 7001;

const PUBLIC_URL = process.env.PUBLIC_URL || "https://aminruls-macbook-pro-2.tailaf6f0f.ts.net";

const PLACEHOLDER_POSTER =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/800px-Placeholder_view_vector.svg.png";

const TORBOX_LIBRARY_LIMIT = 30;
const TORBOX_RECENT_LIMIT = 20;
const TORRENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_STREAMS_PER_ITEM = 6;
const TORBOX_REQUEST_DELAY_MS = 300;
const DOWNLOAD_LINK_CONCURRENCY = 4;
const CDN_CHECK_TIMEOUT_MS = 2500;
const CATALOG_PAGE_SIZE = 20;

const MOVIE_GENRES = {
    "Action": 28,
    "Animation": 16,
    "Comedy": 35,
    "Crime": 80,
    "Documentary": 99,
    "Drama": 18,
    "Fantasy": 14,
    "Horror": 27,
    "Romance": 10749,
    "Sci-Fi": 878,
    "Thriller": 53
};

const SERIES_GENRES = {
    "Action & Adventure": 10759,
    "Animation": 16,
    "Comedy": 35,
    "Crime": 80,
    "Documentary": 99,
    "Drama": 18,
    "Mystery": 9648,
    "Reality": 10764,
    "Sci-Fi & Fantasy": 10765
};

module.exports = {
    PORT,
    PUBLIC_URL,
    PLACEHOLDER_POSTER,
    TORBOX_LIBRARY_LIMIT,
    TORBOX_RECENT_LIMIT,
    TORRENTS_CACHE_TTL_MS,
    MAX_STREAMS_PER_ITEM,
    TORBOX_REQUEST_DELAY_MS,
    DOWNLOAD_LINK_CONCURRENCY,
    CDN_CHECK_TIMEOUT_MS,
    CATALOG_PAGE_SIZE,
    MOVIE_GENRES,
    SERIES_GENRES
};
