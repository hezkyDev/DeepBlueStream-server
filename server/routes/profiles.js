const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

function hashPin(pin) {
    return crypto.createHash("sha256").update(String(pin)).digest("hex");
}

router.get("/", (req, res) => {
    const profiles = db
        .prepare("SELECT id, name, avatar, pin_hash FROM profiles ORDER BY id")
        .all()
        .map(profile => ({
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar,
            hasPin: Boolean(profile.pin_hash)
        }));

    res.json(profiles);
});

router.post("/", (req, res) => {
    const { name, avatar, pin } = req.body || {};

    if (!name) {
        return res.status(400).json({ error: "name is required" });
    }

    const pinHash = pin ? hashPin(pin) : null;

    const result = db
        .prepare("INSERT INTO profiles (name, avatar, pin_hash) VALUES (?, ?, ?)")
        .run(name, avatar || null, pinHash);

    res.status(201).json({
        id: result.lastInsertRowid,
        name,
        avatar: avatar || null,
        hasPin: Boolean(pinHash)
    });
});

router.post("/:id/verify-pin", (req, res) => {
    const { pin } = req.body || {};

    const profile = db
        .prepare("SELECT pin_hash FROM profiles WHERE id = ?")
        .get(req.params.id);

    if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
    }

    if (!profile.pin_hash) {
        return res.json({ ok: true });
    }

    res.json({ ok: profile.pin_hash === hashPin(pin) });
});

module.exports = router;
