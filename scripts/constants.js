/**
 * Module-level constants.
 * This is the single source of truth for the module id.
 * Import MODULE_ID everywhere the id is referenced — never write the string literal directly.
 */

/** @type {string} The canonical module id — mirrors the "id" field in module.json. */
export const MODULE_ID = "daggerheart-quickactions";

/**
 * Absolute path to the chat card background image shared across all module chat messages.
 * @type {string}
 */
export const CHAT_CARD_BG = `modules/${MODULE_ID}/assets/chat-messages/skull.webp`;

/**
 * Setting keys for the Biography tab visibility feature.
 * @type {Readonly<{POLICY: string, HIDE: string}>}
 */
export const BIOGRAPHY_SETTINGS = Object.freeze({
    /** World scope — GM policy that can override every user's personal choice. */
    POLICY: "biographyTabPolicy",
    /** Client scope — the user's personal choice, honored only under the USER policy. */
    HIDE: "hideBiographyTab"
});

/**
 * Accepted values of the BIOGRAPHY_SETTINGS.POLICY world setting.
 * @type {Readonly<{USER: string, VISIBLE: string, HIDDEN: string}>}
 */
export const BIOGRAPHY_POLICY = Object.freeze({
    /** Each user decides through their own client setting (default). */
    USER: "user",
    /** Tab is shown to everyone, ignoring personal settings. */
    VISIBLE: "visible",
    /** Tab is hidden from everyone, ignoring personal settings. */
    HIDDEN: "hidden"
});
