/**
 * Consolidated file containing all Quick Actions applications.
 * Contains: Downtime (Fear), Falling Damage, Request Roll, Help an Ally, Scar Check, Loot & Consumables, and Fate Roll.
 * Compatible with Foundry V13 (ApplicationV2).
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// HELPERS
// ==================================================================

async function rollD4WithDiceSoNice() {
    try {
        const roll = new Roll("1d4");
        await roll.evaluate();
        // We keep this here because Downtime uses ChatMessage.create directly without passing the roll object,
        // so Dice So Nice wouldn't trigger on its own.
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

// ==================================================================
// 1. DOWNTIME / EARN FEAR APP
// ==================================================================

class DowntimeApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "downtime-app",
        classes: ["dh-qa-app", "downtime-app"],
        window: {
            title: "Choose Rest Type",
            icon: "fas fa-bed",
            resizable: false,
            controls: []
        },
        position: {
            width: 400,
            height: "auto"
        },
        actions: {
            shortRest: DowntimeApp.prototype._onShortRest,
            longRest: DowntimeApp.prototype._onLongRest
        }
    };

    static PARTS = {
        form: {
            template: "modules/daggerheart-quickactions/templates/downtime.hbs"
        }
    };

    async _onShortRest(event, target) {
        await this._processRest("short");
        this.close();
    }

    async _onLongRest(event, target) {
        await this._processRest("long");
        this.close();
    }

    async _processRest(type) {
        const currentFear = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
        const numberOfPCs = 4; // TODO: Make dynamic if necessary

        const fearRoll = await rollD4WithDiceSoNice();
        if (fearRoll === null) return;

        let addedFear = fearRoll;
        if (type === "long") addedFear += numberOfPCs;

        let newFear = Math.min(currentFear + addedFear, 12);
        
        await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, newFear);

        // Visual
        const MESSAGE_TITLE = type === "short" ? "Short Rest" : "Long Rest";
        
        const content = `
        <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                    ${MESSAGE_TITLE}
                </h3>
            </header>
            <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 25px 20px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.75); z-index: 0;"></div>
                <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                    
                    <div style="color: #ffffff; font-size: 1.4em; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; font-family: 'Aleo', serif; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">
                        The GM earns Fear
                    </div>

                    <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 15px #800080, 2px 2px 2px #000; font-family: 'Lato', sans-serif;">+${addedFear}</div>
                    
                    <div style="color: #e0e0e0; font-size: 0.9em; margin-top: 8px; font-weight: bold; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 4px;">
                        Current Total: ${newFear}
                    </div>
                </div>
            </div>
        </div>`;

        await ChatMessage.create({
            user: game.user.id,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: content
        });
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
        window: {
            title: "Falling & Collision Damage",
            icon: "fas fa-skull-crossbones",
            resizable: false,
            controls: []
        },
        position: {
            width: 420,
            height: "auto"
        },
        actions: {
            rollDamage: FallingDamageApp.prototype._onRollDamage,
            cancel: FallingDamageApp.prototype._onCancel
        }
    };

    static PARTS = {
        form: {
            template: "modules/daggerheart-quickactions/templates/falling.hbs"
        }
    };

    async _onRollDamage(event, target) {
        const selection = target.dataset.height;
        if (!selection) return;

        let damageFormula = "";
        let heightText = "";
        let damageType = "Physical Damage";

        switch (selection) {
            case "veryclose": damageFormula = "1d10+3"; heightText = "Very Close Range"; break;
            case "close": damageFormula = "1d20+5"; heightText = "Close Range"; break;
            case "far": damageFormula = "1d100+15"; heightText = "Far/Very Far Range"; break;
            case "collision": damageFormula = "1d20+5"; heightText = "Collision"; damageType = "Direct Physical Damage"; break;
        }

        try {
            const roll = new Roll(damageFormula);
            await roll.evaluate();

            const content = `
            <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
                <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
                    <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">The Fall Ends</h3>
                </header>
                <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                    <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
                    <div style="position: relative; z-index: 1; width: 100%;">
                        
                        <div style="color: #ffffff; font-size: 1.5em; font-weight: 800; margin-bottom: 5px; text-transform: uppercase; font-family: 'Aleo', serif; text-shadow: 2px 2px 0 #000;">
                            ${heightText}
                        </div>
                        
                        <div style="color: #e0e0e0; font-size: 1.1em; margin-bottom: 15px; font-weight: bold; background: rgba(0,0,0,0.5); display: inline-block; padding: 2px 10px; border-radius: 4px;">
                            ${damageType} <span style="color: #C9A060;">(${damageFormula})</span>
                        </div>

                        <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px #ff0000, 2px 2px 0px #000; font-family: 'Lato', sans-serif; line-height: 1;">
                            ${roll.total}
                        </div>
                        
                        <div style="color: #ff6b6b; font-size: 1.0em; font-weight: bold; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px;">
                            DAMAGE
                        </div>
                    </div>
                </div>
            </div>`;

            await roll.toMessage({
                speaker: ChatMessage.getSpeaker(),
                flavor: `<strong>${heightText}</strong>`,
                content: content
            });
            this.close();
        } catch (error) {
            console.error("Falling Damage Error:", error);
            ui.notifications.error("Error calculating falling damage.");
        }
    }

    _onCancel() { this.close(); }
}

// ==================================================================
// 3. REQUEST ROLL APP
// ==================================================================

class RequestRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "request-roll-app",
        classes: ["dh-qa-app", "request-roll-app"],
        window: {
            title: "Roll Configuration",
            icon: "fas fa-dice-d20",
            resizable: false,
            controls: []
        },
        position: {
            width: 400,
            height: "auto"
        },
        actions: {
            roll: RequestRollApp.prototype._onRoll,
            cancel: RequestRollApp.prototype._onCancel
        }
    };

    static PARTS = {
        form: {
            template: "modules/daggerheart-quickactions/templates/requestRoll.hbs"
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.difficultyOptions = Array.from({length: 26}, (_, i) => i + 5);
        return context;
    }

    async _onRoll(event, target) {
        const formData = new FormData(this.element);
        
        const difficulty = formData.get("difficulty");
        const trait = formData.get("trait");
        const reaction = formData.has("reaction");
        const advantage = formData.has("advantage");
        const disadvantage = formData.has("disadvantage");
        const labelInput = (formData.get("label") || "").trim();

        let command = "[[/dr";
        let params = [];
        if (difficulty) params.push(`difficulty=${difficulty}`);
        if (trait) params.push(`trait=${trait}`);
        if (reaction) params.push("reaction=true");
        if (advantage) params.push("advantage=true");
        if (disadvantage) params.push("disadvantage=true");
        
        if (params.length > 0) command += " " + params.join(" ");
        command += "]]";
        if (labelInput) command += `{${labelInput}}`;

        const content = `
        <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                    ${labelInput || "Roll Request"}
                </h3>
            </header>
            <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 100px; display: flex; align-items: center; justify-content: center; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
                <span style="color: #ffffff !important; font-size: 1.1em; font-weight: bold; text-shadow: 0px 0px 8px #000000; position: relative; z-index: 1; font-family: 'Lato', sans-serif; line-height: 1.4; width: 100%;">
                    ${command}
                </span>
            </div>
        </div>`;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        this.close();
    }

    _onCancel() { this.close(); }
}

// ==================================================================
// 4. LOOT & CONSUMABLES APP
// ==================================================================

class LootConsumableApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) {
        super(options);
        // Initial state
        this.localState = {
            type: "Loot", // "Loot" or "Consumable"
            formula: "1d12"
        };
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "loot-consumable-app",
        classes: ["dh-qa-app", "loot-consumable-app"],
        window: {
            title: "Loot & Consumables",
            icon: "fas fa-treasure-chest",
            resizable: false,
            controls: []
        },
        position: {
            width: 450,
            height: "auto"
        },
        actions: {
            selectType: LootConsumableApp.prototype._onSelectType,
            setFormula: LootConsumableApp.prototype._onSetFormula,
            roll: LootConsumableApp.prototype._onRoll
        }
    };

    static PARTS = {
        form: {
            template: "modules/daggerheart-quickactions/templates/lootConsumable.hbs"
        }
    };

    async _prepareContext(options) {
        return {
            isLoot: this.localState.type === "Loot",
            isConsumable: this.localState.type === "Consumable",
            formula: this.localState.formula
        };
    }

    _onSelectType(event, target) {
        const type = target.dataset.type;
        this.localState.type = type;
        this.render();
    }

    _onSetFormula(event, target) {
        const formula = target.dataset.formula;
        this.localState.formula = formula;
        this.render();
    }

    async _onRoll(event, target) {
        const formData = new FormData(this.element);
        const customFormula = formData.get("formula");
        const rollFormula = customFormula || this.localState.formula;

        const packName = "daggerheart-quickactions.loot-and-consumable-tables";
        const pack = game.packs.get(packName);

        if (!pack) {
            ui.notifications.error(`Compendium '${packName}' not found.`);
            return;
        }

        const documents = await pack.getDocuments();
        const table = documents.find(d => d.name === this.localState.type);

        if (!table) {
            ui.notifications.error(`Table '${this.localState.type}' not found in compendium.`);
            return;
        }

        let roll;
        try {
            roll = new Roll(rollFormula);
            await roll.evaluate();
        } catch (err) {
            ui.notifications.error("Invalid roll formula.");
            return;
        }

        if (game.dice3d) {
            await game.dice3d.showForRoll(roll, game.user, true);
        }

        let rollTotal = roll.total;
        if (rollTotal > 60) rollTotal = 60;
        if (rollTotal < 1) rollTotal = 1;

        const drawResult = table.results.find(r => {
            const min = r.range[0];
            const max = r.range[1];
            return rollTotal >= min && rollTotal <= max;
        });

        let itemName = "Nothing found";
        let displayHtml = "Nothing found";

        if (drawResult) {
            itemName = drawResult.text || drawResult.getChatText();
            displayHtml = itemName;

            if (drawResult.type === "document" && drawResult.documentId) {
                const collection = drawResult.documentCollection;
                const id = drawResult.documentId;
                
                let uuid = "";
                if (collection.includes(".")) {
                    uuid = `Compendium.${collection}.${id}`;
                } else {
                    uuid = `${collection}.${id}`;
                }
                
                displayHtml = `@UUID[${uuid}]{${itemName}}`;
            }
        }

        const bgImage = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";
        const titleColor = "#C9A060"; // Gold

        const content = `
        <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                    ${this.localState.type} Roll
                </h3>
            </header>
            <div class="card-content" style="background-image: url('${bgImage}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
                <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                    
                    <div style="color: #ffffff; font-size: 0.9em;">Result: <strong>${rollTotal}</strong> (${rollFormula})</div>
                    
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.3); width: 80%; margin: 10px 0;">

                    <div style="color: #ffffff !important; font-size: 1.5em; font-weight: bold; text-shadow: 0px 0px 10px ${titleColor}; font-family: 'Lato', sans-serif; line-height: 1.2;">
                        ${displayHtml}
                    </div>
                    
                    ${drawResult && drawResult.img ? `<img src="${drawResult.img}" style="margin-top: 10px; max-width: 48px; border: none;" />` : ''}

                </div>
            </div>
        </div>`;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    }
}

// ==================================================================
// 5. HELP AN ALLY (Macro Logic)
// ==================================================================

export async function helpAnAlly() {
    const selectedToken = canvas.tokens.controlled[0];
    
    if (!selectedToken) {
        ui.notifications.warn("Please select a token first!");
        return;
    }
    
    const actor = selectedToken.actor;
    
    if (!actor) {
        ui.notifications.warn("Selected token has no associated actor!");
        return;
    }
    
    const currentHope = actor.system.resources?.hope?.value;
    
    if (currentHope === undefined || currentHope === null) {
        ui.notifications.warn("This actor doesn't have a Hope resource!");
        return;
    }

    const BACKGROUND_IMAGE = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";

    // CASE: NO HOPE
    if (currentHope <= 0) {
        const content = `
        <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                    Help an Ally
                </h3>
            </header>
            <div class="card-content" style="background-image: url('${BACKGROUND_IMAGE}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); z-index: 0;"></div>
                <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                    <i class="fas fa-heart-broken" style="font-size: 32px; color: #ff6b6b; margin-bottom: 10px;"></i>
                    <div style="color: #ff6b6b; font-size: 1.1em; font-weight: bold; font-family: 'Aleo', serif;">No Hope remaining!</div>
                </div>
            </div>
        </div>`;
        
        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({actor: actor}),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        return;
    }
    
    // CASE: HAS HOPE - ROLL
    const roll = new Roll("1d6");
    await roll.evaluate();
    
    const newHope = currentHope - 1;
    await actor.update({"system.resources.hope.value": newHope});
    
    const content = `
    <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                Help an Ally
            </h3>
        </header>
        <div class="card-content" style="background-image: url('${BACKGROUND_IMAGE}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                
                <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px #4CAF50, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">
                    ${roll.total}
                </div>
                
                <div style="color: #ccc; font-size: 0.9em; margin-top: 10px; font-style: italic;">
                    Hope used: ${currentHope} → ${newHope}
                </div>
            </div>
        </div>
    </div>`;
    
    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({actor: actor}),
        flavor: "<strong>Help an Ally</strong>",
        content: content
    });
}

// ==================================================================
// 6. SCAR CHECK (Macro Logic)
// ==================================================================

export async function scarCheck() {
    if (!canvas.tokens.controlled.length) {
        ui.notifications.warn("Please select a token first!");
        return;
    }

    const token = canvas.tokens.controlled[0];
    const actor = token.actor;

    if (!actor) {
        ui.notifications.error("Selected token has no associated actor!");
        return;
    }

    const currentLevel = actor.system.levelData?.level?.current;

    if (currentLevel === undefined || currentLevel === null) {
        ui.notifications.error("Could not find level data at system.levelData.level.current!");
        return;
    }

    const currentHopeMax = actor.system.resources?.hope?.max;

    if (currentHopeMax === undefined || currentHopeMax === null) {
        ui.notifications.error("Could not find hope data at system.resources.hope.max!");
        return;
    }

    const roll = new Roll("1d12");
    await roll.evaluate();

    const rollResult = roll.total;
    const isScar = rollResult <= currentLevel;

    const BACKGROUND_IMAGE = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";
    
    let resultTitle = "";
    let resultColor = "";
    let resultIcon = "";
    let resultDescription = "";

    if (isScar) {
        resultTitle = "YOU TAKE A SCAR";
        resultColor = "#ff6b6b"; // Red
        resultIcon = "fas fa-skull";
        resultDescription = "Mark a Scar manually on your sheet.";
        ui.notifications.info(`${actor.name} takes a Scar!`);
    } else {
        resultTitle = "SAFE";
        resultColor = "#4CAF50"; // Green
        resultIcon = "fas fa-shield-alt";
        resultDescription = "No scar taken.";
        ui.notifications.info(`${actor.name} avoids taking a Scar!`);
    }

    const content = `
    <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                Scar Check
            </h3>
        </header>
        <div class="card-content" style="background-image: url('${BACKGROUND_IMAGE}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
            
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                
                <div style="color: #ccc; font-size: 0.9em; margin-bottom: 5px; font-weight: bold; text-shadow: 1px 1px 0 #000;">
                    Level: ${currentLevel} vs Roll:
                </div>

                <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 10px ${resultColor}, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">
                    ${rollResult}
                </div>

                <i class="${resultIcon}" style="font-size: 24px; color: ${resultColor}; margin: 10px 0; text-shadow: 1px 1px 0 #000;"></i>

                <div style="color: ${resultColor}; font-size: 1.2em; font-weight: bold; text-transform: uppercase; font-family: 'Aleo', serif; text-shadow: 1px 1px 0 #000;">
                    ${resultTitle}
                </div>

                <div style="color: #eee; font-size: 0.9em; margin-top: 5px; font-style: italic;">
                    ${resultDescription}
                </div>
            </div>
        </div>
    </div>`;

    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({token: token}),
        flavor: "<strong>Scar Check</strong>",
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}

// ==================================================================
// 7. SPOTLIGHT TOKEN (Macro Logic)
// ==================================================================

export async function spotlightToken() {
    if (!game.combat) {
        return ui.notifications.warn("No active combat found!");
    }

    const tokens = canvas.tokens.controlled;
    if (!tokens.length) {
        return ui.notifications.warn("Please select a token first!");
    }
    const token = tokens[0];

    if (!token.inCombat) {
        return ui.notifications.warn("Select at least one token that is in combat");
    }

    const turnIndex = game.combat.turns.findIndex(turn => turn.id === token.combatant?.id);

    if (turnIndex !== -1) {
        await game.combat.update({ turn: turnIndex });
    } else {
        ui.notifications.warn("Could not find this token in the combat turn order.");
    }
}

// ==================================================================
// 8. SHOW MACROS APP
// ==================================================================

class ShowMacrosApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(macroNames, options = {}) {
        super(options);
        this.macroNames = macroNames;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "show-macros-app",
        classes: ["dh-qa-app", "show-macros-app"],
        window: {
            title: "Macros",
            icon: "fas fa-play-circle",
            resizable: true,
            controls: []
        },
        position: {
            width: 300,
            height: "auto"
        },
        actions: {
            executeMacro: ShowMacrosApp.prototype._onExecuteMacro
        }
    };

    static PARTS = {
        form: {
            template: "modules/daggerheart-quickactions/templates/showmacros.hbs"
        }
    };

    async _prepareContext(options) {
        return {
            macros: this.macroNames
        };
    }

    async _onExecuteMacro(event, target) {
        const macroName = target.dataset.macro;
        const packName = "daggerheart-quickactions.macros";
        const pack = game.packs.get(packName);

        if (!pack) {
            ui.notifications.error(`Compendium '${packName}' not found.`);
            return;
        }

        const index = await pack.getIndex();
        const entry = index.find(m => m.name === macroName);

        if (!entry) {
            ui.notifications.warn(`Macro '${macroName}' not found in '${packName}'.`);
            return;
        }

        const macro = await pack.getDocument(entry._id);
        if (macro) {
            macro.execute();
        }
    }
}

// ==================================================================
// 9. FATE ROLL (Custom Colorset)
// ==================================================================

export async function fateRoll(rollType = 'hope') {
    // Try to get selected actor or user character
    const actor = canvas.tokens.controlled[0]?.actor || game.user.character;

    const roll = new Roll("1d12");
    await roll.evaluate();

    let appearance = {};

    if (rollType === 'hope') {
        appearance = {
            colorset: "custom",
            foreground: "#000000",
            background: "#FFD700", // Gold
            outline: "#000000",
            texture: "none"
        };
    } else if (rollType === 'fear') {
        appearance = {
            colorset: "custom",
            foreground: "#FFFFFF",
            background: "#2c003e", // Deep Purple
            outline: "#000000",
            texture: "none"
        };
    }

    // Apply appearance to the first term (the d12)
    if (roll.terms[0]) {
        roll.terms[0].options.appearance = appearance;
    }

    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        flavor: `<strong>${rollType.charAt(0).toUpperCase() + rollType.slice(1)} Roll</strong>`
    });
}

// ==================================================================
// EXPORTED FUNCTIONS
// ==================================================================

export async function activateDowntime() {
    new DowntimeApp().render(true);
}

export async function activateFallingDamage() {
    new FallingDamageApp().render(true);
}

export async function activateRequestRoll() {
    new RequestRollApp().render(true);
}

export async function activateLootConsumable() {
    new LootConsumableApp().render(true);
}

export async function showMacros(...args) {
    // Allows calling as showMacros(["A", "B"]) or showMacros("A", "B")
    let macros = [];
    if (Array.isArray(args[0])) {
        macros = args[0];
    } else {
        macros = args;
    }
    new ShowMacrosApp(macros).render(true);
}