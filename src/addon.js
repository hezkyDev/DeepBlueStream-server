require("dotenv").config();

const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = require("./manifest");
const { PORT } = require("./constants");

const catalogHandler = require("./handlers/catalogHandler");
const metaHandler = require("./handlers/metaHandler");
const streamHandler = require("./handlers/streamHandler");
const subtitlesHandler = require("./handlers/subtitlesHandler");

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);
builder.defineSubtitlesHandler(subtitlesHandler);

serveHTTP(builder.getInterface(), {
    port: PORT
});

console.log(`DeepBlueStream running on port ${PORT}`);
console.log("TMDB Loaded:", !!process.env.TMDB_API_KEY);
console.log("TORBOX Loaded:", !!process.env.TORBOX_API_KEY);
