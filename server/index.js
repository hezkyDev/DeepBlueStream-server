require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { API_PORT } = require("./constants");

const profilesRouter = require("./routes/profiles");
const progressRouter = require("./routes/progress");
const favoritesRouter = require("./routes/favorites");
const catalogRouter = require("./routes/catalog");
const metaRouter = require("./routes/meta");
const streamRouter = require("./routes/stream");
const searchRouter = require("./routes/search");
const skipTimesRouter = require("./routes/skipTimes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/profiles", profilesRouter);
app.use("/api/progress", progressRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api", catalogRouter);
app.use("/api/meta", metaRouter);
app.use("/api/stream", streamRouter);
app.use("/api/search", searchRouter);
app.use("/api/skip-times", skipTimesRouter);

app.listen(API_PORT, () => {
    console.log(`DeepBlueStream API server listening on port ${API_PORT}`);
});
