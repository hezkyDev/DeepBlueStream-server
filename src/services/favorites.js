const fs = require("fs");
const path = require("path");

const FAVORITES_FILE = path.join(__dirname, "..", "data", "favorites.json");

function loadFavorites() {
    try {
        const raw = fs.readFileSync(FAVORITES_FILE, "utf-8");
        return JSON.parse(raw);
    } catch (err) {
        return [];
    }
}

function saveFavorites(favorites) {
    fs.mkdirSync(path.dirname(FAVORITES_FILE), { recursive: true });
    fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
}

function getFavorites() {
    return loadFavorites();
}

function getFavoritesByType(type) {
    return loadFavorites().filter(favorite => favorite.type === type);
}

function findFavoriteByTmdbId(type, tmdbId) {
    return loadFavorites().find(
        favorite => favorite.type === type && String(favorite.tmdbId) === String(tmdbId)
    );
}

function addFavorite(favorite) {
    const favorites = loadFavorites();

    if (!favorites.some(item => item.type === favorite.type && String(item.tmdbId) === String(favorite.tmdbId))) {
        favorites.push(favorite);
        saveFavorites(favorites);
    }

    return favorites;
}

function removeFavorite(type, tmdbId) {
    const favorites = loadFavorites().filter(
        favorite => !(favorite.type === type && String(favorite.tmdbId) === String(tmdbId))
    );

    saveFavorites(favorites);

    return favorites;
}

module.exports = {
    getFavorites,
    getFavoritesByType,
    findFavoriteByTmdbId,
    addFavorite,
    removeFavorite
};
