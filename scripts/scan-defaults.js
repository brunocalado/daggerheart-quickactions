// ============================================================
// Quick Actions | scan-defaults.js
// Built-in Scan labels and titles. Built lazily so the text follows the active language.
// ============================================================

import { tr } from "./i18n.js";

const HP_THRESHOLDS = [
    { min: 100, key: "imposing" },
    { min: 75,  key: "weathered" },
    { min: 50,  key: "battered" },
    { min: 25,  key: "broken" },
    { min: 0,   key: "fallen" }
];

const STRESS_THRESHOLDS = [
    { min: 100, key: "unshakeable" },
    { min: 70,  key: "guarded" },
    { min: 50,  key: "rattled" },
    { min: 25,  key: "overwhelmed" },
    { min: 0,   key: "shattered" }
];

/**
 * Default descriptive labels for a Scan track, ordered from the highest threshold down.
 * @param {"hp"|"stress"} type
 * @returns {Array<{min: number, label: string}>}
 */
export function getDefaultScanLabels(type) {
    const list = type === "hp" ? HP_THRESHOLDS : STRESS_THRESHOLDS;
    return list.map(({ min, key }) => ({ min, label: tr(`Scan.Labels.${key}`) }));
}

/**
 * Default chat-card title for a Scan track.
 * @param {"hp"|"stress"} type
 * @returns {string}
 */
export function getDefaultScanTitle(type) {
    return tr(type === "hp" ? "Scan.PhysicalState" : "Scan.MentalState");
}
