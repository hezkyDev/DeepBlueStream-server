const { PLACEHOLDER_POSTER } = require("../constants");
const { getSeasonDetails } = require("../services/tmdb");

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

async function buildSeriesVideos(series, idPrefix) {
    const seasons = (series.seasons || []).filter(season => typeof season.season_number === "number");

    const seasonDetails = await Promise.all(
        seasons.map(async season => {
            try {
                return await getSeasonDetails(series.id, season.season_number);
            } catch (err) {
                console.error(
                    "Failed to load season details:",
                    series.id,
                    season.season_number,
                    err.response?.data || err.message
                );

                return null;
            }
        })
    );

    const videos = [];

    for (const seasonDetail of seasonDetails) {
        if (!seasonDetail || !Array.isArray(seasonDetail.episodes)) {
            continue;
        }

        for (const episode of seasonDetail.episodes) {
            videos.push({
                id: `${idPrefix}:${series.id}:${seasonDetail.season_number}:${episode.episode_number}`,
                title: episode.name || `Episode ${episode.episode_number}`,
                season: seasonDetail.season_number,
                episode: episode.episode_number,
                released: episode.air_date ? new Date(episode.air_date).toISOString() : undefined,
                overview: episode.overview || undefined,
                thumbnail: episode.still_path
                    ? `https://image.tmdb.org/t/p/w300${episode.still_path}`
                    : undefined
            });
        }
    }

    return videos;
}

function extractCast(details, limit = 5) {
    const cast = details.credits?.cast || [];
    return cast.slice(0, limit).map(member => member.name);
}

function extractDirectors(details) {
    const crew = details.credits?.crew || [];
    return crew.filter(member => member.job === "Director").map(member => member.name);
}

function extractMovieContentRating(details) {
    const results = details.release_dates?.results || [];
    const us = results.find(entry => entry.country === "US");
    const certification = us?.release_dates?.find(release => release.certification)?.certification;

    return certification || undefined;
}

function extractSeriesContentRating(details) {
    const results = details.content_ratings?.results || [];
    const us = results.find(entry => entry.iso_3166_1 === "US");

    return us?.rating || undefined;
}

module.exports = {
    movieToMeta,
    seriesToMeta,
    buildSeriesVideos,
    extractCast,
    extractDirectors,
    extractMovieContentRating,
    extractSeriesContentRating
};
