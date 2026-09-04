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
 * World setting key choosing which Daggerheart roll tables the Loot & Consumables roller
 * draws from. Value is one of LOOT_SOURCE; edited through the "Loot & Consumables
 * Configuration" settings menu rather than as a standalone dropdown.
 * @type {string}
 */
export const LOOT_CONSUMABLE_SOURCE = "lootConsumableSource";

/**
 * Accepted values of the LOOT_CONSUMABLE_SOURCE setting.
 * BOTH concatenates the Core Set table (positions 1..N) ahead of the Hope & Fear table
 * (positions N+1..N+M) into one ordered pool, so higher dice totals reach the newer book.
 * @type {Readonly<{CORE: string, HOPE_AND_FEAR: string, BOTH: string}>}
 */
export const LOOT_SOURCE = Object.freeze({
    CORE: "core",
    HOPE_AND_FEAR: "hopeAndFear",
    BOTH: "both"
});

/**
 * The Daggerheart system's loot/consumable roll tables, keyed by the roller's own type value
 * ("Loot" / "Consumable") and then by LOOT_SOURCE key. Looked up with fromUuid() at roll time
 * so a system rename of the tables can no longer break the roller (the ids are stable, the
 * names are not — v2.9.2 renamed "Loot" -> "Core Set Items" and "Consumables" -> "Core Set
 * Consumables" and added the two Hope & Fear tables).
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const LOOT_CONSUMABLE_TABLES = Object.freeze({
    Loot: Object.freeze({
        core: "Compendium.daggerheart.rolltables.RollTable.S61Shlt2I5CbLRjz",
        hopeAndFear: "Compendium.daggerheart.rolltables.RollTable.SEFcv9kGssQ5KbP8"
    }),
    Consumable: Object.freeze({
        core: "Compendium.daggerheart.rolltables.RollTable.tF04P02yVN1YDVel",
        hopeAndFear: "Compendium.daggerheart.rolltables.RollTable.4SaO1I5qsUOoDGrE"
    })
});

/**
 * Human-readable labels for the LOOT_CONSUMABLE_SOURCE choices, shown in the dropdown of the
 * "Loot & Consumables Configuration" settings menu.
 * @type {Readonly<Record<string, string>>}
 */
export const LOOT_SOURCE_LABELS = Object.freeze({
    [LOOT_SOURCE.CORE]: "Core Set only",
    [LOOT_SOURCE.HOPE_AND_FEAR]: "Hope & Fear only",
    [LOOT_SOURCE.BOTH]: "Core Set + Hope & Fear"
});

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
 * Default value of the CINEMATIC_IMAGES setting: one core Foundry icon per case, so Cinematic
 * Mode works out of the box instead of staying inert until the GM configures something.
 *
 * These are all `icons/…` paths that ship with Foundry itself — nothing is bundled with this
 * module, which is why the AI-generated artwork removed in 0.6.4 was not simply restored. The GM
 * can still point any case at their own artwork, blank a case to fall back to a plain chat
 * message, or restore this map from the settings menu.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_CINEMATIC_IMAGES = Object.freeze({
    /** Sprint, Leap, Maneuver — winged feet. */
    agility: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
    /** Lift, Smash, Grapple — a stone fist. */
    strength: "icons/magic/earth/strike-fist-stone.webp",
    /** Control, Hide, Tinker — a precision tool. */
    finesse: "icons/tools/hand/lockpicks-steel-grey.webp",
    /** Perceive, Sense, Navigate — the third eye. */
    instinct: "icons/magic/perception/third-eye-blue-red.webp",
    /** Charm, Perform, Deceive — a figure projecting their voice. */
    presence: "icons/skills/trades/music-singing-voice-blue.webp",
    /** Recall, Analyze, Comprehend — a book of runes. */
    knowledge: "icons/skills/trades/academics-book-study-runes.webp",
    /** Hope — a radiant golden burst, matching the resource's colour. */
    hope: "icons/magic/light/explosion-star-glow-yellow.webp",
    /** Fear — a burning purple skull, matching the resource's colour. */
    fear: "icons/magic/death/projectile-skull-fire-purple.webp",
    /** The generic Duality Roll — a glowing two-halves symbol, one light and one dark. */
    none: "icons/commodities/currency/coin-yingyang.webp"
});
