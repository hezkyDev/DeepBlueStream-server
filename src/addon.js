require("dotenv").config();

const path = require("path");
const express = require("express");
const { addonBuilder, getRouter } = require("stremio-addon-sdk");

const manifest = require("./manifest");
const { PORT } = require("./constants");
const { getHealth, getStatus } = require("./health");
const { validateEnv } = require("./lib/validateEnv");
const { renderLandingPage, renderNotFoundPage } = require("./lib/page");

validateEnv();

const catalogHandler = require("./handlers/catalogHandler");
const metaHandler = require("./handlers/metaHandler");
const streamHandler = require("./handlers/streamHandler");
const subtitlesHandler = require("./handlers/subtitlesHandler");

const builder = new addonBuilder(manifest);

builder.defineCatalogHandler(catalogHandler);
builder.defineMetaHandler(metaHandler);
builder.defineStreamHandler(streamHandler);
builder.defineSubtitlesHandler(subtitlesHandler);

const app = express();

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
    res.send(renderLandingPage());
});

app.get("/health", (_req, res) => {
    res.json(getHealth());
});

app.get("/status", async (_req, res) => {
    res.json(await getStatus());
});

app.use(getRouter(builder.getInterface()));

app.use((_req, res) => {
    res.status(404).send(renderNotFoundPage());
});

app.listen(PORT, () => {
    console.log(`DeepBlueStream running on port ${PORT}`);
    console.log("TMDB Loaded:", !!process.env.TMDB_API_KEY);
    console.log("TORBOX Loaded:", !!process.env.TORBOX_API_KEY);
});
