const { getSubtitlesByHash } = require("../services/opensubtitles");

async function subtitlesHandler({ id, extra }) {
    try {
        const videoHash = extra?.videoHash;

        if (!videoHash) {
            return { subtitles: [] };
        }

        const subtitles = await getSubtitlesByHash(videoHash);

        return { subtitles };

    } catch (err) {
        console.error("Subtitles error:", err.response?.data || err.message);
        return { subtitles: [] };
    }
}

module.exports = subtitlesHandler;
