const tmdb = require("./services/tmdb");
const torbox = require("./services/torbox");
const prowlarr = require("./services/prowlarr");

const START_TIME = Date.now();

async function checkProvider(testFn, configured) {
    if (!configured) {
        return { configured: false, status: "not_configured" };
    }

    try {
        await testFn();
        return { configured: true, status: "ok" };
    } catch (err) {
        return {
            configured: true,
            status: "error",
            error: err.response?.status ? `HTTP ${err.response.status}` : "unreachable"
        };
    }
}

async function getStatus() {
    const [tmdbStatus, torboxStatus, prowlarrStatus] = await Promise.all([
        checkProvider(() => tmdb.testConnection(), !!process.env.TMDB_API_KEY),
        checkProvider(() => torbox.testConnection(), !!process.env.TORBOX_API_KEY),
        checkProvider(() => prowlarr.testConnection(), !!(process.env.PROWLARR_URL && process.env.PROWLARR_API_KEY))
    ]);

    return {
        tmdb: tmdbStatus,
        torbox: torboxStatus,
        prowlarr: prowlarrStatus
    };
}

function getHealth() {
    return {
        status: "ok",
        uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    getHealth,
    getStatus
};
