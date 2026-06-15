const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DATA_DIR = path.join(__dirname, "..", "..", "server", "data");
const OVERRIDE_FILE = path.join(DATA_DIR, "skip-times.json");
const MAPPING_FILE = path.join(DATA_DIR, "anime-mapping.json");

const MAPPING_URL =
    "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-mini.json";
const MAPPING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ANISKIP_BASE_URL = "https://api.aniskip.com/v2/skip-times";
const ANISKIP_TIMEOUT_MS = 5000;
const ANISKIP_CACHE_TTL_MS = 60 * 60 * 1000;

// Keyed by "<tmdbId>/<season>". Each TMDB show often maps to multiple MAL
// IDs (one per season / OVA / movie), so we have to disambiguate by season.
let mappingByTmdb = null;
let mappingLoadPromise = null;
const aniskipCache = new Map();

function loadOverrides() {
    try {
        if (!fs.existsSync(OVERRIDE_FILE)) {
            return {};
        }

        return JSON.parse(fs.readFileSync(OVERRIDE_FILE, "utf8"));
    } catch (err) {
        console.error("skipTimes: failed to read overrides:", err.message);
        return {};
    }
}

async function downloadMappingFile() {
    console.log("skipTimes: refreshing anime-mapping.json from Fribb...");

    const response = await axios.get(MAPPING_URL, {
        timeout: 30000,
        responseType: "json"
    });

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(response.data));
}

async function ensureMapping() {
    if (mappingByTmdb) {
        return mappingByTmdb;
    }

    if (mappingLoadPromise) {
        return mappingLoadPromise;
    }

    mappingLoadPromise = (async () => {
        let needsRefresh = true;

        try {
            const stat = fs.statSync(MAPPING_FILE);
            if (Date.now() - stat.mtimeMs < MAPPING_TTL_MS) {
                needsRefresh = false;
            }
        } catch (_) {
            // file missing — needs download
        }

        if (needsRefresh) {
            try {
                await downloadMappingFile();
            } catch (err) {
                console.error("skipTimes: mapping download failed:", err.message);

                if (!fs.existsSync(MAPPING_FILE)) {
                    return null;
                }
            }
        }

        const raw = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf8"));
        const map = new Map();

        for (const entry of raw) {
            if (entry.type !== "TV") {
                // Skip OVA/MOVIE/etc. — only series have intros/outros.
                continue;
            }

            const tmdbTv = entry.themoviedb_id?.tv;
            const malId = entry.mal_id;
            const tmdbSeason = entry.season?.tmdb;

            if (!tmdbTv || !malId || tmdbSeason === undefined || tmdbSeason === 0) {
                continue;
            }

            map.set(`${tmdbTv}/${tmdbSeason}`, malId);
        }

        mappingByTmdb = map;
        return map;
    })();

    try {
        return await mappingLoadPromise;
    } finally {
        mappingLoadPromise = null;
    }
}

async function getMalIdForTmdb(tmdbId, season) {
    const mapping = await ensureMapping();

    if (!mapping) {
        return null;
    }

    return mapping.get(`${tmdbId}/${season}`) ?? null;
}

function normalizeAniskipResponse(data) {
    if (!data || data.found === false || !Array.isArray(data.results)) {
        return { intro: null, outro: null };
    }

    let intro = null;
    let outro = null;

    for (const skip of data.results) {
        const interval = skip?.interval;

        if (!interval || typeof interval.startTime !== "number" || typeof interval.endTime !== "number") {
            continue;
        }

        const entry = {
            start: interval.startTime,
            end: interval.endTime
        };

        if (skip.skipType === "op") {
            intro = entry;
        } else if (skip.skipType === "ed") {
            outro = entry;
        }
    }

    return { intro, outro };
}

async function fetchAniskip(malId, episode, episodeDurationSeconds) {
    const cacheKey = `${malId}/${episode}/${Math.round(episodeDurationSeconds || 0)}`;
    const cached = aniskipCache.get(cacheKey);

    if (cached && Date.now() - cached.ts < ANISKIP_CACHE_TTL_MS) {
        return cached.value;
    }

    try {
        const response = await axios.get(`${ANISKIP_BASE_URL}/${malId}/${episode}`, {
            params: {
                types: ["op", "ed"],
                episodeLength: Math.round(episodeDurationSeconds || 0)
            },
            timeout: ANISKIP_TIMEOUT_MS
        });

        const value = normalizeAniskipResponse(response.data);
        aniskipCache.set(cacheKey, { ts: Date.now(), value });

        return value;
    } catch (err) {
        console.error("skipTimes: AniSkip request failed:", err.message);
        return { intro: null, outro: null };
    }
}

async function getSkipTimes({ type, tmdbId, season, episode, episodeDurationSeconds }) {
    const overrides = loadOverrides();
    const overrideKey = `${tmdbId}/${season}/${episode}`;

    if (overrides[overrideKey]) {
        return overrides[overrideKey];
    }

    if (type === "anime") {
        const malId = await getMalIdForTmdb(tmdbId, season);

        if (!malId) {
            return { intro: null, outro: null };
        }

        return fetchAniskip(malId, episode, episodeDurationSeconds);
    }

    return { intro: null, outro: null };
}

module.exports = { getSkipTimes };
