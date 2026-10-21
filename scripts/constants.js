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
 * Labels for the LOOT_CONSUMABLE_SOURCE choices, as translation keys, shown in the dropdown of the
 * "Loot & Consumables Configuration" settings menu.
 * @type {Readonly<Record<string, string>>}
 */
export const LOOT_SOURCE_LABELS = Object.freeze({
    [LOOT_SOURCE.CORE]: "DH_QUICKACTIONS.LOOT.source.core",
    [LOOT_SOURCE.HOPE_AND_FEAR]: "DH_QUICKACTIONS.LOOT.source.hopeAndFear",
    [LOOT_SOURCE.BOTH]: "DH_QUICKACTIONS.LOOT.source.both"
});

/**
 * World setting key holding the GM's list of custom roll tables for the Custom Tables roller.
 * Stored as an array of { uuid, label } snapshots — the label is captured when the table is
 * dropped so a queued entry still reads correctly after the table is renamed or removed.
 * Deliberately separate from LOOT_CONSUMABLE_SOURCE: the SRD roller reads a rarity-ordered
 * index, this one lets each table roll its own formula.
 * @type {string}
 */
export const CUSTOM_TABLES = "customTables";

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
 * World setting key holding the on/off switch for the stat tooltip shown when hovering character
 * tokens.
 * @type {string}
 */
export const TOKEN_TOOLTIP_ENABLED = "tokenTooltip";

/**
 * World setting key holding the on/off switch for the Hope bar drawn above character tokens.
 * Off leaves the canvas untouched, for worlds that render Hope through a token bar module instead.
 * @type {string}
 */
export const HOPE_BAR_ENABLED = "hopeBarEnabled";

/**
 * World setting key holding the on/off switch for the chat card that records items and currency moved
 * between a character and a party stash by dragging.
 * @type {string}
 */
export const TRANSFER_LOG_ENABLED = "transferLogEnabled";

/**
 * World setting key holding the ids of users switched off in the Downtime configuration.
 * Stored as an array of user ids — those users are skipped by the whole Downtime flow
 * (row list, state initialization and effect application) even while they are connected.
 * @type {string}
 */
export const DOWNTIME_DISABLED_USERS = "downtimeDisabledUsers";

/**
 * The Daggerheart system's "Unleash Chaos" domain card. The recharge finds the actor's copy by
 * this origin rather than by its English name, so renamed or translated copies still resolve.
 * @type {string}
 */
export const UNLEASH_CHAOS_UUID = "Compendium.daggerheart.domains.Item.o62i0QdbUDIiAhSq";

/**
 * The Daggerheart system's "Chain Lightning" domain card, used to recognise its Spellcast Roll
 * whatever the owned copy is called.
 * @type {string}
 */
export const CHAIN_LIGHTNING_UUID = "Compendium.daggerheart.domains.Item.0kAVO6rordCfZqYP";

/**
 * Default Scan chat card titles, as translation keys. The `scanHpTitle` / `scanStressTitle`
 * settings default to "" and fall back to these when read, because settings register in `init`,
 * before translations load: localizing a default there would store the raw key. Resolving on read
 * also keeps the default following each client's language until a GM types their own text.
 * @type {Readonly<{hp: string, stress: string}>}
 */
export const SCAN_DEFAULT_TITLES = Object.freeze({
    hp: "DH_QUICKACTIONS.SCAN.hpTitle",
    stress: "DH_QUICKACTIONS.SCAN.stressTitle"
});

/**
 * Default Scan descriptors per track, keyed by minimum remaining percentage, as translation keys.
 * The thresholds are fixed; a GM's text in `scanHpLabels` / `scanStressLabels` overrides the
 * entry with the same `min`, and an empty entry falls back to the key.
 * @type {Readonly<{hp: ReadonlyArray<{min: number, label: string}>, stress: ReadonlyArray<{min: number, label: string}>}>}
 */
export const SCAN_DEFAULT_LABELS = Object.freeze({
    hp: Object.freeze([
        { min: 100, label: "DH_QUICKACTIONS.SCAN.labels.hp.imposing" },
        { min: 75,  label: "DH_QUICKACTIONS.SCAN.labels.hp.weathered" },
        { min: 50,  label: "DH_QUICKACTIONS.SCAN.labels.hp.battered" },
        { min: 25,  label: "DH_QUICKACTIONS.SCAN.labels.hp.broken" },
        { min: 0,   label: "DH_QUICKACTIONS.SCAN.labels.hp.fallen" }
    ]),
    stress: Object.freeze([
        { min: 100, label: "DH_QUICKACTIONS.SCAN.labels.stress.unshakeable" },
        { min: 70,  label: "DH_QUICKACTIONS.SCAN.labels.stress.guarded" },
        { min: 50,  label: "DH_QUICKACTIONS.SCAN.labels.stress.rattled" },
        { min: 25,  label: "DH_QUICKACTIONS.SCAN.labels.stress.overwhelmed" },
        { min: 0,   label: "DH_QUICKACTIONS.SCAN.labels.stress.shattered" }
    ])
});

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
 * Labels for CINEMATIC_CASE_KEYS, as translation keys, shown as row labels in the Cinematic Roll
 * Images settings menu. Traits, Hope and Fear reuse the Daggerheart system's own keys so they
 * read exactly as the system words them in the player's language.
 * @type {Readonly<Record<string, string>>}
 */
export const CINEMATIC_CASE_LABELS = Object.freeze({
    agility: "DAGGERHEART.CONFIG.Traits.agility.name",
    strength: "DAGGERHEART.CONFIG.Traits.strength.name",
    finesse: "DAGGERHEART.CONFIG.Traits.finesse.name",
    instinct: "DAGGERHEART.CONFIG.Traits.instinct.name",
    presence: "DAGGERHEART.CONFIG.Traits.presence.name",
    knowledge: "DAGGERHEART.CONFIG.Traits.knowledge.name",
    hope: "DAGGERHEART.GENERAL.hope",
    fear: "DAGGERHEART.GENERAL.fear",
    none: "DH_QUICKACTIONS.CINEMATIC.noTrait"
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
