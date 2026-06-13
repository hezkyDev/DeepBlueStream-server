function requireProfile(req, res, next) {
    const profileId = Number(req.header("X-Profile-Id"));

    if (!profileId || Number.isNaN(profileId)) {
        return res.status(400).json({ error: "Missing or invalid X-Profile-Id header" });
    }

    req.profileId = profileId;
    next();
}

module.exports = { requireProfile };
