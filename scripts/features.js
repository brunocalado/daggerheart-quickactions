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
// chain that jumps from every target who took damage. The GM runs it from
// the macro's window after the player casts.

const CHAIN_LIGHTNING = "Chain Lightning";
const DISTANCES_MODULE_ID = "daggerheart-distances";
const SEQUENCER_MODULE_ID = "sequencer";

// JB2A database keys. The primary bolt is drawn from the caster, the secondary
// one for every jump of the chain; Sequencer picks the file by distance.
const BOLT_PRIMARY = "jb2a.chain_lightning.primary.blue";
const BOLT_SECONDARY = "jb2a.chain_lightning.secondary.blue";
const FLAMES = "jb2a.flames.01.orange";
// CC0 "Basic Spell Impacts" by lentikula (https://lentikula.itch.io/freecc0-basic-spell-impacts-sfx).
const SOUND_PATH = `modules/${MODULE_ID}/assets/sounds/chain-lightning`;
const LIGHTNING_SOUNDS = [1, 2, 3, 4, 5].map(n => `${SOUND_PATH}/lightning-impact-${n}.ogg`);
const FIRE_SOUNDS = [1, 2, 3, 4, 5].map(n => `${SOUND_PATH}/fire-impact-${n}.ogg`);

/**
 * Hooks the controls on the Chain Lightning results card. Called once from init.
 */
export function registerChainLightning() {
    Hooks.on("renderChatMessageHTML", (message, html) => {
        if (message.getFlag(MODULE_ID, "chainLightning")) activateResultsCard(message, html);
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
 * Adversary tokens the lightning can reach. Anything not Friendly counts, the
 * same split the system's combat tracker makes, so a Neutral adversary token
 * isn't silently left out.
 */
function isAdversary(token) {
    return token.actor?.type === "adversary" && token.document.disposition !== CONST.TOKEN_DISPOSITIONS.FRIENDLY;
}

/**
 * Whether `target` is within Close range of `source`. With Daggerheart Distances
 * active its measurement decides, so the lightning reaches exactly the tokens
 * its rings highlight as Close. Otherwise the system's check, which uses the
 * scene's (or the world's) Close distance and measures edge to edge on the grid.
 * @param {Token} source
 * @param {Token} target
 */
function isWithinClose(source, target) {
    const distances = game.modules.get(DISTANCES_MODULE_ID);
    if (distances?.active && distances.api?.isWithinRange) return distances.api.isWithinRange(source, target, "close");
    return source.isWithinRange(target, "close");
}

/** An adversary with every Hit Point marked is out of the fight. */
function isDefeated(actor) {
    const hp = actor.system.resources.hitPoints;
    return hp.value >= hp.max;
}

/**
 * Resolves Chain Lightning and posts the results card.
 * Wave 0 is the adversaries within Close range of the caster; the Spellcast
 * Roll succeeds against those whose
 * Difficulty it meets (all of them on a critical). Each later wave is every
 * adversary not yet targeted within Close range of a target that took damage
 * in the previous wave. Every target the lightning reaches makes a reaction
 * roll against the Spellcast Roll result.
 *
 * @param {object} config
 * @param {Token} config.caster
 * @param {number} config.spellcast           - Spellcast Roll result.
 * @param {boolean} config.critical           - Whether the Spellcast Roll was a critical success.
 * @param {string} [config.damageFormula]     - A formula or a rolled total.
 * @param {boolean} [config.applyDamage]      - Mark HP, or only report it.
 * @param {boolean} [config.rename]           - Number the targets' names (1, 2...).
 */
async function resolveChainLightning({ caster, spellcast, critical, damageFormula = "2d8+4", applyDamage = true, rename = false }) {
    const results = [];
    const targeted = new Set([caster.id]);
    let renameCounter = 1;
    // One damage roll applied to every target, per the SRD rule for spells
    // that hit several targets. Rolled on the first failed reaction roll.
    let damageRoll = null;

    // Each target remembers the token the lightning jumped from, for the animation.
    const jumpedFrom = new Map();
    const findTargets = sources => canvas.tokens.placeables.filter(t => {
        if (targeted.has(t.id) || !isAdversary(t)) return false;
        const source = sources.find(s => isWithinClose(s, t));
        if (source) jumpedFrom.set(t.id, source);
        return !!source;
    });
    // One entry per wave: the bolts drawn in it, and whether each target burns.
    const strikes = [];

    let wave = findTargets([caster]);
    for (let waveIndex = 0; wave.length; waveIndex++) {
        wave.forEach(t => targeted.add(t.id));
        const damaged = [];
        const bolts = [];
        strikes.push(bolts);

        for (const token of wave) {
            const actor = token.actor;
            const defeated = isDefeated(actor);
            if (rename && !defeated) {
                await token.document.update({
                    name: `${token.name} ${renameCounter++}`,
                    displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
                    displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS
                });
            }

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

            // Listed rather than skipped silently, so the card explains why an
            // adversary in range wasn't hit. The chain doesn't pass through it.
            if (defeated) {
                result.hit = false;
                result.defeated = true;
                continue;
            }

            // Only the first wave is targeted by the Spellcast Roll itself;
            // chained adversaries go straight to the reaction roll.
            if (waveIndex === 0 && !critical && spellcast < actor.system.difficulty) {
                result.hit = false;
                result.difficulty = actor.system.difficulty;
                continue;
            }

            result.reaction = await rollReaction(actor, spellcast);
            const bolt = { from: jumpedFrom.get(token.id), to: token, burns: false };
            bolts.push(bolt);
            if (result.reaction.success) continue;

            if (!damageRoll) {
                damageRoll = await new Roll(damageFormula).evaluate();
                if (game.dice3d) await game.dice3d.showForRoll(damageRoll, game.user, true);
            }
            Object.assign(result, await damageAdversary(actor, damageRoll.total, applyDamage));
            if (result.hitPoints > 0) damaged.push(token);
            bolt.burns = result.hitPoints > 0;
        }

        wave = findTargets(damaged);
    }

    // Not awaited: the card goes to chat while the chain is still playing.
    playChainLightning(strikes);

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
 * Draws the chain with Sequencer and JB2A, when both are active: a bolt to
 * every target the lightning reached, wave after wave, and flames on each one
 * that took damage, with sounds. Sequencer plays it on every client.
 * @param {{from: Token, to: Token, burns: boolean}[][]} strikes - Bolts per wave.
 */
function playChainLightning(strikes) {
    if (!game.modules.get(SEQUENCER_MODULE_ID)?.active || !Sequencer.Database.entryExists(BOLT_PRIMARY)) return;
    const waves = strikes.filter(bolts => bolts.length);
    if (!waves.length) return;

    const pick = list => list[Math.floor(Math.random() * list.length)];
    // softFail: a missing JB2A file skips that effect instead of throwing.
    const sequence = new Sequence({ moduleName: MODULE_ID, softFail: true });
    waves.forEach((bolts, index) => {
        if (index > 0) sequence.wait(700);
        // One sound per wave, not per bolt, so a big wave doesn't stack them.
        sequence.sound().file(pick(LIGHTNING_SOUNDS)).volume(0.6);
        for (const { from, to } of bolts) {
            sequence.effect().file(index === 0 ? BOLT_PRIMARY : BOLT_SECONDARY).atLocation(from).stretchTo(to);
        }
        const burning = bolts.filter(b => b.burns);
        if (!burning.length) return;
        sequence.sound().file(pick(FIRE_SOUNDS)).volume(0.5).delay(400);
        for (const { to } of burning) {
            sequence.effect().file(FLAMES).attachTo(to).scaleToObject(1.5)
                .delay(400).duration(4000).fadeIn(300).fadeOut(1000);
        }
    });
    sequence.play();
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
        if (r.defeated) {
            stats = '<span style="color: #aaa; font-size: 0.9em;">Defeated</span>';
        } else if (!r.hit) {
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
                <span style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">${stats}</span>
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
        classes: ["dh-qa-app", "chain-lightning-app"],
        window: {
            title: CHAIN_LIGHTNING,
            icon: "fas fa-bolt",
            resizable: false,
            controls: []
        },
        position: {
            width: 400,
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
            template: `modules/${MODULE_ID}/templates/chain-lightning.hbs`
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
