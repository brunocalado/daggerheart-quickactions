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
// CHAIN LIGHTNING APP V2
// ==================================================================

/**
 * Resolves Chain Lightning (Arcana 5) for a caster token. The player uses the
 * card as usual (2 Stress, Spellcast Roll); this app resolves the part the
 * system leaves to the table: reaction rolls with a Difficulty equal to the
 * Spellcast Roll, and the chain that jumps from every target who took damage.
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
            title: "Chain Lightning",
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
        const cast = this.#findLastCast();
        return {
            ...context,
            casterName: this.caster.name,
            foundCast: !!cast,
            spellcast: cast?.total ?? "",
            critical: cast?.isCritical ?? false
        };
    }

    /**
     * The caster's most recent Chain Lightning Spellcast Roll in chat, so the GM
     * doesn't have to copy the number over. Reading the roll from the message
     * keeps a later reroll (Hope feature, etc.) in effect.
     * @returns {{total: number, isCritical: boolean}|null}
     */
    #findLastCast() {
        const actor = this.caster.actor;
        if (!actor) return null;
        const message = game.messages.contents.findLast(m =>
            m.type === "dualityRoll"
            && m.system.source?.actor === actor.uuid
            && actor.items.get(m.system.source.item)?.name === "Chain Lightning"
        );
        const roll = message?.system.roll;
        if (!roll?._evaluated) return null;
        return { total: roll.total, isCritical: roll.isCritical };
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

        await this.#execute({
            spellcast,
            critical,
            damageFormula: damage,
            shouldApplyDamage: applyDamage,
            shouldRename: renameTargets
        });
    }

    /**
     * Core Logic for Chain Lightning.
     * Wave 0 is every adversary within Close range of the caster; the Spellcast
     * Roll succeeds against those whose Difficulty it meets (all of them on a
     * critical). Each later wave is every adversary not yet targeted within Close
     * range of a target that took damage in the previous wave. Every target the
     * lightning reaches makes a reaction roll against the Spellcast Roll result.
     */
    async #execute({ spellcast, critical, damageFormula, shouldApplyDamage, shouldRename }) {
        const caster = this.caster;
        const results = [];
        const targeted = new Set([caster.id]);
        let renameCounter = 1;
        // One damage roll applied to every target, per the SRD rule for spells
        // that hit several targets. Rolled on the first failed reaction roll.
        let damageRoll = null;

        const isLivingAdversary = t => {
            const actor = t.actor;
            if (actor?.type !== "adversary" || t.document.disposition !== CONST.TOKEN_DISPOSITIONS.HOSTILE) return false;
            const hp = actor.system.resources.hitPoints;
            return hp.value < hp.max;
        };
        // isWithinRange is the system's range check: it uses the scene's (or the
        // world's) Close distance and measures edge to edge like the token ruler.
        const findTargets = sources => canvas.tokens.placeables.filter(t =>
            !targeted.has(t.id) && isLivingAdversary(t) && sources.some(s => s.isWithinRange(t, "close"))
        );

        let wave = findTargets([caster]);
        for (let waveIndex = 0; wave.length; waveIndex++) {
            wave.forEach(t => targeted.add(t.id));
            const damaged = [];

            for (const token of wave) {
                if (shouldRename) {
                    await token.document.update({
                        name: `${token.name} ${renameCounter++}`,
                        displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER,
                        displayName: CONST.TOKEN_DISPLAY_MODES.ALWAYS
                    });
                }

                const actor = token.actor;
                const result = { name: token.name, chained: waveIndex > 0, hit: true, reaction: null, hitPoints: 0 };
                results.push(result);

                // Only the first wave is targeted by the Spellcast Roll itself;
                // chained adversaries go straight to the reaction roll.
                if (waveIndex === 0 && !critical && spellcast < actor.system.difficulty) {
                    result.hit = false;
                    result.difficulty = actor.system.difficulty;
                    continue;
                }

                result.reaction = await this.#rollReaction(actor, spellcast);
                if (result.reaction.success) continue;

                if (!damageRoll) {
                    damageRoll = await new Roll(damageFormula).evaluate();
                    if (game.dice3d) await game.dice3d.showForRoll(damageRoll, game.user, true);
                }
                result.hitPoints = await this.#damage(actor, damageRoll.total, shouldApplyDamage);
                if (result.hitPoints > 0) damaged.push(token);
            }

            wave = findTargets(damaged);
        }

        await this.#createChatMessage(results, spellcast, critical, damageFormula, damageRoll, shouldApplyDamage);
    }

    /**
     * Rolls an adversary reaction roll through the system, so roll bonuses and
     * effects that apply to reaction rolls are included. A natural 20 succeeds.
     * @returns {Promise<{total: number, critical: boolean, success: boolean}>}
     */
    async #rollReaction(actor, difficulty) {
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
     * @returns {Promise<number>} Hit Points marked (or that would be marked).
     */
    async #damage(actor, total, apply) {
        const damageTypes = ["magical"];
        if (!apply) return actor.convertDamageToThreshold(actor.calculateDamage(total, damageTypes));

        const updates = await actor.takeDamage({ main: { total, damageTypes } });
        const hitPoints = updates?.find(u => u.key === "hitPoints");
        return Math.abs(hitPoints?.value ?? 0);
    }

    async #createChatMessage(results, spellcast, critical, damageFormula, damageRoll, applied) {
        const titleColor = "#C9A060"; // Gold

        let listItemsHtml = "";

        results.forEach((r) => {
            const failed = r.reaction && !r.reaction.success;
            const statusIcon = failed ? '<i class="fas fa-bolt"></i>' : '<i class="fas fa-shield-alt"></i>';
            const statusColor = failed ? '#f44336' : r.hit ? '#4CAF50' : '#777';

            // Chained Indicator on new line
            const chainedIndicator = r.chained
                ? `<div style="margin-top: 2px; color: #4a90e2; font-size: 0.85em; display: flex; align-items: center;">
                        <i class="fas fa-bolt" style="margin-right: 4px;"></i> CHAINED
                   </div>`
                : '';

            let stats;
            if (!r.hit) {
                stats = `<span style="color: #aaa; font-size: 0.9em;">Spellcast missed (Difficulty ${r.difficulty})</span>`;
            } else {
                const critText = r.reaction.critical ? ' <i class="fas fa-star" style="color: #FFD700; font-size: 0.8em;" title="Critical"></i>' : '';
                const outcome = failed
                    ? `<span style="color: #ff6b6b; font-weight: bold;">${r.hitPoints} HP</span>`
                    : '<span style="color: #aaa;">Resisted</span>';
                stats = `<span style="color: #ccc; font-size: 0.9em;">Reaction: <span style="color: #4a90e2; font-weight: bold;">${r.reaction.total}</span>${critText}</span>
                    <span style="color: #666;">|</span>
                    <span style="font-size: 0.9em;">${outcome}</span>`;
            }

            listItemsHtml += `
            <div style="display: flex; flex-direction: column; background: rgba(0,0,0,0.4); margin-bottom: 4px; padding: 6px 8px; border-radius: 4px; border-left: 3px solid ${statusColor}; font-size: 0.95em;">

                <!-- Line 1: Icon + Name -->
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <span style="color: ${statusColor}; width: 15px; text-align: center;">${statusIcon}</span>
                    <strong style="color: #e0e0e0; font-size: 1.05em;">${r.name}</strong>
                </div>

                <!-- Line 2: Stats (Right Aligned) -->
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                    ${stats}
                </div>

                <!-- Line 3: Chained Indicator (if applicable) -->
                ${chainedIndicator}
            </div>
            `;
        });

        if (!results.length) {
            listItemsHtml = '<div style="color: #aaa; text-align: center;">No adversaries within Close range.</div>';
        }

        const damageText = damageRoll ? `${damageRoll.total} <span style="color: #777;">(${damageFormula})</span>` : damageFormula;

        const content = `
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
                    <span><strong>Mode:</strong> ${applied ? '<span style="color:#f44336">Damage</span>' : '<span style="color:#4a90e2">Info</span>'}</span>
                </div>

                <div style="padding-right: 5px;">
                    ${listItemsHtml}
                </div>
            </div>
        </div>`;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ token: this.caster.document }),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    }
}
