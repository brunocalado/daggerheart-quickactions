/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Downtime UI App and related helpers.
 * Contains the full Downtime UI system (DowntimeUIApp, helpers, and exported activation functions).
 */

import { rollD4WithDiceSoNice } from "./apps.js";
import { MODULE_ID, DOWNTIME_DISABLED_USERS } from "./constants.js";
import { findSourcedItem } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const DEFAULT_CRAFT_ENTRIES = [
    { recipeUuid: "Compendium.daggerheart.loot.Item.PQxvxAVBbkt0TleC", craftUuid: "Compendium.daggerheart.consumables.Item.tPfKtKRRjv8qdSqy" },
    { recipeUuid: "Compendium.daggerheart.loot.Item.1TLpFsp3PLDsqoTw", craftUuid: "Compendium.daggerheart.consumables.Item.b6vGSPFWOlzZZDLO" },
    { recipeUuid: "Compendium.daggerheart.loot.Item.5YZls8XH3MB7twNa", craftUuid: "Compendium.daggerheart.consumables.Item.Zsh2AvZr8EkGtLyw" },
    { recipeUuid: "Compendium.daggerheart.loot.Item.MhCo8i0cRXzdnXbA", craftUuid: "Compendium.daggerheart.consumables.Item.Nwv5ydGf0MWnzq1n" }
];

const ALLOWED_CRAFT_TYPES = ["loot", "consumable", "weapon", "armor"];

const DEFAULT_ITEM_MOVE_ENTRIES = [
    { itemUuid: "Compendium.daggerheart.subclasses.Item.5bmB1YcxiJVNVXDM" },
    { itemUuid: "Compendium.daggerheart.subclasses.Item.TIUsIlTS1WkK5vr2" }
];

// `label` and `effect` are translation keys, resolved by whichever client renders them.
const FORAGER_OPTIONS = [
    { value: 1, label: "DH_QUICKACTIONS.DOWNTIME.forager.food.label", effect: "DH_QUICKACTIONS.DOWNTIME.forager.food.effect", itemUuid: `Compendium.${MODULE_ID}.items.Item.1tnzi64VuC8kTQKn` },
    { value: 2, label: "DH_QUICKACTIONS.DOWNTIME.forager.relic.label", effect: "DH_QUICKACTIONS.DOWNTIME.forager.relic.effect", itemUuid: `Compendium.${MODULE_ID}.items.Item.q1VJh3YHE1peFgpP` },
    { value: 3, label: "DH_QUICKACTIONS.DOWNTIME.forager.rune.label", effect: "DH_QUICKACTIONS.DOWNTIME.forager.rune.effect", itemUuid: `Compendium.${MODULE_ID}.items.Item.vPGhnT1C84fwNiYf` },
    { value: 4, label: "DH_QUICKACTIONS.DOWNTIME.forager.vial.label", effect: "DH_QUICKACTIONS.DOWNTIME.forager.vial.effect", itemUuid: `Compendium.${MODULE_ID}.items.Item.C1lOuQ5TGYVCIOqB` },
    { value: 5, label: "DH_QUICKACTIONS.DOWNTIME.forager.charm.label", effect: "DH_QUICKACTIONS.DOWNTIME.forager.charm.effect", itemUuid: `Compendium.${MODULE_ID}.items.Item.Fm6XzoBkT7G4a9La` }
];

/**
 * Moves whose outcome has no short/long rest distinction, so the Efficient / Recovery badges —
 * which upgrade one chosen move to long rest quality — have nothing to act on and are not offered.
 * @type {Set<string>}
 */
const NO_UPGRADE_MOVES = new Set([
    "prepare",
    "core_favor",
    "core_changeShape",
    "core_onlySkinDeep"
]);

/**
 * Moves that are granted on top of the actor's normal allowance, so they never count towards the
 * move limit shown on their row.
 * @type {Set<string>}
 */
const BONUS_MOVES = new Set(["core_forager", "core_pipeweed"]);

/**
 * Translation keys of the built-in moves' names, by move key. The rest moves reuse the system's
 * own strings; the feature-granted moves are this module's.
 * @type {Readonly<Record<string, string>>}
 */
const MOVE_LABELS = Object.freeze({
    tendWounds: "DAGGERHEART.APPLICATIONS.Downtime.shortRest.tendToWounds.name",
    clearStress: "DAGGERHEART.APPLICATIONS.Downtime.shortRest.clearStress.name",
    repairArmor: "DAGGERHEART.APPLICATIONS.Downtime.shortRest.repairArmor.name",
    prepare: "DAGGERHEART.APPLICATIONS.Downtime.shortRest.prepare.name",
    workOnProject: "DAGGERHEART.APPLICATIONS.Downtime.longRest.workOnAProject.name",
    core_favor: "DH_QUICKACTIONS.DOWNTIME.moves.showTribute",
    core_changeShape: "DH_QUICKACTIONS.DOWNTIME.moves.changeShape",
    core_onlySkinDeep: "DH_QUICKACTIONS.DOWNTIME.moves.onlySkinDeep",
    core_forager: "DH_QUICKACTIONS.DOWNTIME.moves.forage",
    core_pipeweed: "DH_QUICKACTIONS.DOWNTIME.moves.smokePipeweed"
});

/**
 * The stock item behind each core downtime feature, with the translation keys of the label and
 * help text shown in the Downtime configuration's Core tab. The GM can point any key at another
 * item there; the saved `downtimeCoreFeatures` entry then overrides `itemUuid`. Detection goes by
 * UUID, never by label.
 * @type {Array<{key: string, label: string, itemUuid: string, description: string}>}
 */
const DEFAULT_CORE_FEATURES = [
    { key: "efficient", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.efficient.name", itemUuid: "Compendium.daggerheart.ancestries.Item.2xlqKOkDxWHbuj4t", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.efficient.description" },
    { key: "forager", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.forager.name", itemUuid: "Compendium.daggerheart.domains.Item.06UapZuaA5S6fAKl", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.forager.description" },
    { key: "premiumBedroll", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.premiumBedroll.name", itemUuid: "Compendium.daggerheart.loot.Item.QGYPNBIufpBguwjC", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.premiumBedroll.description" },
    { key: "celestialTrance", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.celestialTrance.name", itemUuid: "Compendium.daggerheart.ancestries.Item.TfolXWFG2W2hx6sK", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.celestialTrance.description" },
    { key: "eloquent", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.eloquent.name", itemUuid: "Compendium.daggerheart.subclasses.Item.5bmB1YcxiJVNVXDM", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.eloquent.description" },
    { key: "soothingSpeech", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.soothingSpeech.name", itemUuid: "Compendium.daggerheart.domains.Item.QED2PDYePOSTbLtC", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.soothingSpeech.description" },
    { key: "armorer", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.armorer.name", itemUuid: "Compendium.daggerheart.domains.Item.cy8GjBPGc9w9RaGO", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.armorer.description" },
    { key: "beastbound", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.beastbound.name", itemUuid: "Compendium.daggerheart.subclasses.Item.TIUsIlTS1WkK5vr2", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.beastbound.description" },
    { key: "recovery", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.recovery.name", itemUuid: "Compendium.daggerheart.domains.Item.gsiQFT6q3WOgqerJ", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.recovery.description" },
    { key: "favor", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.favor.name", itemUuid: "Compendium.daggerheart.classes.Item.OGPn7DUJoJwAXh8o", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.favor.description" },
    { key: "changeShape", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.changeShape.name", itemUuid: "Compendium.daggerheart.transformations.Item.P1sdtkECFSdLz02W", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.changeShape.description" },
    { key: "onlySkinDeep", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.onlySkinDeep.name", itemUuid: "Compendium.daggerheart.transformations.Item.qXA130mgMnvPZfNF", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.onlySkinDeep.description" },
    { key: "oasis", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.oasis.name", itemUuid: "Compendium.daggerheart.communities.Item.DOrvaVrES1HYhG2u", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.oasis.description" },
    { key: "timekeepersPendant", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.timekeepersPendant.name", itemUuid: "Compendium.daggerheart.loot.Item.4qUp8YWnsgi7ws8Q", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.timekeepersPendant.description" },
    { key: "pipeweed", label: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.pipeweed.name", itemUuid: "Compendium.daggerheart.consumables.Item.eBQAxdk4y85I7xQe", description: "DH_QUICKACTIONS.DOWNTIME.coreFeatures.pipeweed.description" }
];

/**
 * Moves that resolve by rolling a die during a short rest, which is what Duneborne's Oasis
 * ("reroll a die used for a downtime move and take the higher result") can act on. On a long rest
 * these same moves resolve at full effect without rolling, so Oasis is never offered there.
 * @type {Set<string>}
 */
const ROLLING_MOVES = new Set(["tendWounds", "clearStress", "repairArmor", "core_forager"]);

/**
 * Key the Daggerheart system uses for the Self-Healing armour feature, in an armour item's
 * `system.armorFeatures` list.
 * @type {string}
 */
const SELF_HEALING_ARMOR_FEATURE = "selfHealing";

// ==================================================================
// DOWNTIME UI HELPERS
// ==================================================================

/**
 * Whether a user has been switched off in the Downtime configuration ("Users" tab).
 * Disabled users are skipped by the whole flow — row list, state initialization and
 * effect application — so they never take part even while connected.
 * @param {User|null|undefined} user - The user to test.
 * @returns {boolean} True when the user must be ignored by the Downtime system.
 */
function _isDowntimeDisabledUser(user) {
    if (!user) return false;
    const disabled = game.settings.get(MODULE_ID, DOWNTIME_DISABLED_USERS) ?? [];
    return disabled.includes(user.id);
}

function _getActorTier(actor) {
    const level = actor.system?.levelData?.level?.current ?? 1;
    if (level >= 8) return 4;
    if (level >= 5) return 3;
    if (level >= 2) return 2;
    return 1;
}

/**
 * Canonical empty downtime choices record (instance-based model).
 * @returns {object} A fresh choices object with no selections.
 */
function _emptyDowntimeChoices() {
    return {
        actions: [],
        efficientSlot: null,
        recoverySlot: null,
        recoveryGrantedSlot: null,
        oasisSlot: null,
        oasisGrantedSlot: null,
        foragerChoice: null,
        eloquentBeneficiary: null,
        recoveryBeneficiary: null,
        oasisBeneficiary: null
    };
}

/**
 * Normalizes a raw `downtimeChoices` flag into the instance-based model.
 * Each selected move is one `{ id, key, target }` instance, so the same move can
 * appear multiple times. Migrates the legacy shape — `actions` as an array of
 * move-key strings with a parallel `targets` map and slot fields referencing move
 * keys — by wrapping each key as an instance and remapping every slot key to the
 * id of the first instance carrying that key.
 * @param {object|null|undefined} raw - The stored flag value.
 * @returns {object} A choices object in the current instance-based shape.
 */
function _normalizeChoices(raw) {
    const base = _emptyDowntimeChoices();
    if (!raw || !Array.isArray(raw.actions)) return base;

    // New shape has no `targets` map and stores action instances as objects.
    const isLegacy = raw.targets !== undefined || raw.actions.some(a => typeof a === "string");
    if (!isLegacy) {
        return {
            ...base,
            ...raw,
            actions: raw.actions.map(a => ({
                id: a.id ?? foundry.utils.randomID(),
                key: a.key,
                target: a.target ?? null
            }))
        };
    }

    const legacyTargets = raw.targets ?? {};
    const actions = raw.actions
        .filter(k => typeof k === "string")
        .map(k => ({ id: foundry.utils.randomID(), key: k, target: legacyTargets[k] ?? null }));
    const idForKey = (key) => (key == null ? null : (actions.find(i => i.key === key)?.id ?? null));

    return {
        actions,
        efficientSlot: idForKey(raw.efficientSlot),
        recoverySlot: idForKey(raw.recoverySlot),
        recoveryGrantedSlot: idForKey(raw.recoveryGrantedSlot),
        oasisSlot: idForKey(raw.oasisSlot),
        oasisGrantedSlot: idForKey(raw.oasisGrantedSlot),
        foragerChoice: raw.foragerChoice ?? null,
        eloquentBeneficiary: raw.eloquentBeneficiary ?? null,
        recoveryBeneficiary: raw.recoveryBeneficiary ?? null,
        oasisBeneficiary: raw.oasisBeneficiary ?? null
    };
}

/**
 * Reads and normalizes a user's downtime choices.
 * @param {User} user - The user whose choices to read.
 * @returns {object} Instance-based choices (empty record when unset).
 */
function _readDowntimeChoices(user) {
    return _normalizeChoices(user?.getFlag(MODULE_ID, "downtimeChoices"));
}

async function _reduceArmorMarks(actor, reduction) {
    if (reduction <= 0) return;
    await actor.system.updateArmorValue({ value: -reduction });
}

async function _clearAllArmorMarks(actor) {
    await actor.system.updateArmorValue({ clear: true });
}

/**
 * Gets the maximum Hope from the actor's derived data.
 */
function _getMaxHope(actor) {
    // Accesses derived data directly.
    // Ensures compatibility with Active Effects, Scars, and system settings.
    return actor.system.resources.hope.max ?? 0;
}

/**
 * The item a core feature is currently identified by. The GM can point a core feature at another
 * item (homebrew, a world copy) in the Downtime configuration's Core tab; otherwise, or when the
 * slot was emptied there, the stock compendium item applies. Only the UUID is used — a `label`
 * saved by older versions held English text and is ignored.
 * @param {string} featureKey - Core feature key, e.g. "pipeweed".
 * @returns {string|undefined} The UUID of the item to look for on the sheet.
 */
function _coreFeatureUuid(featureKey) {
    const coreFeatures = game.settings.get(MODULE_ID, "downtimeCoreFeatures") ?? [];
    return coreFeatures.find(f => f.key === featureKey)?.itemUuid
        || DEFAULT_CORE_FEATURES.find(f => f.key === featureKey)?.itemUuid;
}

function _hasCoreFeature(actor, featureKey) {
    return !!findSourcedItem(actor, _coreFeatureUuid(featureKey));
}

function _hasEfficientFeature(actor) {
    return _hasCoreFeature(actor, "efficient");
}

function _hasRecoveryFeature(actor) {
    return _hasCoreFeature(actor, "recovery");
}

function _hasForagerFeature(actor) {
    return _hasCoreFeature(actor, "forager");
}

function _hasPremiumBedrollFeature(actor) {
    return _hasCoreFeature(actor, "premiumBedroll");
}

function _hasCelestialTranceFeature(actor) {
    return _hasCoreFeature(actor, "celestialTrance");
}

function _hasEloquentFeature(actor) {
    return _hasCoreFeature(actor, "eloquent");
}

function _hasSoothingSpeechFeature(actor) {
    return _hasCoreFeature(actor, "soothingSpeech");
}

function _hasArmorerFeature(actor) {
    return _hasCoreFeature(actor, "armorer");
}

function _hasBeastboundFeature(actor) {
    return _hasCoreFeature(actor, "beastbound");
}

function _hasFavorFeature(actor) {
    return _hasCoreFeature(actor, "favor");
}

/**
 * Whether the actor is wearing armour with the Self-Healing feature ("When you take a rest, clear
 * an Armor Slot"). The system models this as an entry in the armour's own `system.armorFeatures`
 * rather than as a separate item, so matching the feature covers the Trollhide Cuirass and any
 * homebrew armour carrying it — a name match would only ever catch the one. Unworn armour does
 * nothing, hence the `equipped` check.
 * @param {Actor} actor - The actor to test.
 * @returns {boolean} True when equipped armour grants Self-Healing.
 */
function _hasSelfHealingArmor(actor) {
    return actor.items.some(item =>
        item.type === "armor"
        && item.system?.equipped
        && (item.system?.armorFeatures ?? []).some(f => f?.value === SELF_HEALING_ARMOR_FEATURE));
}

function _hasChangeShapeFeature(actor) {
    return _hasCoreFeature(actor, "changeShape");
}

function _hasOnlySkinDeepFeature(actor) {
    return _hasCoreFeature(actor, "onlySkinDeep");
}

function _hasOasisFeature(actor) {
    return _hasCoreFeature(actor, "oasis");
}

function _hasTimekeepersPendant(actor) {
    return _hasCoreFeature(actor, "timekeepersPendant");
}

function _hasPipeweed(actor) {
    return _hasCoreFeature(actor, "pipeweed");
}

/**
 * Rolls one downtime die, optionally applying Duneborne's Oasis reroll.
 * Both dice are shown through Dice So Nice so the table sees the reroll happen.
 * @param {string} formula - Dice formula to evaluate (e.g. "1d4").
 * @param {boolean} useOasis - Whether this instance holds the Oasis reroll.
 * @returns {Promise<{total: number, text: string}>} The kept total and how to render it.
 */
async function _rollDowntimeDie(formula, useOasis) {
    const roll = new Roll(formula);
    await roll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
    if (!useOasis) return { total: roll.total, text: `${roll.total}` };

    const reroll = new Roll(formula);
    await reroll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(reroll, game.user, true);
    const best = Math.max(roll.total, reroll.total);
    return {
        total: best,
        text: game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.oasisRoll", { first: roll.total, second: reroll.total, best })
    };
}

/**
 * Spends one unit of a quantity-carrying item, deleting it once the last one is used.
 * @param {Actor} actor - Owner of the item.
 * @param {Item} item - The item to consume.
 * @returns {Promise<void>}
 */
async function _consumeOne(actor, item) {
    const quantity = item.system?.quantity ?? 1;
    if (quantity > 1) await item.update({ "system.quantity": quantity - 1 });
    else await actor.deleteEmbeddedDocuments("Item", [item.id]);
}

async function _getBeastboundCompanion(actor) {
    // system.companion is already the companion actor object (or null)
    const companion = actor.system?.companion;
    if (!companion) return null;

    // Verify it's a valid companion type
    return companion.type === "companion" ? companion : null;
}

function _getDomainCardCounts(actor) {
    const domainCards = actor.items.filter(i => i.type === "domainCard");
    let loadout = 0;
    let vault = 0;
    for (const card of domainCards) {
        if (card.system?.inVault === true) {
            vault++;
        } else {
            loadout++;
        }
    }
    return { loadout, vault };
}

function _getRefreshableFeatures(actor, restType, forceEffectiveLong = false) {
    const isLong = restType === "long" || forceEffectiveLong;
    const results = [];
    for (const item of actor.items) {
        // Check system.actions (Map or object) for action-level uses
        const actions = item.system?.actions;
        if (actions && typeof actions === "object") {
            const entries = actions instanceof Map ? actions.entries() : Object.entries(actions);
            for (const [actionId, action] of entries) {
                const uses = action.uses;
                if (!uses || !uses.recovery) continue;
                if (uses.recovery === "shortRest") {
                    results.push({ type: "action", itemName: item.name, actionId, item, uses });
                } else if (uses.recovery === "longRest" && isLong) {
                    results.push({ type: "action", itemName: item.name, actionId, item, uses });
                }
            }
        }

        // Check system.resource for item-level resource
        const res = item.system?.resource;
        if (res?.type === "simple" && res.recovery) {
            const matches = res.recovery === "shortRest" || (res.recovery === "longRest" && isLong);
            if (matches) {
                results.push({ type: "resource", itemName: item.name, item, resource: res });
            }
        }
    }
    return results;
}

async function _applyDowntimeEffects() {
    const state = game.settings.get(MODULE_ID, "downtimeUIState");
    if (!state?.actors) return;

    const restType = state.restType || "short";
    const isLong = restType === "long";

    // Gather included actors and merge player choices from user flags
    const includedActors = [];
    for (const [actorId, gmState] of Object.entries(state.actors)) {
        if (!gmState.included) continue;
        const actor = game.actors.get(actorId);
        if (!actor) continue;
        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        // Guards against a user switched off after the state was built.
        if (_isDowntimeDisabledUser(ownerUser)) continue;
        const playerChoices = _readDowntimeChoices(ownerUser);
        includedActors.push({ actor, actorState: { ...gmState, ...playerChoices } });
    }

    if (includedActors.length === 0) {
        ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.noActors"));
        return;
    }

    // GM Fear roll
    const fearRoll = await rollD4WithDiceSoNice();
    if (fearRoll === null) return;

    let addedFear = fearRoll;
    let calculationText = game.i18n.localize("DH_QUICKACTIONS.REST.calcShort", { roll: fearRoll });
    if (isLong) {
        addedFear += includedActors.length;
        calculationText = game.i18n.localize("DH_QUICKACTIONS.REST.calcLong", { roll: fearRoll, pcs: includedActors.length });
    }
    const currentFear = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
    const newFear = Math.min(currentFear + addedFear, 12);
    await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, newFear);

    // Prepare bonus calculation
    const preparers = includedActors.filter(a => a.actorState.actions.some(i => i.key === "prepare"));
    const prepareBonus = preparers.length >= 2 ? 2 : 1;

    // Pipeweed is party-wide — "Any other PCs who chose the Clear Stress downtime move also gain
    // this benefit" — so it has to be totalled before anyone's Clear Stress is resolved, the same
    // way the Prepare pairing bonus is. Each leaf smoked contributes its own +1, so two smokers
    // clear two extra Stress for everyone on Clear Stress. Short rest only.
    const pipeweedSmokers = isLong
        ? []
        : includedActors.filter(a => a.actorState.actions.some(i => i.key === "core_pipeweed"));
    const pipeweedBonus = pipeweedSmokers.length;

    // Per-actor effects
    const resultsByActor = new Map();

    for (const { actor, actorState } of includedActors) {
        if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
        const actorEvents = resultsByActor.get(actor.id).events;
        const tier = _getActorTier(actor);

        // Read per-actor modifiers from GM state
        const gmActorState = state.actors?.[actor.id] ?? {};
        const hpModifier = gmActorState.hpModifier ?? 0;
        const stressModifier = gmActorState.stressModifier ?? 0;
        const hopeModifier = gmActorState.hopeModifier ?? 0;
        const armorSlotModifier = gmActorState.armorSlotModifier ?? 0;

        // Efficient feature: one action can use long rest behavior during short rest
        const hasEfficient = _hasEfficientFeature(actor);
        const efficientSlot = actorState.efficientSlot ?? null;

        // Recovery feature: like Efficient but independent; also enables ally grant via Hope
        const hasRecovery = _hasRecoveryFeature(actor);
        const recoverySlot = actorState.recoverySlot ?? null;

        // Determine if this actor received a Recovery grant from another included actor
        const recoveryGrantor = includedActors.find(a =>
            a.actor.id !== actor.id &&
            _hasRecoveryFeature(a.actor) &&
            a.actorState.recoveryBeneficiary === actor.id
        );
        const recoveryGrantedSlot = actorState.recoveryGrantedSlot ?? null;
        // Validate the grantor still has enough Hope at execution time
        const grantorCurrentHope = recoveryGrantor
            ? (recoveryGrantor.actor.system.resources?.hope?.value ?? 0)
            : 0;

        // Oasis (Duneborne): one reroll per short rest, kept for yourself or handed to an ally.
        // Unlike Recovery there is no Hope cost, so a granted reroll needs no execution-time check.
        const hasOasis = _hasOasisFeature(actor);
        const oasisSlot = actorState.oasisSlot ?? null;
        const oasisGranted = includedActors.some(a =>
            a.actor.id !== actor.id &&
            _hasOasisFeature(a.actor) &&
            a.actorState.oasisBeneficiary === actor.id
        );
        const oasisGrantedSlot = actorState.oasisGrantedSlot ?? null;

        for (const instance of actorState.actions) {
            // Keep `action` = the move key so every branch below (tendWounds, custom_, …) is unchanged.
            const action = instance.key;
            const targetActor = instance.target ? (game.actors.get(instance.target) ?? actor) : actor;
            const isSelf = targetActor.id === actor.id;
            // Slots reference an instance id, so an upgrade applies to exactly one repeat.
            const effectiveLong = isLong
                || (hasEfficient && instance.id === efficientSlot)
                || (hasRecovery && instance.id === recoverySlot)
                || (recoveryGrantedSlot !== null && instance.id === recoveryGrantedSlot && grantorCurrentHope >= 1);
            // The Oasis reroll only has a die to act on while the move still rolls one, so an
            // instance upgraded to long-rest quality quietly gives it up.
            const useOasis = !effectiveLong && (
                (hasOasis && instance.id === oasisSlot)
                || (oasisGranted && instance.id === oasisGrantedSlot)
            );

            if (action === "tendWounds") {
                // Read the target actor's modifier (when healing others, use target's modifier)
                const targetHpMod = isSelf ? hpModifier : (state.actors?.[targetActor.id]?.hpModifier ?? 0);
                // Soothing Speech: +1 HP on target when tending another character
                const hasSoothing = _hasSoothingSpeechFeature(actor);
                const soothingBonus = (hasSoothing && !isSelf) ? 1 : 0;
                const move = game.i18n.localize(MOVE_LABELS.tendWounds);
                const name = foundry.utils.escapeHTML(targetActor.name);
                if (effectiveLong) {
                    await targetActor.update({ "system.resources.hitPoints.value": 0 });
                    actorEvents.push(isSelf
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.tendWoundsAll", { move })
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.tendWoundsAllAlly", { move, name }));
                } else {
                    const roll = await _rollDowntimeDie("1d4", useOasis);
                    const recovery = roll.total + tier + targetHpMod + soothingBonus;
                    const currentHP = targetActor.system.resources?.hitPoints?.value ?? 0;
                    const newHP = Math.max(0, currentHP - recovery);
                    await targetActor.update({ "system.resources.hitPoints.value": newHP });
                    // The roll breakdown is a sum rather than a sentence, so its terms are joined
                    // with spaces; the sentence around it is one key.
                    const breakdown = [roll.text];
                    if (targetHpMod > 0) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.mod", { value: targetHpMod }));
                    if (soothingBonus > 0) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.soothingSpeech"));
                    const data = { move, name, amount: recovery, breakdown: breakdown.join(" ") };
                    actorEvents.push(isSelf
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.tendWoundsRoll", data)
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.tendWoundsRollAlly", data));
                }
                // Soothing Speech self-heal: clear 2 HP on the caster when tending another
                if (hasSoothing && !isSelf) {
                    const selfHP = actor.system.resources?.hitPoints?.value ?? 0;
                    const newSelfHP = Math.max(0, selfHP - 2);
                    await actor.update({ "system.resources.hitPoints.value": newSelfHP });
                    actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.soothingSelfHeal"));
                }
            }

            if (action === "clearStress") {
                let companionStressCleared = null;
                const hasBedroll = _hasPremiumBedrollFeature(actor);
                const move = game.i18n.localize(MOVE_LABELS.clearStress);

                if (effectiveLong) {
                    await actor.update({ "system.resources.stress.value": 0 });

                    // Beastbound: clear companion stress if Beastbound feature present
                    if (_hasBeastboundFeature(actor)) {
                        const companion = await _getBeastboundCompanion(actor);
                        if (companion) {
                            const companionStress = companion.system.resources?.stress?.value ?? 0;
                            companionStressCleared = companionStress;
                            await companion.update({ "system.resources.stress.value": 0 });
                        }
                    }

                    actorEvents.push(companionStressCleared === null
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.clearStressAll", { move })
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.clearStressAllCompanion", { move, companion: companionStressCleared }));
                } else {
                    const roll = await _rollDowntimeDie("1d4", useOasis);
                    const bedrollBonus = hasBedroll ? 1 : 0;
                    const recovery = roll.total + tier + stressModifier + bedrollBonus + pipeweedBonus;
                    const currentStress = actor.system.resources?.stress?.value ?? 0;
                    const newStress = Math.max(0, currentStress - recovery);
                    await actor.update({ "system.resources.stress.value": newStress });
                    const breakdown = [roll.text, game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.tier", { value: tier })];
                    if (stressModifier > 0) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.mod", { value: stressModifier }));
                    if (hasBedroll) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.bedroll"));
                    if (pipeweedBonus > 0) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.pipeweed", { value: pipeweedBonus }));

                    // Beastbound: clear companion stress if Beastbound feature present
                    if (_hasBeastboundFeature(actor)) {
                        const companion = await _getBeastboundCompanion(actor);
                        if (companion) {
                            const companionStress = companion.system.resources?.stress?.value ?? 0;
                            companionStressCleared = Math.min(recovery, companionStress);
                            const newCompanionStress = Math.max(0, companionStress - recovery);
                            await companion.update({ "system.resources.stress.value": newCompanionStress });
                        }
                    }

                    const data = { move, amount: recovery, breakdown: breakdown.join(" "), companion: companionStressCleared };
                    actorEvents.push(companionStressCleared === null
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.clearStressRoll", data)
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.clearStressRollCompanion", data));
                }
            }

            if (action === "repairArmor") {
                const targetArmorMod = isSelf ? armorSlotModifier : (state.actors?.[targetActor.id]?.armorSlotModifier ?? 0);
                const move = game.i18n.localize(MOVE_LABELS.repairArmor);
                const name = foundry.utils.escapeHTML(targetActor.name);
                if (effectiveLong) {
                    await _clearAllArmorMarks(targetActor);
                    actorEvents.push(isSelf
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.repairArmorAll", { move })
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.repairArmorAllAlly", { move, name }));
                } else {
                    const roll = await _rollDowntimeDie("1d4", useOasis);
                    const reduction = roll.total + tier + targetArmorMod;
                    await _reduceArmorMarks(targetActor, reduction);
                    const breakdown = [roll.text];
                    if (targetArmorMod > 0) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.mod", { value: targetArmorMod }));
                    const data = { move, name, amount: reduction, breakdown: breakdown.join(" ") };
                    actorEvents.push(isSelf
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.repairArmorRoll", data)
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.repairArmorRollAlly", data));
                }
            }

            if (action === "prepare") {
                const currentHope = actor.system.resources?.hope?.value ?? 0;
                const maxHope = _getMaxHope(actor);
                const totalGain = prepareBonus + hopeModifier;
                const newHope = Math.min(currentHope + totalGain, maxHope);
                const actualGain = newHope - currentHope;
                await actor.update({ "system.resources.hope.value": newHope });
                const breakdown = [prepareBonus === 2
                    ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.prepareHopePaired", { amount: actualGain })
                    : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.prepareHope", { amount: actualGain })];
                if (hopeModifier > 0) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bonus.mod", { value: hopeModifier }));
                if (actualGain < totalGain) breakdown.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.capped"));
                actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.prepare", {
                    move: game.i18n.localize(MOVE_LABELS.prepare),
                    breakdown: breakdown.join(" ")
                }));
            }

            // Custom move actions
            if (action.startsWith("custom_")) {
                const moveLabel = action.slice("custom_".length);
                actorEvents.push(foundry.utils.escapeHTML(moveLabel));
            }

            // Item move actions
            if (action.startsWith("itemmove_")) {
                const itemUuid = action.slice("itemmove_".length);
                const moveItem = await fromUuid(itemUuid);
                actorEvents.push(moveItem
                    ? foundry.utils.escapeHTML(moveItem.name)
                    : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.unknownItem"));
            }

            // Feature-driven moves that resolve entirely in the fiction — the player narrates the
            // tribute, the new shape, or the swapped ancestry feature, and applies whatever the
            // sheet needs themselves. The summary only records that the move was spent, which is
            // what the table needs to see; nothing is written to the actor.
            if (action === "core_favor") {
                actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.favor", { move: game.i18n.localize(MOVE_LABELS.core_favor) }));
            }

            if (action === "core_changeShape") {
                actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.changeShape", { move: game.i18n.localize(MOVE_LABELS.core_changeShape) }));
            }

            if (action === "core_onlySkinDeep") {
                actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.onlySkinDeep", { move: game.i18n.localize(MOVE_LABELS.core_onlySkinDeep) }));
            }

            // Pipeweed: the +1 Stress it grants is already folded into every Clear Stress above
            // via pipeweedBonus, since the leaf helps the whole party and had to be counted before
            // anyone resolved. All that is left here is spending the consumable.
            if (action === "core_pipeweed") {
                const leaf = findSourcedItem(actor, _coreFeatureUuid("pipeweed"));
                const move = game.i18n.localize(MOVE_LABELS.core_pipeweed);
                if (leaf) {
                    await _consumeOne(actor, leaf);
                    actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.pipeweedSmoked", { move }));
                } else {
                    actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.pipeweedNone", { move }));
                }
            }

            // Forager core feature action
            if (action === "core_forager") {
                const foragerDie = await _rollDowntimeDie("1d6", useOasis);
                const foragerRoll = foragerDie.total;
                if (foragerRoll !== null) {
                    let resultOption;
                    if (foragerRoll <= 5) {
                        resultOption = FORAGER_OPTIONS[foragerRoll - 1];
                    } else {
                        // Roll 6 = choose: use player's pre-selected choice, fallback to option 1
                        const choice = actorState.foragerChoice ?? 1;
                        resultOption = FORAGER_OPTIONS[choice - 1] ?? FORAGER_OPTIONS[0];
                    }
                    const data = {
                        move: game.i18n.localize(MOVE_LABELS.core_forager),
                        roll: foragerDie.text,
                        result: game.i18n.localize(resultOption.label),
                        effect: game.i18n.localize(resultOption.effect)
                    };
                    actorEvents.push(foragerRoll === 6
                        ? game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.forageChosen", data)
                        : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.forage", data));

                    // Grant the foraged item to the actor's inventory
                    if (resultOption.itemUuid) {
                        try {
                            const foragedItem = await fromUuid(resultOption.itemUuid);
                            if (foragedItem) {
                                const itemData = foragedItem.toObject();
                                await actor.createEmbeddedDocuments("Item", [itemData]);
                            }
                        } catch (err) {
                            console.error(`daggerheart-quickactions | Failed to grant foraged item ${resultOption.itemUuid}:`, err);
                        }
                    }
                }
            }

            // Craft downtime actions
            if (action.startsWith("craft_")) {
                const recipeUuid = action.slice("craft_".length);
                const recipeItem = await fromUuid(recipeUuid);
                const recipeName = recipeItem
                    ? foundry.utils.escapeHTML(recipeItem.name)
                    : game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.unknownRecipe");
                actorEvents.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.craftUsed", { name: recipeName }));

                // Find matching craft entry to grant the crafted item
                const savedCraft = game.settings.get(MODULE_ID, "downtimeCraftEntries") ?? [];
                const craftEntries = savedCraft.length > 0 ? savedCraft : DEFAULT_CRAFT_ENTRIES;
                const entry = craftEntries.find(e => e.recipeUuid === recipeUuid);
                if (entry?.craftUuid) {
                    try {
                        const craftItem = await fromUuid(entry.craftUuid);
                        if (craftItem) {
                            const itemData = craftItem.toObject();
                            await actor.createEmbeddedDocuments("Item", [itemData]);
                            // The item's highlight is markup, so it wraps the escaped name here
                            // and stays out of en.json.
                            const craftedItem = `<strong style="color:#C9A060;">${foundry.utils.escapeHTML(craftItem.name)}</strong>`;
                            const craftMsg = `
                            <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden; font-family: 'Aleo', serif;">
                                <div class="card-content" style="background: #191919; padding: 12px; text-align: center;">
                                    <div style="color: #C9A060; font-weight: bold; font-size: 1.1em; margin-bottom: 6px;">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.craftedTitle")}</div>
                                    <div style="color: #e0e0e0;">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.craftedBody", { actor: foundry.utils.escapeHTML(actor.name), item: craftedItem })}</div>
                                </div>
                            </div>`;
                            await ChatMessage.create({ user: game.user.id, style: CONST.CHAT_MESSAGE_STYLES.OTHER, content: craftMsg });
                        }
                    } catch (err) {
                        console.error(`daggerheart-quickactions | Failed to grant crafted item for "${recipeName}":`, err);
                    }
                }
            }
        }
    }

    // Apply automatic stress recovery from Premium Bedroll
    // Skip if the actor chose Clear Stress (bedroll bonus is already integrated into that roll)
    for (const { actor, actorState } of includedActors) {
        if (!_hasPremiumBedrollFeature(actor)) continue;
        if (actorState.actions.some(i => i.key === "clearStress")) continue;
        const currentStress = actor.system.resources?.stress?.value ?? 0;
        if (currentStress <= 0) continue;
        const newStress = Math.max(0, currentStress - 1);
        await actor.update({ "system.resources.stress.value": newStress });
        if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
        resultsByActor.get(actor.id).events.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.bedroll"));
    }

    // Self-Healing armour: "When you take a rest, clear an Armor Slot." Unconditional on any rest,
    // so unlike Premium Bedroll (whose +1 is folded into the Clear Stress roll) it stacks on top of
    // Repair Armor rather than being skipped when that move was chosen.
    for (const { actor } of includedActors) {
        if (!_hasSelfHealingArmor(actor)) continue;
        const marks = actor.system.resources?.armor?.value ?? 0;
        if (marks <= 0) continue;
        await _reduceArmorMarks(actor, 1);
        if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
        resultsByActor.get(actor.id).events.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.selfHealing"));
    }

    // Armorer bonus: when an actor with Armorer uses Repair Armor, all other included actors clear 1 Armor Slot
    for (const { actor, actorState } of includedActors) {
        if (!_hasArmorerFeature(actor)) continue;
        if (!actorState.actions.some(i => i.key === "repairArmor")) continue;
        for (const { actor: ally } of includedActors) {
            if (ally.id === actor.id) continue;
            await _reduceArmorMarks(ally, 1);
            if (!resultsByActor.has(ally.id)) resultsByActor.set(ally.id, { name: ally.name, events: [] });
            resultsByActor.get(ally.id).events.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.armorer", { name: foundry.utils.escapeHTML(actor.name) }));
        }
    }

    // Recovery Hope cost: deduct 1 Hope from the Recovery actor if their ally used the granted slot
    for (const { actor, actorState } of includedActors) {
        if (!_hasRecoveryFeature(actor)) continue;
        const beneficiaryId = actorState.recoveryBeneficiary ?? null;
        if (!beneficiaryId) continue;
        const beneficiaryEntry = includedActors.find(a => a.actor.id === beneficiaryId);
        // Only deduct if the ally actually used their granted upgrade slot
        if (!beneficiaryEntry?.actorState.recoveryGrantedSlot) continue;
        const currentHope = actor.system.resources?.hope?.value ?? 0;
        if (currentHope < 1) continue;
        await actor.update({ "system.resources.hope.value": currentHope - 1 });
        if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
        resultsByActor.get(actor.id).events.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.recovery", { name: foundry.utils.escapeHTML(beneficiaryEntry.actor.name) }));
    }

    // Feature refresh (uses recovery + resource recovery)
    // Group updates by item to avoid conflicts when an item has both action uses and resource
    for (const { actor, actorState } of includedActors) {
        const hasEff = _hasEfficientFeature(actor);
        const effSlot = actorState.efficientSlot ?? null;
        const forceEffLong = hasEff && effSlot !== null && !isLong;
        const refreshable = _getRefreshableFeatures(actor, restType, forceEffLong);
        if (refreshable.length === 0) continue;

        const itemUpdates = new Map();
        for (const entry of refreshable) {
            const itemId = entry.item.id;
            if (!itemUpdates.has(itemId)) {
                itemUpdates.set(itemId, { item: entry.item, name: entry.itemName, updateData: {}, changed: false });
            }
            const record = itemUpdates.get(itemId);

            if (entry.type === "action") {
                if (entry.uses.value === 0 || entry.uses.value === null) continue;
                record.updateData[`system.actions.${entry.actionId}.uses.value`] = 0;
                record.changed = true;
            } else if (entry.type === "resource") {
                const res = entry.resource;
                const resetValue = res.progression === "increasing" ? 0 : parseInt(res.max) || 0;
                if (res.value === resetValue) continue;
                record.updateData["system.resource.value"] = resetValue;
                record.changed = true;
            }
        }

        // Batch all item updates for this actor into a single database operation.
        const batchUpdates = [];
        const refreshedNames = [];
        for (const [, record] of itemUpdates) {
            if (!record.changed) continue;
            batchUpdates.push({ _id: record.item.id, ...record.updateData });
            refreshedNames.push(record.name);
        }
        if (batchUpdates.length > 0) {
            await Item.implementation.updateDocuments(batchUpdates, { parent: actor });
        }
        if (refreshedNames.length > 0) {
            if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
            // A short unit list keeps the plain comma list ("A, B, C") with no "and" before the last.
            const names = game.i18n.getListFormatter({ style: "short", type: "unit" })
                .format(refreshedNames.map(n => foundry.utils.escapeHTML(n)));
            resultsByActor.get(actor.id).events.push(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.summary.refreshed", { names }));
        }
    }

    // Chat card
    const restLabel = isLong
        ? game.i18n.localize("DAGGERHEART.APPLICATIONS.Downtime.longRest.title")
        : game.i18n.localize("DAGGERHEART.APPLICATIONS.Downtime.shortRest.title");

    let eventsHtml = "";
    for (const [actorId, data] of resultsByActor) {
        if (data.events.length === 0) continue;
        eventsHtml += `
        <div style="margin-bottom: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 6px;">
            <div style="font-weight: bold; color: #C9A060; border-bottom: 1px solid rgba(201,160,96,0.3); margin-bottom: 4px; padding-bottom: 2px; font-size: 1.05em;">
                ${foundry.utils.escapeHTML(data.name)}
            </div>
            <div style="padding-left: 4px; font-size: 0.9em; color: #e0e0e0; line-height: 1.4;">
                ${data.events.map(e => `<div style="margin-bottom: 2px;">• ${e}</div>`).join("")}
            </div>
        </div>`;
    }

    const content = `
    <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden; font-family: 'Aleo', serif;">
        <header style="background: #191919; padding: 10px; text-align: center; font-size: 1.4em; color: #C9A060; text-transform: uppercase; letter-spacing: 2px; text-shadow: 0 0 10px #C9A060; border-bottom: 2px solid #C9A060;">
            ${restLabel}
        </header>
        <div class="card-content" style="background: #191919; padding: 15px;">
            <div style="text-align: center; font-weight: bold; color: #C9A060; font-size: 1.1em; margin-bottom: 8px;">${game.i18n.localize("DH_QUICKACTIONS.REST.gmEarnsFear")}</div>
            <div style="text-align: center; font-size: 2.5em; font-weight: bold; color: #ffffff; text-shadow: 0 0 10px #C9A060;">+${addedFear}</div>
            <div style="text-align: center; color: #ccc; font-size: 0.9em; margin-top: 4px;">${calculationText}</div>
            <div style="text-align: center; color: #C9A060; font-size: 1em; margin-top: 8px;">${game.i18n.localize("DH_QUICKACTIONS.REST.currentTotal", { total: newFear })}</div>
            <hr style="border: 1px solid rgba(201,160,96,0.3); margin: 12px 0;">
            <div style="color: #e0e0e0; font-size: 0.9em; line-height: 1.6;">
                ${eventsHtml}
            </div>
        </div>
    </div>`;
    await ChatMessage.create({ user: game.user.id, style: CONST.CHAT_MESSAGE_STYLES.OTHER, content });

    // Update consecutive short rest counter (resets on long rest)
    const currentCount = game.settings.get(MODULE_ID, "shortRestCount") ?? 0;
    await game.settings.set(MODULE_ID, "shortRestCount", isLong ? 0 : currentCount + 1);

    // Broadcast close to all players, then close GM instance and clear state
    await game.settings.set(MODULE_ID, "downtimeUIClosed", { timestamp: Date.now() });
    DowntimeUIApp._instance?.close();
    await game.settings.set(MODULE_ID, "downtimeUIState", {});
    for (const user of game.users) {
        if (user.isGM) continue;
        if (user.getFlag(MODULE_ID, "downtimeChoices")) {
            await user.unsetFlag(MODULE_ID, "downtimeChoices");
        }
    }
}

// ==================================================================
// CONFIGURE ACTOR APP
// ==================================================================
class ConfigureActorApp extends HandlebarsApplicationMixin(ApplicationV2) {
    #actorId = null;
    #resolve = null;

    static DEFAULT_OPTIONS = {
        id: "daggerheart-configure-actor",
        classes: ["dh-configure-actor"],
        window: { title: "DH_QUICKACTIONS.DOWNTIME.configureActor.title", resizable: true },
        position: { width: 480, height: 320 },
        actions: {
            saveConfig: ConfigureActorApp.prototype._onSaveConfig
        }
    };

    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/configure-actor.hbs` } };

    constructor(actorId, actorState, resolve) {
        super();
        this.#actorId = actorId;
        this._actorState = actorState;
        this.#resolve = resolve;
    }

    async _prepareContext() {
        const s = this._actorState;
        return {
            maxChoices: s.maxChoices ?? 2,
            hpModifier: s.hpModifier ?? 0,
            stressModifier: s.stressModifier ?? 0,
            hopeModifier: s.hopeModifier ?? 0,
            armorSlotModifier: s.armorSlotModifier ?? 0
        };
    }

    _onSaveConfig() {
        const el = this.element;
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        const result = {
            maxChoices: clamp(parseInt(el.querySelector('[name="maxChoices"]').value) || 2, 1, 6),
            hpModifier: clamp(parseInt(el.querySelector('[name="hpModifier"]').value) || 0, 0, 10),
            stressModifier: clamp(parseInt(el.querySelector('[name="stressModifier"]').value) || 0, 0, 10),
            hopeModifier: clamp(parseInt(el.querySelector('[name="hopeModifier"]').value) || 0, 0, 10),
            armorSlotModifier: clamp(parseInt(el.querySelector('[name="armorSlotModifier"]').value) || 0, 0, 10)
        };

        if (this.#resolve) this.#resolve(result);
        this.close();
    }

    _onClose(options) {
        super._onClose(options);
        if (this.#resolve) {
            this.#resolve(null);
            this.#resolve = null;
        }
    }

    static open(actorId, actorState) {
        return new Promise((resolve) => {
            const app = new ConfigureActorApp(actorId, actorState, resolve);
            app.render(true);
        });
    }
}

// ==================================================================
// CONFIGURE MOVES APP (Global craft / extra moves config)
// ==================================================================
class ConfigureMovesApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "daggerheart-configure-moves",
        classes: ["dh-configure-actor"],
        window: { title: "DH_QUICKACTIONS.DOWNTIME.config.title", resizable: true },
        position: { width: 480, height: 500 },
        actions: {
            saveMovesConfig: ConfigureMovesApp.prototype._onSaveMovesConfig,
            toggleDowntimeUser: ConfigureMovesApp.prototype._onToggleDowntimeUser,
            addCraftRow: ConfigureMovesApp.prototype._onAddCraftRow,
            removeCraftRow: ConfigureMovesApp.prototype._onRemoveCraftRow,
            addCustomRow: ConfigureMovesApp.prototype._onAddCustomRow,
            removeCustomRow: ConfigureMovesApp.prototype._onRemoveCustomRow,
            addItemMoveRow: ConfigureMovesApp.prototype._onAddItemMoveRow,
            removeItemMoveRow: ConfigureMovesApp.prototype._onRemoveItemMoveRow,
            removeCoreItem: ConfigureMovesApp.prototype._onRemoveCoreItem
        }
    };

    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/configure-moves.hbs` } };

    async _prepareContext() {
        const saved = game.settings.get(MODULE_ID, "downtimeCraftEntries") ?? [];
        const craftEntries = saved.length > 0 ? saved : DEFAULT_CRAFT_ENTRIES;

        const resolvedEntries = [];
        for (const entry of craftEntries) {
            const recipe = entry.recipeUuid ? await fromUuid(entry.recipeUuid) : null;
            const craft = entry.craftUuid ? await fromUuid(entry.craftUuid) : null;
            resolvedEntries.push({
                recipeUuid: entry.recipeUuid || "",
                recipeName: recipe?.name || "",
                craftUuid: entry.craftUuid || "",
                craftName: craft?.name || ""
            });
        }

        const customMovesRaw = game.settings.get(MODULE_ID, "downtimeCustomMoves") ?? [];
        const customMoves = customMovesRaw.map(m => ({
            label: m.label || "",
            restType: m.restType || "any"
        }));

        const savedItemMoves = game.settings.get(MODULE_ID, "downtimeItemMoveEntries") ?? [];
        const itemMoveRaw = savedItemMoves.length > 0 ? savedItemMoves : DEFAULT_ITEM_MOVE_ENTRIES;

        const itemMoveEntries = [];
        for (const entry of itemMoveRaw) {
            const item = entry.itemUuid ? await fromUuid(entry.itemUuid) : null;
            itemMoveEntries.push({
                itemUuid: entry.itemUuid || "",
                itemName: item?.name || "",
                restType: entry.restType || "any"
            });
        }

        // Core features — merge saved with defaults so new features always appear
        const savedCore = game.settings.get(MODULE_ID, "downtimeCoreFeatures") ?? [];
        const savedByKey = new Map(savedCore.map(e => [e.key, e]));
        const coreRaw = DEFAULT_CORE_FEATURES.map(d => {
            const saved = savedByKey.get(d.key);
            return saved ? { ...d, ...saved, label: d.label, description: d.description } : d;
        });
        const coreFeatures = [];
        for (const entry of coreRaw) {
            const item = entry.itemUuid ? await fromUuid(entry.itemUuid) : null;
            coreFeatures.push({
                key: entry.key || "",
                label: entry.label || "",
                itemUuid: entry.itemUuid || "",
                itemName: item?.name || "",
                description: entry.description || ""
            });
        }

        // Users tab — every non-GM user, with its participation switch
        const disabledUsers = game.settings.get(MODULE_ID, DOWNTIME_DISABLED_USERS) ?? [];
        const users = game.users
            .filter(u => !u.isGM)
            .map(u => ({
                id: u.id,
                name: u.name,
                characterName: u.character?.name || "",
                active: u.active,
                enabled: !disabledUsers.includes(u.id)
            }));

        return { craftEntries: resolvedEntries, customMoves, itemMoveEntries, coreFeatures, users };
    }

    _onRender(context, options) {
        // Core help tooltips (fixed position, not clipped by overflow)
        let fixedTip = document.querySelector('.dui-fixed-tooltip');
        if (!fixedTip) {
            fixedTip = document.createElement('div');
            fixedTip.className = 'dui-fixed-tooltip';
            document.body.appendChild(fixedTip);
        }
        this.element.addEventListener('mouseenter', (e) => {
            const help = e.target.closest?.('.dui-core-help');
            if (!help) return;
            const text = help.dataset.tip;
            if (!text) return;
            fixedTip.textContent = text;
            const rect = help.getBoundingClientRect();
            fixedTip.style.top = `${rect.bottom + 6}px`;
            fixedTip.style.left = `${rect.left + rect.width / 2 - 110}px`;
            fixedTip.classList.add('visible');
        }, true);
        this.element.addEventListener('mouseleave', (e) => {
            const help = e.target.closest?.('.dui-core-help');
            if (!help) return;
            fixedTip.classList.remove('visible');
        }, true);

        // Tab switching
        this.element.querySelectorAll('.dui-cfg-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.element.querySelectorAll('.dui-cfg-tab').forEach(t => t.classList.remove('active'));
                this.element.querySelectorAll('.dui-cfg-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                this.element.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
            });
        });

        // Craft drag-drop
        const craftList = this.element.querySelector('#dui-craft-list');
        if (!craftList) return;

        craftList.addEventListener('dragover', (e) => {
            const dropZone = e.target.closest('.dui-craft-drop');
            if (dropZone) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                dropZone.classList.add('dragover');
            }
        });

        craftList.addEventListener('dragleave', (e) => {
            const dropZone = e.target.closest('.dui-craft-drop');
            if (dropZone) dropZone.classList.remove('dragover');
        });

        craftList.addEventListener('drop', async (e) => {
            const dropZone = e.target.closest('.dui-craft-drop');
            if (!dropZone) return;
            e.preventDefault();
            dropZone.classList.remove('dragover');

            let data;
            try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
            if (data.type !== 'Item') {
                ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.onlyItems"));
                return;
            }

            const item = await fromUuid(data.uuid);
            if (!item) {
                ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.unresolved"));
                return;
            }
            if (!ALLOWED_CRAFT_TYPES.includes(item.type)) {
                ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.craftType", { type: item.type }));
                return;
            }

            const row = dropZone.closest('.dui-craft-row');
            const idx = row.dataset.index;
            const slot = dropZone.dataset.slot;
            const inputName = slot === 'recipe' ? `craftRecipe_${idx}` : `craftCraft_${idx}`;

            const hiddenInput = row.querySelector(`input[name="${inputName}"]`);
            if (hiddenInput) hiddenInput.value = data.uuid;

            dropZone.querySelector('.dui-craft-name').textContent = item.name;
            dropZone.classList.remove('empty');
            dropZone.classList.add('filled');
        });

        // Item Moves drag-drop
        const itemMoveList = this.element.querySelector('#dui-itemmove-list');
        if (itemMoveList) {
            itemMoveList.addEventListener('dragover', (e) => {
                const dropZone = e.target.closest('.dui-itemmove-drop');
                if (dropZone) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    dropZone.classList.add('dragover');
                }
            });

            itemMoveList.addEventListener('dragleave', (e) => {
                const dropZone = e.target.closest('.dui-itemmove-drop');
                if (dropZone) dropZone.classList.remove('dragover');
            });

            itemMoveList.addEventListener('drop', async (e) => {
                const dropZone = e.target.closest('.dui-itemmove-drop');
                if (!dropZone) return;
                e.preventDefault();
                dropZone.classList.remove('dragover');

                let data;
                try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
                if (data.type !== 'Item') {
                    ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.onlyItems"));
                    return;
                }

                const item = await fromUuid(data.uuid);
                if (!item) {
                    ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.unresolved"));
                    return;
                }

                const row = dropZone.closest('.dui-itemmove-row');
                const idx = row.dataset.index;
                const hiddenInput = row.querySelector(`input[name="itemMove_${idx}"]`);
                if (hiddenInput) hiddenInput.value = data.uuid;

                dropZone.querySelector('.dui-itemmove-name').textContent = item.name;
                dropZone.classList.remove('empty');
                dropZone.classList.add('filled');
            });
        }

        // Core features drag-drop
        const coreList = this.element.querySelector('#dui-core-list');
        if (coreList) {
            coreList.addEventListener('dragover', (e) => {
                const dropZone = e.target.closest('.dui-core-drop');
                if (dropZone) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    dropZone.classList.add('dragover');
                }
            });

            coreList.addEventListener('dragleave', (e) => {
                const dropZone = e.target.closest('.dui-core-drop');
                if (dropZone) dropZone.classList.remove('dragover');
            });

            coreList.addEventListener('drop', async (e) => {
                const dropZone = e.target.closest('.dui-core-drop');
                if (!dropZone) return;
                e.preventDefault();
                dropZone.classList.remove('dragover');

                let data;
                try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
                if (data.type !== 'Item') {
                    ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.onlyItems"));
                    return;
                }

                const item = await fromUuid(data.uuid);
                if (!item) {
                    ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.unresolved"));
                    return;
                }

                const row = dropZone.closest('.dui-core-row');
                const idx = row.dataset.index;
                const hiddenInput = row.querySelector(`input[name="coreItem_${idx}"]`);
                if (hiddenInput) hiddenInput.value = data.uuid;

                dropZone.querySelector('.dui-core-item-name').textContent = item.name;
                dropZone.classList.remove('empty');
                dropZone.classList.add('filled');
            });
        }
    }

    _onAddCraftRow() {
        const craftList = this.element.querySelector('#dui-craft-list');
        const nextIndex = craftList.querySelectorAll('.dui-craft-row').length;
        const newRow = document.createElement('div');
        newRow.className = 'dui-craft-row';
        newRow.dataset.index = String(nextIndex);
        const remove = foundry.utils.escapeHTML(game.i18n.localize("DH_QUICKACTIONS.COMMON.remove"));
        newRow.innerHTML = `
            <div class="dui-craft-drop empty" data-slot="recipe" data-index="${nextIndex}">
                <i class="fas fa-scroll"></i>
                <span class="dui-craft-name">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.config.dragRecipe")}</span>
            </div>
            <i class="fas fa-arrow-right dui-craft-arrow"></i>
            <div class="dui-craft-drop empty" data-slot="craft" data-index="${nextIndex}">
                <i class="fas fa-flask"></i>
                <span class="dui-craft-name">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.config.dragCrafted")}</span>
            </div>
            <button type="button" class="dui-craft-remove" data-action="removeCraftRow" data-index="${nextIndex}" title="${remove}">
                <i class="fas fa-times"></i>
            </button>
            <input type="hidden" name="craftRecipe_${nextIndex}" value="">
            <input type="hidden" name="craftCraft_${nextIndex}" value="">`;
        craftList.appendChild(newRow);
    }

    _onRemoveCraftRow(event, target) {
        target.closest('.dui-craft-row').remove();
    }

    _onAddCustomRow() {
        const customList = this.element.querySelector('#dui-custom-list');
        const nextIndex = customList.querySelectorAll('.dui-custom-row').length;
        const newRow = document.createElement('div');
        newRow.className = 'dui-custom-row';
        newRow.dataset.index = String(nextIndex);
        const placeholder = foundry.utils.escapeHTML(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.config.moveNamePlaceholder"));
        const remove = foundry.utils.escapeHTML(game.i18n.localize("DH_QUICKACTIONS.COMMON.remove"));
        newRow.innerHTML = `
            <input type="text" class="dui-custom-input" name="customMove_${nextIndex}" value="" maxlength="27" placeholder="${placeholder}">
            <select class="dui-rest-type-select">
                <option value="any" selected>${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.restType.any")}</option>
                <option value="short">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.restType.short")}</option>
                <option value="long">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.restType.long")}</option>
            </select>
            <button type="button" class="dui-craft-remove" data-action="removeCustomRow" data-index="${nextIndex}" title="${remove}">
                <i class="fas fa-times"></i>
            </button>`;
        customList.appendChild(newRow);
    }

    _onRemoveCustomRow(event, target) {
        target.closest('.dui-custom-row').remove();
    }

    _onAddItemMoveRow() {
        const list = this.element.querySelector('#dui-itemmove-list');
        const nextIndex = list.querySelectorAll('.dui-itemmove-row').length;
        const newRow = document.createElement('div');
        newRow.className = 'dui-itemmove-row';
        newRow.dataset.index = String(nextIndex);
        const remove = foundry.utils.escapeHTML(game.i18n.localize("DH_QUICKACTIONS.COMMON.remove"));
        newRow.innerHTML = `
            <div class="dui-itemmove-drop empty" data-index="${nextIndex}">
                <i class="fas fa-box-open"></i>
                <span class="dui-itemmove-name">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.dragItem")}</span>
            </div>
            <select class="dui-rest-type-select">
                <option value="any" selected>${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.restType.any")}</option>
                <option value="short">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.restType.short")}</option>
                <option value="long">${game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.restType.long")}</option>
            </select>
            <button type="button" class="dui-craft-remove" data-action="removeItemMoveRow" data-index="${nextIndex}" title="${remove}">
                <i class="fas fa-times"></i>
            </button>
            <input type="hidden" name="itemMove_${nextIndex}" value="">`;
        list.appendChild(newRow);
    }

    _onRemoveItemMoveRow(event, target) {
        target.closest('.dui-itemmove-row').remove();
    }

    /**
     * Flips a user's participation switch in the Users tab. The change stays DOM-local
     * until the config is saved, matching the save-on-demand behaviour of every other tab.
     * @param {Event} event - The originating click event.
     * @param {HTMLElement} target - The toggle button of the user row.
     * @returns {void}
     */
    _onToggleDowntimeUser(event, target) {
        target.classList.toggle("checked");
    }

    _onRemoveCoreItem(event, target) {
        const row = target.closest('.dui-core-row');
        const idx = row.dataset.index;
        // Clear the hidden input UUID
        const hiddenInput = row.querySelector(`input[name="coreItem_${idx}"]`);
        if (hiddenInput) hiddenInput.value = "";
        // Reset the drop zone visual
        const dropZone = row.querySelector('.dui-core-drop');
        if (dropZone) {
            dropZone.classList.remove('filled');
            dropZone.classList.add('empty');
            dropZone.querySelector('.dui-core-item-name').textContent = game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.dragItem");
        }
        // Hide the remove button
        target.style.display = "none";
    }

    async _onSaveMovesConfig() {
        const el = this.element;

        // Collect craft entries from hidden inputs
        const craftEntries = [];
        let i = 0;
        while (el.querySelector(`input[name="craftRecipe_${i}"]`)) {
            const recipeUuid = el.querySelector(`input[name="craftRecipe_${i}"]`).value;
            const craftUuid = el.querySelector(`input[name="craftCraft_${i}"]`).value;
            if (recipeUuid || craftUuid) {
                craftEntries.push({ recipeUuid, craftUuid });
            }
            i++;
        }

        // Collect custom moves from text inputs
        const customMoves = [];
        for (const row of el.querySelectorAll('.dui-custom-row')) {
            const label = row.querySelector('.dui-custom-input')?.value.trim();
            const restType = row.querySelector('.dui-rest-type-select')?.value || "any";
            if (label) {
                customMoves.push({ label, restType });
            }
        }

        // Collect item move entries from hidden inputs
        const itemMoveEntries = [];
        let j = 0;
        while (el.querySelector(`input[name="itemMove_${j}"]`)) {
            const itemUuid = el.querySelector(`input[name="itemMove_${j}"]`).value;
            const restType = el.querySelector(`.dui-itemmove-row[data-index="${j}"] .dui-rest-type-select`)?.value || "any";
            if (itemUuid) {
                itemMoveEntries.push({ itemUuid, restType });
            }
            j++;
        }

        // Collect core feature entries from hidden inputs
        const coreFeatures = [];
        let k = 0;
        while (el.querySelector(`input[name="coreKey_${k}"]`)) {
            const key = el.querySelector(`input[name="coreKey_${k}"]`).value;
            const itemUuid = el.querySelector(`input[name="coreItem_${k}"]`).value;
            coreFeatures.push({ key, itemUuid });
            k++;
        }

        // Collect the users switched off in the Users tab — an unchecked toggle means "excluded"
        const disabledUsers = [];
        for (const row of el.querySelectorAll('.dui-user-row')) {
            const toggle = row.querySelector('.dui-user-toggle');
            if (toggle && !toggle.classList.contains('checked')) disabledUsers.push(row.dataset.userId);
        }

        await game.settings.set(MODULE_ID, "downtimeCraftEntries", craftEntries);
        await game.settings.set(MODULE_ID, "downtimeCustomMoves", customMoves);
        await game.settings.set(MODULE_ID, "downtimeItemMoveEntries", itemMoveEntries);
        await game.settings.set(MODULE_ID, "downtimeCoreFeatures", coreFeatures);
        await game.settings.set(MODULE_ID, DOWNTIME_DISABLED_USERS, disabledUsers);
        ui.notifications.info(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.saved"));
        this.close();
    }

    _onClose() {
        document.querySelector('.dui-fixed-tooltip')?.remove();
    }
}

// ==================================================================
// DOWNTIME UI APP
// ==================================================================
class DowntimeUIApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static _instance = null;
    /** @type {Function} Debounced render to collapse rapid re-render bursts into a single execution */
    _debouncedRender = foundry.utils.debounce(() => this.render(), 100);

    static DEFAULT_OPTIONS = {
        id: "daggerheart-downtime-ui",
        classes: ["dh-downtime-ui"],
        window: { title: "DAGGERHEART.GENERAL.downtime", icon: "fas fa-moon", resizable: true, controls: [] },
        position: { width: 720, height: "auto" },
        actions: {
            startDowntime: DowntimeUIApp.prototype._onStartDowntime,
            toggleIncluded: DowntimeUIApp.prototype._onToggleIncluded,
            configMaxChoices: DowntimeUIApp.prototype._onConfigMaxChoices,
            setRestType: DowntimeUIApp.prototype._onSetRestType,
            setShortRestCount: DowntimeUIApp.prototype._onSetShortRestCount,
            addAction: DowntimeUIApp.prototype._onAddAction,
            removeAction: DowntimeUIApp.prototype._onRemoveAction,
            toggleEfficientSlot: DowntimeUIApp.prototype._onToggleEfficientSlot,
            toggleRecoverySlot: DowntimeUIApp.prototype._onToggleRecoverySlot,
            toggleRecoveryGrantedSlot: DowntimeUIApp.prototype._onToggleRecoveryGrantedSlot,
            toggleOasisSlot: DowntimeUIApp.prototype._onToggleOasisSlot,
            toggleOasisGrantedSlot: DowntimeUIApp.prototype._onToggleOasisGrantedSlot,
            openMovesConfig: DowntimeUIApp.prototype._onOpenMovesConfig,
            resendDowntime: DowntimeUIApp.prototype._onResendDowntime
        }
    };

    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/downtime-ui.hbs` } };

    async _prepareContext() {
        const isGM = game.user.isGM;
        const savedState = game.settings.get(MODULE_ID, "downtimeUIState");
        const rows = [];

        const globalRestType = savedState?.restType || "short";
        const isLong = globalRestType === "long";

        const shortActions = [
            { key: "tendWounds", label: game.i18n.localize(MOVE_LABELS.tendWounds), hasTarget: true },
            { key: "clearStress", label: game.i18n.localize(MOVE_LABELS.clearStress), hasTarget: false },
            { key: "repairArmor", label: game.i18n.localize(MOVE_LABELS.repairArmor), hasTarget: true },
            { key: "prepare", label: game.i18n.localize(MOVE_LABELS.prepare), hasTarget: false }
        ];
        const longActions = [
            ...shortActions,
            { key: "workOnProject", label: game.i18n.localize(MOVE_LABELS.workOnProject), hasTarget: false }
        ];
        const availableActions = isLong ? longActions : shortActions;

        // Build actor list (all non-GM character actors)
        const allActors = [];
        for (const user of game.users) {
            if (user.isGM) continue;
            if (_isDowntimeDisabledUser(user)) continue;
            const actor = user.character;
            if (!actor || actor.type !== "character") continue;
            allActors.push({ id: actor.id, name: actor.name, userId: user.id, user, actor });
        }

        for (const { id: actorId, name: actorName, userId, user, actor } of allActors) {
            // GM-controlled data from world setting
            const gmState = savedState?.actors?.[actorId] ?? { included: true, maxChoices: 2 };
            // Celestial Trance bonus: +1 move
            let maxChoices = gmState.maxChoices ?? 2;
            if (_hasCelestialTranceFeature(actor)) {
                maxChoices += 1;
            }
            // Timekeeper's Pendant: "You can choose an additional downtime move each rest."
            if (_hasTimekeepersPendant(actor)) {
                maxChoices += 1;
            }
            // Eloquent bonus: +1 move if chosen by another party member
            const playerChoices = _readDowntimeChoices(user);
            const eloquentGiver = allActors.find(a => a.id !== actorId && _hasEloquentFeature(a.actor));
            const eloquentGiverChoices = eloquentGiver ? game.users.find(u => u.character?.id === eloquentGiver.id)?.getFlag(MODULE_ID, "downtimeChoices") : null;
            if (eloquentGiverChoices?.eloquentBeneficiary === actorId) {
                maxChoices += 1;
            }

            // Exclude bonus moves (Forage, Smoke Pipeweed) from the move count
            const selectedCount = playerChoices.actions.filter(i => !BONUS_MOVES.has(i.key)).length;
            const isOverLimit = selectedCount > maxChoices;

            // Build craft downtime actions from global setting
            const savedCraft = game.settings.get(MODULE_ID, "downtimeCraftEntries") ?? [];
            const craftEntries = savedCraft.length > 0 ? savedCraft : DEFAULT_CRAFT_ENTRIES;
            const extraActions = [];
            for (const entry of craftEntries) {
                if (!entry.recipeUuid) continue;
                const recipeItem = await fromUuid(entry.recipeUuid);
                if (!recipeItem) continue;
                const owned = findSourcedItem(actor, entry.recipeUuid);
                if (owned) {
                    extraActions.push({ key: `craft_${entry.recipeUuid}`, label: recipeItem.name, hasTarget: false, isExtra: true });
                }
            }

            // Build custom move actions from global setting
            const customMoves = game.settings.get(MODULE_ID, "downtimeCustomMoves") ?? [];
            for (const move of customMoves) {
                if (!move.label) continue;
                const rt = move.restType || "any";
                if (rt !== "any" && rt !== globalRestType) continue;
                extraActions.push({ key: `custom_${move.label}`, label: move.label, hasTarget: false, isExtra: true });
            }

            // Build item move actions from global setting
            const savedItemMoves = game.settings.get(MODULE_ID, "downtimeItemMoveEntries") ?? [];
            const itemMoveEntries = savedItemMoves.length > 0 ? savedItemMoves : DEFAULT_ITEM_MOVE_ENTRIES;
            for (const entry of itemMoveEntries) {
                if (!entry.itemUuid) continue;
                const rt = entry.restType || "any";
                if (rt !== "any" && rt !== globalRestType) continue;
                const moveItem = await fromUuid(entry.itemUuid);
                if (!moveItem) continue;
                // Skip Eloquent if it's configured as a Core Feature
                if (entry.itemUuid === _coreFeatureUuid("eloquent") && _hasEloquentFeature(actor)) {
                    continue;
                }
                const owned = findSourcedItem(actor, entry.itemUuid);
                if (owned) {
                    extraActions.push({ key: `itemmove_${entry.itemUuid}`, label: moveItem.name, hasTarget: false, isExtra: true });
                }
            }

            // Efficient feature: actor sees long rest actions during short rest
            const hasEfficient = _hasEfficientFeature(actor);
            const efficientSlot = playerChoices.efficientSlot ?? null;

            // Recovery feature: like Efficient, allows one move to use long rest quality
            const hasRecovery = _hasRecoveryFeature(actor);
            const recoverySlot = playerChoices.recoverySlot ?? null;
            const recoveryBeneficiary = playerChoices.recoveryBeneficiary ?? "";

            // Determine if another included actor with Recovery has designated this actor as beneficiary
            const recoveryGrantor = allActors.find(a => {
                if (a.id === actorId) return false;
                if (!_hasRecoveryFeature(a.actor)) return false;
                const grantorUser = game.users.find(u => u.character?.id === a.id);
                const grantorChoices = grantorUser?.getFlag(MODULE_ID, "downtimeChoices");
                return grantorChoices?.recoveryBeneficiary === actorId;
            });
            const hasRecoveryGrant = !!recoveryGrantor;
            // Grant is only valid if the grantor still has at least 1 Hope
            const grantorHasHope = recoveryGrantor
                ? (recoveryGrantor.actor.system.resources?.hope?.value ?? 0) >= 1
                : false;
            const recoveryGrantedSlot = playerChoices.recoveryGrantedSlot ?? null;

            // Ally selector options for Recovery (populated only when actor has Recovery during short rest)
            const recoveryAllyOptions = [];
            if (hasRecovery && !isLong) {
                for (const other of allActors) {
                    if (other.id === actorId) continue;
                    recoveryAllyOptions.push({ id: other.id, name: other.name });
                }
            }
            // Ally grant is only selectable if actor has at least 1 Hope (read directly to avoid forward reference)
            const canSelectRecoveryAlly = (actor.system.resources?.hope?.value ?? 0) >= 1;

            // Oasis (Duneborne): one short-rest reroll, kept or handed to an ally. Mirrors the
            // Recovery grant above, minus the Hope cost the feature does not charge.
            const hasOasis = _hasOasisFeature(actor);
            const oasisSlot = playerChoices.oasisSlot ?? null;
            const oasisBeneficiary = playerChoices.oasisBeneficiary ?? "";
            const hasOasisGrant = allActors.some(a => {
                if (a.id === actorId) return false;
                if (!_hasOasisFeature(a.actor)) return false;
                const grantorUser = game.users.find(u => u.character?.id === a.id);
                return grantorUser?.getFlag(MODULE_ID, "downtimeChoices")?.oasisBeneficiary === actorId;
            });
            const oasisGrantedSlot = playerChoices.oasisGrantedSlot ?? null;
            const oasisAllyOptions = [];
            if (hasOasis && !isLong) {
                for (const other of allActors) {
                    if (other.id === actorId) continue;
                    oasisAllyOptions.push({ id: other.id, name: other.name });
                }
            }

            const actorAvailableActions = ((hasEfficient || hasRecovery || hasRecoveryGrant) && !isLong) ? longActions : availableActions;

            // Forager feature: bonus action that doesn't count towards move limit
            const hasForager = _hasForagerFeature(actor);

            const allActions = [...actorAvailableActions, ...extraActions];
            // Feature-granted moves that spend one of the actor's choices, unlike Forager's free
            // bonus below. All are offered on both rest types, since none of the features draw a
            // short/long distinction.
            if (_hasFavorFeature(actor)) {
                allActions.push({ key: "core_favor", label: game.i18n.localize(MOVE_LABELS.core_favor), hasTarget: false });
            }
            if (_hasChangeShapeFeature(actor)) {
                allActions.push({ key: "core_changeShape", label: game.i18n.localize(MOVE_LABELS.core_changeShape), hasTarget: false });
            }
            if (_hasOnlySkinDeepFeature(actor)) {
                allActions.push({ key: "core_onlySkinDeep", label: game.i18n.localize(MOVE_LABELS.core_onlySkinDeep), hasTarget: false });
            }
            // Add Forager as a bonus action if the actor has it
            if (hasForager) {
                allActions.push({ key: "core_forager", label: game.i18n.localize(MOVE_LABELS.core_forager), hasTarget: false, isBonusMove: true, isForagerMove: true });
            }
            // Pipeweed is opt-in: owning the leaf offers the move, choosing it smokes one. Short
            // rest only, and free — it is the consumable that is spent, not a downtime move.
            if (!isLong && _hasPipeweed(actor)) {
                allActions.push({ key: "core_pipeweed", label: game.i18n.localize(MOVE_LABELS.core_pipeweed), hasTarget: false, isBonusMove: true });
            }

            // Each available move carries the list of its selected instances so the
            // same move can be queued multiple times, each with its own target/slot.
            const annotatedActions = allActions.map(a => {
                const canUpgrade = !NO_UPGRADE_MOVES.has(a.key);
                const canBeEfficientSlot = hasEfficient && !isLong && canUpgrade;
                const canBeRecoverySlot = hasRecovery && !isLong && canUpgrade;
                const canBeRecoveryGrantedSlot = hasRecoveryGrant && grantorHasHope && !isLong && canUpgrade;
                // Oasis rerolls a die, so it is only offered on the moves that roll one.
                const rolls = !isLong && ROLLING_MOVES.has(a.key);
                const canBeOasisSlot = hasOasis && rolls;
                const canBeOasisGrantedSlot = hasOasisGrant && rolls;
                const instances = playerChoices.actions
                    .filter(inst => inst.key === a.key)
                    .map(inst => ({
                        id: inst.id,
                        targetActorId: inst.target ?? "",
                        isEfficientSlot: inst.id === efficientSlot,
                        canBeEfficientSlot,
                        isRecoverySlot: inst.id === recoverySlot,
                        canBeRecoverySlot,
                        isRecoveryGrantedSlot: inst.id === recoveryGrantedSlot,
                        canBeRecoveryGrantedSlot,
                        isOasisSlot: inst.id === oasisSlot,
                        canBeOasisSlot,
                        isOasisGrantedSlot: inst.id === oasisGrantedSlot,
                        canBeOasisGrantedSlot
                    }));
                return {
                    ...a,
                    count: instances.length,
                    selected: instances.length > 0,
                    // Move-level gate so standalone moves without any slot skip per-instance rows.
                    hasSlots: canBeEfficientSlot || canBeRecoverySlot || canBeRecoveryGrantedSlot
                        || canBeOasisSlot || canBeOasisGrantedSlot,
                    instances
                };
            });

            // Target options: "Yourself" + all other actors
            const targetOptions = [{ id: "", name: game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.ui.yourself") }];
            for (const other of allActors) {
                if (other.id === actorId) continue;
                targetOptions.push({ id: other.id, name: other.name });
            }

            const isOwnRow = userId === game.user.id;

            const hasPrepare = playerChoices.actions.some(i => i.key === "prepare");

            const forceEffectiveLong = hasEfficient && efficientSlot !== null && !isLong;
            const refreshFeatures = _getRefreshableFeatures(actor, globalRestType, forceEffectiveLong).map(f => f.itemName);
            // Deduplicate names (same item may have multiple actions)
            const uniqueRefreshFeatures = [...new Set(refreshFeatures)];

            // Soothing Speech & Armorer features
            const hasSoothingSpeech = _hasSoothingSpeechFeature(actor);
            const hasArmorer = _hasArmorerFeature(actor);
            const hasPremiumBedroll = _hasPremiumBedrollFeature(actor);
            const hasSelfHealingArmor = _hasSelfHealingArmor(actor);
            const hasCelestialTrance = _hasCelestialTranceFeature(actor);

            // Eloquent feature: prepare options for beneficiary selection
            const hasEloquent = _hasEloquentFeature(actor);
            const eloquentOptions = [];
            if (hasEloquent) {
                for (const other of allActors) {
                    if (other.id === actorId) continue;
                    eloquentOptions.push({ id: other.id, name: other.name });
                }
            }

            // Beastbound feature: resolve companion info
            const hasBeastbound = _hasBeastboundFeature(actor);
            let beastboundInfo = null;
            if (hasBeastbound) {
                const companion = await _getBeastboundCompanion(actor);
                if (companion) {
                    const companionName = companion.name.length > 10 ? companion.name.substring(0, 10) : companion.name;
                    beastboundInfo = { found: true, name: companionName };
                } else {
                    beastboundInfo = { found: false, name: null };
                }
            }

            // Resource bars — mirrors token-tooltip.js data access pattern
            const sys = actor.system;
            const hp     = sys.resources?.hitPoints ?? { value: 0, max: 0 };
            const stress = sys.resources?.stress    ?? { value: 0, max: 0 };
            const hope   = sys.resources?.hope      ?? { value: 0, max: 0 };
            const armor  = sys.resources?.armor     ?? { value: 0, max: 0 };

            const _pct = (v, m) => (!m ? 0 : Math.round(Math.min(100, Math.max(0, (v / m) * 100))));

            // HP/Stress/Armor bars fill as the resource is *spent*; Hope fills as it *increases*
            const hpPct     = _pct(hp.max - hp.value,         hp.max);
            const stressPct = _pct(stress.max - stress.value,  stress.max);
            const hopePct   = _pct(hope.value,                 hope.max);
            const armorPct  = _pct(armor.max - armor.value,    armor.max);

            // Domain Cards information
            const { loadout: domainLoadout, vault: domainVault } = _getDomainCardCounts(actor);
            let domainCardStatus = null;
            if (domainLoadout < 5 && domainVault > 0) {
                domainCardStatus = {
                    type: "warning",
                    message: "DH_QUICKACTIONS.DOWNTIME.ui.vaultToLoadout",
                    count: `${domainLoadout}/5`
                };
            } else if (domainLoadout >= 5 && domainVault > 0) {
                domainCardStatus = {
                    type: "info",
                    message: "DH_QUICKACTIONS.DOWNTIME.ui.swapCards",
                    count: `${domainLoadout}/5`
                };
            }

            rows.push({
                userId,
                userName: user.name,
                actorId,
                actorName,
                avatar: actor.img || "icons/svg/mystery-man.svg",
                included: gmState.included,
                maxChoices,
                actions: annotatedActions,
                targetOptions,
                isOwnRow,
                isGM,
                // The GM may fill in any row (e.g. for absent players); _writeChoices
                // routes GM edits to the row owner's flag, last write wins.
                canInteract: isOwnRow || isGM,
                selectedCount,
                isOverLimit,
                hasPrepare,
                hasEfficient,
                efficientSlot,
                hasForager,
                foragerChoice: playerChoices.foragerChoice ?? null,
                hasEloquent,
                eloquentBeneficiary: playerChoices.eloquentBeneficiary ?? "",
                eloquentOptions,
                refreshFeatures: uniqueRefreshFeatures,
                hasSoothingSpeech,
                hasArmorer,
                hasPremiumBedroll,
                hasSelfHealingArmor,
                hasCelestialTrance,
                hasBeastbound,
                beastboundInfo,
                hasRecovery,
                recoverySlot,
                recoveryBeneficiary,
                recoveryAllyOptions,
                canSelectRecoveryAlly,
                hasRecoveryGrant,
                grantorHasHope,
                recoveryGrantedSlot,
                hasOasis,
                oasisSlot,
                oasisBeneficiary,
                oasisAllyOptions,
                hasOasisGrant,
                oasisGrantedSlot,
                hasTimekeepersPendant: _hasTimekeepersPendant(actor),
                hasPipeweed: !isLong && _hasPipeweed(actor),
                showFeaturesRow: hasEloquent || (hasEfficient && !isLong) || hasSoothingSpeech || hasArmorer || hasPremiumBedroll || hasSelfHealingArmor || hasCelestialTrance || hasBeastbound || (hasRecovery && !isLong) || (hasRecoveryGrant && !isLong) || (hasOasis && !isLong) || (hasOasisGrant && !isLong) || _hasTimekeepersPendant(actor),
                domainCardStatus,
                hp,
                stress,
                hope,
                armor,
                hpPct,
                stressPct,
                hopePct,
                armorPct
            });
        }

        const shortRestCount = game.settings.get(MODULE_ID, "shortRestCount") ?? 0;
        const shortRestPips = Array.from({ length: 3 }, (_, i) => ({
            value: i + 1,
            filled: i < shortRestCount,
            warn: shortRestCount >= 3
        }));

        return {
            rows, isGM, hasAnyActor: rows.length > 0,
            restType: globalRestType, isLong, isShort: !isLong,
            restLabel: isLong ? "DAGGERHEART.APPLICATIONS.Downtime.longRest.title" : "DAGGERHEART.APPLICATIONS.Downtime.shortRest.title",
            foragerOptions: FORAGER_OPTIONS,
            shortRestCount, shortRestPips
        };
    }

    _onFirstRender() {
        // Event delegation: single listener on root element, valid for any select that appears later
        // This ensures the listener is always active, even if selects are added/removed via re-renders
        this.element.addEventListener("change", (event) => {
            if (event.target.classList.contains("dui-target-select")) {
                this._onSetTarget(event);
            }
            if (event.target.classList.contains("dui-forager-select")) {
                this._onSetForagerChoice(event);
            }
            if (event.target.classList.contains("dui-eloquent-select")) {
                this._onSetEloquentBeneficiary(event);
            }
            if (event.target.classList.contains("dui-recovery-beneficiary-select")) {
                this._onSetRecoveryBeneficiary(event);
            }
            if (event.target.classList.contains("dui-oasis-beneficiary-select")) {
                this._onSetOasisBeneficiary(event);
            }
        });

        // Smart tooltip: position first, then show (prevents scroll glitch)
        this.element.addEventListener("mouseenter", (event) => {
            const badge = event.target.closest?.(".dui-refresh-badge") || event.target.closest?.(".dui-domain-card-badge");
            if (!badge) return;
            const tooltip = badge.querySelector(".dui-refresh-tooltip") || badge.querySelector(".dui-domain-card-tooltip");
            if (!tooltip) return;

            // 1. Reset position and keep hidden for measurement
            tooltip.classList.remove("dui-refresh-tooltip--above", "dui-domain-card-tooltip--above");
            tooltip.style.display = "flex";
            const tooltipHeight = tooltip.offsetHeight;
            tooltip.style.removeProperty("display");

            // 2. Decide direction based on available space
            const container = badge.closest(".window-content") || badge.closest(".dui-container");
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const badgeRect = badge.getBoundingClientRect();
                const spaceBelow = containerRect.bottom - badgeRect.bottom - 8;
                const spaceAbove = badgeRect.top - containerRect.top - 8;
                if (tooltipHeight > spaceBelow && spaceAbove > spaceBelow) {
                    tooltip.classList.add(tooltip.classList.contains("dui-refresh-tooltip") ? "dui-refresh-tooltip--above" : "dui-domain-card-tooltip--above");
                }
            }

            // 3. Now reveal (position is already correct, no scroll flash)
            tooltip.style.visibility = "visible";
            tooltip.style.opacity = "1";
        }, true);

        this.element.addEventListener("mouseleave", (event) => {
            const badge = event.target.closest?.(".dui-refresh-badge") || event.target.closest?.(".dui-domain-card-badge");
            if (!badge) return;
            // Don't hide if mouse moved into the tooltip itself
            const related = event.relatedTarget;
            if (related && badge.contains(related)) return;
            const tooltip = badge.querySelector(".dui-refresh-tooltip") || badge.querySelector(".dui-domain-card-tooltip");
            if (!tooltip) return;
            tooltip.style.visibility = "";
            tooltip.style.opacity = "";
        }, true);
    }

    /**
     * Persists a full instance-based choices object for the given actor's owner.
     * The GM may write any user's flag and re-renders directly; a player writes only
     * their own flag (the flag-change hook in main.js re-renders other clients).
     * @param {User} ownerUser - The user who owns the actor being edited.
     * @param {object} choices - A complete instance-based choices object.
     * @returns {Promise<void>}
     */
    async _writeChoices(ownerUser, choices) {
        if (game.user.isGM) {
            await ownerUser.setFlag(MODULE_ID, "downtimeChoices", choices);
            this.render();
        } else {
            await game.user.setFlag(MODULE_ID, "downtimeChoices", choices);
        }
    }

    async _onStartDowntime() {
        if (!game.user.isGM) return;
        await _applyDowntimeEffects();
    }

    async _onToggleIncluded(event, target) {
        if (!game.user.isGM) return;
        const actorId = target.dataset.actorId;
        const state = game.settings.get(MODULE_ID, "downtimeUIState");
        if (!state?.actors?.[actorId]) return;
        state.actors[actorId].included = !state.actors[actorId].included;
        state.timestamp = Date.now();
        await game.settings.set(MODULE_ID, "downtimeUIState", state);
    }

    async _onConfigMaxChoices(event, target) {
        if (!game.user.isGM) return;
        const actorId = target.dataset.actorId;
        const state = game.settings.get(MODULE_ID, "downtimeUIState");
        const actorState = state?.actors?.[actorId] ?? {};

        const result = await ConfigureActorApp.open(actorId, actorState);
        if (!result) return;

        Object.assign(state.actors[actorId], result);
        state.timestamp = Date.now();
        await game.settings.set(MODULE_ID, "downtimeUIState", state);

        // Persist configs so they survive across sessions
        const persistedConfigs = game.settings.get(MODULE_ID, "downtimeActorConfigs") ?? {};
        persistedConfigs[actorId] = {
            maxChoices: result.maxChoices,
            hpModifier: result.hpModifier,
            stressModifier: result.stressModifier,
            hopeModifier: result.hopeModifier,
            armorSlotModifier: result.armorSlotModifier
        };
        await game.settings.set(MODULE_ID, "downtimeActorConfigs", persistedConfigs);
    }

    _onOpenMovesConfig() {
        if (!game.user.isGM) return;
        new ConfigureMovesApp().render(true);
    }

    async _onResendDowntime() {
        if (!game.user.isGM) return;
        await game.settings.set(MODULE_ID, "downtimeUIOpen", { timestamp: Date.now() });
        ui.notifications.info(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.resent"));
    }

    async _onSetRestType(event, target) {
        if (!game.user.isGM) return;
        const restType = target.dataset.restType;
        const state = game.settings.get(MODULE_ID, "downtimeUIState");
        if (!state?.actors) return;
        state.restType = restType;
        state.timestamp = Date.now();
        await game.settings.set(MODULE_ID, "downtimeUIState", state);
        // Clear all player choices when switching rest type
        for (const user of game.users) {
            if (user.isGM) continue;
            if (user.getFlag(MODULE_ID, "downtimeChoices")) {
                await user.unsetFlag(MODULE_ID, "downtimeChoices");
            }
        }
    }

    /**
     * Sets the consecutive short rest counter from the GM-only pip strip. Clicking a pip
     * raises the count to that pip's position; clicking the last filled pip lowers it by one,
     * so the GM can both add and clear rests by hand when the automatic count drifts.
     * The counter is a world setting, so only the GM may write it.
     * @param {Event} event - The originating click event.
     * @param {HTMLElement} target - The clicked pip, carrying data-count.
     * @returns {Promise<void>}
     */
    async _onSetShortRestCount(event, target) {
        if (!game.user.isGM) return;
        const value = Number(target.dataset.count) || 0;
        const current = game.settings.get(MODULE_ID, "shortRestCount") ?? 0;
        await game.settings.set(MODULE_ID, "shortRestCount", value === current ? value - 1 : value);
        this.render();
    }

    /**
     * Adds one instance of a move to the actor's choices. The same move may be added
     * multiple times; each instance gets a unique id and its own independent target.
     * @param {Event} event - The originating click event.
     * @param {HTMLElement} target - The add button (data-actor-id / data-action-key).
     * @returns {Promise<void>}
     */
    async _onAddAction(event, target) {
        const actorId = target.dataset.actorId;
        const actionKey = target.dataset.actionKey;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        const instance = { id: foundry.utils.randomID(), key: actionKey, target: null };
        choices.actions = [...choices.actions, instance];

        // workOnProject is long-rest-only: auto-assign the new instance to an upgrade
        // slot when selected during a short rest so it gains Long Rest quality.
        const state = game.settings.get(MODULE_ID, "downtimeUIState");
        const restType = state?.restType || "short";
        if (actionKey === "workOnProject" && restType === "short") {
            const actor = ownerUser.character;
            // Prefer the Recovery slot if the actor has Recovery but not Efficient.
            if (actor && _hasRecoveryFeature(actor) && !_hasEfficientFeature(actor)) {
                choices.recoverySlot = instance.id;
            } else {
                choices.efficientSlot = instance.id;
            }
        }

        await this._writeChoices(ownerUser, choices);
    }

    /**
     * Removes the most recently added instance of a move. Any upgrade slot that
     * referenced the removed instance is cleared.
     * @param {Event} event - The originating click event.
     * @param {HTMLElement} target - The remove button (data-actor-id / data-action-key).
     * @returns {Promise<void>}
     */
    async _onRemoveAction(event, target) {
        const actorId = target.dataset.actorId;
        const actionKey = target.dataset.actionKey;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        // Remove the last instance carrying this key.
        let removedId = null;
        for (let i = choices.actions.length - 1; i >= 0; i--) {
            if (choices.actions[i].key === actionKey) {
                removedId = choices.actions[i].id;
                choices.actions = [...choices.actions.slice(0, i), ...choices.actions.slice(i + 1)];
                break;
            }
        }
        if (removedId === null) return;

        if (choices.efficientSlot === removedId) choices.efficientSlot = null;
        if (choices.recoverySlot === removedId) choices.recoverySlot = null;
        if (choices.recoveryGrantedSlot === removedId) choices.recoveryGrantedSlot = null;

        await this._writeChoices(ownerUser, choices);
    }

    /**
     * Shared toggle logic for the three upgrade-slot badges (Efficient, Recovery,
     * Recovery-granted). Each badge marks one move *instance* to gain Long Rest
     * quality during a short rest. Because a workOnProject instance is only valid
     * while it holds a slot, moving this slot off such an instance during a short
     * rest also removes it.
     * @param {HTMLElement} target - The badge button (data-actor-id / data-instance-id).
     * @param {"efficientSlot"|"recoverySlot"|"recoveryGrantedSlot"} slotField - Which slot to toggle.
     * @returns {Promise<void>}
     */
    async _toggleSlot(target, slotField) {
        const actorId = target.dataset.actorId;
        const instanceId = target.dataset.instanceId;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        const prevId = choices[slotField];
        const newId = prevId === instanceId ? null : instanceId;
        choices[slotField] = newId;

        // If this slot moved off a workOnProject instance during a short rest, remove it.
        if (prevId && prevId !== newId) {
            const prev = choices.actions.find(i => i.id === prevId);
            if (prev?.key === "workOnProject") {
                const state = game.settings.get(MODULE_ID, "downtimeUIState");
                if ((state?.restType || "short") === "short") {
                    choices.actions = choices.actions.filter(i => i.id !== prevId);
                }
            }
        }

        await this._writeChoices(ownerUser, choices);
    }

    /**
     * Toggles the Efficient upgrade slot for a move instance.
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    async _onToggleEfficientSlot(event, target) {
        await this._toggleSlot(target, "efficientSlot");
    }

    /**
     * Toggles the Recovery upgrade slot for a move instance (actor's own Recovery feature).
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    async _onToggleRecoverySlot(event, target) {
        await this._toggleSlot(target, "recoverySlot");
    }

    /**
     * Toggles the Recovery grant slot for a move instance (beneficiary of an ally's Recovery).
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    async _onToggleRecoveryGrantedSlot(event, target) {
        await this._toggleSlot(target, "recoveryGrantedSlot");
    }

    /**
     * Toggles the Oasis reroll slot for a move instance (actor's own Duneborne feature).
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    async _onToggleOasisSlot(event, target) {
        await this._toggleSlot(target, "oasisSlot");
    }

    /**
     * Toggles the Oasis reroll slot for a move instance (beneficiary of an ally's Oasis).
     * @param {Event} event
     * @param {HTMLElement} target
     * @returns {Promise<void>}
     */
    async _onToggleOasisGrantedSlot(event, target) {
        await this._toggleSlot(target, "oasisGrantedSlot");
    }

    /**
     * Stores which ally receives this actor's Oasis reroll. Clearing the selection keeps the
     * reroll for the actor themselves.
     * @param {Event} event - Change event from the beneficiary select.
     * @returns {Promise<void>}
     */
    async _onSetOasisBeneficiary(event) {
        const select = event.target;
        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === select.dataset.actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        choices.oasisBeneficiary = select.value || null;
        // Handing the reroll away releases the slot the actor had marked for themselves.
        if (choices.oasisBeneficiary) choices.oasisSlot = null;
        await this._writeChoices(ownerUser, choices);
    }

    async _onSetTarget(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const instanceId = select.dataset.instanceId;
        const targetId = select.value || null;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        choices.actions = choices.actions.map(i => (i.id === instanceId ? { ...i, target: targetId } : i));
        await this._writeChoices(ownerUser, choices);
    }

    async _onSetForagerChoice(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const choiceValue = parseInt(select.value) || null;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        choices.foragerChoice = choiceValue;
        await this._writeChoices(ownerUser, choices);
    }

    async _onSetEloquentBeneficiary(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const beneficiaryId = select.value || null;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        choices.eloquentBeneficiary = beneficiaryId;
        await this._writeChoices(ownerUser, choices);
    }

    /**
     * Handles selection of a Recovery beneficiary ally.
     * The Recovery actor spends 1 Hope at execution time; this only stores the selection.
     * @param {Event} event - The change event from the recovery beneficiary select.
     */
    async _onSetRecoveryBeneficiary(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const beneficiaryId = select.value || null;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const choices = _readDowntimeChoices(ownerUser);
        choices.recoveryBeneficiary = beneficiaryId;
        await this._writeChoices(ownerUser, choices);
    }

    _onClose(options) {
        super._onClose(options);
        DowntimeUIApp._instance = null;
    }
}

// ==================================================================
// EXPORTED FUNCTIONS
// ==================================================================

export async function activateDowntimeUI() {
    if (!game.user.isGM) {
        ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.DOWNTIME.notify.gmOnly"));
        return;
    }
    if (DowntimeUIApp._instance?.rendered) {
        DowntimeUIApp._instance.bringToFront();
        return;
    }

    // Initialize GM-controlled state with all non-GM character actors
    // Load persistent configs so modifiers and maxChoices survive across sessions
    const savedConfigs = game.settings.get(MODULE_ID, "downtimeActorConfigs") ?? {};
    const defaults = { included: true, maxChoices: 2, hpModifier: 0, stressModifier: 0, hopeModifier: 0, armorSlotModifier: 0 };
    const actors = {};
    for (const user of game.users) {
        if (user.isGM) continue;
        if (_isDowntimeDisabledUser(user)) continue;
        const actor = user.character;
        if (!actor || actor.type !== "character") continue;
        const saved = savedConfigs[actor.id] ?? {};
        actors[actor.id] = { ...defaults, ...saved, included: user.active };
        // Clear any previous player choices
        if (user.getFlag(MODULE_ID, "downtimeChoices")) {
            await user.unsetFlag(MODULE_ID, "downtimeChoices");
        }
    }
    await game.settings.set(MODULE_ID, "downtimeUIState", { timestamp: Date.now(), restType: "short", actors });

    DowntimeUIApp._instance = new DowntimeUIApp();
    DowntimeUIApp._instance.render(true);

    // Broadcast to players so they open the UI too
    await game.settings.set(MODULE_ID, "downtimeUIOpen", { timestamp: Date.now() });
}

export function getDowntimeUIInstance() {
    return DowntimeUIApp._instance;
}

export function openDowntimeUIForPlayer() {
    if (_isDowntimeDisabledUser(game.user)) return;
    if (DowntimeUIApp._instance?.rendered) return;
    DowntimeUIApp._instance = new DowntimeUIApp();
    DowntimeUIApp._instance.render(true);
}