/**
 * Downtime UI App and related helpers.
 * Extracted from apps.js — contains the full Downtime UI system
 * (DowntimeUIApp, helpers, and exported activation functions).
 */

import { rollD4WithDiceSoNice } from "./apps.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

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

        for (const action of actorState.actions) {
            const targetActor = targets[action] ? (game.actors.get(targets[action]) ?? actor) : actor;
            const isSelf = targetActor.id === actor.id;

            if (action === "tendWounds") {
                if (isLong) {
                    await targetActor.update({ "system.resources.hitPoints.value": 0 });
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Tend to Wounds${target} (Recover All HP)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const recovery = roll.total + tier;
                    const currentHP = targetActor.system.resources?.hitPoints?.value ?? 0;
                    const newHP = Math.max(0, currentHP - recovery);
                    await targetActor.update({ "system.resources.hitPoints.value": newHP });
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Tend to Wounds${target} (Recover ${recovery} HP [Roll: ${roll.total}])`);
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
                    const recovery = roll.total + tier;
                    const currentStress = actor.system.resources?.stress?.value ?? 0;
                    const newStress = Math.max(0, currentStress - recovery);
                    await actor.update({ "system.resources.stress.value": newStress });
                    eventLines.push(`${actor.name} chose Clear Stress (Recover ${recovery} Stress [Roll: ${roll.total}])`);
                }
            }

            if (action === "repairArmor") {
                if (isLong) {
                    await _clearAllArmorMarks(targetActor);
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Repair Armor${target} (Recover All Armor Slots)`);
                } else {
                    const roll = new Roll("1d4");
                    await roll.evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
                    const reduction = roll.total + tier;
                    await _reduceArmorMarks(targetActor, reduction);
                    const target = isSelf ? "" : ` of ${targetActor.name}`;
                    eventLines.push(`${actor.name} chose Repair Armor${target} (Recover ${reduction} Armor Slots [Roll: ${roll.total}])`);
                }
            }

            if (action === "prepare") {
                const currentHope = actor.system.resources?.hope?.value ?? 0;
                await actor.update({ "system.resources.hope.value": currentHope + prepareBonus });
                eventLines.push(`${actor.name} chose Prepare (+${prepareBonus} Hope${prepareBonus === 2 ? ", paired" : ""})`);
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
            toggleAction: DowntimeUIApp.prototype._onToggleAction
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

            const annotatedActions = availableActions.map(a => ({
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
                atMaxChoices
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
        const current = state?.actors?.[actorId]?.maxChoices ?? 2;

        const content = `<div style="display:flex;align-items:center;gap:10px;justify-content:center;">
            <label style="font-weight:bold;">Max Actions:</label>
            <input type="number" name="maxChoices" value="${current}" min="1" max="6" style="width:60px;text-align:center;">
        </div>`;

        const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Configure Actor" },
            content,
            ok: {
                label: "Save",
                callback: (event, button) => {
                    return parseInt(button.form.elements.maxChoices.value) || 2;
                }
            }
        });

        if (result) {
            state.actors[actorId].maxChoices = result;
            state.timestamp = Date.now();
            await game.settings.set("daggerheart-quickactions", "downtimeUIState", state);
        }
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
    const actors = {};
    for (const user of game.users) {
        if (user.isGM) continue;
        const actor = user.character;
        if (!actor || actor.type !== "character") continue;
        actors[actor.id] = { included: true, maxChoices: 2 };
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
