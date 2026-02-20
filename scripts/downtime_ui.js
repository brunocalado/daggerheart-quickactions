/**
 * Downtime UI App and related helpers.
 * Contains the full Downtime UI system (DowntimeUIApp, helpers, and exported activation functions).
 */

import { rollD4WithDiceSoNice, rollD6WithDiceSoNice } from "./apps.js";

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

const FORAGER_OPTIONS = [
    { value: 1, label: "A unique food", effect: "Clear 2 Stress", itemUuid: "Compendium.daggerheart-quickactions.items.Item.1tnzi64VuC8kTQKn" },
    { value: 2, label: "A beautiful relic", effect: "Gain 2 Hope", itemUuid: "Compendium.daggerheart-quickactions.items.Item.q1VJh3YHE1peFgpP" },
    { value: 3, label: "An arcane rune", effect: "+2 to a Spellcast Roll", itemUuid: "Compendium.daggerheart-quickactions.items.Item.vPGhnT1C84fwNiYf" },
    { value: 4, label: "A healing vial", effect: "Clear 2 Hit Points", itemUuid: "Compendium.daggerheart-quickactions.items.Item.C1lOuQ5TGYVCIOqB" },
    { value: 5, label: "A luck charm", effect: "Reroll any die", itemUuid: "Compendium.daggerheart-quickactions.items.Item.Fm6XzoBkT7G4a9La" }
];

// ==================================================================
// DOWNTIME UI HELPERS
// ==================================================================

function _getActorTier(actor) {
    const level = actor.system?.levelData?.level?.current ?? 1;
    if (level >= 8) return 4;
    if (level >= 5) return 3;
    if (level >= 2) return 2;
    return 1;
}

function _getArmorItems(actor) {
    return actor.items.filter(i => i.system?.equipped === true && i.system?.marks !== undefined);
}

function _getTotalMarks(item) {
    const m = item.system.marks;
    if (typeof m === "number") return m;
    if (Array.isArray(m)) return m.filter(Boolean).length;
    if (typeof m === "object" && m !== null) return Object.values(m).filter(Boolean).length;
    return 0;
}

async function _setMarks(item, newCount) {
    const marks = item.system.marks;
    if (typeof marks === "number") {
        await item.update({ "system.marks": Math.max(0, newCount) });
    } else if (Array.isArray(marks)) {
        const newArray = [...marks];
        const truthyIndices = newArray.reduce((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
        const toRemove = truthyIndices.length - Math.max(0, newCount);
        for (let i = 0; i < toRemove; i++) {
            newArray[truthyIndices[truthyIndices.length - 1 - i]] = false;
        }
        await item.update({ "system.marks": newArray });
    } else if (typeof marks === "object" && marks !== null) {
        const newObj = { ...marks };
        const truthyKeys = Object.entries(newObj).filter(([, v]) => Boolean(v)).map(([k]) => k);
        const toRemove = truthyKeys.length - Math.max(0, newCount);
        for (let i = 0; i < toRemove; i++) {
            newObj[truthyKeys[truthyKeys.length - 1 - i]] = false;
        }
        await item.update({ "system.marks": newObj });
    }
}

async function _reduceArmorMarks(actor, reduction) {
    const items = _getArmorItems(actor);
    let remaining = reduction;
    for (const item of items) {
        if (remaining <= 0) break;
        const current = _getTotalMarks(item);
        if (current <= 0) continue;
        const removeFromThis = Math.min(current, remaining);
        await _setMarks(item, current - removeFromThis);
        remaining -= removeFromThis;
    }
}

async function _clearAllArmorMarks(actor) {
    const items = _getArmorItems(actor);
    for (const item of items) {
        await _setMarks(item, 0);
    }
}

/**
 * Gets the maximum Hope from the actor's derived data.
 */
function _getMaxHope(actor) {
    // Accesses derived data directly.
    // Ensures compatibility with Active Effects, Scars, and system settings.
    return actor.system.resources.hope.max ?? 0;
}

function _hasCoreFeature(actor, featureKey, fallbackName) {
    const coreFeatures = game.settings.get("daggerheart-quickactions", "downtimeCoreFeatures") ?? [];
    const feature = coreFeatures.find(f => f.key === featureKey);
    const name = feature?.label || fallbackName;
    return actor.items.some(i => i.name === name);
}

function _hasEfficientFeature(actor) {
    return _hasCoreFeature(actor, "efficient", "Efficient");
}

function _hasForagerFeature(actor) {
    return _hasCoreFeature(actor, "forager", "Forager");
}

function _hasPremiumBedrollFeature(actor) {
    return _hasCoreFeature(actor, "premiumBedroll", "Premium Bedroll");
}

function _hasCelestialTranceFeature(actor) {
    return _hasCoreFeature(actor, "celestialTrance", "Celestial Trance");
}

function _hasEloquentFeature(actor) {
    return _hasCoreFeature(actor, "eloquent", "Eloquent");
}

function _hasSoothingSpeechFeature(actor) {
    return _hasCoreFeature(actor, "soothingSpeech", "Soothing Speech");
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
    const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
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
        const playerChoices = ownerUser?.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {} };
        includedActors.push({ actor, actorState: { ...gmState, ...playerChoices } });
    }

    if (includedActors.length === 0) {
        ui.notifications.warn("No actors selected for downtime.");
        return;
    }

    // GM Fear roll
    const fearRoll = await rollD4WithDiceSoNice();
    if (fearRoll === null) return;

    let addedFear = fearRoll;
    let calculationText = `(1d4) ${fearRoll}`;
    if (isLong) {
        addedFear += includedActors.length;
        calculationText = `(1d4 + ${includedActors.length} PCs) ${fearRoll} + ${includedActors.length}`;
    }
    const currentFear = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
    const newFear = Math.min(currentFear + addedFear, 12);
    await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, newFear);

    // Prepare bonus calculation
    const preparers = includedActors.filter(a => a.actorState.actions.includes("prepare"));
    const prepareBonus = preparers.length >= 2 ? 2 : 1;

    // Per-actor effects
    const resultsByActor = new Map();

    for (const { actor, actorState } of includedActors) {
        if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
        const actorEvents = resultsByActor.get(actor.id).events;
        const tier = _getActorTier(actor);
        const targets = actorState.targets ?? {};

        // Read per-actor modifiers from GM state
        const gmActorState = state.actors?.[actor.id] ?? {};
        const hpModifier = gmActorState.hpModifier ?? 0;
        const stressModifier = gmActorState.stressModifier ?? 0;
        const hopeModifier = gmActorState.hopeModifier ?? 0;
        const armorSlotModifier = gmActorState.armorSlotModifier ?? 0;

        // Efficient feature: one action can use long rest behavior during short rest
        const hasEfficient = _hasEfficientFeature(actor);
        const efficientSlot = actorState.efficientSlot ?? null;

        for (const action of actorState.actions) {
            const targetActor = targets[action] ? (game.actors.get(targets[action]) ?? actor) : actor;
            const isSelf = targetActor.id === actor.id;
            const effectiveLong = isLong || (hasEfficient && action === efficientSlot);

            if (action === "tendWounds") {
                // Read the target actor's modifier (when healing others, use target's modifier)
                const targetHpMod = isSelf ? hpModifier : (state.actors?.[targetActor.id]?.hpModifier ?? 0);
                // Soothing Speech: +1 HP on target when tending another character
                const hasSoothing = _hasSoothingSpeechFeature(actor);
                const soothingBonus = (hasSoothing && !isSelf) ? 1 : 0;
                if (effectiveLong) {
                    await targetActor.update({ "system.resources.hitPoints.value": 0 });
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    actorEvents.push(`Tend to Wounds${target} (Recover All HP)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const recovery = roll.total + tier + targetHpMod + soothingBonus;
                    const currentHP = targetActor.system.resources?.hitPoints?.value ?? 0;
                    const newHP = Math.max(0, currentHP - recovery);
                    await targetActor.update({ "system.resources.hitPoints.value": newHP });
                    const modText = targetHpMod > 0 ? ` +${targetHpMod} mod` : "";
                    const soothText = soothingBonus > 0 ? " +1 Soothing Speech" : "";
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    actorEvents.push(`Tend to Wounds${target} (Recover ${recovery} HP [Roll: ${roll.total}${modText}${soothText}])`);
                }
                // Soothing Speech self-heal: clear 2 HP on the caster when tending another
                if (hasSoothing && !isSelf) {
                    const selfHP = actor.system.resources?.hitPoints?.value ?? 0;
                    const newSelfHP = Math.max(0, selfHP - 2);
                    await actor.update({ "system.resources.hitPoints.value": newSelfHP });
                    actorEvents.push(`Soothing Speech (Self-heal 2 HP)`);
                }
            }

            if (action === "clearStress") {
                // Premium Bedroll bonus: +1 stress recovery
                const premiumBedrollBonus = _hasPremiumBedrollFeature(actor) ? 1 : 0;

                if (effectiveLong) {
                    await actor.update({ "system.resources.stress.value": 0 });
                    const bonusText = premiumBedrollBonus > 0 ? " (+1 Premium Bedroll)" : "";
                    actorEvents.push(`Clear Stress (Recover All Stress)${bonusText}`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const recovery = roll.total + tier + stressModifier + premiumBedrollBonus;
                    const currentStress = actor.system.resources?.stress?.value ?? 0;
                    const newStress = Math.max(0, currentStress - recovery);
                    await actor.update({ "system.resources.stress.value": newStress });
                    const modText = stressModifier > 0 ? ` +${stressModifier} mod` : "";
                    const bonusText = premiumBedrollBonus > 0 ? " +1 Premium Bedroll" : "";
                    actorEvents.push(`Clear Stress (Recover ${recovery} Stress [Roll: ${roll.total}${modText}${bonusText}])`);
                }
            }

            if (action === "repairArmor") {
                const targetArmorMod = isSelf ? armorSlotModifier : (state.actors?.[targetActor.id]?.armorSlotModifier ?? 0);
                if (effectiveLong) {
                    await _clearAllArmorMarks(targetActor);
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    actorEvents.push(`Repair Armor${target} (Recover All Armor Slots)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const reduction = roll.total + tier + targetArmorMod;
                    await _reduceArmorMarks(targetActor, reduction);
                    const modText = targetArmorMod > 0 ? ` +${targetArmorMod} mod` : "";
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    actorEvents.push(`Repair Armor${target} (Recover ${reduction} Armor Slots [Roll: ${roll.total}${modText}])`);
                }
            }

            if (action === "prepare") {
                const currentHope = actor.system.resources?.hope?.value ?? 0;
                const maxHope = _getMaxHope(actor);
                const totalGain = prepareBonus + hopeModifier;
                const newHope = Math.min(currentHope + totalGain, maxHope);
                const actualGain = newHope - currentHope;
                await actor.update({ "system.resources.hope.value": newHope });
                const modText = hopeModifier > 0 ? ` +${hopeModifier} mod` : "";
                const cappedText = actualGain < totalGain ? " [capped]" : "";
                actorEvents.push(`Prepare (+${actualGain} Hope${prepareBonus === 2 ? ", paired" : ""}${modText}${cappedText})`);
            }

            // Custom move actions
            if (action.startsWith("custom_")) {
                const moveLabel = action.slice("custom_".length);
                actorEvents.push(`${moveLabel}`);
            }

            // Item move actions
            if (action.startsWith("itemmove_")) {
                const itemUuid = action.slice("itemmove_".length);
                const moveItem = await fromUuid(itemUuid);
                const itemName = moveItem?.name ?? "Unknown Item";
                actorEvents.push(`${itemName}`);
            }

            // Forager core feature action
            if (action === "core_forager") {
                const foragerRoll = await rollD6WithDiceSoNice();
                if (foragerRoll !== null) {
                    let resultOption;
                    if (foragerRoll <= 5) {
                        resultOption = FORAGER_OPTIONS[foragerRoll - 1];
                    } else {
                        // Roll 6 = choose: use player's pre-selected choice, fallback to option 1
                        const choice = actorState.foragerChoice ?? 1;
                        resultOption = FORAGER_OPTIONS[choice - 1] ?? FORAGER_OPTIONS[0];
                    }
                    const chosenText = foragerRoll === 6 ? " (Chose)" : "";
                    actorEvents.push(`Forage [Roll: ${foragerRoll}${chosenText}] — ${resultOption.label} (${resultOption.effect})`);

                    // Grant the foraged item to the actor's inventory
                    if (resultOption.itemUuid) {
                        try {
                            const foragedItem = await fromUuid(resultOption.itemUuid);
                            if (foragedItem) {
                                const itemData = foragedItem.toObject();
                                await actor.createEmbeddedDocuments("Item", [itemData]);
                            }
                        } catch (err) {
                            console.error(`daggerheart-quickactions | Failed to grant foraged item "${resultOption.label}":`, err);
                        }
                    }
                }
            }

            // Craft downtime actions
            if (action.startsWith("craft_")) {
                const recipeUuid = action.slice("craft_".length);
                const recipeItem = await fromUuid(recipeUuid);
                const recipeName = recipeItem?.name ?? "Unknown Recipe";
                actorEvents.push(`Used ${recipeName}`);

                // Find matching craft entry to grant the crafted item
                const savedCraft = game.settings.get("daggerheart-quickactions", "downtimeCraftEntries") ?? [];
                const craftEntries = savedCraft.length > 0 ? savedCraft : DEFAULT_CRAFT_ENTRIES;
                const entry = craftEntries.find(e => e.recipeUuid === recipeUuid);
                if (entry?.craftUuid) {
                    try {
                        const craftItem = await fromUuid(entry.craftUuid);
                        if (craftItem) {
                            const itemData = craftItem.toObject();
                            await actor.createEmbeddedDocuments("Item", [itemData]);
                            const craftMsg = `
                            <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden; font-family: 'Aleo', serif;">
                                <div class="card-content" style="background: #191919; padding: 12px; text-align: center;">
                                    <div style="color: #C9A060; font-weight: bold; font-size: 1.1em; margin-bottom: 6px;">Item Crafted</div>
                                    <div style="color: #e0e0e0;">${actor.name} crafted <strong style="color:#C9A060;">${craftItem.name}</strong> and it was added to their inventory.</div>
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
    for (const { actor } of includedActors) {
        if (_hasPremiumBedrollFeature(actor)) {
            const currentStress = actor.system.resources?.stress?.value ?? 0;
            const newStress = Math.max(0, currentStress - 1);
            await actor.update({ "system.resources.stress.value": newStress });
            if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
            resultsByActor.get(actor.id).events.push(`Premium Bedroll (Automatic +1 Stress Recovery)`);
        }
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

        const refreshedNames = [];
        for (const [, record] of itemUpdates) {
            if (!record.changed) continue;
            await record.item.update(record.updateData);
            refreshedNames.push(record.name);
        }
        if (refreshedNames.length > 0) {
            if (!resultsByActor.has(actor.id)) resultsByActor.set(actor.id, { name: actor.name, events: [] });
            resultsByActor.get(actor.id).events.push(`Refreshed: ${refreshedNames.join(", ")}`);
        }
    }

    // Chat card
    const restLabel = isLong ? "Long Rest" : "Short Rest";
    
    let eventsHtml = "";
    for (const [actorId, data] of resultsByActor) {
        if (data.events.length === 0) continue;
        eventsHtml += `
        <div style="margin-bottom: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 6px;">
            <div style="font-weight: bold; color: #C9A060; border-bottom: 1px solid rgba(201,160,96,0.3); margin-bottom: 4px; padding-bottom: 2px; font-size: 1.05em;">
                ${data.name}
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
            <div style="text-align: center; font-weight: bold; color: #C9A060; font-size: 1.1em; margin-bottom: 8px;">The GM earns Fear</div>
            <div style="text-align: center; font-size: 2.5em; font-weight: bold; color: #ffffff; text-shadow: 0 0 10px #C9A060;">+${addedFear}</div>
            <div style="text-align: center; color: #ccc; font-size: 0.9em; margin-top: 4px;">${calculationText}</div>
            <div style="text-align: center; color: #C9A060; font-size: 1em; margin-top: 8px;">Current Total: ${newFear}</div>
            <hr style="border: 1px solid rgba(201,160,96,0.3); margin: 12px 0;">
            <div style="color: #e0e0e0; font-size: 0.9em; line-height: 1.6;">
                ${eventsHtml}
            </div>
        </div>
    </div>`;
    await ChatMessage.create({ user: game.user.id, style: CONST.CHAT_MESSAGE_STYLES.OTHER, content });

    // Close and clear state + player flags
    DowntimeUIApp._instance?.close();
    await game.settings.set("daggerheart-quickactions", "downtimeUIState", {});
    for (const user of game.users) {
        if (user.isGM) continue;
        if (user.getFlag("daggerheart-quickactions", "downtimeChoices")) {
            await user.unsetFlag("daggerheart-quickactions", "downtimeChoices");
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
        window: { title: "Configure Actor", resizable: true },
        position: { width: 480, height: 320 },
        actions: {
            saveConfig: ConfigureActorApp.prototype._onSaveConfig
        }
    };

    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/configure-actor.hbs" } };

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
        window: { title: "+Moves", resizable: true },
        position: { width: 480, height: 500 },
        actions: {
            saveMovesConfig: ConfigureMovesApp.prototype._onSaveMovesConfig,
            addCraftRow: ConfigureMovesApp.prototype._onAddCraftRow,
            removeCraftRow: ConfigureMovesApp.prototype._onRemoveCraftRow,
            addCustomRow: ConfigureMovesApp.prototype._onAddCustomRow,
            removeCustomRow: ConfigureMovesApp.prototype._onRemoveCustomRow,
            addItemMoveRow: ConfigureMovesApp.prototype._onAddItemMoveRow,
            removeItemMoveRow: ConfigureMovesApp.prototype._onRemoveItemMoveRow,
            removeCoreItem: ConfigureMovesApp.prototype._onRemoveCoreItem
        }
    };

    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/configure-moves.hbs" } };

    async _prepareContext() {
        const saved = game.settings.get("daggerheart-quickactions", "downtimeCraftEntries") ?? [];
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

        const customMovesRaw = game.settings.get("daggerheart-quickactions", "downtimeCustomMoves") ?? [];
        const customMoves = customMovesRaw.map(m => ({
            label: m.label || "",
            restType: m.restType || "any"
        }));

        const savedItemMoves = game.settings.get("daggerheart-quickactions", "downtimeItemMoveEntries") ?? [];
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
        const savedCore = game.settings.get("daggerheart-quickactions", "downtimeCoreFeatures") ?? [];
        const defaultCore = [
            { key: "efficient", label: "Efficient", itemUuid: "Compendium.daggerheart.ancestries.Item.2xlqKOkDxWHbuj4t", description: "During Short Rest, one selected action can be upgraded to Long Rest quality." },
            { key: "forager", label: "Forager", itemUuid: "Compendium.daggerheart.domains.Item.06UapZuaA5S6fAKl", description: "Grants a bonus Forage action that does not count towards the move limit." },
            { key: "premiumBedroll", label: "Premium Bedroll", itemUuid: "Compendium.daggerheart.loot.Item.QGYPNBIufpBguwjC", description: "Refreshes additional resources during rest, as if it were a Long Rest." },
            { key: "celestialTrance", label: "Celestial Trance", itemUuid: "Compendium.daggerheart.ancestries.Item.TfolXWFG2W2hx6sK", description: "Grants +1 extra move during downtime." },
            { key: "eloquent", label: "Eloquent", itemUuid: "Compendium.daggerheart.subclasses.Item.5bmB1YcxiJVNVXDM", description: "Allows granting a bonus move to another party member." },
            { key: "soothingSpeech", label: "Soothing Speech", itemUuid: "Compendium.daggerheart.domains.Item.QED2PDYePOSTbLtC", description: "When using Tend to Wounds on another character during Short Rest, clear an additional HP on the target. You also clear 2 HP on yourself." }
        ];
        const savedByKey = new Map(savedCore.map(e => [e.key, e]));
        const coreRaw = defaultCore.map(d => {
            const saved = savedByKey.get(d.key);
            return saved ? { ...d, ...saved, description: d.description } : d;
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

        return { craftEntries: resolvedEntries, customMoves, itemMoveEntries, coreFeatures };
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
                ui.notifications.warn("Only items can be dropped here.");
                return;
            }

            const item = await fromUuid(data.uuid);
            if (!item) {
                ui.notifications.warn("Could not resolve item.");
                return;
            }
            if (!ALLOWED_CRAFT_TYPES.includes(item.type)) {
                ui.notifications.warn(`Only loot, consumable, weapon, or armor items are allowed. Got: ${item.type}`);
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
                    ui.notifications.warn("Only items can be dropped here.");
                    return;
                }

                const item = await fromUuid(data.uuid);
                if (!item) {
                    ui.notifications.warn("Could not resolve item.");
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
                    ui.notifications.warn("Only items can be dropped here.");
                    return;
                }

                const item = await fromUuid(data.uuid);
                if (!item) {
                    ui.notifications.warn("Could not resolve item.");
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
        newRow.innerHTML = `
            <div class="dui-craft-drop empty" data-slot="recipe" data-index="${nextIndex}">
                <i class="fas fa-scroll"></i>
                <span class="dui-craft-name">Drag Recipe Here</span>
            </div>
            <i class="fas fa-arrow-right dui-craft-arrow"></i>
            <div class="dui-craft-drop empty" data-slot="craft" data-index="${nextIndex}">
                <i class="fas fa-flask"></i>
                <span class="dui-craft-name">Drag Crafted Item Here</span>
            </div>
            <button type="button" class="dui-craft-remove" data-action="removeCraftRow" data-index="${nextIndex}" title="Remove">
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
        newRow.innerHTML = `
            <input type="text" class="dui-custom-input" name="customMove_${nextIndex}" value="" maxlength="27" placeholder="Move name...">
            <select class="dui-rest-type-select">
                <option value="any" selected>Any</option>
                <option value="short">Short</option>
                <option value="long">Long</option>
            </select>
            <button type="button" class="dui-craft-remove" data-action="removeCustomRow" data-index="${nextIndex}" title="Remove">
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
        newRow.innerHTML = `
            <div class="dui-itemmove-drop empty" data-index="${nextIndex}">
                <i class="fas fa-box-open"></i>
                <span class="dui-itemmove-name">Drag Item Here</span>
            </div>
            <select class="dui-rest-type-select">
                <option value="any" selected>Any</option>
                <option value="short">Short</option>
                <option value="long">Long</option>
            </select>
            <button type="button" class="dui-craft-remove" data-action="removeItemMoveRow" data-index="${nextIndex}" title="Remove">
                <i class="fas fa-times"></i>
            </button>
            <input type="hidden" name="itemMove_${nextIndex}" value="">`;
        list.appendChild(newRow);
    }

    _onRemoveItemMoveRow(event, target) {
        target.closest('.dui-itemmove-row').remove();
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
            dropZone.querySelector('.dui-core-item-name').textContent = "Drag Item Here";
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
            const label = el.querySelector(`input[name="coreLabel_${k}"]`).value;
            const itemUuid = el.querySelector(`input[name="coreItem_${k}"]`).value;
            coreFeatures.push({ key, label, itemUuid });
            k++;
        }

        await game.settings.set("daggerheart-quickactions", "downtimeCraftEntries", craftEntries);
        await game.settings.set("daggerheart-quickactions", "downtimeCustomMoves", customMoves);
        await game.settings.set("daggerheart-quickactions", "downtimeItemMoveEntries", itemMoveEntries);
        await game.settings.set("daggerheart-quickactions", "downtimeCoreFeatures", coreFeatures);
        ui.notifications.info("Moves configuration saved.");
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

    static DEFAULT_OPTIONS = {
        id: "daggerheart-downtime-ui",
        classes: ["dh-downtime-ui"],
        window: { title: "Downtime", icon: "fas fa-moon", resizable: true, controls: [] },
        position: { width: 720, height: "auto" },
        actions: {
            startDowntime: DowntimeUIApp.prototype._onStartDowntime,
            toggleIncluded: DowntimeUIApp.prototype._onToggleIncluded,
            configMaxChoices: DowntimeUIApp.prototype._onConfigMaxChoices,
            setRestType: DowntimeUIApp.prototype._onSetRestType,
            toggleAction: DowntimeUIApp.prototype._onToggleAction,
            toggleEfficientSlot: DowntimeUIApp.prototype._onToggleEfficientSlot,
            openMovesConfig: DowntimeUIApp.prototype._onOpenMovesConfig,
            resendDowntime: DowntimeUIApp.prototype._onResendDowntime
        }
    };

    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/downtime-ui.hbs" } };

    async _prepareContext() {
        const isGM = game.user.isGM;
        const savedState = game.settings.get("daggerheart-quickactions", "downtimeUIState");
        const rows = [];

        const globalRestType = savedState?.restType || "short";
        const isLong = globalRestType === "long";

        const shortActions = [
            { key: "tendWounds", label: "Tend to Wounds", hasTarget: true },
            { key: "clearStress", label: "Clear Stress", hasTarget: false },
            { key: "repairArmor", label: "Repair Armor", hasTarget: true },
            { key: "prepare", label: "Prepare", hasTarget: false }
        ];
        const longActions = [
            ...shortActions,
            { key: "workOnProject", label: "Work on a Project", hasTarget: false }
        ];
        const availableActions = isLong ? longActions : shortActions;

        // Build actor list (all non-GM character actors)
        const allActors = [];
        for (const user of game.users) {
            if (user.isGM) continue;
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
            // Eloquent bonus: +1 move if chosen by another party member
            const playerChoices = user.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {}, eloquentBeneficiary: null };
            const eloquentGiver = allActors.find(a => a.id !== actorId && _hasEloquentFeature(a.actor));
            const eloquentGiverChoices = eloquentGiver ? game.users.find(u => u.character?.id === eloquentGiver.id)?.getFlag("daggerheart-quickactions", "downtimeChoices") : null;
            if (eloquentGiverChoices?.eloquentBeneficiary === actorId) {
                maxChoices += 1;
            }

            // Exclude bonus moves (e.g. Forager) from the move count
            const selectedCount = playerChoices.actions.filter(a => a !== "core_forager").length;
            const isOverLimit = selectedCount > maxChoices;

            // Build craft downtime actions from global setting
            const savedCraft = game.settings.get("daggerheart-quickactions", "downtimeCraftEntries") ?? [];
            const craftEntries = savedCraft.length > 0 ? savedCraft : DEFAULT_CRAFT_ENTRIES;
            const extraActions = [];
            for (const entry of craftEntries) {
                if (!entry.recipeUuid) continue;
                const recipeItem = await fromUuid(entry.recipeUuid);
                if (!recipeItem) continue;
                const owned = actor.items.find(i => i.name === recipeItem.name);
                if (owned) {
                    extraActions.push({ key: `craft_${entry.recipeUuid}`, label: recipeItem.name, hasTarget: false, isExtra: true });
                }
            }

            // Build custom move actions from global setting
            const customMoves = game.settings.get("daggerheart-quickactions", "downtimeCustomMoves") ?? [];
            for (const move of customMoves) {
                if (!move.label) continue;
                const rt = move.restType || "any";
                if (rt !== "any" && rt !== globalRestType) continue;
                extraActions.push({ key: `custom_${move.label}`, label: move.label, hasTarget: false, isExtra: true });
            }

            // Build item move actions from global setting
            const savedItemMoves = game.settings.get("daggerheart-quickactions", "downtimeItemMoveEntries") ?? [];
            const itemMoveEntries = savedItemMoves.length > 0 ? savedItemMoves : DEFAULT_ITEM_MOVE_ENTRIES;
            for (const entry of itemMoveEntries) {
                if (!entry.itemUuid) continue;
                const rt = entry.restType || "any";
                if (rt !== "any" && rt !== globalRestType) continue;
                const moveItem = await fromUuid(entry.itemUuid);
                if (!moveItem) continue;
                // Skip Eloquent if it's configured as a Core Feature
                if (moveItem.name === "Eloquent" && _hasEloquentFeature(actor)) {
                    continue;
                }
                const owned = actor.items.find(i => i.name === moveItem.name);
                if (owned) {
                    extraActions.push({ key: `itemmove_${entry.itemUuid}`, label: moveItem.name, hasTarget: false, isExtra: true });
                }
            }

            // Efficient feature: actor sees long rest actions during short rest
            const hasEfficient = _hasEfficientFeature(actor);
            const efficientSlot = playerChoices.efficientSlot ?? null;
            const actorAvailableActions = (hasEfficient && !isLong) ? longActions : availableActions;

            // Forager feature: bonus action that doesn't count towards move limit
            const hasForager = _hasForagerFeature(actor);

            const allActions = [...actorAvailableActions, ...extraActions];
            // Add Forager as a bonus action if the actor has it
            if (hasForager) {
                allActions.push({ key: "core_forager", label: "Forage", hasTarget: false, isBonusMove: true });
            }

            const annotatedActions = allActions.map(a => ({
                ...a,
                selected: playerChoices.actions.includes(a.key),
                targetActorId: playerChoices.targets?.[a.key] ?? "",
                cannotSelect: false,
                isEfficientSlot: a.key === efficientSlot,
                canBeEfficientSlot: hasEfficient && !isLong && a.key !== "prepare" && playerChoices.actions.includes(a.key)
            }));

            // Target options: "Yourself" + all other actors
            const targetOptions = [{ id: "", name: "Yourself" }];
            for (const other of allActors) {
                if (other.id === actorId) continue;
                targetOptions.push({ id: other.id, name: other.name });
            }

            const isOwnRow = userId === game.user.id;

            const hasPrepare = playerChoices.actions.includes("prepare");

            const forceEffectiveLong = hasEfficient && efficientSlot !== null && !isLong;
            const refreshFeatures = _getRefreshableFeatures(actor, globalRestType, forceEffectiveLong).map(f => f.itemName);
            // Deduplicate names (same item may have multiple actions)
            const uniqueRefreshFeatures = [...new Set(refreshFeatures)];

            // Soothing Speech feature
            const hasSoothingSpeech = _hasSoothingSpeechFeature(actor);

            // Eloquent feature: prepare options for beneficiary selection
            const hasEloquent = _hasEloquentFeature(actor);
            const eloquentOptions = [];
            if (hasEloquent) {
                eloquentOptions.push({ id: "", name: "Choose beneficiary..." });
                for (const other of allActors) {
                    if (other.id === actorId) continue;
                    eloquentOptions.push({ id: other.id, name: other.name });
                }
            }

            rows.push({
                userId,
                userName: user.name,
                userColor: user.color?.toString() || "#ffffff",
                actorId,
                actorName,
                avatar: actor.img || "icons/svg/mystery-man.svg",
                included: gmState.included,
                maxChoices,
                actions: annotatedActions,
                targetOptions,
                isOwnRow,
                isGM,
                canInteract: isOwnRow,
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
                showFeaturesRow: hasEloquent || (hasEfficient && !isLong) || hasSoothingSpeech
            });
        }

        return {
            rows, isGM, hasAnyActor: rows.length > 0,
            restType: globalRestType, isLong, isShort: !isLong,
            restLabel: isLong ? "Long Rest" : "Short Rest",
            foragerOptions: FORAGER_OPTIONS
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
        });

        // Smart tooltip: position first, then show (prevents scroll glitch)
        this.element.addEventListener("mouseenter", (event) => {
            const badge = event.target.closest?.(".dui-refresh-badge");
            if (!badge) return;
            const tooltip = badge.querySelector(".dui-refresh-tooltip");
            if (!tooltip) return;

            // 1. Reset position and keep hidden for measurement
            tooltip.classList.remove("dui-refresh-tooltip--above");
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
                    tooltip.classList.add("dui-refresh-tooltip--above");
                }
            }

            // 3. Now reveal (position is already correct, no scroll flash)
            tooltip.style.visibility = "visible";
            tooltip.style.opacity = "1";
        }, true);

        this.element.addEventListener("mouseleave", (event) => {
            const badge = event.target.closest?.(".dui-refresh-badge");
            if (!badge) return;
            // Don't hide if mouse moved into the tooltip itself
            const related = event.relatedTarget;
            if (related && badge.contains(related)) return;
            const tooltip = badge.querySelector(".dui-refresh-tooltip");
            if (!tooltip) return;
            tooltip.style.visibility = "";
            tooltip.style.opacity = "";
        }, true);
    }

    // Player writes own choices to user flag
    async _savePlayerChoices(actions, targets, efficientSlot = null, foragerChoice = null, eloquentBeneficiary = null) {
        await game.user.setFlag("daggerheart-quickactions", "downtimeChoices", { actions, targets, efficientSlot, foragerChoice, eloquentBeneficiary });
    }

    async _onStartDowntime() {
        if (!game.user.isGM) return;
        await _applyDowntimeEffects();
    }

    async _onToggleIncluded(event, target) {
        if (!game.user.isGM) return;
        const actorId = target.dataset.actorId;
        const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
        if (!state?.actors?.[actorId]) return;
        state.actors[actorId].included = !state.actors[actorId].included;
        state.timestamp = Date.now();
        await game.settings.set("daggerheart-quickactions", "downtimeUIState", state);
    }

    async _onConfigMaxChoices(event, target) {
        if (!game.user.isGM) return;
        const actorId = target.dataset.actorId;
        const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
        const actorState = state?.actors?.[actorId] ?? {};

        const result = await ConfigureActorApp.open(actorId, actorState);
        if (!result) return;

        Object.assign(state.actors[actorId], result);
        state.timestamp = Date.now();
        await game.settings.set("daggerheart-quickactions", "downtimeUIState", state);

        // Persist configs so they survive across sessions
        const persistedConfigs = game.settings.get("daggerheart-quickactions", "downtimeActorConfigs") ?? {};
        persistedConfigs[actorId] = {
            maxChoices: result.maxChoices,
            hpModifier: result.hpModifier,
            stressModifier: result.stressModifier,
            hopeModifier: result.hopeModifier,
            armorSlotModifier: result.armorSlotModifier
        };
        await game.settings.set("daggerheart-quickactions", "downtimeActorConfigs", persistedConfigs);
    }

    _onOpenMovesConfig() {
        if (!game.user.isGM) return;
        new ConfigureMovesApp().render(true);
    }

    async _onResendDowntime() {
        if (!game.user.isGM) return;
        await game.settings.set("daggerheart-quickactions", "downtimeUIOpen", { timestamp: Date.now() });
        ui.notifications.info("Downtime UI re-sent to all players.");
    }

    async _onSetRestType(event, target) {
        if (!game.user.isGM) return;
        const restType = target.dataset.restType;
        const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
        if (!state?.actors) return;
        state.restType = restType;
        state.timestamp = Date.now();
        await game.settings.set("daggerheart-quickactions", "downtimeUIState", state);
        // Clear all player choices when switching rest type
        for (const user of game.users) {
            if (user.isGM) continue;
            if (user.getFlag("daggerheart-quickactions", "downtimeChoices")) {
                await user.unsetFlag("daggerheart-quickactions", "downtimeChoices");
            }
        }
    }

    async _onToggleAction(event, target) {
        const actorId = target.dataset.actorId;
        const actionKey = target.dataset.actionKey;

        // Find the user who owns this actor to read their current choices
        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const actor = ownerUser.character;
        const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
        let maxChoices = state?.actors?.[actorId]?.maxChoices ?? 2;
        // Celestial Trance bonus: +1 move
        if (actor && _hasCelestialTranceFeature(actor)) {
            maxChoices += 1;
        }
        // Eloquent bonus: +1 move if chosen by another party member
        if (actor) {
            const eloquentGiver = game.users.find(u => {
                if (u.isGM || u.id === ownerUser.id) return false;
                return u.character != null && _hasEloquentFeature(u.character);
            });
            if (eloquentGiver) {
                const eloquentGiverChoices = eloquentGiver.getFlag("daggerheart-quickactions", "downtimeChoices");
                if (eloquentGiverChoices?.eloquentBeneficiary === actorId) {
                    maxChoices += 1;
                }
            }
        }

        const currentChoices = ownerUser.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {}, eloquentBeneficiary: null };
        const actions = [...currentChoices.actions];
        const targets = { ...(currentChoices.targets ?? {}) };
        const idx = actions.indexOf(actionKey);

        if (idx >= 0) {
            actions.splice(idx, 1);
            delete targets[actionKey];
        } else {
            actions.push(actionKey);
        }

        // If deselecting the action that was the efficient slot, clear it
        const currentEfficientSlot = currentChoices.efficientSlot ?? null;
        let efficientSlot = (idx >= 0 && currentEfficientSlot === actionKey) ? null : currentEfficientSlot;

        // workOnProject is long-rest-only: auto-set as efficient slot when selected during short rest
        const restType = state?.restType || "short";
        if (actionKey === "workOnProject" && restType === "short") {
            if (idx < 0) {
                // Selecting workOnProject → auto-mark as efficient slot
                efficientSlot = "workOnProject";
            }
        }

        // Players write their own flag; GM can write any user's flag
        const foragerChoice = currentChoices.foragerChoice ?? null;
        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", { actions, targets, efficientSlot, foragerChoice });
            this.render();
        } else {
            await this._savePlayerChoices(actions, targets, efficientSlot, foragerChoice);
        }
    }

    async _onToggleEfficientSlot(event, target) {
        const actorId = target.dataset.actorId;
        const actionKey = target.dataset.actionKey;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const currentChoices = ownerUser.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {}, efficientSlot: null };
        // Toggle: if already this slot, clear it; otherwise set it
        const newEfficientSlot = currentChoices.efficientSlot === actionKey ? null : actionKey;
        const foragerChoice = currentChoices.foragerChoice ?? null;

        // If workOnProject loses the efficient slot during short rest, deselect it
        // (either by un-starring it directly or by switching the star to another action)
        let actions = [...currentChoices.actions];
        let targets = { ...(currentChoices.targets ?? {}) };
        const oldSlot = currentChoices.efficientSlot;
        if (oldSlot === "workOnProject" && newEfficientSlot !== "workOnProject") {
            const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
            const restType = state?.restType || "short";
            if (restType === "short") {
                actions = actions.filter(a => a !== "workOnProject");
                delete targets.workOnProject;
            }
        }

        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", {
                actions,
                targets,
                efficientSlot: newEfficientSlot,
                foragerChoice
            });
            this.render();
        } else {
            await this._savePlayerChoices(actions, targets, newEfficientSlot, foragerChoice);
        }
    }

    async _onSetTarget(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const actionKey = select.dataset.actionKey;
        const targetId = select.value;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const currentChoices = ownerUser.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {} };
        const targets = { ...(currentChoices.targets ?? {}), [actionKey]: targetId || null };
        const efficientSlot = currentChoices.efficientSlot ?? null;
        const foragerChoice = currentChoices.foragerChoice ?? null;

        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", { actions: currentChoices.actions, targets, efficientSlot, foragerChoice });
            this.render();
        } else {
            await this._savePlayerChoices(currentChoices.actions, targets, efficientSlot, foragerChoice);
        }
    }

    async _onSetForagerChoice(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const choiceValue = parseInt(select.value) || null;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const currentChoices = ownerUser.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {} };
        const efficientSlot = currentChoices.efficientSlot ?? null;

        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", {
                actions: currentChoices.actions,
                targets: currentChoices.targets ?? {},
                efficientSlot,
                foragerChoice: choiceValue
            });
            this.render();
        } else {
            await this._savePlayerChoices(currentChoices.actions, currentChoices.targets ?? {}, efficientSlot, choiceValue);
        }
    }

    async _onSetEloquentBeneficiary(event) {
        const select = event.target;
        const actorId = select.dataset.actorId;
        const beneficiaryId = select.value || null;

        const ownerUser = game.users.find(u => !u.isGM && u.character?.id === actorId);
        if (!ownerUser) return;

        const currentChoices = ownerUser.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {}, efficientSlot: null, foragerChoice: null };
        const actions = currentChoices.actions ?? [];
        const targets = currentChoices.targets ?? {};
        const efficientSlot = currentChoices.efficientSlot ?? null;
        const foragerChoice = currentChoices.foragerChoice ?? null;

        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", { actions, targets, efficientSlot, foragerChoice, eloquentBeneficiary: beneficiaryId });
            this.render();
        } else {
            await game.user.setFlag("daggerheart-quickactions", "downtimeChoices", { actions, targets, efficientSlot, foragerChoice, eloquentBeneficiary: beneficiaryId });
        }
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
        ui.notifications.warn("Only the GM can open the Downtime UI.");
        return;
    }
    if (DowntimeUIApp._instance?.rendered) {
        DowntimeUIApp._instance.bringToFront();
        return;
    }

    // Initialize GM-controlled state with all non-GM character actors
    // Load persistent configs so modifiers and maxChoices survive across sessions
    const savedConfigs = game.settings.get("daggerheart-quickactions", "downtimeActorConfigs") ?? {};
    const defaults = { included: true, maxChoices: 2, hpModifier: 0, stressModifier: 0, hopeModifier: 0, armorSlotModifier: 0 };
    const actors = {};
    for (const user of game.users) {
        if (user.isGM) continue;
        const actor = user.character;
        if (!actor || actor.type !== "character") continue;
        const saved = savedConfigs[actor.id] ?? {};
        actors[actor.id] = { ...defaults, ...saved, included: user.active };
        // Clear any previous player choices
        if (user.getFlag("daggerheart-quickactions", "downtimeChoices")) {
            await user.unsetFlag("daggerheart-quickactions", "downtimeChoices");
        }
    }
    await game.settings.set("daggerheart-quickactions", "downtimeUIState", { timestamp: Date.now(), restType: "short", actors });

    DowntimeUIApp._instance = new DowntimeUIApp();
    DowntimeUIApp._instance.render(true);

    // Broadcast to players so they open the UI too
    await game.settings.set("daggerheart-quickactions", "downtimeUIOpen", { timestamp: Date.now() });
}

export function getDowntimeUIInstance() {
    return DowntimeUIApp._instance;
}

export function openDowntimeUIForPlayer() {
    if (DowntimeUIApp._instance?.rendered) return;
    DowntimeUIApp._instance = new DowntimeUIApp();
    DowntimeUIApp._instance.render(true);
}