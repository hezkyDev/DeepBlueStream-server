const {
    getTrendingMovies,
    getTrendingSeries,
    getMovieDetails,
    getSeriesDetails,
    searchMovie,
    searchSeries,
    discoverMovies,
    discoverSeries
} = require("../services/tmdb");

const { getFavoritesByType } = require("../services/favorites");
const { buildTorboxGroupedCatalog } = require("../lib/torboxLibrary");

const {
    PLACEHOLDER_POSTER,
    TORBOX_LIBRARY_LIMIT,
    TORBOX_RECENT_LIMIT,
    CATALOG_PAGE_SIZE,
    MOVIE_GENRES,
    SERIES_GENRES
} = require("../constants");

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

async function catalogHandler({ type, id, extra }) {
    console.log("CATALOG REQUEST:", id, "TYPE:", type, "EXTRA:", extra);

    try {
        if (id === "torbox-trending" || id === "deepbluestream") {
            if (extra && extra.search) {
                const searchResults = await searchMovie(extra.search);
                return { metas: searchResults.map(movieToMeta) };
            }

            const tmdbMovies = await getTrendingMovies();
            return { metas: tmdbMovies.map(movieToMeta) };
        }

        if (id === "torbox-trending-series") {
            const tmdbSeries = extra && extra.search
                ? await searchSeries(extra.search)
                : await getTrendingSeries();

            return { metas: tmdbSeries.map(series => seriesToMeta(series, "series")) };
        }

        if (id === "torbox-trending-anime") {
            if (extra && extra.search) {
                const searchResults = await searchSeries(extra.search);
                return { metas: searchResults.map(series => seriesToMeta(series, "anime")) };
            }

            return { metas: [] };
        }

        if (id === "torbox-movies") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_LIBRARY_LIMIT, "movie")
            };
        }

        if (id === "torbox-series") {
            if (extra && extra.search) {
                const searchResults = await searchSeries(extra.search);
                return { metas: searchResults.map(series => seriesToMeta(series, "series")) };
            }

            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_LIBRARY_LIMIT, "series")
            };
        }

        if (id === "torbox-anime") {
            if (extra && extra.search) {
                const searchResults = await searchSeries(extra.search);
                return { metas: searchResults.map(series => seriesToMeta(series, "anime")) };
            }

            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_LIBRARY_LIMIT, "anime")
            };
        }

        if (id === "torbox-recent-movies") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_RECENT_LIMIT, "movie")
            };
        }

        if (id === "torbox-recent-series") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_RECENT_LIMIT, "series")
            };
        }

        if (id === "torbox-recent-anime") {
            return {
                metas: await buildTorboxGroupedCatalog(TORBOX_RECENT_LIMIT, "anime")
            };
        }

        if (id === "torbox-discover-movies") {
            const genreId = extra && extra.genre ? MOVIE_GENRES[extra.genre] : undefined;
            const page = extra && extra.skip ? Math.floor(Number(extra.skip) / CATALOG_PAGE_SIZE) + 1 : 1;

            const movies = await discoverMovies({ genreId, page });

            return { metas: movies.map(movieToMeta) };
        }

        if (id === "torbox-discover-series") {
            const genreId = extra && extra.genre ? SERIES_GENRES[extra.genre] : undefined;
            const page = extra && extra.skip ? Math.floor(Number(extra.skip) / CATALOG_PAGE_SIZE) + 1 : 1;

            const series = await discoverSeries({ genreId, page });

            return { metas: series.map(item => seriesToMeta(item, "series")) };
        }

        if (id === "torbox-favorites-movies") {
            const favorites = getFavoritesByType("movie");

            const movies = await Promise.all(
                favorites.map(favorite => getMovieDetails(favorite.tmdbId))
            );

            return { metas: movies.map(movieToMeta) };
        }

        if (id === "torbox-favorites-series" || id === "torbox-favorites-anime") {
            const favoriteType = id === "torbox-favorites-anime" ? "anime" : "series";
            const favorites = getFavoritesByType(favoriteType);

            const seriesList = await Promise.all(
                favorites.map(favorite => getSeriesDetails(favorite.tmdbId))
            );

            return { metas: seriesList.map(series => seriesToMeta(series, favoriteType)) };
        }

        return { metas: [] };

    } catch (err) {
        console.error("Catalog error:", err.response?.data || err.message);
        return { metas: [] };
    }
}

module.exports = catalogHandler;
