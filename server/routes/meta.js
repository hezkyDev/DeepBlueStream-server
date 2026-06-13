const express = require("express");
const metaHandler = require("../../src/handlers/metaHandler");

const router = express.Router();

router.get("/:id", async (req, res) => {
    const result = await metaHandler({ id: req.params.id });

    if (!result.meta) {
        return res.status(404).json({ error: "Not found" });
    }

    res.json(result.meta);
});

module.exports = router;
