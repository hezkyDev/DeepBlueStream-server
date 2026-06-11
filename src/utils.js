function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[._\-()[\]{}:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function mapLimit(items, limit, mapper) {
    const results = [];
    let index = 0;

    async function worker() {
        while (index < items.length) {
            const currentIndex = index++;
            results[currentIndex] = await mapper(items[currentIndex]);
        }
    }

    const workers = Array.from(
        { length: Math.min(limit, items.length) },
        () => worker()
    );

    await Promise.all(workers);

    return results;
}

module.exports = {
    normalizeText,
    sleep,
    mapLimit
};
