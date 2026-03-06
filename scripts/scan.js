/**
 * Scan Module
 * Contains the logic for the QuickActions.Scan() feature.
 * Labels and titles are configurable via the Scan Settings menu.
 */

const MODULE_ID = "daggerheart-quickactions";

/** Fallback HP labels used when settings are unavailable. */
const DEFAULT_HP_LABELS = [
    { min: 100, label: "Imposing; their form is pristine, radiating an aura of untouched power." },
    { min: 75,  label: "Weathered; minor injuries or disruptions mark their form, but their stance remains firm." },
    { min: 50,  label: "Battered; visible wounds or flickering essence betray the toll of battle, slowing them down." },
    { min: 25,  label: "Broken; they stagger with ragged desperation, their existence hanging by a thread." },
    { min: 0,   label: "Fallen; the vessel has succumbed, collapsing into stillness or dissipation." },
];

/** Fallback Stress labels used when settings are unavailable. */
const DEFAULT_STRESS_LABELS = [
    { min: 100, label: "Unshakeable; their mind is a fortress, operating with absolute, terrifying clarity." },
    { min: 70,  label: "Guarded; a subtle tension tightens their movements, the weight of the moment setting in." },
    { min: 50,  label: "Rattled; hesitation fractures their focus, erratic energy revealing their inner turmoil." },
    { min: 25,  label: "Overwhelmed; panic or instability has taken hold, leaving them erratic and unpredictable." },
    { min: 0,   label: "Shattered; their mental defenses have crumbled, leaving them utterly exposed and vulnerable to any threat." },
];

/**
 * Reads the configured scan labels from world settings, falling back to defaults.
 * @param {"hp"|"stress"} type - Which label set to retrieve.
 * @returns {Array<{min: number, label: string}>}
 */
function getScanLabels(type) {
    const key = type === "hp" ? "scanHpLabels" : "scanStressLabels";
    const fallback = type === "hp" ? DEFAULT_HP_LABELS : DEFAULT_STRESS_LABELS;
    try {
        return JSON.parse(game.settings.get(MODULE_ID, key));
    } catch {
        return fallback;
    }
}

/**
 * Reads the configured scan title from world settings, falling back to defaults.
 * @param {"hp"|"stress"} type - Which title to retrieve.
 * @returns {string}
 */
function getScanTitle(type) {
    const key = type === "hp" ? "scanHpTitle" : "scanStressTitle";
    const fallback = type === "hp" ? "Physical State" : "Mental State";
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
    if (!game.settings.get("daggerheart-quickactions", "enableScan")) {
        return ui.notifications.warn("The Scan action is currently disabled by the GM.");
    }

    const targets = game.user.targets;
    if (targets.size === 0) {
        return ui.notifications.warn("Please target a token to scan.");
    }
    const target = targets.first();

    const actor = target.actor;
    if (!actor) {
        return ui.notifications.warn("The targeted token has no actor.");
    }
    const validTypes = ["character", "adversary", "companion"];
    if (!validTypes.includes(actor.type)) {
        return ui.notifications.warn(`Can only scan Characters, Adversaries, or Companions. Targeted a ${actor.type}.`);
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

    const titleColor = "#C9A060";
    const bgImage = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";

    const content = `
    <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                Scan: ${target.name}
            </h3>
        </header>
        <div class="card-content" style="background-image: url('${bgImage}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 120px; display: flex; flex-direction: column; align-items: stretch; justify-content: center; text-align: center; position: relative; gap: 15px;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; gap: 15px;">
                ${hpLabel ? `<div>
                    <div style="color: #ff6b6b; font-size: 1.0em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">${hpTitle}</div>
                    <div style="color: #ffffff; font-size: 1.2em; font-family: 'Aleo', serif; text-shadow: 1px 1px 2px #000;">${hpLabel.charAt(0).toUpperCase() + hpLabel.slice(1)}</div>
                </div>` : ''}
                ${stressLabel ? `<div>
                    <div style="color: #9d80ff; font-size: 1.0em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">${stressTitle}</div>
                    <div style="color: #ffffff; font-size: 1.2em; font-family: 'Aleo', serif; text-shadow: 1px 1px 2px #000;">${stressLabel.charAt(0).toUpperCase() + stressLabel.slice(1)}</div>
                </div>` : ''}
            </div>
        </div>
    </div>`;

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        whisper: [game.user.id]
    });
}