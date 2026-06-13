const { PLACEHOLDER_POSTER } = require("../constants");

function movieToMeta(movie) {
    return {
        id: `dbs:${movie.id}`,
        type: "movie",
        name: movie.title,
        poster: movie.poster_path
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
            : PLACEHOLDER_POSTER,
        background: movie.backdrop_path
            ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
            : undefined,
        description: movie.overview || undefined,
        releaseInfo: movie.release_date || undefined
    };
}

function seriesToMeta(series, type = "series") {
    return {
        id: `${type === "anime" ? "dbs-anime" : "dbs-series"}:${series.id}`,
        type,
        name: series.name,
        poster: series.poster_path
            ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
            : PLACEHOLDER_POSTER,
        background: series.backdrop_path
            ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
            : undefined,
        description: series.overview || undefined,
        releaseInfo: series.first_air_date || undefined
    };
}

module.exports = {
    movieToMeta,
    seriesToMeta
};
