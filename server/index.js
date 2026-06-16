require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const { API_PORT } = require("./constants");
const requireApiToken = require("./middleware/requireApiToken");

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

// Throttle abuse on the public endpoint (per-IP). Generous enough for normal
// app use (home + browsing fan out to several calls).
app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 300,
        standardHeaders: true,
        legacyHeaders: false
    })
);

// All API routes require the shared bearer token (see requireApiToken).
app.use("/api", requireApiToken);

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
