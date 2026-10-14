/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Scan Module
 * Contains the logic for the QuickActions.Scan() feature.
 * Labels and titles are configurable via the Scan Settings menu.
 */

import { MODULE_ID, SCAN_DEFAULT_LABELS, SCAN_DEFAULT_TITLES } from "./constants.js";
import { buildChatCard } from "./helpers.js";

/**
 * Reads the configured scan labels from world settings. Each threshold uses the GM's text when
 * one is stored for it, and the localized default otherwise — an empty or unparsable setting
 * means "all defaults", so the card follows the client's language until the GM writes their own.
 * @param {"hp"|"stress"} type - Which label set to retrieve.
 * @returns {Array<{min: number, label: string}>}
 */
export function getScanLabels(type) {
    const key = type === "hp" ? "scanHpLabels" : "scanStressLabels";
    let stored = [];
    try {
        stored = JSON.parse(game.settings.get(MODULE_ID, key));
    } catch { /* empty or malformed: every threshold falls back to its default */ }
    if (!Array.isArray(stored)) stored = [];
    return SCAN_DEFAULT_LABELS[type].map(({ min, label }) => ({
        min,
        label: stored.find(entry => entry?.min === min)?.label || game.i18n.localize(label)
    }));
}

/**
 * Reads the configured scan title from world settings, falling back to the localized default.
 * @param {"hp"|"stress"} type - Which title to retrieve.
 * @returns {string}
 */
export function getScanTitle(type) {
    const key = type === "hp" ? "scanHpTitle" : "scanStressTitle";
    const fallback = game.i18n.localize(SCAN_DEFAULT_TITLES[type]);
    try {
        return game.settings.get(MODULE_ID, key) || fallback;
    } catch {
        return fallback;
    }
}

/**
 * Gets a descriptive label based on a percentage value.
 * @param {number} pct The percentage (0-100).
 * @param {Array<object>} labels The array of label mappings, sorted descending by min.
 * @returns {string}
 */
function getLabel(pct, labels) {
    for (const entry of labels) {
        if (pct >= entry.min) {
            return entry.label;
        }
    }
    return labels[labels.length - 1].label; // Fallback to the lowest value
}

/**
 * Scans the targeted token and displays its physical and mental state in the chat.
 */
export async function scan() {
    // Check if the feature is enabled by the GM
    if (!game.settings.get(MODULE_ID, "enableScan")) {
        return ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.SCAN.notify.disabled"));
    }

    const targets = game.user.targets;
    if (targets.size === 0) {
        return ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.SCAN.notify.noTarget"));
    }
    const target = targets.first();

    const actor = target.actor;
    if (!actor) {
        return ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.SCAN.notify.noActor"));
    }
    const validTypes = ["character", "adversary", "companion"];
    if (!validTypes.includes(actor.type)) {
        return ui.notifications.warn(game.i18n.localize("DH_QUICKACTIONS.SCAN.notify.invalidType", { type: actor.type }));
    }

    const hp = actor.system.resources?.hitPoints;
    const stress = actor.system.resources?.stress;

    let hpPct = 100;
    if (hp && hp.max > 0) {
        hpPct = Math.max(0, Math.round(((hp.max - hp.value) / hp.max) * 100));
    } else if (hp) {
        hpPct = hp.value > 0 ? 0 : 100;
    }

    let stressPct = 100;
    if (stress && stress.max > 0) {
        stressPct = Math.max(0, Math.round(((stress.max - stress.value) / stress.max) * 100));
    } else if (stress) {
        stressPct = stress.value > 0 ? 0 : 100;
    }

    const hpLabel = hp ? getLabel(hpPct, getScanLabels("hp")) : null;
    const stressLabel = stress ? getLabel(stressPct, getScanLabels("stress")) : null;
    const hpTitle = getScanTitle("hp");
    const stressTitle = getScanTitle("stress");

    const bodyHtml = `
                <div style="width: 100%; display: flex; flex-direction: column; gap: 15px;">
                    ${hpLabel ? `<div>
                        <div style="color: #ff6b6b; font-size: 1.0em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">${hpTitle}</div>
                        <div style="color: #ffffff; font-size: 1.2em; font-family: 'Aleo', serif; text-shadow: 1px 1px 2px #000;">${hpLabel.charAt(0).toUpperCase() + hpLabel.slice(1)}</div>
                    </div>` : ''}
                    ${stressLabel ? `<div>
                        <div style="color: #9d80ff; font-size: 1.0em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">${stressTitle}</div>
                        <div style="color: #ffffff; font-size: 1.2em; font-family: 'Aleo', serif; text-shadow: 1px 1px 2px #000;">${stressLabel.charAt(0).toUpperCase() + stressLabel.slice(1)}</div>
                    </div>` : ''}
                </div>`;
    const content = buildChatCard(game.i18n.localize("DH_QUICKACTIONS.SCAN.cardTitle", { name: foundry.utils.escapeHTML(target.name) }), bodyHtml);

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        whisper: [game.user.id]
    });
}