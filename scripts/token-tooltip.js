/**
 * Token Tooltip
 * Shows a stat summary when hovering over character tokens on the canvas.
 */

const MODULE_ID = "daggerheart-quickactions";
const TEMPLATE_PATH = `modules/${MODULE_ID}/templates/token-tooltip.hbs`;

// Singleton DOM element for the tooltip
let _tooltipEl = null;

// Tracks which token is currently hovered (async race guard)
let _activeTokenId = null;

// -------------------------------------------------------------------
// Public init — called from main.js inside Hooks.once("init")
// -------------------------------------------------------------------
export function initTokenTooltip() {
    foundry.applications.handlebars.loadTemplates([TEMPLATE_PATH]);
    Hooks.on("hoverToken", _onHoverToken);
}

// -------------------------------------------------------------------
// Hook handler
// -------------------------------------------------------------------
async function _onHoverToken(token, hovered) {
    if (!game.settings.get(MODULE_ID, "tokenTooltip")) {
        _hideTooltip();
        return;
    }

    const actorType = token.actor?.type;
    const isCharacter = actorType === "character";
    const isAdversary = actorType === "adversary" && game.user.isGM;
    const isCompanion = actorType === "companion";

    if (!token.actor || (!isCharacter && !isAdversary && !isCompanion)) {
        _hideTooltip();
        return;
    }

    if (!hovered) {
        _activeTokenId = null;
        _hideTooltip();
        return;
    }

    const tokenId = token.id;
    _activeTokenId = tokenId;

    const data = isAdversary ? _buildAdversaryData(token) : isCompanion ? _buildCompanionData(token) : _buildData(token);
    const html = await foundry.applications.handlebars.renderTemplate(TEMPLATE_PATH, data);

    // After await: check if user already moved off this token
    if (_activeTokenId !== tokenId) return;

    const el = _getOrCreateEl();
    el.innerHTML = html;
    _positionTooltip(token, el);
    el.style.display = "block";
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
const ROMAN = ["", "I", "II", "III", "IV"];

function _tierRoman(tier) {
    return ROMAN[tier] ?? `${tier}`;
}

function _truncName(name) {
    if (!name || name.length <= 17) return name;
    return name.slice(0, 17) + "...";
}

// -------------------------------------------------------------------
// Data builder — always use actor.system (live, post-Active Effects)
// NEVER use .toObject(), actor.data, or JSON extraction
// -------------------------------------------------------------------
function _buildData(token) {
    const actor = token.actor;
    const sys = actor.system;

    const hp     = sys.resources?.hitPoints ?? { value: 0, max: 0 };
    const stress = sys.resources?.stress    ?? { value: 0, max: 0 };
    const hope   = sys.resources?.hope      ?? { value: 0, max: 0 };
    const armor  = sys.resources?.armor     ?? { value: 0, max: 0 };
    const dt     = sys.damageThresholds     ?? { major: 0, severe: 0 };

    const pct = (v, m) => (!m ? 0 : Math.round(Math.min(100, Math.max(0, (v / m) * 100))));

    // Check massive damage variant rule
    let showMassive = false;
    let massiveDT = 0;
    try {
        const variant = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.variantRules);
        if (variant?.massiveDamage?.enabled) {
            showMassive = true;
            massiveDT = (dt.severe ?? 0) * 2;
        }
    } catch (e) {
        // Variant setting not available; skip massive
    }

    const evasion = sys.evasion ?? 0;

    return {
        name:     _truncName(actor.name),
        evasion,
        hp,
        stress,
        hope,
        armor,
        minorDT:  dt.major ?? 0,
        majorDT:  dt.severe ?? 0,
        showMassive,
        massiveDT,
        hpPct:     pct(hp.max - hp.value, hp.max),
        stressPct: pct(stress.max - stress.value, stress.max),
        hopePct:   pct(hope.value, hope.max),
        armorPct:  pct(armor.max - armor.value, armor.max)
    };
}

// -------------------------------------------------------------------
// Adversary data builder (GM only)
// -------------------------------------------------------------------
function _buildAdversaryData(token) {
    const actor = token.actor;
    const sys = actor.system;

    const hp     = sys.resources?.hitPoints ?? { value: 0, max: 0 };
    const stress = sys.resources?.stress    ?? { value: 0, max: 0 };
    const dt     = sys.damageThresholds     ?? { major: 0, severe: 0 };

    const pct = (v, m) => (!m ? 0 : Math.round(Math.min(100, Math.max(0, (v / m) * 100))));

    const difficulty  = sys.difficulty ?? "";
    const attackBonus = sys.attack?.roll?.bonus ?? 0;
    const bonusSign   = attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;

    // Check massive damage variant rule
    let showMassive = false;
    let massiveDT = 0;
    try {
        const variant = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.variantRules);
        if (variant?.massiveDamage?.enabled) {
            showMassive = true;
            massiveDT = (dt.severe ?? 0) * 2;
        }
    } catch (e) {
        // Variant setting not available; skip massive
    }

    const tier = sys.tier ?? 1;

    return {
        isAdversary: true,
        name:        _truncName(actor.name),
        tierRoman:   _tierRoman(tier),
        tier,
        difficulty,
        bonusSign,
        hp,
        stress,
        minorDT:  dt.major ?? 0,
        majorDT:  dt.severe ?? 0,
        showMassive,
        massiveDT,
        hpPct:     pct(hp.max - hp.value, hp.max),
        stressPct: pct(stress.max - stress.value, stress.max)
    };
}

// -------------------------------------------------------------------
// Companion data builder
// -------------------------------------------------------------------
function _buildCompanionData(token) {
    const actor = token.actor;
    const sys = actor.system;

    const stress  = sys.resources?.stress ?? { value: 0, max: 0 };
    const evasion = sys.evasion ?? 0;

    const pct = (v, m) => (!m ? 0 : Math.round(Math.min(100, Math.max(0, (v / m) * 100))));

    // Resolve partner to actor name
    let partnerName = "";
    const partnerRef = sys.partner;
    if (partnerRef) {
        try {
            if (typeof partnerRef === "string") {
                // String reference (e.g. "Actor.Gc7BKSi8Y55elT0k")
                const idMatch = partnerRef.match(/^Actor\.(.+)$/);
                if (idMatch) {
                    const partnerActor = game.actors.get(idMatch[1]);
                    if (partnerActor?.name) partnerName = partnerActor.name;
                }
                if (!partnerName) {
                    const partnerActor = fromUuidSync(partnerRef);
                    if (partnerActor?.name) partnerName = partnerActor.name;
                }
            } else if (partnerRef?.name) {
                // Already a resolved document/object with a name
                partnerName = partnerRef.name;
            } else if (partnerRef?.id) {
                // Object with an id property
                const partnerActor = game.actors.get(partnerRef.id);
                if (partnerActor?.name) partnerName = partnerActor.name;
            }
        } catch (e) {
            // Invalid reference; skip partner
        }
    }

    return {
        isCompanion: true,
        name:        _truncName(actor.name),
        evasion,
        partnerName: _truncName(partnerName),
        stress,
        stressPct: pct(stress.max - stress.value, stress.max)
    };
}

// -------------------------------------------------------------------
// DOM management
// -------------------------------------------------------------------
function _getOrCreateEl() {
    if (!_tooltipEl || !document.body.contains(_tooltipEl)) {
        _tooltipEl = document.createElement("div");
        _tooltipEl.id = "dh-qa-token-tooltip";
        _tooltipEl.style.display = "none";
        document.body.appendChild(_tooltipEl);
    }
    return _tooltipEl;
}

function _hideTooltip() {
    if (_tooltipEl) _tooltipEl.style.display = "none";
}

// -------------------------------------------------------------------
// Positioning: canvas coordinates → screen coordinates
// -------------------------------------------------------------------
function _positionTooltip(token, el) {
    if (!canvas?.ready) return;

    const canvasBounds = canvas.app.view.getBoundingClientRect();
    const t = canvas.stage.worldTransform;

    // Right edge of token in screen coords
    const screenRightX = canvasBounds.left + t.tx + (token.x + token.w) * t.a;
    const screenTopY   = canvasBounds.top  + t.ty + token.y * t.d;
    const tokenScreenLeft = canvasBounds.left + t.tx + token.x * t.a;

    const PADDING = 8;
    const MARGIN  = 6;

    // Measure tooltip dimensions (temporarily visible but hidden)
    el.style.visibility = "hidden";
    el.style.display = "block";
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    el.style.display = "none";
    el.style.visibility = "";

    // Prefer right side of token; flip left if overflow
    let left = screenRightX + PADDING;
    if (left + tipW > window.innerWidth - MARGIN) {
        left = tokenScreenLeft - tipW - PADDING;
    }
    left = Math.max(MARGIN, left);

    let top = screenTopY;
    if (top + tipH > window.innerHeight - MARGIN) {
        top = window.innerHeight - tipH - MARGIN;
    }
    top = Math.max(MARGIN, top);

    el.style.left = `${left}px`;
    el.style.top  = `${top}px`;
}
