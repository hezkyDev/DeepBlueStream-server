require("dotenv").config();

const {
    checkCached
} = require("./src/services/torbox");

(async () => {
    try {
        const hashes = [
            "2A931491AC8428179B91E51391A8B295EA7C8CEE",
            "5DB5411C2A72E6EBD9F48143E0B6B5B71EAD3A78"
        ];

        const result = await checkCached(hashes);

        console.log(
            JSON.stringify(result, null, 2)
        );
    } catch (err) {
        console.error(
            JSON.stringify(err.response?.data || err.message, null, 2)
        );
    }
})();