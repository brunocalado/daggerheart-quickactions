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
