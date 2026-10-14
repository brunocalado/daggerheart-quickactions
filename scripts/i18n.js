// ============================================================
// Quick Actions | i18n.js
// Thin wrappers over game.i18n. Every user-facing string lives in lang/*.json under "DHQA".
// ============================================================

/**
 * Localizes a key relative to the module namespace, formatting {placeholders} when data is given.
 * @param {string} key - Key without the "DHQA." prefix (e.g. "Notify.GMOnly").
 * @param {Object} [data] - Placeholder values.
 * @returns {string}
 */
export function tr(key, data) {
    const full = `DHQA.${key}`;
    return data ? game.i18n.format(full, data) : game.i18n.localize(full);
}
