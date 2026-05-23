/**
 * Consolidated file containing all Quick Actions applications.
 * Contains: Downtime (Fear), Falling Damage, Help an Ally, Scar Check, Loot & Consumables, Fate Roll, Hope Spender, Templates, and Level Up.
 * Compatible with Foundry V13 (ApplicationV2).
 */

const MODULE_ID = "daggerheart-quickactions";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// HELPERS
// ==================================================================

export async function rollD4WithDiceSoNice() {
    try {
        const roll = new Roll("1d4");
        await roll.evaluate();
        if (game.dice3d) {
            await game.dice3d.showForRoll(roll, game.user, true);
        }
        return roll.total;
    } catch (error) {
        console.error("Error rolling 1d4:", error);
        ui.notifications.error("Error rolling the die!");
        return null;
    }
}

export async function rollD6WithDiceSoNice() {
    try {
        const roll = new Roll("1d6");
        await roll.evaluate();
        if (game.dice3d) {
            await game.dice3d.showForRoll(roll, game.user, true);
        }
        return roll.total;
    } catch (error) {
        console.error("Error rolling 1d6:", error);
        ui.notifications.error("Error rolling the die!");
        return null;
    }
}

/**
 * Executes the visual fate roll logic (Cards, Colors, Dice So Nice settings)
 */
async function performVisualFateRoll(dieFormula, rollType) {
    const actor = canvas.tokens.controlled[0]?.actor || game.user.character;
    const roll = new Roll(dieFormula);
    await roll.evaluate();

    let appearance = {};

    if (rollType === 'hope') {
        appearance = {
            colorset: "custom",
            foreground: "#000000",
            background: "#FFD700",
            outline: "#000000",
            texture: "none"
        };
    } else if (rollType === 'fear') {
        appearance = {
            colorset: "custom",
            foreground: "#FFFFFF",
            background: "#2c003e",
            outline: "#000000",
            texture: "none"
        };
    }

    if (roll.terms[0]) {
        roll.terms[0].options.appearance = appearance;
    }

    const title = `${rollType.charAt(0).toUpperCase() + rollType.slice(1)} Roll`;
    const titleColor = "#C9A060";
    const bgImage = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";

    const content = `
    <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                ${title}
            </h3>
        </header>
        <div class="card-content" style="background-image: url('${bgImage}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                <div style="color: #ffffff; font-size: 0.9em; margin-bottom: 5px;">Result</div>
                <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px ${rollType === 'hope' ? '#FFD700' : '#800080'}, 2px 2px 0px #000; font-family: 'Lato', sans-serif; line-height: 1;">
                    ${roll.total}
                </div>
            </div>
        </div>
    </div>`;

    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}

// ==================================================================
// 1. DOWNTIME APP
// ==================================================================
class DowntimeApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "downtime-app",
        classes: ["dh-qa-app", "downtime-app"],
        window: { title: "Choose Rest Type", icon: "fas fa-bed", resizable: false, controls: [] },
        position: { width: 400, height: "auto" },
        actions: { shortRest: DowntimeApp.prototype._onShortRest, longRest: DowntimeApp.prototype._onLongRest }
    };
    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/downtime.hbs" } };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.numberOfPCs = game.settings.get("daggerheart-quickactions", "downtimePCs");
        return context;
    }
    async _onShortRest() { await this._processRest("short"); this.close(); }
    async _onLongRest() { await this._processRest("long"); this.close(); }

    async _processRest(type) {
        const pcInput = this.element.querySelector('[name="numberOfPCs"]');
        let numberOfPCs = pcInput && pcInput.value ? parseInt(pcInput.value, 10) : 4;
        await game.settings.set("daggerheart-quickactions", "downtimePCs", numberOfPCs);

        const currentFear = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
        const fearRoll = await rollD4WithDiceSoNice();
        if (fearRoll === null) return;

        let addedFear = fearRoll;
        let calculationText = `(1d4) ${fearRoll}`;
        if (type === "long") {
            addedFear += numberOfPCs;
            calculationText = `(1d4 + ${numberOfPCs} PCs) ${fearRoll} + ${numberOfPCs}`;
        }
        let newFear = Math.min(currentFear + addedFear, 12);
        await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, newFear);

        const MESSAGE_TITLE = type === "short" ? "Short Rest" : "Long Rest";
        const content = `
        <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">${MESSAGE_TITLE}</h3>
            </header>
            <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 25px 20px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); z-index: 0;"></div>
                <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                    <div style="color: #ffffff; font-size: 1.4em; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; font-family: 'Aleo', serif;">The GM earns Fear</div>
                    <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 15px #800080, 2px 2px 2px #000; font-family: 'Lato', sans-serif;">+${addedFear}</div>
                    <div style="color: #ccc; font-size: 0.8em; margin-top: 5px; font-style: italic;">${calculationText}</div>
                    <div style="color: #e0e0e0; font-size: 0.9em; margin-top: 8px; font-weight: bold; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 4px;">Current Total: ${newFear}</div>
                </div>
            </div>
        </div>`;
        await ChatMessage.create({ user: game.user.id, style: CONST.CHAT_MESSAGE_STYLES.OTHER, content: content });
    }
}

// ==================================================================
// 2. FALLING DAMAGE APP
// ==================================================================
class FallingDamageApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "falling-damage-app",
        classes: ["dh-qa-app", "falling-app"],
        window: { title: "Falling & Collision Damage", icon: "fas fa-skull-crossbones", resizable: false, controls: [] },
        position: { width: 420, height: "auto" },
        actions: { rollDamage: FallingDamageApp.prototype._onRollDamage, cancel: FallingDamageApp.prototype._onCancel }
    };
    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/falling.hbs" } };

    /**
     * Prepares context data with current falling damage formulas from settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with formulas.
     */
    async _prepareContext(_options) {
        const formulas = game.settings.get(MODULE_ID, "fallingDamageFormulas");
        return { formulas };
    }

    async _onRollDamage(event, target) {
        const selection = target.dataset.height;
        if (!selection) return;
        const formulas = game.settings.get(MODULE_ID, "fallingDamageFormulas");
        let damageFormula = "", heightText = "", damageType = "Physical Damage";
        switch (selection) {
            case "veryclose": damageFormula = formulas.veryclose; heightText = "Very Close Range"; break;
            case "close": damageFormula = formulas.close; heightText = "Close Range"; break;
            case "far": damageFormula = formulas.far; heightText = "Far/Very Far Range"; break;
            case "collision": damageFormula = formulas.collision; heightText = "Collision"; damageType = "Direct Physical Damage"; break;
        }
        try {
            const roll = new Roll(damageFormula);
            await roll.evaluate();
            // BaseRoll class is required so Foundry uses foundryRoll.hbs, which renders the Deal Damage / Apply Healing buttons.
            const rollJSON = roll.toJSON();
            rollJSON.class = 'BaseRoll';
            await foundry.documents.ChatMessage.implementation.create({
                author: game.user.id,
                speaker: foundry.documents.ChatMessage.implementation.getSpeaker(),
                flavor: `${heightText} — ${damageType} (${damageFormula})`,
                rolls: [rollJSON],
                sound: CONFIG.sounds.dice
            });
            this.close();
        } catch (error) { console.error("Falling Damage Error:", error); ui.notifications.error("Error calculating falling damage."); }
    }
    _onCancel() { this.close(); }
}

// ==================================================================
// 4. LOOT & CONSUMABLES APP
// ==================================================================
class LootConsumableApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) { super(options); this.localState = { type: "Loot", formula: "1d12" }; }
    static DEFAULT_OPTIONS = {
        tag: "form", id: "loot-consumable-app", classes: ["dh-qa-app", "loot-consumable-app"],
        window: { title: "Loot & Consumables", icon: "fas fa-treasure-chest", resizable: false, controls: [] },
        position: { width: 450, height: "auto" },
        actions: { selectType: LootConsumableApp.prototype._onSelectType, setFormula: LootConsumableApp.prototype._onSetFormula, roll: LootConsumableApp.prototype._onRoll }
    };
    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/lootConsumable.hbs" } };

    async _prepareContext(options) { return { isLoot: this.localState.type === "Loot", isConsumable: this.localState.type === "Consumable", formula: this.localState.formula }; }
    _onSelectType(event, target) { this.localState.type = target.dataset.type; this.render(); }
    _onSetFormula(event, target) { this.localState.formula = target.dataset.formula; this.render(); }

    async _onRoll(event, target) {
        const formData = new FormData(this.element);
        const rollFormula = formData.get("formula") || this.localState.formula;
        const pack = game.packs.get("daggerheart.rolltables");
        if (!pack) { ui.notifications.error(`Compendium 'daggerheart.rolltables' not found.`); return; }
        
        let tableName = this.localState.type === "Consumable" ? "Consumables" : this.localState.type;
        const documents = await pack.getDocuments();
        const table = documents.find(d => d.name === tableName);
        if (!table) { ui.notifications.error(`Table '${tableName}' not found in compendium.`); return; }

        let roll;
        try { roll = new Roll(rollFormula); await roll.evaluate(); } catch (err) { ui.notifications.error("Invalid roll formula."); return; }
        if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

        let rollTotal = Math.max(1, Math.min(60, roll.total));
        const drawResult = table.results.find(r => rollTotal >= r.range[0] && rollTotal <= r.range[1]);
        
        let displayHtml = "Nothing found";
        if (drawResult) {
            let itemName = drawResult.text || drawResult.getChatText();
            if (drawResult.type === "document" && drawResult.documentId) {
                const uuid = drawResult.documentCollection.includes(".") ? `Compendium.${drawResult.documentCollection}.${drawResult.documentId}` : `${drawResult.documentCollection}.${drawResult.documentId}`;
                displayHtml = `@UUID[${uuid}]{${itemName}}`;
            } else { displayHtml = itemName; }
        }

        const titleColor = "#C9A060";
        const content = `
        <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">${this.localState.type} Roll</h3>
            </header>
            <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
                <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                    <div style="color: #ffffff; font-size: 0.9em;">Result: <strong>${rollTotal}</strong> (${rollFormula})</div>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.3); width: 80%; margin: 10px 0;">
                    <div style="color: #ffffff !important; font-size: 1.5em; font-weight: bold; text-shadow: 0px 0px 10px ${titleColor}; font-family: 'Lato', sans-serif; line-height: 1.2;">${displayHtml}</div>
                    ${drawResult && drawResult.img ? `<img src="${drawResult.img}" style="margin-top: 10px; max-width: 48px; border: none;" />` : ''}
                </div>
            </div>
        </div>`;
        await ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker(), content: content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
    }
}

// ==================================================================
// 5. HELP AN ALLY
// ==================================================================
export async function helpAnAlly() {
    const selectedToken = canvas.tokens.controlled[0];
    if (!selectedToken) { ui.notifications.warn("Please select a token first!"); return; }
    const actor = selectedToken.actor;
    if (!actor) return;
    const currentHope = actor.system.resources?.hope?.value;
    if (currentHope === undefined) { ui.notifications.warn("No Hope resource!"); return; }

    const BACKGROUND_IMAGE = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";
    if (currentHope <= 0) {
        await ChatMessage.create({
            user: game.user.id, speaker: ChatMessage.getSpeaker({actor: actor}), style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: `<div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;"><header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;"><h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">Help an Ally</h3></header><div class="card-content" style="background-image: url('${BACKGROUND_IMAGE}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;"><div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); z-index: 0;"></div><div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;"><i class="fas fa-heart-broken" style="font-size: 32px; color: #ff6b6b; margin-bottom: 10px;"></i><div style="color: #ff6b6b; font-size: 1.1em; font-weight: bold; font-family: 'Aleo', serif;">No Hope remaining!</div></div></div></div>`
        });
        return;
    }
    
    const roll = new Roll("1d6"); await roll.evaluate();
    await actor.update({"system.resources.hope.value": currentHope - 1});
    
    const content = `
    <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">Help an Ally</h3>
        </header>
        <div class="card-content" style="background-image: url('${BACKGROUND_IMAGE}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px #4CAF50, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">${roll.total}</div>
                <div style="color: #ccc; font-size: 0.9em; margin-top: 10px; font-style: italic;">Hope used: ${currentHope} → ${currentHope - 1}</div>
            </div>
        </div>
    </div>`;
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({actor: actor}), flavor: "<strong>Help an Ally</strong>", content: content });
}

// ==================================================================
// 6. SCAR CHECK
// ==================================================================
export async function scarCheck() {
    const token = canvas.tokens.controlled[0];
    if (!token || !token.actor) { ui.notifications.error("Select a token with an actor!"); return; }
    
    const currentLevel = token.actor.system.levelData?.level?.current;
    if (currentLevel === undefined) { ui.notifications.error("Could not find level data!"); return; }

    const roll = new Roll("1d12"); await roll.evaluate();
    const isScar = roll.total <= currentLevel;
    const resultColor = isScar ? "#ff6b6b" : "#4CAF50";
    const resultTitle = isScar ? "YOU TAKE A SCAR" : "SAFE";
    const resultIcon = isScar ? "fas fa-skull" : "fas fa-shield-alt";
    const resultDesc = isScar ? "Mark a Scar manually on your sheet." : "No scar taken.";

    const content = `
    <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">Scar Check</h3>
        </header>
        <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                <div style="color: #ccc; font-size: 0.9em; margin-bottom: 5px; font-weight: bold; text-shadow: 1px 1px 0 #000;">Level: ${currentLevel} vs Roll:</div>
                <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 10px ${resultColor}, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">${roll.total}</div>
                <i class="${resultIcon}" style="font-size: 24px; color: ${resultColor}; margin: 10px 0; text-shadow: 1px 1px 0 #000;"></i>
                <div style="color: ${resultColor}; font-size: 1.2em; font-weight: bold; text-transform: uppercase; font-family: 'Aleo', serif; text-shadow: 1px 1px 0 #000;">${resultTitle}</div>
                <div style="color: #eee; font-size: 0.9em; margin-top: 5px; font-style: italic;">${resultDesc}</div>
            </div>
        </div>
    </div>`;
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({token: token}), flavor: "<strong>Scar Check</strong>", content: content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
}

// ==================================================================
// 7. SPOTLIGHT TOKEN
// ==================================================================
export async function spotlightToken() {
    if (!game.combat) return ui.notifications.warn("No active combat found!");
    const token = canvas.tokens.controlled[0];
    if (!token || !token.inCombat) return ui.notifications.warn("Select a combatant token!");
    const turnIndex = game.combat.turns.findIndex(turn => turn.id === token.combatant?.id);
    if (turnIndex !== -1) await game.combat.update({ turn: turnIndex });
    else ui.notifications.warn("Token not found in combat.");
}

// ==================================================================
// 8. SHOW MACROS APP
// ==================================================================
class ShowMacrosApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(macroNames, options = {}) { super(options); this.macroNames = macroNames; }
    static DEFAULT_OPTIONS = { tag: "form", id: "show-macros-app", classes: ["dh-qa-app", "show-macros-app"], window: { title: "Macros", icon: "fas fa-play-circle", resizable: true }, position: { width: 300, height: "auto" }, actions: { executeMacro: ShowMacrosApp.prototype._onExecuteMacro } };
    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/showmacros.hbs" } };

    async _prepareContext(options) {
        const macroList = [];
        const pack = game.packs.get("daggerheart-quickactions.macros");
        let index = pack ? await pack.getIndex() : null;

        for (const input of this.macroNames) {
            let identifier = input, displayName = input, displayImg = "icons/svg/dice-target.svg";
            if (typeof input === "object" && input !== null) { identifier = input.uuid; displayName = input.name; displayImg = input.img; }
            if (typeof input === "string") {
                if (index) { const entry = index.find(m => m.name === input); if (entry) { displayName = entry.name; displayImg = entry.img; } }
                try { const doc = await fromUuid(input); if (doc) { displayName = doc.name; displayImg = doc.img; } } catch(e){}
                if (!input.includes(".")) { const wm = game.macros.get(input); if (wm) { displayName = wm.name; displayImg = wm.img; identifier = wm.uuid; } }
            }
            if (identifier) macroList.push({ id: identifier, name: displayName, img: displayImg });
        }
        return { macros: macroList };
    }

    async _onExecuteMacro(event, target) {
        const identifier = target.dataset.macro;
        let macro = null;
        const pack = game.packs.get("daggerheart-quickactions.macros");
        if (pack) { const index = await pack.getIndex(); const entry = index.find(m => m.name === identifier); if (entry) macro = await pack.getDocument(entry._id); }
        if (!macro) try { macro = await fromUuid(identifier); } catch(e){}
        if (!macro) macro = game.macros.find(m => m.name === identifier);
        if (macro && typeof macro.execute === 'function') macro.execute();
        else ui.notifications.warn(`Macro '${identifier}' not found.`);
    }
}

// ==================================================================
// 9. FATE ROLL
// ==================================================================
class FateRollDialog extends ApplicationV2 {
    constructor(rollType, options = {}) { super(options); this.rollType = rollType; }
    static DEFAULT_OPTIONS = { tag: "div", id: "dh-fate-ask-dialog", window: { title: "Select Fate Die", icon: "fas fa-dice", resizable: false }, position: { width: 320, height: "auto" }, actions: { roll: FateRollDialog.prototype._onRoll } };
    async _renderHTML(context, options) {
        const dice = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"];
        const buttons = dice.map(d => `<button type="button" class="dh-btn" data-action="roll" data-value="${d}" style="margin: 4px; width: 30%; flex: 1 0 30%;">${d}</button>`).join("");
        return `<div class="dh-qa-app" style="background: #191919; padding: 15px; height: 100%;"><p style="color: #C9A060; font-family: 'Aleo', serif; text-align: center; margin-bottom: 10px; font-size: 1.1em;">Rolling <strong>${this.rollType.toUpperCase()}</strong>. Choose die:</p><div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 5px;">${buttons}</div></div>`;
    }
    _replaceHTML(result, content, options) { content.innerHTML = result; return content; }
    async _onRoll(event, target) { await performVisualFateRoll(target.dataset.value, this.rollType); this.close(); }
}

export async function fateRoll(rollType = 'hope', mode = 'default') {
    if (mode === 'system') { if (ui.chat) await ui.chat.processMessage(`/fr type=${rollType}`); return; }
    if (mode === 'ask') { new FateRollDialog(rollType).render(true); return; }
    await performVisualFateRoll('1d12', rollType);
}

// ==================================================================
// 10. HOPE SPENDER APP
// ==================================================================
class HopeSpenderApp extends ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "daggerheart-hope-spender-v2", tag: "div", window: { title: "Spend Hope", icon: "fas fa-sun", resizable: false }, position: { width: 320, height: "auto" }, actions: { spend: HopeSpenderApp.prototype._onSpend } };
    async _renderHTML(context, options) {
        const buttons = [1, 2, 3, 4, 5, 6].map(num => `<button type="button" class="dh-hope-btn" data-action="spend" data-value="${num}">${num}</button>`).join("");
        return `<style>.dh-wrapper { background: #191919; padding: 10px; display: flex; flex-direction: column; gap: 10px; color: #C9A060; height: 100%; } .dh-title { text-align: center; font-family: 'Aleo', serif; font-size: 1.1em; border-bottom: 1px solid #444; padding-bottom: 5px; } .dh-hope-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .dh-hope-btn { background: #2a2a2a; color: #C9A060; border: 1px solid #C9A060; font-family: 'Aleo', serif; font-size: 1.5em; font-weight: bold; height: 50px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; } .dh-hope-btn:hover { background: #C9A060; color: #191919; box-shadow: 0 0 8px #C9A060; }</style><div class="dh-wrapper"><div class="dh-title">Select Hope to Spend</div><div class="dh-hope-grid">${buttons}</div></div>`;
    }
    _replaceHTML(result, content, options) { content.innerHTML = result; return content; }
    async _onSpend(event, target) {
        const spendAmount = parseInt(target.dataset.value);
        const token = canvas.tokens.controlled[0];
        if (!token) return ui.notifications.warn("Select a token!");
        const actor = token.actor;
        const currentHope = actor.system.resources?.hope?.value;
        if (currentHope === undefined) return ui.notifications.warn("No Hope resource!");
        if (currentHope < spendAmount) return ui.notifications.error("Not enough Hope!");
        await actor.update({"system.resources.hope.value": currentHope - spendAmount});
        const content = `<div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;"><header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;"><h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">Hope Spent</h3></header><div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;"><div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.80); z-index: 0;"></div><div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;"><div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 15px #C9A060, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">-${spendAmount}</div><div style="color: #ccc; font-size: 0.9em; margin-top: 10px; font-style: italic;">Hope Remaining: ${currentHope} → <span style="color: #C9A060; font-weight: bold;">${currentHope - spendAmount}</span></div></div></div></div>`;
        await ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker({actor: actor}), content: content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
        this.close();
    }
}

// TemplateCreatorApp has been moved to scripts/template-creator.js
// 12. LEVEL UP APP
// ==================================================================
class LevelUpApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static _instance = null;

    static DEFAULT_OPTIONS = {
        id: "daggerheart-level-up",
        classes: ["dh-level-up"],
        window: { title: "Level Up Players", icon: "fas fa-arrow-up", resizable: false, controls: [] },
        position: { width: 420, height: "auto" },
        actions: { levelUp: LevelUpApp.prototype._onLevelUp, levelUpAll: LevelUpApp.prototype._onLevelUpAll }
    };

    static PARTS = { form: { template: "modules/daggerheart-quickactions/templates/level-up.hbs" } };

    async _prepareContext() {
        const players = [];
        for (const user of game.users) {
            if (user.isGM) continue;
            const actor = user.character;
            const hasActor = !!actor;
            const currentLevel = hasActor ? (actor.system?.levelData?.level?.current ?? "?") : null;
            const changedLevel = hasActor ? (actor.system?.levelData?.level?.changed ?? currentLevel) : null;
            const hasPending = hasActor && changedLevel !== null && changedLevel > currentLevel;

            players.push({
                userId: user.id,
                userName: user.name,
                userColor: user.color?.toString() || "#ffffff",
                actorId: actor?.id || null,
                characterName: actor?.name || null,
                avatar: actor?.img || "icons/svg/mystery-man.svg",
                currentLevel,
                changedLevel,
                hasPending,
                hasActor
            });
        }
        const hasAnyActor = players.some(p => p.hasActor);
        return { players, hasAnyActor };
    }

    async _onLevelUpAll() {
        const actors = [];
        for (const user of game.users) {
            if (user.isGM) continue;
            const actor = user.character;
            if (!actor) continue;
            const currentLevel = actor.system?.levelData?.level?.current ?? 1;
            const changedLevel = actor.system?.levelData?.level?.changed ?? currentLevel;
            await actor.update({ "system.levelData.level.changed": changedLevel + 1 });
            actors.push(actor.name);
        }
        if (actors.length) {
            ui.notifications.info(`Leveled up: ${actors.join(", ")}`);
        }
        this.render();
    }

    async _onLevelUp(event, target) {
        const actorId = target.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.error("Actor not found.");
            return;
        }
        const currentLevel = actor.system?.levelData?.level?.current ?? 1;
        const changedLevel = actor.system?.levelData?.level?.changed ?? currentLevel;
        const newChanged = changedLevel + 1;

        await actor.update({ "system.levelData.level.changed": newChanged });
        ui.notifications.info(`${actor.name} leveled up to ${newChanged}!`);
        this.render();
    }

    _onClose(options) {
        super._onClose(options);
        LevelUpApp._instance = null;
    }
}

// ==================================================================
// EXPORTED FUNCTIONS
// ==================================================================
export async function activateDowntime() { new DowntimeApp().render(true); }
export async function activateFallingDamage() { new FallingDamageApp().render(true); }
export async function activateLootConsumable() { new LootConsumableApp().render(true); }
export async function activateSpendHope() { new HopeSpenderApp().render(true); }

export async function activateLevelUp() {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can use Level Up.");
        return;
    }
    if (LevelUpApp._instance?.rendered) {
        LevelUpApp._instance.bringToFront();
        return;
    }
    LevelUpApp._instance = new LevelUpApp();
    LevelUpApp._instance.render(true);
}

export async function showMacros(...args) {
    let rawMacros = Array.isArray(args[0]) ? args[0] : args;
    const macros = rawMacros.filter(m => m !== undefined && m !== null);
    if (macros.length === 0) return ui.notifications.warn("QuickActions: No valid macros provided.");
    new ShowMacrosApp(macros).render(true);
}
