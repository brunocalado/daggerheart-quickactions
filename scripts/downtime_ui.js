/**
 * Downtime UI App and related helpers.
 * Extracted from apps.js — contains the full Downtime UI system
 * (DowntimeUIApp, helpers, and exported activation functions).
 */

import { rollD4WithDiceSoNice } from "./apps.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const DEFAULT_CRAFT_ENTRIES = [
    { recipeUuid: "Compendium.daggerheart.loot.Item.PQxvxAVBbkt0TleC", craftUuid: "Compendium.daggerheart.consumables.Item.tPfKtKRRjv8qdSqy" },
    { recipeUuid: "Compendium.daggerheart.loot.Item.1TLpFsp3PLDsqoTw", craftUuid: "Compendium.daggerheart.consumables.Item.b6vGSPFWOlzZZDLO" },
    { recipeUuid: "Compendium.daggerheart.loot.Item.5YZls8XH3MB7twNa", craftUuid: "Compendium.daggerheart.consumables.Item.Zsh2AvZr8EkGtLyw" },
    { recipeUuid: "Compendium.daggerheart.loot.Item.MhCo8i0cRXzdnXbA", craftUuid: "Compendium.daggerheart.consumables.Item.Nwv5ydGf0MWnzq1n" }
];

const ALLOWED_CRAFT_TYPES = ["loot", "consumable", "weapon", "armor"];

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
 * Updated to use the system's calculated value instead of manual calculation.
 */
function _getMaxHope(actor) {
    // CORREÇÃO APLICADA: Acessa o dado derivado diretamente.
    // Isso garante compatibilidade com Active Effects, Scars e configurações do sistema.
    return actor.system.resources.hope.max ?? 0;
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
    const eventLines = [];
    for (const { actor, actorState } of includedActors) {
        const tier = _getActorTier(actor);
        const targets = actorState.targets ?? {};

        // Read per-actor modifiers from GM state
        const gmActorState = state.actors?.[actor.id] ?? {};
        const hpModifier = gmActorState.hpModifier ?? 0;
        const stressModifier = gmActorState.stressModifier ?? 0;
        const hopeModifier = gmActorState.hopeModifier ?? 0;
        const armorSlotModifier = gmActorState.armorSlotModifier ?? 0;

        for (const action of actorState.actions) {
            const targetActor = targets[action] ? (game.actors.get(targets[action]) ?? actor) : actor;
            const isSelf = targetActor.id === actor.id;

            if (action === "tendWounds") {
                // Read the target actor's modifier (when healing others, use target's modifier)
                const targetHpMod = isSelf ? hpModifier : (state.actors?.[targetActor.id]?.hpModifier ?? 0);
                if (isLong) {
                    await targetActor.update({ "system.resources.hitPoints.value": 0 });
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Tend to Wounds${target} (Recover All HP)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const recovery = roll.total + tier + targetHpMod;
                    const currentHP = targetActor.system.resources?.hitPoints?.value ?? 0;
                    const newHP = Math.max(0, currentHP - recovery);
                    await targetActor.update({ "system.resources.hitPoints.value": newHP });
                    const modText = targetHpMod > 0 ? ` +${targetHpMod} mod` : "";
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Tend to Wounds${target} (Recover ${recovery} HP [Roll: ${roll.total}${modText}])`);
                }
            }

            if (action === "clearStress") {
                if (isLong) {
                    await actor.update({ "system.resources.stress.value": 0 });
                    eventLines.push(`${actor.name} chose Clear Stress (Recover All Stress)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const recovery = roll.total + tier + stressModifier;
                    const currentStress = actor.system.resources?.stress?.value ?? 0;
                    const newStress = Math.max(0, currentStress - recovery);
                    await actor.update({ "system.resources.stress.value": newStress });
                    const modText = stressModifier > 0 ? ` +${stressModifier} mod` : "";
                    eventLines.push(`${actor.name} chose Clear Stress (Recover ${recovery} Stress [Roll: ${roll.total}${modText}])`);
                }
            }

            if (action === "repairArmor") {
                const targetArmorMod = isSelf ? armorSlotModifier : (state.actors?.[targetActor.id]?.armorSlotModifier ?? 0);
                if (isLong) {
                    await _clearAllArmorMarks(targetActor);
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Repair Armor${target} (Recover All Armor Slots)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const reduction = roll.total + tier + targetArmorMod;
                    await _reduceArmorMarks(targetActor, reduction);
                    const modText = targetArmorMod > 0 ? ` +${targetArmorMod} mod` : "";
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Repair Armor${target} (Recover ${reduction} Armor Slots [Roll: ${roll.total}${modText}])`);
                }
            }

            if (action === "prepare") {
                const currentHope = actor.system.resources?.hope?.value ?? 0;
                // Updated usage here
                const maxHope = _getMaxHope(actor);
                const totalGain = prepareBonus + hopeModifier;
                const newHope = Math.min(currentHope + totalGain, maxHope);
                const actualGain = newHope - currentHope;
                await actor.update({ "system.resources.hope.value": newHope });
                const modText = hopeModifier > 0 ? ` +${hopeModifier} mod` : "";
                const cappedText = actualGain < totalGain ? " [capped]" : "";
                eventLines.push(`${actor.name} chose Prepare (+${actualGain} Hope${prepareBonus === 2 ? ", paired" : ""}${modText}${cappedText})`);
            }

            // Custom move actions
            if (action.startsWith("custom_")) {
                const moveLabel = action.slice("custom_".length);
                eventLines.push(`${actor.name}: ${moveLabel}`);
            }

            // Craft downtime actions
            if (action.startsWith("craft_")) {
                const recipeUuid = action.slice("craft_".length);
                const recipeItem = await fromUuid(recipeUuid);
                const recipeName = recipeItem?.name ?? "Unknown Recipe";
                eventLines.push(`${actor.name} used ${recipeName}`);

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

    // Chat card
    const restLabel = isLong ? "Long Rest" : "Short Rest";
    const eventsHtml = eventLines.map(e => `<div style="padding: 3px 0; border-bottom: 1px solid rgba(201,160,96,0.15);">${e}</div>`).join("");
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
        position: { width: 480, height: 420 },
        actions: {
            saveMovesConfig: ConfigureMovesApp.prototype._onSaveMovesConfig,
            addCraftRow: ConfigureMovesApp.prototype._onAddCraftRow,
            removeCraftRow: ConfigureMovesApp.prototype._onRemoveCraftRow,
            addCustomRow: ConfigureMovesApp.prototype._onAddCustomRow,
            removeCustomRow: ConfigureMovesApp.prototype._onRemoveCustomRow
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

        const customMoves = game.settings.get("daggerheart-quickactions", "downtimeCustomMoves") ?? [];

        return { craftEntries: resolvedEntries, customMoves };
    }

    _onRender(context, options) {
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
            <button type="button" class="dui-craft-remove" data-action="removeCustomRow" data-index="${nextIndex}" title="Remove">
                <i class="fas fa-times"></i>
            </button>`;
        customList.appendChild(newRow);
    }

    _onRemoveCustomRow(event, target) {
        target.closest('.dui-custom-row').remove();
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
        for (const input of el.querySelectorAll('.dui-custom-input')) {
            const label = input.value.trim();
            if (label) {
                customMoves.push({ label });
            }
        }

        await game.settings.set("daggerheart-quickactions", "downtimeCraftEntries", craftEntries);
        await game.settings.set("daggerheart-quickactions", "downtimeCustomMoves", customMoves);
        ui.notifications.info("Moves configuration saved.");
        this.close();
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
            openMovesConfig: DowntimeUIApp.prototype._onOpenMovesConfig
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
            // Player choices from user flags
            const playerChoices = user.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {} };

            const selectedCount = playerChoices.actions.length;
            const atMaxChoices = selectedCount >= gmState.maxChoices;

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
                extraActions.push({ key: `custom_${move.label}`, label: move.label, hasTarget: false, isExtra: true });
            }

            const allActions = [...availableActions, ...extraActions];
            const annotatedActions = allActions.map(a => ({
                ...a,
                selected: playerChoices.actions.includes(a.key),
                targetActorId: playerChoices.targets?.[a.key] ?? "",
                cannotSelect: !playerChoices.actions.includes(a.key) && atMaxChoices
            }));

            // Target options: "Yourself" + all other actors
            const targetOptions = [{ id: "", name: "Yourself" }];
            for (const other of allActors) {
                if (other.id === actorId) continue;
                targetOptions.push({ id: other.id, name: other.name });
            }

            const isOwnRow = userId === game.user.id;

            const hasPrepare = playerChoices.actions.includes("prepare");

            rows.push({
                userId,
                userName: user.name,
                userColor: user.color?.toString() || "#ffffff",
                actorId,
                actorName,
                avatar: actor.img || "icons/svg/mystery-man.svg",
                included: gmState.included,
                maxChoices: gmState.maxChoices,
                actions: annotatedActions,
                targetOptions,
                isOwnRow,
                isGM,
                canInteract: isOwnRow,
                selectedCount,
                atMaxChoices,
                hasPrepare
            });
        }

        return {
            rows, isGM, hasAnyActor: rows.length > 0,
            restType: globalRestType, isLong, isShort: !isLong,
            restLabel: isLong ? "Long Rest" : "Short Rest"
        };
    }

    _onFirstRender() {
        // Event delegation: single listener on root element, valid for any select that appears later
        // This ensures the listener is always active, even if selects are added/removed via re-renders
        this.element.addEventListener("change", (event) => {
            if (event.target.classList.contains("dui-target-select")) {
                this._onSetTarget(event);
            }
        });
    }

    // --- Player writes own choices to user flag ---
    async _savePlayerChoices(actions, targets) {
        await game.user.setFlag("daggerheart-quickactions", "downtimeChoices", { actions, targets });
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

        const state = game.settings.get("daggerheart-quickactions", "downtimeUIState");
        const maxChoices = state?.actors?.[actorId]?.maxChoices ?? 2;

        const currentChoices = ownerUser.getFlag("daggerheart-quickactions", "downtimeChoices") ?? { actions: [], targets: {} };
        const actions = [...currentChoices.actions];
        const targets = { ...(currentChoices.targets ?? {}) };
        const idx = actions.indexOf(actionKey);

        if (idx >= 0) {
            actions.splice(idx, 1);
            delete targets[actionKey];
        } else if (actions.length < maxChoices) {
            actions.push(actionKey);
        } else {
            return;
        }

        // Players write their own flag; GM can write any user's flag
        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", { actions, targets });
        } else {
            await this._savePlayerChoices(actions, targets);
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

        if (game.user.isGM) {
            await ownerUser.setFlag("daggerheart-quickactions", "downtimeChoices", { actions: currentChoices.actions, targets });
        } else {
            await this._savePlayerChoices(currentChoices.actions, targets);
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
        actors[actor.id] = { ...defaults, ...saved, included: true };
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