/**
 * Scan Module
 * Contains the logic for the QuickActions.Scan() feature.
 * Labels and titles are configurable via the Scan Settings menu.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";
import { tr } from "./i18n.js";
import { getDefaultScanLabels, getDefaultScanTitle } from "./scan-defaults.js";

/**
 * Reads the configured scan labels from world settings, falling back to defaults.
 * @param {"hp"|"stress"} type - Which label set to retrieve.
 * @returns {Array<{min: number, label: string}>}
 */
function getScanLabels(type) {
    const key = type === "hp" ? "scanHpLabels" : "scanStressLabels";
    try {
        const parsed = JSON.parse(game.settings.get(MODULE_ID, key));
        if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* unset or malformed: use the localized defaults */ }
    return getDefaultScanLabels(type);
}

/**
 * Reads the configured scan title from world settings, falling back to defaults.
 * @param {"hp"|"stress"} type - Which title to retrieve.
 * @returns {string}
 */
function getScanTitle(type) {
    const key = type === "hp" ? "scanHpTitle" : "scanStressTitle";
    try {
        return game.settings.get(MODULE_ID, key) || getDefaultScanTitle(type);
    } catch {
        return getDefaultScanTitle(type);
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
        return ui.notifications.warn(tr("Notify.ScanDisabled"));
    }

    const targets = game.user.targets;
    if (targets.size === 0) {
        return ui.notifications.warn(tr("Notify.ScanNoTarget"));
    }
    const target = targets.first();

    const actor = target.actor;
    if (!actor) {
        return ui.notifications.warn(tr("Notify.ScanNoActor"));
    }
    const validTypes = ["character", "adversary", "companion"];
    if (!validTypes.includes(actor.type)) {
        return ui.notifications.warn(tr("Notify.ScanInvalidType", { type: actor.type }));
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
    const content = buildChatCard(tr("Scan.Title", { name: target.name }), bodyHtml);

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        whisper: [game.user.id]
    });
}