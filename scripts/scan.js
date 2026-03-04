/**
 * Scan Module
 * Contains the logic for the QuickActions.Scan() feature.
 */

const HP_LABELS = [
    { min: 100, label: "no injuries" },
    { min: 75,  label: "slightly injured" },
    { min: 50,  label: "more than slightly injured" },
    { min: 25,  label: "injured" },
    { min: 1,   label: "heavily injured or near death" },
    { min: 0,   label: "dying" },
];

const STRESS_LABELS = [
    { min: 100, label: "calm, focused, and operating with absolute clarity" },
    { min: 75,  label: "feeling the strain, nerves tight but still in control" },
    { min: 50,  label: "rattled and hesitant, the pressure beginning to cloud judgment" },
    { min: 25,  label: "exhausted and erratic, struggling to maintain focus" },
    { min: 10,  label: "on the verge of breaking, mind racing with fear and doubt" },
    { min: 0,   label: "completely overwhelmed, paralyzed by panic and unable to think clearly" },
];

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

    const hpLabel = hp ? getLabel(hpPct, HP_LABELS) : null;
    const stressLabel = stress ? getLabel(stressPct, STRESS_LABELS) : null;

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
                    <div style="color: #ff6b6b; font-size: 1.0em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">Physical State</div>
                    <div style="color: #ffffff; font-size: 1.2em; font-family: 'Aleo', serif; text-shadow: 1px 1px 2px #000;">${hpLabel.charAt(0).toUpperCase() + hpLabel.slice(1)}</div>
                </div>` : ''}
                ${stressLabel ? `<div>
                    <div style="color: #9d80ff; font-size: 1.0em; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">Mental State</div>
                    <div style="color: #ffffff; font-size: 1.2em; font-family: 'Aleo', serif; text-shadow: 1px 1px 2px #000;">${stressLabel.charAt(0).toUpperCase() + stressLabel.slice(1)}</div>
                </div>` : ''}
            </div>
        </div>
    </div>`;

    await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}