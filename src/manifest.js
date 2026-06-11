const { MOVIE_GENRES, SERIES_GENRES } = require("./constants");

const manifest = {
    id: "com.deepbluestream",
    version: "1.0.0",
    name: "DeepBlueStream",
    description: "Personal Streaming Platform",

    resources: ["catalog", "meta", "stream", "subtitles"],

    types: ["movie", "series", "anime"],

    idPrefixes: ["tt", "dbs", "dbs-series", "dbs-anime", "tb", "tbg"],

    catalogs: [
        {
            type: "movie",
            id: "torbox-trending",
            name: "DeepBlueStream - Trending Movies",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "series",
            id: "torbox-trending-series",
            name: "DeepBlueStream - Trending Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "anime",
            id: "torbox-trending-anime",
            name: "DeepBlueStream - Trending Anime",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "torbox-movies",
            name: "DeepBlueStream - Movies"
        },
        {
            type: "series",
            id: "torbox-series",
            name: "DeepBlueStream - Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "anime",
            id: "torbox-anime",
            name: "DeepBlueStream - Anime",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "torbox-recent-movies",
            name: "DeepBlueStream - Recently Added Movies"
        },
        {
            type: "series",
            id: "torbox-recent-series",
            name: "DeepBlueStream - Recently Added Series"
        },
        {
            type: "anime",
            id: "torbox-recent-anime",
            name: "DeepBlueStream - Recently Added Anime"
        },
        {
            type: "movie",
            id: "torbox-discover-movies",
            name: "DeepBlueStream - Discover Movies",
            extra: [
                { name: "genre", isRequired: false, options: Object.keys(MOVIE_GENRES) },
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "series",
            id: "torbox-discover-series",
            name: "DeepBlueStream - Discover Series",
            extra: [
                { name: "genre", isRequired: false, options: Object.keys(SERIES_GENRES) },
                { name: "skip", isRequired: false }
            ]
        },
        {
            type: "movie",
            id: "torbox-favorites-movies",
            name: "DeepBlueStream - Favorites"
        },
        {
            type: "series",
            id: "torbox-favorites-series",
            name: "DeepBlueStream - Favorites"
        },
        {
            type: "anime",
            id: "torbox-favorites-anime",
            name: "DeepBlueStream - Favorites"
        }
    ]
};

module.exports = manifest;
