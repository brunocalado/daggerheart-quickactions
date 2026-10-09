/*!
 * Daggerheart: Quick Actions
 * 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Features Module
 * Contains specific complex macros and features accessed via QuickActions.Features()
 */

import { MODULE_ID } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// EMBEDDED TEMPLATE (Inline HTML)
// ==================================================================
const CHAIN_LIGHTNING_TEMPLATE_PATH = `modules/${MODULE_ID}/templates/chain-lightning-inline.hbs`;
const CHAIN_LIGHTNING_TEMPLATE_CONTENT = `
<div class="dh-qa-app" style="display: flex; flex-direction: column; gap: 10px;">
    <p class="notes" style="margin-bottom: 10px;">Caster: <strong>{{casterName}}</strong>. {{#if foundCast}}Spellcast Roll read from the last Chain Lightning cast in chat.{{else}}Enter the result of the caster's Spellcast Roll.{{/if}}</p>

    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label style="font-weight: bold; color: #C9A060;">Spellcast Roll</label>
        <input type="number" name="spellcast" value="{{spellcast}}" min="1" max="99" required class="dh-input" style="width: 60px; text-align: center;">
    </div>

    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
        <label style="font-weight: bold; color: #C9A060;">Critical Success?</label>
        <input type="checkbox" name="critical" {{#if critical}}checked{{/if}} style="accent-color: #C9A060; transform: scale(1.2);">
    </div>

    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label style="font-weight: bold; color: #C9A060;">Damage</label>
        <input type="text" name="damage" value="2d8+4" placeholder="2d8+4 or a rolled total" class="dh-input" style="width: 150px; text-align: center;">
    </div>

    <!-- Rename Option -->
    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
        <label style="font-weight: bold; color: #C9A060;">Rename Targets (1, 2...)?</label>
        <input type="checkbox" name="renameTargets" style="accent-color: #C9A060; transform: scale(1.2);">
    </div>

    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
        <label style="font-weight: bold; color: #C9A060;">Apply Damage?</label>
        <input type="checkbox" name="applyDamage" checked style="accent-color: #C9A060; transform: scale(1.2);">
    </div>

    <div class="form-footer">
        <button type="submit" class="dh-btn" style="width: 100%;">
            <i class="fas fa-bolt"></i> Cast Chain Lightning
        </button>
    </div>
</div>
`;

// ==================================================================
// TEMPLATE COMPILATION (Cache Injection)
// ==================================================================
if (typeof Handlebars !== "undefined") {
    const compiledTemplate = Handlebars.compile(CHAIN_LIGHTNING_TEMPLATE_CONTENT);
    Handlebars.templates = Handlebars.templates || {};
    Handlebars.templates[CHAIN_LIGHTNING_TEMPLATE_PATH] = compiledTemplate;
    Handlebars.registerPartial(CHAIN_LIGHTNING_TEMPLATE_PATH, compiledTemplate);
}

// ==================================================================
// EXPORTED FUNCTION
// ==================================================================

export async function features(featureName, ...args) {
    if (!featureName) {
        ui.notifications.warn("QuickActions.Features: No feature name provided.");
        return;
    }

    switch (featureName) {
        case 'Chain Lightning':
            if (!canvas.tokens.controlled.length) {
                ui.notifications.warn("Select the caster's token first!");
                return;
            }
            new ChainLightningApp(canvas.tokens.controlled[0]).render(true);
            break;
        case 'Unleash Chaos':
            if (!canvas.tokens.controlled.length) {
                ui.notifications.warn("Select a token first!");
                return;
            }
            await executeUnleashChaos(canvas.tokens.controlled[0]);
            break;
        default:
            ui.notifications.warn(`QuickActions.Features: Feature '${featureName}' not found.`);
    }
}

// ==================================================================
// UNLEASH CHAOS
// ==================================================================

/**
 * Recharges the "Unleash Chaos" item, prompting the player for the cost to pay.
 * The three options are 1 Stress (default, the most common case), 1 HP, or
 * nothing at all (used for the free recharge at the start of a session).
 * Posts a styled chat message summarising the cost and the recharge result.
 *
 * @param {Token} token - The controlled token whose actor owns Unleash Chaos.
 * @returns {Promise<void>}
 */
async function executeUnleashChaos(token) {
    const actor = token.actor;

    // Require a subclass with a spellcastingTrait to determine max charge
    const subclassItem = actor.items.find(i => i.type === "subclass");
    if (!subclassItem?.system?.spellcastingTrait) {
        ui.notifications.warn("The actor has no subclass with a spellcastingTrait defined.");
        return;
    }

    const spellcastingTrait = subclassItem.system.spellcastingTrait;
    const traitValue = actor.system.traits?.[spellcastingTrait]?.value || 0;
    // Minimum of 1 token so the ability is always usable
    const maxTokens = Math.max(1, traitValue);

    const targetItem = actor.items.find(i => i.name === "Unleash Chaos");
    if (!targetItem) {
        ui.notifications.warn("Item 'Unleash Chaos' not found on this actor.");
        return;
    }

    const currentTokens = targetItem.system.resource?.value || 0;
    if (currentTokens >= maxTokens) {
        ui.notifications.info(`Unleash Chaos is already at maximum charge (${maxTokens}).`);
        return;
    }

    // Ask which cost to pay. "Stress" is the default since it's the usual case;
    // "Nothing" covers the free recharge at the start of a session.
    const costType = await foundry.applications.api.DialogV2.wait({
        window: { title: "Unleash Chaos — Recharge Cost" },
        content: `
            <p>What cost do you want to pay to recharge <strong>Unleash Chaos</strong>?</p>
            <p style="color: var(--color-text-secondary); font-size: 0.9em;">At the start of a session, you may recover it for free — choose "Nothing" in that case.</p>
        `,
        buttons: [
            { action: "stress", label: "1 Stress", icon: "fas fa-brain", default: true },
            { action: "hp", label: "1 HP", icon: "fas fa-heart" },
            { action: "none", label: "Nothing", icon: "fas fa-hourglass-start" }
        ],
        rejectClose: false
    });

    if (!costType) {
        ui.notifications.warn("Action cancelled.");
        return;
    }

    const stress = actor.system.resources.stress;
    const hp = actor.system.resources.hitPoints;

    if (costType === "stress") {
        if (stress.value >= stress.max) {
            ui.notifications.error("Your Stress is already at maximum — you cannot pay this cost.");
            return;
        }
        await actor.update({ "system.resources.stress.value": stress.value + 1 });
    } else if (costType === "hp") {
        if (hp.value >= hp.max) {
            ui.notifications.error("Your Hit Points are already at maximum — you cannot pay this cost.");
            return;
        }
        // In Daggerheart, marking HP means adding to the current value (damage track)
        await actor.update({ "system.resources.hitPoints.value": hp.value + 1 });
    }
    // costType === "none": free session-start recovery, no resource is spent

    await targetItem.update({ "system.resource.value": maxTokens });
    await _createUnleashChaosChatMessage(token, costType, maxTokens - currentTokens, maxTokens);
}

/**
 * Creates a styled chat message summarising the Unleash Chaos recharge.
 * Follows the same visual style used throughout this module.
 *
 * @param {Token} token                    - The token used as the chat speaker.
 * @param {"stress"|"hp"|"none"} costType  - Which resource was spent, or "none" for a free session-start recovery.
 * @param {number} tokensGained            - How many tokens were added.
 * @param {number} newTotal                - The new total charge after recharge.
 * @returns {Promise<void>}
 */
async function _createUnleashChaosChatMessage(token, costType, tokensGained, newTotal) {
    const titleColor = "#C9A060";
    const restoreColor = "#4CAF50";

    let costColor, costLabel, costIcon;
    switch (costType) {
        case "stress":
            costColor = "#9d80ff";
            costLabel = "1 Stress";
            costIcon = "fas fa-brain";
            break;
        case "hp":
            costColor = "#ff6b6b";
            costLabel = "1 Hit Point";
            costIcon = "fas fa-heart";
            break;
        default:
            costColor = "#4a90e2";
            costLabel = "Session Start Recovery";
            costIcon = "fas fa-hourglass-start";
    }

    const content = `
    <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden; font-family: 'Lato', sans-serif;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                Unleash Chaos
            </h3>
        </header>
        <div class="card-content" style="background: #141414; padding: 15px; display: flex; flex-direction: column; gap: 10px;">

            <!-- Cost Row -->
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.4); padding: 8px 10px; border-radius: 4px; border-left: 3px solid ${costColor};">
                <i class="${costIcon}" style="color: ${costColor}; width: 16px; text-align: center;"></i>
                <span style="color: #ccc; font-size: 0.95em;">Cost paid:</span>
                <strong style="color: ${costColor}; font-size: 1em;">${costLabel}</strong>
            </div>

            <!-- Restore Row -->
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.4); padding: 8px 10px; border-radius: 4px; border-left: 3px solid ${restoreColor};">
                <i class="fas fa-bolt" style="color: ${restoreColor}; width: 16px; text-align: center;"></i>
                <span style="color: #ccc; font-size: 0.95em;">Restored:</span>
                <strong style="color: ${restoreColor}; font-size: 1em;">+${tokensGained} token${tokensGained !== 1 ? 's' : ''}</strong>
                <span style="color: #777; font-size: 0.85em;">(now ${newTotal})</span>
            </div>

        </div>
    </div>`;

    await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ token }),
        content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}

// ==================================================================
// CHAIN LIGHTNING
// ==================================================================
// Chain Lightning (Arcana 5). The player uses the card as usual (2 Stress,
// Spellcast Roll); this module resolves the part the system leaves to the
// table: reaction rolls with a Difficulty equal to the Spellcast Roll, and the
// chain that jumps from every target who took damage. Two entry points:
// placing the card's area from its chat message, or the macro's window.

const CHAIN_LIGHTNING = "Chain Lightning";

/**
 * Id of the Chain Lightning cast whose area button this client clicked last.
 * The system creates the Region with no link back to the message, so the
 * click is remembered here and stamped on the Region as it is created.
 */
let pendingAreaCast = null;

/**
 * Hooks for Chain Lightning: resolving the cast when the card's area is
 * placed, and the controls on the results card. Called once from init.
 */
export function registerChainLightning() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        if (message.getFlag(MODULE_ID, "chainLightning")) return activateResultsCard(message, html);
        if (!isChainLightningCast(message)) return;
        for (const button of html.querySelectorAll(".action-areas")) {
            button.addEventListener("click", () => pendingAreaCast = message.id);
        }
    });

    Hooks.on("preCreateRegion", (region, data, options, userId) => {
        if (userId !== game.user.id || !pendingAreaCast) return;
        const message = game.messages.get(pendingAreaCast);
        if (!message?.system.action?.areas?.some(a => a.name === region.name)) return;
        region.updateSource({ [`flags.${MODULE_ID}.chainLightningCast`]: pendingAreaCast });
        pendingAreaCast = null;
    });

    // Damage, renames and adversary rolls need GM rights, so the active GM
    // resolves the cast no matter who placed the area.
    Hooks.on("createRegion", (region) => {
        if (!game.users.activeGM?.isSelf) return;
        const messageId = region.getFlag(MODULE_ID, "chainLightningCast");
        if (messageId) resolveFromArea(region, game.messages.get(messageId));
    });
}

/**
 * Results card controls: each target's token image pans the canvas to it,
 * and the GM gets an undo button for the damage a target took.
 * @param {ChatMessage} message
 * @param {HTMLElement} html
 */
function activateResultsCard(message, html) {
    for (const img of html.querySelectorAll(".cl-pan")) {
        img.addEventListener("click", () => {
            const token = fromUuidSync(img.dataset.tokenUuid);
            if (!token?.object || token.parent !== canvas.scene) {
                ui.notifications.warn("That token isn't on the scene you are viewing.");
                return;
            }
            canvas.animatePan(token.object.center);
        });
    }
    for (const button of html.querySelectorAll(".cl-undo")) {
        if (!game.user.isGM) {
            button.remove();
            continue;
        }
        button.addEventListener("click", event => {
            event.preventDefault();
            button.disabled = true;
            undoChainLightningDamage(message, Number(button.dataset.index));
        });
    }
}

/**
 * Reverts the damage one target took, the way the system's own undo button
 * does: the resource updates takeDamage returned, negated.
 * @param {ChatMessage} message - The results card.
 * @param {number} index        - The target's position in the card.
 */
async function undoChainLightningDamage(message, index) {
    const data = foundry.utils.deepClone(message.getFlag(MODULE_ID, "chainLightning"));
    const result = data.results[index];
    if (!result || result.undone) return;
    const actor = fromUuidSync(result.tokenUuid)?.actor;
    if (!actor) {
        ui.notifications.warn(`${result.name} is no longer on the scene; nothing to undo.`);
        return;
    }

    await actor.modifyResource(result.updates.map(u => ({ ...u, value: -u.value })));
    result.undone = true;
    await message.update({
        content: chainLightningCardHTML(data),
        [`flags.${MODULE_ID}.chainLightning`]: data
    });
}

/**
 * Whether a chat message is the Spellcast Roll of a Chain Lightning card.
 * @param {ChatMessage} message
 */
function isChainLightningCast(message) {
    if (message?.type !== "dualityRoll") return false;
    const actor = fromUuidSync(message.system.source?.actor ?? "");
    return actor?.items.get(message.system.source.item)?.name === CHAIN_LIGHTNING;
}

/**
 * The Spellcast Roll result of a cast message. Read from the message, so a
 * later reroll (Hope feature, etc.) is in effect.
 * @returns {{total: number, isCritical: boolean}|null}
 */
function castResult(message) {
    const roll = message?.system.roll;
    if (!roll?._evaluated) return null;
    return { total: roll.total, isCritical: roll.isCritical };
}

/**
 * Resolves a cast whose area was just placed: the adversaries inside the area
 * are the targets of the Spellcast Roll.
 * @param {RegionDocument} region
 * @param {ChatMessage} message - The cast's Spellcast Roll message.
 */
async function resolveFromArea(region, message) {
    const cast = castResult(message);
    if (!cast) return;
    if (region.parent !== canvas.scene) {
        ui.notifications.warn("Chain Lightning: view the scene where the area was placed to resolve it.");
        return;
    }

    const actor = fromUuidSync(message.system.source.actor);
    const casterTokens = canvas.tokens.placeables.filter(t => t.actor === actor);
    // An emanation dropped on a token is anchored to it; prefer that token.
    const base = region.shapes[0]?.base;
    const caster = casterTokens.find(t => t.document.x === base?.x && t.document.y === base?.y) ?? casterTokens[0];
    if (!caster) {
        ui.notifications.warn(`Chain Lightning: ${actor?.name ?? "the caster"} has no token on this scene.`);
        return;
    }

    await resolveChainLightning({
        caster,
        spellcast: cast.total,
        critical: cast.isCritical,
        initialTargets: canvas.tokens.placeables.filter(t => t.document.testInsideRegion(region))
    });
}

/** Hostile adversaries that are still standing. */
function isLivingAdversary(token) {
    const actor = token.actor;
    if (actor?.type !== "adversary" || token.document.disposition !== CONST.TOKEN_DISPOSITIONS.HOSTILE) return false;
    const hp = actor.system.resources.hitPoints;
    return hp.value < hp.max;
}

/**
 * Resolves Chain Lightning and posts the results card.
 * Wave 0 is the initial targets (adversaries within Close range of the caster
 * when none are given); the Spellcast Roll succeeds against those whose
 * Difficulty it meets (all of them on a critical). Each later wave is every
 * adversary not yet targeted within Close range of a target that took damage
 * in the previous wave. Every target the lightning reaches makes a reaction
 * roll against the Spellcast Roll result.
 *
 * @param {object} config
 * @param {Token} config.caster
 * @param {number} config.spellcast           - Spellcast Roll result.
 * @param {boolean} config.critical           - Whether the Spellcast Roll was a critical success.
 * @param {Token[]} [config.initialTargets]   - Tokens the Spellcast Roll targets.
 * @param {string} [config.damageFormula]     - A formula or a rolled total.
 * @param {boolean} [config.applyDamage]      - Mark HP, or only report it.
 * @param {boolean} [config.rename]           - Number the targets' names (1, 2...).
 */
async function resolveChainLightning({ caster, spellcast, critical, initialTargets = null, damageFormula = "2d8+4", applyDamage = true, rename = false }) {
    const results = [];
    const targeted = new Set([caster.id]);
    let renameCounter = 1;
    // One damage roll applied to every target, per the SRD rule for spells
    // that hit several targets. Rolled on the first failed reaction roll.
    let damageRoll = null;

    // isWithinRange is the system's range check: it uses the scene's (or the
    // world's) Close distance and measures edge to edge like the token ruler.
    const findTargets = sources => canvas.tokens.placeables.filter(t =>
        !targeted.has(t.id) && isLivingAdversary(t) && sources.some(s => s.isWithinRange(t, "close"))
    );

    let wave = initialTargets
        ? initialTargets.filter(t => t !== caster && isLivingAdversary(t))
        : findTargets([caster]);
    for (let waveIndex = 0; wave.length; waveIndex++) {
        wave.forEach(t => targeted.add(t.id));
        const damaged = [];

        for (const token of wave) {
            if (rename) {
                await token.document.update({
                    name: `${token.name} ${renameCounter++}`,
                    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
                    displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS
                });
            }

            const actor = token.actor;
            const result = {
                tokenUuid: token.document.uuid,
                name: token.name,
                img: token.document.texture.src,
                chained: waveIndex > 0,
                hit: true,
                reaction: null,
                hitPoints: 0,
                updates: [],
                undone: false
            };
            results.push(result);

            // Only the first wave is targeted by the Spellcast Roll itself;
            // chained adversaries go straight to the reaction roll.
            if (waveIndex === 0 && !critical && spellcast < actor.system.difficulty) {
                result.hit = false;
                result.difficulty = actor.system.difficulty;
                continue;
            }

            result.reaction = await rollReaction(actor, spellcast);
            if (result.reaction.success) continue;

            if (!damageRoll) {
                damageRoll = await new Roll(damageFormula).evaluate();
                if (game.dice3d) await game.dice3d.showForRoll(damageRoll, game.user, true);
            }
            Object.assign(result, await damageAdversary(actor, damageRoll.total, applyDamage));
            if (result.hitPoints > 0) damaged.push(token);
        }

        wave = findTargets(damaged);
    }

    // Everything the card shows is kept in a flag, so the card can be rebuilt
    // after an undo.
    const data = { spellcast, critical, damageFormula, damageTotal: damageRoll?.total ?? null, applyDamage, results };
    await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ token: caster.document }),
        content: chainLightningCardHTML(data),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        flags: { [MODULE_ID]: { chainLightning: data } }
    });
}

/**
 * Rolls an adversary reaction roll through the system, so roll bonuses and
 * effects that apply to reaction rolls are included. A natural 20 succeeds.
 * @returns {Promise<{total: number, critical: boolean, success: boolean}>}
 */
async function rollReaction(actor, difficulty) {
    const config = await actor.diceRoll({
        title: game.i18n.localize("DAGGERHEART.GENERAL.reactionRoll"),
        effects: await game.system.api.data.actions.actionsTypes.base.getActionRelevantEffects(
            { action: { actionType: "reaction", roll: {} } },
            actor
        ),
        roll: { type: "trait", difficulty },
        actionType: "reaction",
        hasRoll: true,
        dialog: { configure: false },
        skips: { createMessage: true }
    });
    const { total, isCritical } = config.roll;
    return { total, critical: isCritical, success: isCritical || total >= difficulty };
}

/**
 * Magic damage to an adversary. takeDamage applies resistance, immunity,
 * damage reduction and the thresholds the same way the system's damage
 * button does. Without applying, the HP the damage would mark is computed.
 * @returns {Promise<{hitPoints: number, updates: object[]}>} Hit Points marked
 *   (or that would be marked), and the resource updates made, for undo.
 */
async function damageAdversary(actor, total, apply) {
    const damageTypes = ["magical"];
    if (!apply) return { hitPoints: actor.convertDamageToThreshold(actor.calculateDamage(total, damageTypes)), updates: [] };

    const { value: hpBefore, max: hpMax } = actor.system.resources.hitPoints;
    // The updates carry a Set of damage types, which a flag can't store and
    // modifyResource doesn't need to revert them.
    const updates = (await actor.takeDamage({ main: { total, damageTypes } }) ?? [])
        .map(({ damageTypes, ...update }) => update);
    const hitPoints = updates.find(u => u.key === "hitPoints");
    const marked = Math.abs(hitPoints?.value ?? 0);
    // HP stops at the maximum, so undo reverts what was actually marked, not
    // what the damage asked for — otherwise it would heal a dying adversary.
    // Computed rather than read back: modifyResource doesn't await its update.
    if (hitPoints) hitPoints.value = Math.min(marked, hpMax - hpBefore);
    return { hitPoints: marked, updates };
}

/**
 * The results card's markup, built from the data stored on the message.
 * @returns {string}
 */
function chainLightningCardHTML({ spellcast, critical, damageFormula, damageTotal, applyDamage, results }) {
    const titleColor = "#C9A060"; // Gold

    let listItemsHtml = "";

    results.forEach((r, index) => {
        const failed = r.reaction && !r.reaction.success;
        const statusColor = r.undone ? '#777' : failed ? '#f44336' : r.hit ? '#4CAF50' : '#777';

        const chainedIndicator = r.chained
            ? `<span style="color: #4a90e2; font-size: 0.85em; white-space: nowrap;"><i class="fas fa-bolt" style="margin-right: 4px;"></i>CHAINED</span>`
            : '<span></span>';

        // Undo sits on the name line; non-GMs have it removed on render.
        let undoControl = '';
        if (r.undone) {
            undoControl = '<span style="color: #777; font-size: 0.8em; margin-left: auto;">Undone</span>';
        } else if (r.updates.length) {
            undoControl = `<button type="button" class="cl-undo" data-index="${index}" title="Undo damage" style="margin-left: auto; flex: 0 0 auto; width: 24px; height: 24px; padding: 0; line-height: 22px; font-size: 0.8em;"><i class="fas fa-undo"></i></button>`;
        }

        let stats;
        if (!r.hit) {
            stats = `<span style="color: #aaa; font-size: 0.9em;">Spellcast missed (Difficulty ${r.difficulty})</span>`;
        } else {
            const critText = r.reaction.critical ? ' <i class="fas fa-star" style="color: #FFD700; font-size: 0.8em;" title="Critical"></i>' : '';
            const outcome = failed
                ? `<span style="color: #ff6b6b; font-weight: bold;${r.undone ? ' text-decoration: line-through;' : ''}">${r.hitPoints} HP</span>`
                : '<span style="color: #aaa;">Resisted</span>';
            stats = `<span style="color: #ccc; font-size: 0.9em;">Reaction: <span style="color: #4a90e2; font-weight: bold;">${r.reaction.total}</span>${critText}</span>
                <span style="color: #666;">|</span>
                <span style="font-size: 0.9em;">${outcome}</span>`;
        }

        listItemsHtml += `
        <div style="display: flex; flex-direction: column; background: rgba(0,0,0,0.4); margin-bottom: 4px; padding: 6px 8px; border-radius: 4px; border-left: 3px solid ${statusColor}; font-size: 0.95em;">

            <!-- Line 1: Token + Name + Undo -->
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <img class="cl-pan" src="${r.img}" data-token-uuid="${r.tokenUuid}" title="Pan to ${r.name}" style="width: 28px; height: 28px; flex: 0 0 28px; border: none; object-fit: contain; cursor: pointer;">
                <strong style="color: #e0e0e0; font-size: 1.05em;">${r.name}</strong>
                ${undoControl}
            </div>

            <!-- Line 2: Chained (left) + Stats (right) -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                ${chainedIndicator}
                <span style="display: flex; align-items: center; gap: 8px;">${stats}</span>
            </div>
        </div>
        `;
    });

    if (!results.length) {
        listItemsHtml = '<div style="color: #aaa; text-align: center;">No adversaries in range.</div>';
    }

    const damageText = damageTotal !== null ? `${damageTotal} <span style="color: #777;">(${damageFormula})</span>` : damageFormula;

    return `
    <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden; font-family: 'Lato', sans-serif;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                Chain Lightning
            </h3>
        </header>

        <div class="card-content" style="background: #141414; padding: 15px;">

            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 4px 10px; margin-bottom: 10px; font-size: 0.9em; color: #aaa; border-bottom: 1px solid #444; padding-bottom: 5px;">
                <span><strong>Spellcast:</strong> ${spellcast}${critical ? ' <i class="fas fa-star" style="color: #FFD700;" title="Critical"></i>' : ''}</span>
                <span><strong>Dmg:</strong> ${damageText} magic</span>
                <span><strong>Mode:</strong> ${applyDamage ? '<span style="color:#f44336">Damage</span>' : '<span style="color:#4a90e2">Info</span>'}</span>
            </div>

            <div style="padding-right: 5px;">
                ${listItemsHtml}
            </div>
        </div>
    </div>`;
}

/**
 * The macro's window: the GM picks the caster's token and confirms the
 * Spellcast Roll. Targets are the adversaries within Close range of the caster.
 */
class ChainLightningApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {Token} caster - The token casting Chain Lightning.
     */
    constructor(caster, options = {}) {
        super(options);
        this.caster = caster;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "chain-lightning-app",
        classes: ["dh-qa-app", "chain-app"],
        window: {
            title: CHAIN_LIGHTNING,
            icon: "fas fa-bolt",
            resizable: false,
            controls: []
        },
        position: {
            width: 350,
            height: "auto"
        },
        form: {
            handler: ChainLightningApp.#onSubmit,
            submitOnChange: false,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: CHAIN_LIGHTNING_TEMPLATE_PATH
        }
    };

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const actor = this.caster.actor;
        const message = game.messages.contents.findLast(m =>
            m.system.source?.actor === actor?.uuid && isChainLightningCast(m)
        );
        const cast = castResult(message);
        return {
            ...context,
            casterName: this.caster.name,
            foundCast: !!cast,
            spellcast: cast?.total ?? "",
            critical: cast?.isCritical ?? false
        };
    }

    /**
     * Handle Form Submission
     * @this {ChainLightningApp}
     */
    static async #onSubmit(event, form, formData) {
        const { spellcast, critical, damage, applyDamage, renameTargets } = formData.object;

        if (!Number.isInteger(spellcast) || spellcast < 1) {
            ui.notifications.error("Enter the result of the Spellcast Roll.");
            return;
        }
        if (!damage || !Roll.validate(damage)) {
            ui.notifications.error("Invalid damage formula!");
            return;
        }

        await resolveChainLightning({
            caster: this.caster,
            spellcast,
            critical,
            damageFormula: damage,
            applyDamage,
            rename: renameTargets
        });
    }
}
