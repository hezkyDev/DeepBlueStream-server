require("dotenv").config();

const {
    buildMagnetFromHash,
    createTorrentFromMagnet,
    findTorrentByHash
} = require("./src/services/torbox");

(async () => {
    try {
        const infoHash = "2A931491AC8428179B91E51391A8B295EA7C8CEE";
        const title = "In the Grey (2026) [1080p] [WEBRip] [5.1]";

        const magnet = buildMagnetFromHash(infoHash, title);

        console.log("Creating torrent from magnet...");
        const createResult = await createTorrentFromMagnet(magnet);

        console.log("Create response:");
        console.log(JSON.stringify(createResult, null, 2));

        console.log("Waiting 3 seconds...");
        await new Promise(resolve => setTimeout(resolve, 3000));

        const torrent = await findTorrentByHash(infoHash);

        console.log("Found in mylist:");
        console.log(JSON.stringify(torrent, null, 2));

    } catch (err) {
        console.error(
            JSON.stringify(err.response?.data || err.message, null, 2)
        );
    }
})();