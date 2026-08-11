/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Module-level constants.
 * This is the single source of truth for the module id.
 * Import MODULE_ID everywhere the id is referenced — never write the string literal directly.
 */

/** @type {string} The canonical module id — mirrors the "id" field in module.json. */
export const MODULE_ID = "daggerheart-quickactions";

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
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.HEBUf4x3GIvjNKJd` },
    { uuid: `Compendium.${MODULE_ID}.macros.Macro.SuzCTTVwiBW1x22f` }
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

/**
 * World setting key holding the master switch for every cosmetic change this module makes to
 * the Daggerheart system's own sidebar menu — tab icon, search toolbar, section ordering,
 * collapsible sections and the two-column button grid. Turning it off leaves the system's menu
 * exactly as the system built it.
 * @type {string}
 */
export const MENU_ENHANCEMENTS_ENABLED = "menuEnhancementsEnabled";

/**
 * World setting key holding the on/off switch for the Hope bar drawn above character tokens.
 * Off leaves the canvas untouched, for worlds that render Hope through a token bar module instead.
 * @type {string}
 */
export const HOPE_BAR_ENABLED = "hopeBarEnabled";

/**
 * World setting key holding the ids of users switched off in the Downtime configuration.
 * Stored as an array of user ids — those users are skipped by the whole Downtime flow
 * (row list, state initialization and effect application) even while they are connected.
 * @type {string}
 */
export const DOWNTIME_DISABLED_USERS = "downtimeDisabledUsers";

/**
 * World setting key holding the GM-configured image for each Cinematic Roll case.
 * Stored as an object keyed by CINEMATIC_CASE_KEYS, values are image paths (or "" when unset).
 * @type {string}
 */
export const CINEMATIC_IMAGES = "cinematicImages";

/**
 * The Request Roll cases that can each have their own Cinematic Mode image: the six traits,
 * Hope, Fear, and "none" — the generic Duality Roll fallback used when no trait or special
 * roll was picked. Order matches the trait buttons in request-roll.hbs.
 * @type {Readonly<Array<string>>}
 */
export const CINEMATIC_CASE_KEYS = Object.freeze([
    "agility", "strength", "finesse", "instinct", "presence", "knowledge", "hope", "fear", "none"
]);

/**
 * Human-readable labels for CINEMATIC_CASE_KEYS, shown as row labels in the Cinematic Roll
 * Images settings menu.
 * @type {Readonly<Record<string, string>>}
 */
export const CINEMATIC_CASE_LABELS = Object.freeze({
    agility: "Agility",
    strength: "Strength",
    finesse: "Finesse",
    instinct: "Instinct",
    presence: "Presence",
    knowledge: "Knowledge",
    hope: "Hope",
    fear: "Fear",
    none: "Duality Roll (no trait)"
});

/**
 * Default value of the CINEMATIC_IMAGES setting — every case unset. Cinematic Mode stays
 * inactive until the GM assigns an image to at least one case.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_CINEMATIC_IMAGES = Object.freeze(
    Object.fromEntries(CINEMATIC_CASE_KEYS.map(key => [key, ""]))
);
