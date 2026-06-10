require("dotenv").config();

const {
    requestDownloadLink
} = require("./src/services/torbox");

(async () => {
    try {
        const result = await requestDownloadLink(38693538, 0);

        console.log(
            JSON.stringify(result, null, 2)
        );
    } catch (err) {
        console.error(
            err.response?.data || err.message
        );
    }
})();