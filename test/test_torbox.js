require("dotenv").config();

const { testConnection } = require("./src/services/torbox");

(async () => {

    try {

        const result = await testConnection();

        console.log(result);

    } catch (err) {

        console.error(err.response?.data || err.message);

    }

})();