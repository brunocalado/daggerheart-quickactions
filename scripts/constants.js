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
 * World setting key holding the macro list shown by the character sheet "Quick Actions" button.
 * Stored as an array of { uuid, name, img } snapshots — name/img are only fallbacks for
 * documents that can no longer be resolved (deleted macro, disabled compendium).
 * @type {string}
 */
export const QUICK_ACTIONS_MACROS = "quickActionsMacros";

/**
 * World setting key holding the on/off switch for the character sheet "Quick Actions" button.
 * @type {string}
 */
export const QUICK_ACTIONS_ENABLED = "quickActionsEnabled";

/**
 * Macros shipped on the Quick Actions list out of the box — all live in this module's own
 * Macros compendium. Names and images are resolved at render time from the documents themselves.
 * @type {Readonly<Array<{uuid: string}>>}
 */
export const DEFAULT_QUICK_ACTIONS_MACROS = Object.freeze([
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.K5yVyJyKhg5XGRWP` },
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.0MbYehILeRnuPP8u` },
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.SWYDWH9nXi7idHrR` },
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.MrVaunevxMfD1jiI` },
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.HEBUf4x3GIvjNKJd` }
]);

/**
 * Fallback artwork used whenever a macro has no image of its own.
 * @type {string}
 */
export const DEFAULT_MACRO_IMG = "icons/svg/dice-target.svg";

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

/**
 * Client-scope setting key holding the collapsed/expanded state of every fieldset in the
 * Daggerheart system's sidebar menu, keyed by a slug of each fieldset's legend text.
 * @type {string}
 */
export const MENU_COLLAPSED_SECTIONS = "menuCollapsedSections";
