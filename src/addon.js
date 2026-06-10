require("dotenv").config();

const axios = require("axios");
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const {
    getTrendingMovies,
    getMovieDetails
} = require("./services/tmdb");
const {
    findMatchingTorrents,
    requestDownloadLink,
    isVideoFile,
    formatBytes,
    detectQuality,
    detectCodec
} = require("./services/torbox");

const manifest = {
    id: "com.deepbluestream",
    version: "1.0.0",
    name: "DeepBlueStream",
    description: "Personal Streaming Platform",

    resources: ["catalog", "meta", "stream"],

    types: ["movie"],

    idPrefixes: ["dbs"],

    catalogs: [
        {
            type: "movie",
            id: "DeepBlueStream"
        }
    ]
};

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(async () => {
	
	console.log("CATALOG REQUEST");

    const tmdbMovies = await getTrendingMovies();

    const metas = tmdbMovies.map(movie => ({
        id: `dbs:${movie.id}`,
        type: "movie",
        name: movie.title,
        poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    }));

    return {
        metas
    };

});

builder.defineMetaHandler(async ({ id }) => {
	
	console.log("META REQUEST:", id);

	const tmdbId = id.replace("dbs:", "");

	const movie = await getMovieDetails(tmdbId);

    if (!movie) {
        return { meta: null };
    }

	return {
	    meta: {
	        id,
	        type: "movie",
	        name: movie.title,
	        poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`,
	        background: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
	        description: movie.overview,
	        releaseInfo: movie.release_date,
	        runtime: `${movie.runtime} min`,
	        genres: movie.genres.map(g => g.name)
	    }
	};

});

builder.defineStreamHandler(async ({ type, id }) => {

    console.log("========== STREAM REQUEST ==========");
    console.log("type =", type);
    console.log("id =", id);
    console.log("===================================");

    try {
        const tmdbId = id.replace("dbs:", "");
        const movie = await getMovieDetails(tmdbId);

        console.log("Searching Torbox for:", movie.title);

        const matchingTorrents = await findMatchingTorrents(movie.title);

        console.log("Matches found:", matchingTorrents.length);

        const streams = [];

        for (const torrent of matchingTorrents) {
            const videoFiles = torrent.files.filter(isVideoFile);

            for (const file of videoFiles) {
                const url = await requestDownloadLink(torrent.id, file.id);

				const quality = detectQuality(torrent.name);
				const codec = detectCodec(torrent.name);
				const size = formatBytes(file.size);

				streams.push({
				    title: `DeepBlueStream\nTorbox | ${quality} | ${size} | ${codec}`,
				    url,
				    behaviorHints: {
				        notWebReady: false
				    }
				});
            }
        }

        return {
            streams
        };

    } catch (err) {
        console.error("Stream error:", err.response?.data || err.message);

        return {
            streams: []
        };
    }
});

serveHTTP(builder.getInterface(), {
    port: 7001
});

console.log("DeepBlueStream running on port 7001");
console.log("TORBOX Loaded:", !!process.env.TORBOX_API_KEY);