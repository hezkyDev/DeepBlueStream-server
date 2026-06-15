const { MOVIE_GENRES, SERIES_GENRES, PUBLIC_URL } = require("./constants");

const manifest = {
    id: "com.deepbluestream",
    version: "1.0.0",
    name: "DeepBlueStream",
    description:
        "Your personal deep-ocean streaming hub. Browse trending, discover and library titles, and play cached sources through your own Torbox account.",

    logo: `${PUBLIC_URL}/logo.png`,
    background: `${PUBLIC_URL}/logo.png`,
    contactEmail: "hezky.dev@gmail.com",

    behaviorHints: {
        configurable: false,
        configurationRequired: false
    },

    resources: ["catalog", "meta", "stream", "subtitles"],

    types: ["movie", "series", "anime"],

    idPrefixes: ["tt", "dbs", "dbs-series", "dbs-anime", "tb", "tbg"],

    catalogs: [
        {
            type: "movie",
            id: "torbox-trending",
            name: "Trending Movies",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "series",
            id: "torbox-trending-series",
            name: "Trending Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "anime",
            id: "torbox-trending-anime",
            name: "Trending Anime",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "torbox-movies",
            name: "Movies"
        },
        {
            type: "series",
            id: "torbox-series",
            name: "Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "anime",
            id: "torbox-anime",
            name: "Anime",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "torbox-recent-movies",
            name: "Recently Added Movies"
        },
        {
            type: "series",
            id: "torbox-recent-series",
            name: "Recently Added Series"
        },
        {
            type: "anime",
            id: "torbox-recent-anime",
            name: "Recently Added Anime"
        },
        {
            type: "movie",
            id: "torbox-discover-movies",
            name: "Discover Movies",
            extra: [
                { name: "genre", isRequired: false, options: Object.keys(MOVIE_GENRES) },
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "series",
            id: "torbox-discover-series",
            name: "Discover Series",
            extra: [
                { name: "genre", isRequired: false, options: Object.keys(SERIES_GENRES) },
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "movie",
            id: "torbox-favorites-movies",
            name: "My List"
        },
        {
            type: "series",
            id: "torbox-favorites-series",
            name: "My List"
        },
        {
            type: "anime",
            id: "torbox-favorites-anime",
            name: "My List"
        }
    ]
};

module.exports = manifest;
