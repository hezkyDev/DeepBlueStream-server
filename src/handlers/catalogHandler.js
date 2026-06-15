const {
    getTrendingMovies,
    getTrendingSeries,
    getMovieDetails,
    getSeriesDetails,
    searchMovie,
    searchSeries,
    searchAnime,
    discoverMovies,
    discoverSeries
} = require("../services/tmdb");

const { getFavoritesByType } = require("../services/favorites");
const { buildTorboxGroupedCatalog } = require("../lib/torboxLibrary");
const { movieToMeta, seriesToMeta } = require("../lib/metaMappers");

const {
    TORBOX_LIBRARY_LIMIT,
    TORBOX_RECENT_LIMIT,
    CATALOG_PAGE_SIZE,
    MOVIE_GENRES,
    SERIES_GENRES
} = require("../constants");

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
                const searchResults = await searchAnime(extra.search);
                return { metas: searchResults.map(series => seriesToMeta(series, "anime")) };
            }

            const animeSeries = await discoverSeries({ genreId: MOVIE_GENRES.Animation, originCountry: "JP" });
            return { metas: animeSeries.map(series => seriesToMeta(series, "anime")) };
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
                const searchResults = await searchAnime(extra.search);
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
