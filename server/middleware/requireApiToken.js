const crypto = require("crypto");

// Rejects requests that don't present the shared bearer token. This guards the
// API when it's exposed publicly (e.g. via Tailscale Funnel). If no token is
// configured the check is skipped so local-only setups keep working.
function timingSafeEqual(a, b) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = function requireApiToken(req, res, next) {
    const expected = process.env.CLIENT_API_TOKEN;
    if (!expected) {
        return next();
    }

    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (token && timingSafeEqual(token, expected)) {
        return next();
    }

    return res.status(401).json({ error: "Unauthorized" });
};
