require("dotenv").config();

const {
    searchTorrent
} = require("./src/services/torbox");

(async () => {

    const result = await searchTorrent();

	console.log(
	    JSON.stringify(result.data[0], null, 2)
	);

})();