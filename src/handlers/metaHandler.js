const {
    getMovieDetails,
    getSeriesDetails,
    getMovieVideos,
    getSeriesVideos,
    extractTrailers
} = require("../services/tmdb");

const { isVideoFile, formatBytes, cleanMovieTitle, extractYear } = require("../services/torbox");

const {
    getMyTorrentsCached,
    findTorboxGroupByKey,
    enrichTorboxGroup,
    getStremioTypeFromLibraryType,
    detectLibraryType,
    cleanSeriesTitle,
    getTorrentGroupKey
} = require("../lib/torboxLibrary");

const {
    buildSeriesVideos,
    extractCast,
    extractDirectors,
    extractMovieContentRating,
    extractSeriesContentRating
} = require("../lib/metaMappers");
const { PLACEHOLDER_POSTER } = require("../constants");

async function metaHandler({ id }) {
    console.log("META REQUEST:", id);

    try {
        if (id.startsWith("dbs-series:") || id.startsWith("dbs-anime:")) {
            const type = id.startsWith("dbs-anime:") ? "anime" : "series";
            const idPrefix = type === "anime" ? "dbs-anime" : "dbs-series";
            const tmdbId = id.replace(`${idPrefix}:`, "");

            const series = await getSeriesDetails(tmdbId);
            const trailerStreams = extractTrailers(await getSeriesVideos(tmdbId));
            const videos = await buildSeriesVideos(series, idPrefix);

            return {
                meta: {
                    id,
                    type,
                    name: series.name,
                    poster: series.poster_path
                        ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: series.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${series.backdrop_path}`
                        : undefined,
                    description: series.overview,
                    releaseInfo: series.first_air_date,
                    genres: series.genres ? series.genres.map(g => g.name) : [],
                    cast: extractCast(series),
                    director: extractDirectors(series),
                    contentRating: extractSeriesContentRating(series),
                    language: series.original_language,
                    country: (series.origin_country || []).join(", ") || undefined,
                    imdbRating: series.vote_average ? series.vote_average.toFixed(1) : undefined,
                    videos,
                    trailerStreams
                }
            };
        }

        if (id.startsWith("dbs:")) {
            const tmdbId = id.replace("dbs:", "");
            const movie = await getMovieDetails(tmdbId);
            const trailerStreams = extractTrailers(await getMovieVideos(tmdbId));

            return {
                meta: {
                    id,
                    type: "movie",
                    name: movie.title,
                    poster: movie.poster_path
                        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                        : PLACEHOLDER_POSTER,
                    background: movie.backdrop_path
                        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
                        : undefined,
                    description: movie.overview,
                    releaseInfo: movie.release_date,
                    runtime: movie.runtime ? `${movie.runtime} min` : undefined,
                    genres: movie.genres ? movie.genres.map(g => g.name) : [],
                    cast: extractCast(movie),
                    director: extractDirectors(movie),
                    contentRating: extractMovieContentRating(movie),
                    language: movie.original_language,
                    imdbRating: movie.vote_average ? movie.vote_average.toFixed(1) : undefined,
                    trailerStreams
                }
            };
        }

        if (id.startsWith("tbg:")) {
            const groupKey = id.replace("tbg:", "");
            const group = await findTorboxGroupByKey(groupKey);

            if (!group) {
                return { meta: null };
            }

            const enriched = await enrichTorboxGroup(group);

            return {
                meta: {
                    id,
                    type: getStremioTypeFromLibraryType(group.type),
                    name: enriched.cleanTitle || group.title,
                    poster: enriched.poster || PLACEHOLDER_POSTER,
                    background: enriched.background,
                    description:
                        enriched.description ||
                        `Cached in Torbox. ${group.torrents.length} version(s) available.`,
                    releaseInfo: enriched.year
                }
            };
        }

        if (id.startsWith("tb:")) {
            const torrentId = Number(id.replace("tb:", ""));

            const torrents = await getMyTorrentsCached();
            const torrent = torrents.find(t => t.id === torrentId);

            if (!torrent) {
                return { meta: null };
            }

            const torrentLibraryType = detectLibraryType(torrent);

            const group = {
                key: getTorrentGroupKey(torrent),
                type: torrentLibraryType,
                title:
                    torrentLibraryType === "series" || torrentLibraryType === "anime"
                        ? cleanSeriesTitle(torrent.name)
                        : cleanMovieTitle(torrent.name),
                year: torrentLibraryType === "movie" ? extractYear(torrent.name) : undefined,
                torrents: [torrent]
            };

            const enriched = await enrichTorboxGroup(group);
            const videoFiles = torrent.files.filter(isVideoFile);
            const firstVideo = videoFiles[0];

            return {
                meta: {
                    id,
                    type: getStremioTypeFromLibraryType(group.type),
                    name: enriched.cleanTitle || torrent.name,
                    poster: enriched.poster || PLACEHOLDER_POSTER,
                    background: enriched.background,
                    description:
                        enriched.description ||
                        `Cached in Torbox. ${videoFiles.length} playable video file(s). Size: ${
                            firstVideo ? formatBytes(firstVideo.size) : "Unknown"
                        }.`,
                    releaseInfo: enriched.year
                }
            };
        }

        return { meta: null };

    } catch (err) {
        console.error("Meta error:", err.response?.data || err.message);
        return { meta: null };
    }
}

module.exports = metaHandler;
