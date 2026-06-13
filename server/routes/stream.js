const express = require("express");
const streamHandler = require("../../src/handlers/streamHandler");

const router = express.Router();

router.get("/:id", async (req, res) => {
    const result = await streamHandler({ type: "movie", id: req.params.id });
    res.json(result.streams);
});

module.exports = router;
