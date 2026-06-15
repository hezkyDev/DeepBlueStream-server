const REQUIRED_ENV_VARS = ["TMDB_API_KEY", "TORBOX_API_KEY"];
const OPTIONAL_ENV_VARS = ["PROWLARR_URL", "PROWLARR_API_KEY"];

function validateEnv() {
    const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
        process.exit(1);
    }

    const missingOptional = OPTIONAL_ENV_VARS.filter(key => !process.env[key]);

    if (missingOptional.length > 0) {
        console.warn(`Optional environment variable(s) not set, Prowlarr fallback disabled: ${missingOptional.join(", ")}`);
    }
}

module.exports = { validateEnv };
