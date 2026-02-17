/**
 * Consolidated file containing all Quick Actions applications.
 * Contains: Downtime (Fear), Falling Damage, Request Roll, Help an Ally, Scar Check, Loot & Consumables, Fate Roll, Hope Spender, Templates, and Level Up.
 * Compatible with Foundry V13 (ApplicationV2).
 */

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

    async _onRollDamage(event, target) {
        const selection = target.dataset.height;
        if (!selection) return;
        let damageFormula = "", heightText = "", damageType = "Physical Damage";
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
                        <div style="color: #ffffff; font-size: 1.5em; font-weight: 800; margin-bottom: 5px; text-transform: uppercase; font-family: 'Aleo', serif; text-shadow: 2px 2px 0 #000;">${heightText}</div>
                        <div style="color: #e0e0e0; font-size: 1.1em; margin-bottom: 15px; font-weight: bold; background: rgba(0,0,0,0.5); display: inline-block; padding: 2px 10px; border-radius: 4px;">${damageType} <span style="color: #C9A060;">(${damageFormula})</span></div>
                        <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px #ff0000, 2px 2px 0px #000; font-family: 'Lato', sans-serif; line-height: 1;">${roll.total}</div>
                        <div style="color: #ff6b6b; font-size: 1.0em; font-weight: bold; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px;">DAMAGE</div>
                    </div>
                </div>
            </div>`;
            await roll.toMessage({ speaker: ChatMessage.getSpeaker(), flavor: `<strong>${heightText}</strong>`, content: content });
            this.close();
        } catch (error) { console.error("Falling Damage Error:", error); ui.notifications.error("Error calculating falling damage."); }
    }
    _onCancel() { this.close(); }
}

// ==================================================================
// 3. REQUEST ROLL APP
// ==================================================================
class RequestRollApp extends ApplicationV2 {
    constructor(options = {}) {
        super(options);
        // Recebe a opção showImages (default true se não for passado)
        this.showImages = options.showImages ?? true;
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "request-roll-app",
        classes: ["dh-qa-app", "request-roll-app"],
        window: { title: "Roll Configuration", icon: "fas fa-dice-d20", resizable: false, controls: [] },
        position: { width: 650, height: "auto" }, // Increased Width for 2 columns
        actions: { roll: RequestRollApp.prototype._onRoll, cancel: RequestRollApp.prototype._onCancel }
    };

    async _renderHTML(context, options) {
        // Filtrar usuários para remover GMs e manter apenas usuários ativos
        const connectedUsers = game.users.filter(u => u.active && !u.isGM);
        
        // Build User Buttons HTML
        let userButtonsHtml = `<button type="button" class="dh-user-btn" data-action="roll" data-target="">All Players</button>`;
        connectedUsers.forEach(u => {
            userButtonsHtml += `<button type="button" class="dh-user-btn" data-action="roll" data-target="${u.id}" style="color:${u.color.css}">${u.name}</button>`;
        });

        // Recuperar flag do modo cinematic
        const savedCinematic = game.user.getFlag("daggerheart-quickactions", "cinematicMode") ?? false;
        const checkedAttr = savedCinematic ? "checked" : "";

        return `
        <style>
            /* Layout */
            .dh-main-layout { display: flex; gap: 15px; height: 100%; }
            .dh-left-col { flex: 1; display: flex; flex-direction: column; gap: 12px; }
            .dh-right-col { width: 150px; display: flex; flex-direction: column; gap: 5px; border-left: 1px solid #444; padding-left: 10px; overflow-y: auto; max-height: 400px; }

            /* Existing Styles Adapted */
            .dh-rr-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
            .dh-rr-label { font-weight: bold; color: #C9A060; flex: 0 0 80px; text-align: right; padding-right: 5px; margin-bottom: 0; }
            .dh-rr-input { flex: 1; text-align: center; background: rgba(255,255,255,0.9); border: 1px solid #7a6e5d; padding: 5px; border-radius: 4px; color: #000000 !important; font-weight: bold; }
            
            .dh-trait-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 5px; }
            .dh-trait-grid button.full-width { grid-column: 1 / -1; }
            
            .dh-trait-btn { 
                background: #191919; 
                color: #ffffff; 
                border: 1px solid #666; 
                padding: 6px; 
                cursor: pointer; 
                border-radius: 4px; 
                font-size: 0.9em; 
                text-transform: uppercase; 
                transition: all 0.2s; 
            }
            .dh-trait-btn:hover { border-color: #C9A060; color: #C9A060; }
            .dh-trait-btn.active { background: #C9A060; color: #191919; border-color: #C9A060; font-weight: bold; box-shadow: 0 0 8px rgba(201, 160, 96, 0.4); }
            
            .dh-special-btn { font-weight: bold; border-width: 2px; }
            .dh-special-btn[data-special="hope"] { border-color: #FFD700; color: #FFD700; }
            .dh-special-btn[data-special="hope"].active, .dh-special-btn[data-special="hope"]:hover { background: #FFD700; color: #000; box-shadow: 0 0 8px #FFD700; }
            
            .dh-special-btn[data-special="fear"] { border-color: #800080; color: #b54ec4; }
            .dh-special-btn[data-special="fear"].active, .dh-special-btn[data-special="fear"]:hover { background: #800080; color: #fff; box-shadow: 0 0 8px #800080; }

            .dh-cb-row { display: flex; align-items: center; justify-content: space-around; background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 4px; }
            .dh-cb-label { display: flex; align-items: center; gap: 8px; color: #e0e0e0; cursor: pointer; font-size: 0.95em; margin-bottom: 0; }
            .dh-cb-label input { accent-color: #C9A060; transform: scale(1.2); margin: 0; }
            .dh-sq-btn { width: 32px; height: 30px; padding: 0; border: 1px solid #555; background: #191919; color: #C9A060; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.2s; font-size: 0.9em; }
            .dh-sq-btn:hover { background: #C9A060; color: #191919; }
            .dh-dc-wrapper { display: flex; align-items: center; gap: 4px; flex: 1; }
            
            /* User Buttons (Right Column) */
            .dh-user-btn {
                background: #2b2b2b;
                color: #e0e0e0;
                border: 1px solid #555;
                padding: 8px;
                text-align: left;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s;
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
            }
            .dh-user-btn:hover {
                background: #C9A060;
                color: #191919 !important;
                border-color: #C9A060;
            }

            .dh-btn-cancel { 
                background: transparent; 
                color: #e0e0e0; 
                border: 1px solid #777; 
                padding: 10px; 
                width: 100%; 
                text-transform: uppercase; 
                cursor: pointer; 
                border-radius: 4px; 
                transition: all 0.2s;
                margin-top: auto;
            }
            .dh-btn-cancel:hover { color: #fff; border-color: #fff; background: rgba(255,255,255,0.1); }
        </style>
        
        <div class="dh-main-layout">
            <!-- LEFT COLUMN -->
            <div class="dh-left-col">
                <div class="dh-rr-row">
                    <label class="dh-rr-label">Difficulty</label>
                    <div class="dh-dc-wrapper">
                        <button type="button" class="dh-sq-btn" data-action="mod-dc" data-value="-5">-5</button>
                        <button type="button" class="dh-sq-btn" data-action="mod-dc" data-value="-2">-2</button>
                        <button type="button" class="dh-sq-btn" data-action="mod-dc" data-value="-1">-1</button>
                        <input type="number" name="difficulty" value="15" class="dh-rr-input" placeholder="DC" style="width: 70px; flex: 0 0 70px;">
                        <button type="button" class="dh-sq-btn" data-action="mod-dc" data-value="1">+1</button>
                        <button type="button" class="dh-sq-btn" data-action="mod-dc" data-value="2">+2</button>
                        <button type="button" class="dh-sq-btn" data-action="mod-dc" data-value="5">+5</button>
                        <button type="button" class="dh-sq-btn" data-action="clear-dc" title="Clear Difficulty" style="margin-left: 5px; color: #ff6b6b; border-color: #ff6b6b;">
                            <i class="fas fa-eraser"></i>
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="dh-rr-label" style="text-align: left; display:block;">Trait</label>
                    <input type="hidden" name="trait" value="">
                    <input type="hidden" name="specialRoll" value="">
                    
                    <div class="dh-trait-grid">
                        <button type="button" class="dh-trait-btn full-width active" data-trait="">None</button>
                        <div style="grid-column: 1 / -1; display: flex; gap: 10px; margin-bottom: 2px;">
                             <button type="button" class="dh-trait-btn dh-special-btn" data-special="hope" style="flex:1;">HOPE</button>
                             <button type="button" class="dh-trait-btn dh-special-btn" data-special="fear" style="flex:1;">FEAR</button>
                        </div>
                        <button type="button" class="dh-trait-btn" data-trait="agility">Agility</button>
                        <button type="button" class="dh-trait-btn" data-trait="strength">Strength</button>
                        <button type="button" class="dh-trait-btn" data-trait="finesse">Finesse</button>
                        <button type="button" class="dh-trait-btn" data-trait="instinct">Instinct</button>
                        <button type="button" class="dh-trait-btn" data-trait="presence">Presence</button>
                        <button type="button" class="dh-trait-btn" data-trait="knowledge">Knowledge</button>
                    </div>
                </div>

                <div class="dh-cb-row">
                    <label class="dh-cb-label">Advantage <input type="checkbox" name="advantage"></label>
                    <label class="dh-cb-label">Disadvantage <input type="checkbox" name="disadvantage"></label>
                    <label class="dh-cb-label">Reaction <input type="checkbox" name="reaction"></label>
                </div>
                <div class="dh-cb-row">
                    <label class="dh-cb-label">Grant Resources <input type="checkbox" name="grantResources" checked></label>
                    <label class="dh-cb-label" style="color: #ffaa44;">Cinematic Mode <input type="checkbox" name="cinematicMode" ${checkedAttr}></label>
                </div>
                
                <div class="dh-rr-row">
                    <label class="dh-rr-label">Label</label>
                    <input type="text" name="label" class="dh-rr-input" placeholder="Optional description...">
                </div>

                <button type="button" class="dh-btn-cancel" data-action="cancel">Cancel</button>
            </div>

            <!-- RIGHT COLUMN -->
            <div class="dh-right-col">
                <div style="font-weight: bold; color: #C9A060; text-align: center; margin-bottom: 5px; text-transform: uppercase; font-size: 0.9em;">Send To</div>
                ${userButtonsHtml}
            </div>
        </div>`;
    }

    _replaceHTML(result, content, options) {
        content.innerHTML = result;
        const traitButtons = content.querySelectorAll('.dh-trait-btn:not(.dh-special-btn)');
        const specialButtons = content.querySelectorAll('.dh-special-btn');
        
        const hiddenTraitInput = content.querySelector('input[name="trait"]');
        const hiddenSpecialInput = content.querySelector('input[name="specialRoll"]');

        // Logic: Clicking a Standard Trait clears Special selection
        traitButtons.forEach(btn => {
            btn.onclick = (e) => {
                // Clear active classes from all buttons
                traitButtons.forEach(b => b.classList.remove('active'));
                specialButtons.forEach(b => b.classList.remove('active'));
                
                // Set active on clicked
                btn.classList.add('active');
                
                // Update inputs
                hiddenTraitInput.value = btn.dataset.trait;
                hiddenSpecialInput.value = ""; // Clear special
            };
        });

        // Logic: Clicking a Special Button clears Standard Trait selection
        specialButtons.forEach(btn => {
            btn.onclick = (e) => {
                // Clear active classes from all buttons
                traitButtons.forEach(b => b.classList.remove('active'));
                specialButtons.forEach(b => b.classList.remove('active'));

                // Set active on clicked
                btn.classList.add('active');

                // Update inputs
                hiddenSpecialInput.value = btn.dataset.special;
                hiddenTraitInput.value = ""; // Clear standard trait
            };
        });

        const dcInput = content.querySelector('input[name="difficulty"]');
        
        // Listener para modificadores (+/-)
        content.querySelectorAll('[data-action="mod-dc"]').forEach(btn => {
            btn.onclick = (e) => {
                const mod = parseInt(btn.dataset.value);
                let currentVal = parseInt(dcInput.value) || 0;
                let newVal = currentVal + mod;
                if (newVal < 0) newVal = 0;
                dcInput.value = newVal;
            };
        });

        // Listener para limpar dificuldade
        const clearBtn = content.querySelector('[data-action="clear-dc"]');
        if (clearBtn) {
            clearBtn.onclick = () => {
                dcInput.value = "";
            };
        }

        return content;
    }

    async _onRoll(event, target) {
        const container = this.element;
        const difficulty = container.querySelector('[name="difficulty"]').value;
        const trait = container.querySelector('[name="trait"]').value;
        const specialRoll = container.querySelector('[name="specialRoll"]').value; // 'hope', 'fear', or ''
        const reaction = container.querySelector('[name="reaction"]').checked;
        const grantResources = container.querySelector('[name="grantResources"]').checked;
        const advantage = container.querySelector('[name="advantage"]').checked;
        const disadvantage = container.querySelector('[name="disadvantage"]').checked;
        const cinematicMode = container.querySelector('[name="cinematicMode"]').checked;
        const labelInput = (container.querySelector('[name="label"]').value || "").trim();
        const targetUser = target.dataset.target || "";

        // Persistir a escolha do Cinematic Mode
        await game.user.setFlag("daggerheart-quickactions", "cinematicMode", cinematicMode);

        let rawCommand = "";
        let displayCommand = "";
        let cinematicTraitLabel = "";
        let cinematicDifficulty = difficulty;

        // BRANCH LOGIC: Special Roll vs Standard Roll
        if (specialRoll) {
            const capSpecial = specialRoll.toLowerCase(); // hope or fear

            // NEW LOGIC: Non-Cinematic Hope/Fear sends direct command
            if (!cinematicMode) {
                // Comando simples: [[/fr type=hope]] ou [[/fr type=fear]]
                // Adiciona {label} se houver
                let textCommand = `[[/fr type=${capSpecial}]]`;
                if (labelInput) {
                    textCommand += `{${labelInput}}`;
                }

                await ChatMessage.create({
                    user: game.user.id,
                    content: textCommand
                    // speaker não é estritamente necessário para este comando, pois o Foundry resolve
                });
                
                this.close();
                return;
            }

            // Cinematic Mode Logic (Visuals)
            const displaySpecial = capSpecial.charAt(0).toUpperCase() + capSpecial.slice(1);
            rawCommand = `/fr type=${displaySpecial}`;
            
            // Setup Cinematic Data for Special (Visuals only)
            cinematicTraitLabel = displaySpecial; // "Hope" or "Fear"
            cinematicDifficulty = ""; // Do not show difficulty
            
        } else {
            // Standard Logic
            let params = [];
            if (difficulty) params.push(`difficulty=${difficulty}`);
            if (trait) params.push(`trait=${trait}`);
            if (reaction) params.push("reaction=true");
            if (grantResources) params.push("grantResources=true");
            if (advantage) params.push("advantage=true");
            if (disadvantage) params.push("disadvantage=true");

            rawCommand = "/dr";
            if (params.length > 0) rawCommand += " " + params.join(" ");

            displayCommand = `[[${rawCommand}]]`;
            if (labelInput) displayCommand += `{${labelInput}}`;

            cinematicTraitLabel = trait ? trait.charAt(0).toUpperCase() + trait.slice(1) : "Roll";
        }

        if (cinematicMode) {
            const dataPacket = {
                command: rawCommand,
                label: labelInput || "GM Requests a Roll",
                difficulty: cinematicDifficulty,
                trait: cinematicTraitLabel,
                rawTrait: specialRoll ? "" : trait, // Se for especial, não manda rawTrait para não buscar imagem de atributo
                showImages: this.showImages // Passa a configuração de imagem para o cliente
            };
            
            await game.settings.set("daggerheart-quickactions", "cinematicRequest", {
                targetId: targetUser,
                data: dataPacket,
                timestamp: Date.now()
            });
            //ui.notifications.info("Cinematic Request sent to player(s) screen.");
            this.close();
            return;
        }

        // Standard Text Chat Logic (Traits)
        let whisperArray = targetUser ? [targetUser] : [];
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
                    ${displayCommand}
                </span>
            </div>
        </div>`;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            whisper: whisperArray
        });
        this.close();
    }
    _onCancel() { this.close(); }
}

// ==================================================================
// 4. NEW: CINEMATIC ROLL PROMPT APP (UPDATED V13)
// ==================================================================
class CinematicRollPrompt extends ApplicationV2 {
    constructor(data, options = {}) {
        super(options);
        this.data = data;
    }

    static DEFAULT_OPTIONS = {
        tag: "div",
        id: "cinematic-roll-prompt",
        classes: ["dh-qa-app"],
        window: { title: "Action Required", icon: "fas fa-dice-d20", resizable: false, controls: [] },
        position: { width: 500, height: "auto" }, // Increased to 500 to fit larger image
        actions: {
            resolveRoll: CinematicRollPrompt.prototype._onResolveRoll
        }
    };

    async _renderHTML(context, options) {
        // Lógica de Texto do Check (Trait ou Duality Roll ou Hope/Fear)
        let checkLabel = this.data.trait;
        if (!checkLabel || checkLabel === "Roll") {
            checkLabel = "Duality Roll";
        }

        // Lógica de Imagem (Atualizada)
        let imageHtml = "";
        
        // Verifica se imagens devem ser exibidas (default é true se undefined)
        if (this.data.showImages !== false) {
            let imageName = "";
            
            if (this.data.rawTrait) {
                // Se tem rawTrait, é um atributo normal (agility, strength, etc)
                imageName = this.data.rawTrait.toLowerCase();
            } else {
                // Se não tem rawTrait, verificamos o label tratado
                if (checkLabel === "Hope") imageName = "hope";
                else if (checkLabel === "Fear") imageName = "fear";
                else if (checkLabel === "Duality Roll") imageName = "none";
            }

            if (imageName) {
                const imagePath = `modules/daggerheart-quickactions/assets/requestroll/${imageName}.webp`;
                imageHtml = `<img src="${imagePath}" style="max-width: 400px; border: none; filter: drop-shadow(0 0 10px rgba(201, 160, 96, 0.5)); margin-bottom: 10px;" />`;
            }
        }

        // Lógica de Dificuldade (Não exibir se vazia)
        let difficultyHtml = "";
        if (this.data.difficulty) {
            difficultyHtml = `Difficulty: <span style="color: #C9A060; font-weight: bold;">${this.data.difficulty}</span><br>`;
        }

        return `
        <style>
            .cinematic-wrapper {
                background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
                border: 2px solid #C9A060;
                padding: 25px;
                text-align: center;
                color: #fff;
                display: flex;
                flex-direction: column;
                gap: 15px;
                align-items: center;
            }
            .cinematic-title { font-family: 'Aleo', serif; font-size: 1.8em; color: #C9A060; text-transform: uppercase; text-shadow: 0 0 10px #C9A060; margin: 0; }
            .cinematic-details { font-size: 1.1em; color: #ccc; margin-bottom: 10px; }
            
            /* BUTTON STYLE */
            .cinematic-btn {
                background: #C9A060 !important;
                color: #000 !important;
                border: 2px solid #8a6d3b !important;
                /* Padding removed as requested to fix alignment */
                font-size: 1.4em !important;
                font-family: 'Aleo', serif !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                cursor: pointer;
                border-radius: 4px;
                text-decoration: none !important;
                display: inline-block !important;
                box-shadow: 0 0 15px rgba(201, 160, 96, 0.6) !important;
                transition: transform 0.1s, box-shadow 0.2s;
                animation: pulse-gold 2s infinite;
                width: 100%;
            }
            .cinematic-btn i { margin-right: 8px; }
            .cinematic-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 0 25px rgba(201, 160, 96, 0.8) !important;
                color: #000 !important;
            }
            @keyframes pulse-gold {
                0% { box-shadow: 0 0 0 0 rgba(201, 160, 96, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(201, 160, 96, 0); }
                100% { box-shadow: 0 0 0 0 rgba(201, 160, 96, 0); }
            }
        </style>
        <div class="cinematic-wrapper">
            <h1 class="cinematic-title">${this.data.label}</h1>
            
            <div class="cinematic-details">
                ${difficultyHtml}
                Check: <span style="color: #C9A060; font-weight: bold;">${checkLabel}</span>
            </div>

            <!-- Imagem do Trait -->
            ${imageHtml}
            
            <div style="margin-top: 10px; width: 100%;">
                <button type="button" class="cinematic-btn" data-action="resolveRoll" data-command="${this.data.command}">
                    <i class="fas fa-dice-d20"></i> ROLL NOW
                </button>
            </div>
        </div>
        `;
    }

    _replaceHTML(result, content, options) {
        content.innerHTML = result;
        return content;
    }

    _onResolveRoll(event, target) {
        // Recupera o comando armazenado (ex: "/dr trait=strength difficulty=15")
        // Preferência pelo data-command do botão se existir (garante que é o que está no HTML)
        const commandToExecute = target.dataset.command || this.data.command;

        if (commandToExecute) {
            ui.chat.processMessage(commandToExecute);
        }

        this.close();
    }
}

// ==================================================================
// 5. LOOT & CONSUMABLES APP
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
// 6. HELP AN ALLY
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
// 7. SCAR CHECK
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
// 8. SPOTLIGHT TOKEN
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
// 9. SHOW MACROS APP
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
// 10. FATE ROLL
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
// 11. HOPE SPENDER APP
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

// ==================================================================
// 12. TEMPLATE CREATOR APP (PORTED FROM MACRO)
// ==================================================================
class TemplateCreatorApp extends ApplicationV2 {
    constructor(options = {}) {
        super(options);
        
        // Retrieve saved settings from user flags (Persistence)
        const savedSettings = game.user.getFlag("daggerheart-quickactions", "templateSettings") || {};
        
        // Default state combined with saved settings
        this.localState = { 
            type: savedSettings.type || 'circle',
            range: savedSettings.range || 'm',
            effect: savedSettings.effect || 'none',
            hidden: savedSettings.hidden || false
        };
    }

    static DEFAULT_OPTIONS = {
        tag: "div",
        id: "daggerheart-template-app",
        classes: ["dh-qa-app"],
        window: { 
            title: "Template Tool", 
            icon: "fas fa-shapes", 
            resizable: false,
            controls: []
        },
        position: { width: 420, height: "auto" }
    };

    async _renderHTML(context, options) {
        const hasTokenMagic = game.modules.get("tokenmagic")?.active;

        return `
        <style>
            .dh-qa-app { 
                background: #1a1a1a; 
                color: #e0e0e0; 
                font-family: 'Signika', sans-serif; 
                box-sizing: border-box;
            }
            .dh-qa-app * {
                box-sizing: border-box;
            }
            .dh-trait-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 6px;
                margin-top: 5px;
            }
            .dh-trait-btn {
                background: #2b2b2b;
                color: #999;
                border: 1px solid #444;
                padding: 8px 4px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 0.85em;
                text-transform: uppercase;
                transition: all 0.2s;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
            }
            .dh-trait-btn:hover { border-color: #C9A060; color: #C9A060; }
            .dh-trait-btn.active {
                background: #C9A060;
                color: #191919;
                border-color: #C9A060;
                font-weight: 800;
                box-shadow: 0 0 8px rgba(201, 160, 96, 0.4);
            }
            .dh-select {
                width: 100%;
                height: auto;
                background: #2b2b2b;
                color: #e0e0e0;
                border: 1px solid #444;
                padding: 8px;
                border-radius: 4px;
                margin-top: 5px;
                font-family: inherit;
                cursor: pointer;
                display: block;
            }
            .dh-select:focus {
                outline: none;
                border-color: #C9A060;
            }
            .dh-checkbox-row {
                margin-top: 12px;
                display: flex;
                align-items: center;
            }
            .dh-checkbox-row input[type="checkbox"] {
                accent-color: #C9A060;
                width: 16px;
                height: 16px;
                margin: 0 8px 0 0;
                cursor: pointer;
            }
            .dh-btn-submit {
                background: #C9A060;
                color: #191919;
                border: none;
                padding: 12px;
                width: 100%;
                font-weight: 800;
                text-transform: uppercase;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s;
                margin-top: 5px;
            }
            .dh-btn-submit:hover {
                filter: brightness(1.15);
                box-shadow: 0 0 12px rgba(201, 160, 96, 0.5);
            }
            .dh-copy-row {
                display: flex; 
                gap: 5px; 
                margin-top: 10px; 
                align-items: center;
            }
            .dh-copy-input {
                flex: 1; 
                background: rgba(0,0,0,0.3); 
                color: #C9A060; 
                border: 1px solid #444; 
                padding: 5px; 
                text-align: center;
                border-radius: 4px;
            }
            .dh-sq-action-btn {
                width: 32px; 
                height: 32px; 
                background: #2b2b2b;
                border: 1px solid #444;
                color: #C9A060;
                display: flex; 
                align-items: center; 
                justify-content: center;
                cursor: pointer;
                border-radius: 4px;
                transition: background 0.2s;
            }
            .dh-sq-action-btn:hover {
                background: #444;
                border-color: #C9A060;
            }
            .dh-rr-label { 
                font-weight: 700; 
                color: #C9A060; 
                display: block; 
                margin-bottom: 4px;
                font-size: 0.9em;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .dh-rr-container { padding: 10px; }
            hr.dh-hr { border: 0; border-top: 1px solid #444; margin: 15px 0; }
        </style>
        
        <div class="dh-rr-container">
            <label class="dh-rr-label">Shape</label>
            <div class="dh-trait-grid">
                <button type="button" class="dh-trait-btn ${this.localState.type === 'circle' ? 'active' : ''}" data-group="type" data-value="circle"><i class="fas fa-circle" style="margin-right:4px"></i>Circle</button>
                <button type="button" class="dh-trait-btn ${this.localState.type === 'cone' ? 'active' : ''}" data-group="type" data-value="cone"><i class="fas fa-wifi" style="transform: rotate(-45deg); margin-right:4px"></i>Cone</button>
                <button type="button" class="dh-trait-btn ${this.localState.type === 'front' ? 'active' : ''}" data-group="type" data-value="front"><i class="fas fa-wifi" style="margin-right:4px"></i>Front</button>
                <button type="button" class="dh-trait-btn ${this.localState.type === 'ray' ? 'active' : ''}" data-group="type" data-value="ray"><i class="fas fa-bolt" style="margin-right:4px"></i>Ray</button>
            </div>

            <label class="dh-rr-label" style="margin-top: 12px;">Distance</label>
            <div class="dh-trait-grid">
                <button type="button" class="dh-trait-btn ${this.localState.range === 'm' ? 'active' : ''}" data-group="range" data-value="m">Melee</button>
                <button type="button" class="dh-trait-btn ${this.localState.range === 'vc' ? 'active' : ''}" data-group="range" data-value="vc">V.Close</button>
                <button type="button" class="dh-trait-btn ${this.localState.range === 'c' ? 'active' : ''}" data-group="range" data-value="c">Close</button>
                <button type="button" class="dh-trait-btn ${this.localState.range === 'f' ? 'active' : ''}" data-group="range" data-value="f">Far</button>
            </div>

            <!-- New Copy Row -->
            <div class="dh-copy-row">
                <input type="text" id="dh-template-code" class="dh-copy-input" readonly value="">
                <button type="button" id="btn-copy-code" class="dh-trait-btn" style="width: auto; padding: 0 10px; height: 32px;">Copy</button>
                <button type="button" id="btn-chat-code" class="dh-sq-action-btn" title="Send to Chat"><i class="fas fa-comment"></i></button>
            </div>
            
            ${hasTokenMagic ? `
            <label class="dh-rr-label" style="margin-top: 12px;">Magic Effect</label>
            <select id="dh-effect-select" class="dh-select">
                <option value="none">None</option>
                <option value="glow">Glowing Outline</option>
                <option value="rays">Annihilating Rays</option>
                <option value="bulge">Bulging Out</option>
                <option value="classic_rays">Classic Rays</option>
                <option value="classic_rays_2">Classic Rays 2</option>
                <option value="fairy">Fairy Fireflies</option>
                <option value="fire">Fire Rays</option>
                <option value="flames">Flames</option>
                <option value="protoplasm">Protoplasm</option>
                <option value="water">Watery Surface</option>
                <option value="zone_blizzard">Zone: Blizzard</option>
                <option value="zone_electricity">Zone: Electricity</option>
                <option value="zone_fire">Zone: Fire</option>
            </select>
            ` : ''}

            <div class="dh-checkbox-row">
                <input type="checkbox" id="dh-hidden-checkbox" ${this.localState.hidden ? 'checked' : ''}>
                <label for="dh-hidden-checkbox" class="dh-rr-label" style="margin-bottom: 0; cursor: pointer;">Hide Template</label>
            </div>

            <hr class="dh-hr">

            <div class="dh-actions">
                <button type="button" class="dh-btn-submit" id="btn-create-template">
                    <i class="fas fa-crosshairs"></i> Place Template
                </button>
            </div>
        </div>`;
    }

    _replaceHTML(result, content, options) {
        content.innerHTML = result;

        const typeButtons = content.querySelectorAll('[data-group="type"]');
        const rangeButtons = content.querySelectorAll('[data-group="range"]');
        const submitBtn = content.querySelector('#btn-create-template');
        const effectSelect = content.querySelector('#dh-effect-select');
        const hiddenCheckbox = content.querySelector('#dh-hidden-checkbox');
        const copyInput = content.querySelector('#dh-template-code');
        const btnCopy = content.querySelector('#btn-copy-code');
        const btnChat = content.querySelector('#btn-chat-code');

        const updateCodeString = () => {
            let shapeText = "circle";
            if (this.localState.type === "cone") shapeText = "cone";
            else if (this.localState.type === "front") shapeText = "rect";
            else if (this.localState.type === "ray") shapeText = "ray";

            let distText = "m";
            if (this.localState.range === "m") distText = "m";
            else if (this.localState.range === "vc") distText = "c"; // Mapped per user instruction
            else if (this.localState.range === "c") distText = "vc"; // Mapped per user instruction
            else if (this.localState.range === "f") distText = "f";

            const code = `@Template[type:${shapeText}|range:${distText}]`;
            if (copyInput) copyInput.value = code;
        };

        // Initialize text
        updateCodeString();

        const updateUI = () => {
            typeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === this.localState.type);
            });
            rangeButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === this.localState.range);
            });
            updateCodeString();
        };
        
        if (effectSelect) {
            effectSelect.value = this.localState.effect;
            effectSelect.onchange = (ev) => {
                this.localState.effect = ev.target.value;
            };
        }

        if (hiddenCheckbox) {
            hiddenCheckbox.onchange = (ev) => {
                this.localState.hidden = ev.target.checked;
            }
        }

        typeButtons.forEach(btn => {
            btn.onclick = (ev) => {
                ev.preventDefault();
                this.localState.type = btn.dataset.value;
                updateUI();
            };
        });

        rangeButtons.forEach(btn => {
            btn.onclick = (ev) => {
                ev.preventDefault();
                this.localState.range = btn.dataset.value;
                updateUI();
            };
        });

        if (btnCopy) {
            btnCopy.onclick = (ev) => {
                ev.preventDefault();
                if (copyInput && copyInput.value) {
                    game.clipboard.copyPlainText(copyInput.value);
                    ui.notifications.info("Template code copied to clipboard!");
                }
            };
        }

        if (btnChat) {
            btnChat.onclick = async (ev) => {
                ev.preventDefault();
                const code = copyInput ? copyInput.value : "";
                if (code) {
                    const content = `
                    <div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
                        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
                            <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                                Template Tool
                            </h3>
                        </header>
                        <div class="card-content" style="background-image: url('modules/daggerheart-quickactions/assets/chat-messages/skull.webp'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
                            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.85); z-index: 0;"></div>
                            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                                <div style="color: #ffffff !important; font-size: 1.2em; font-weight: bold; margin-bottom: 10px; text-shadow: 0px 0px 8px #000;">
                                    ${code}
                                </div>
                                <div style="color: #ccc; font-size: 0.9em; font-style: italic;">
                                    Click above to place the template
                                </div>
                            </div>
                        </div>
                    </div>`;
                    
                    await ChatMessage.create({
                        user: game.user.id,
                        content: content,
                        style: CONST.CHAT_MESSAGE_STYLES.OTHER
                    });
                }
            };
        }

        if (submitBtn) {
            submitBtn.onclick = (ev) => {
                ev.preventDefault();
                this._onCreateTemplate();
            };
        }

        return content;
    }

    async _onCreateTemplate() {
        const selectEl = this.element.querySelector('#dh-effect-select');
        if (selectEl) {
            this.localState.effect = selectEl.value;
        }

        const checkboxEl = this.element.querySelector('#dh-hidden-checkbox');
        if (checkboxEl) {
            this.localState.hidden = checkboxEl.checked;
        }

        // Save State for next time (Persistence)
        await game.user.setFlag("daggerheart-quickactions", "templateSettings", this.localState);

        const ranges = { "m": 5, "vc": 15, "c": 30, "f": 60 };
        
        const shapes = { 
            "circle": "circle", 
            "cone": "cone", 
            "ray": "ray", 
            "front": "cone"
        };

        const dist = ranges[this.localState.range] || 5;
        const selectedType = this.localState.type;
        const dbType = shapes[selectedType] || "circle";
        const userColor = game.user.color?.css || "#C9A060"; 

        const templateData = {
            t: dbType,
            user: game.user.id,
            distance: dist,
            fillColor: userColor,
            direction: 0,
            x: 0,
            y: 0,
            effect: this.localState.effect,
            hidden: this.localState.hidden
        };

        if (selectedType === "cone") {
            templateData.angle = 53.13;
        } else if (selectedType === "front") {
            templateData.angle = 180;
        }
        
        if (selectedType === "ray") {
            templateData.width = 5;
        }

        this.close();
        this._activatePreviewTool(templateData);
    }

    _getTMFXConfig(effectName, colorInt, userId) {
        const randomID = foundry.utils.randomID;
        
        const buildBase = (presetName, filters) => ({
            tokenmagic: {
                templateData: {
                    opacity: 1,
                    tint: null,
                    preset: presetName
                },
                filters: filters,
                options: null
            }
        });

        const makeFilter = (params) => ({
            tmFilters: {
                tmFilterId: params.filterId,
                tmFilterInternalId: randomID(),
                tmFilterType: params.filterType,
                tmFilterOwner: userId,
                tmParams: {
                    ...params,
                    placeableId: randomID(),
                    filterInternalId: randomID(),
                    filterOwner: userId,
                    placeableType: "MeasuredTemplate",
                    updateId: randomID()
                }
            }
        });

        switch(effectName) {
            case 'glow':
                return buildBase("Glowing Outline", [
                    makeFilter({
                        filterType: "glow",
                        filterId: "Glowing Outline",
                        outerStrength: 5.5, innerStrength: 0,
                        color: colorInt, quality: 0.5, padding: 10,
                        animated: { outerStrength: { active: true, loopDuration: 3000, animType: "syncCosOscillation", val1: 5.5, val2: 1.5 } },
                        zOrder: 1, rank: 10004, enabled: true
                    })
                ]);

            case 'rays':
                return buildBase("Annihilating Rays", [
                    makeFilter({
                        filterType: "xray",
                        filterId: "Annihilating Rays",
                        time: 0, color: colorInt, blend: 9,
                        dimX: 1, dimY: 1, anchorX: 0.5, anchorY: 0.5, divisor: 6, intensity: 4,
                        animated: { time: { active: true, speed: 0.0012, animType: "move" } },
                        zOrder: 1, rank: 10001, enabled: true
                    })
                ]);

            case 'bulge':
                return buildBase("Bulging Out", [
                    makeFilter({
                        filterType: "bulgepinch",
                        filterId: "Bulging Out",
                        padding: 150, strength: 0, radiusPercent: 200,
                        animated: { strength: { active: true, animType: "cosOscillation", loopDuration: 2000, val1: 0, val2: 0.45 } },
                        zOrder: 1, rank: 10004, enabled: true
                    })
                ]);

            case 'classic_rays':
                return buildBase("Classic Rays", [
                    makeFilter({
                        filterType: "ray",
                        filterId: "Classic Rays",
                        time: 0, color: colorInt, alpha: 0.5, divisor: 32, anchorX: 0.5, anchorY: 0.5,
                        animated: { time: { active: true, speed: 0.0005, animType: "move" } },
                        zOrder: 1, rank: 10005, enabled: true
                    })
                ]);

            case 'classic_rays_2':
                return buildBase("Classic Rays 2", [
                    makeFilter({
                        filterType: "ray",
                        filterId: "Classic Rays 2",
                        time: 0, color: colorInt, alpha: 1, divisor: 16, anchorX: 0.5, anchorY: 0.5, alphaDiscard: true,
                        animated: { time: { active: true, speed: 0.0009, animType: "move" } },
                        zOrder: 1, rank: 10006, enabled: true
                    })
                ]);

            case 'fairy':
                return buildBase("Fairy Fireflies : Frenetic", [
                    makeFilter({
                        filterType: "globes",
                        filterId: "Fairy Fireflies : Frenetic",
                        color: colorInt, time: 98.8, zOrder: 1, distortion: 1.45, scale: 80, alphaDiscard: true,
                        animated: { time: { active: true, animType: "move", speed: 0.0016 } },
                        rank: 10010, enabled: true
                    }),
                    makeFilter({
                        filterType: "glow",
                        filterId: "Fairy Fireflies : Frenetic",
                        outerStrength: 7.5, innerStrength: 0.5, color: colorInt, quality: 0.5, padding: 10, zOrder: 2,
                        animated: { outerStrength: { active: true, loopDuration: 3000, animType: "syncCosOscillation", val1: 7.5, val2: 5.5 } },
                        rank: 10011, enabled: true
                    })
                ]);

            case 'fire':
                return buildBase("Fire Rays", [
                    makeFilter({
                        filterType: "ray",
                        filterId: "Fire Rays",
                        time: 0, color: colorInt, alpha: 1, divisor: 24, anchorX: 0.5, anchorY: 0.5, alphaDiscard: true, zOrder: 1,
                        animated: { time: { active: true, speed: 0.0009, animType: "move" } },
                        rank: 10015, enabled: true
                    }),
                    makeFilter({
                        filterType: "glow",
                        filterId: "Fire Rays",
                        outerStrength: 1, innerStrength: 1, color: colorInt, quality: 0.5, padding: 10, zOrder: 2,
                        rank: 10016, enabled: true
                    }),
                    makeFilter({
                        filterType: "fire",
                        filterId: "Fire Rays",
                        intensity: 1.5, color: 16777215, amplitude: 1.3, time: 0, blend: 2, fireBlend: 1, zOrder: 3,
                        animated: { time: { active: true, speed: -0.0016, animType: "move" } },
                        rank: 10017, enabled: true
                    })
                ]);

            case 'flames':
                return buildBase("Flames", [
                    makeFilter({
                        filterType: "fire",
                        filterId: "Flames",
                        intensity: 1.5, color: colorInt, // Usando cor do jogador para fogo colorido
                        amplitude: 1.3, time: 0, blend: 2, fireBlend: 1,
                        animated: { time: { active: true, speed: -0.0016, animType: "move" } },
                        zOrder: 1, rank: 10018, enabled: true
                    })
                ]);

            case 'protoplasm':
                return buildBase("Protoplasm", [
                    makeFilter({
                        filterType: "liquid",
                        filterId: "Protoplasm",
                        color: colorInt, time: 0, blend: 8, intensity: 4, spectral: true, scale: 1.4,
                        animated: { time: { active: true, speed: 0.001, animType: "move" } },
                        zOrder: 1, rank: 10027, enabled: true
                    })
                ]);

            case 'water':
                return buildBase("Watery Surface", [
                    makeFilter({
                        filterType: "flood",
                        filterId: "Watery Surface",
                        color: colorInt, time: 0, billowy: 0.43, tintIntensity: 0.72, glint: 0.31, scale: 70, padding: 10,
                        animated: { time: { active: true, speed: 0.0006, animType: "move" } },
                        zOrder: 1, rank: 10038, enabled: true
                    })
                ]);

            case 'zone_blizzard':
                return buildBase("Zone : Blizzard", [
                    makeFilter({
                        filterType: "xglow",
                        filterId: "Zone : Blizzard",
                        auraType: 1, color: colorInt, thickness: 4.5, scale: 5, time: 0, auraIntensity: 0.25, subAuraIntensity: 1, threshold: 0.5, discard: false,
                        animated: { 
                            time: { active: true, speed: 0.0018, animType: "move" },
                            thickness: { val1: 2, val2: 3.3, animType: "cosOscillation", loopDuration: 3000 },
                            subAuraIntensity: { val1: 0.05, val2: 0.1, animType: "cosOscillation", loopDuration: 6000 },
                            auraIntensity: { val1: 0.9, val2: 2.2, animType: "cosOscillation", loopDuration: 3000 }
                        },
                        zOrder: 1, rank: 10042, enabled: true
                    }),
                    makeFilter({
                        filterType: "smoke",
                        filterId: "Zone : Blizzard",
                        color: colorInt, time: 0, blend: 2, dimY: 1,
                        animated: { 
                            time: { active: true, speed: -0.005, animType: "move" },
                            dimX: { val1: 0.4, val2: 0.2, animType: "cosOscillation", loopDuration: 3000 }
                        },
                        zOrder: 2, rank: 10043, enabled: true
                    })
                ]);

            case 'zone_electricity':
                return buildBase("Zone : Electricity", [
                    makeFilter({
                        filterType: "xglow",
                        filterId: "Zone : Electricity",
                        auraType: 2, color: colorInt, scale: 1.5, time: 0, auraIntensity: 1, subAuraIntensity: 0.9, threshold: 0, discard: true,
                        animated: { 
                            time: { active: true, speed: 0.0027, animType: "move" },
                            thickness: { active: true, loopDuration: 3000, animType: "cosOscillation", val1: 1, val2: 2 }
                        },
                        zOrder: 1, rank: 10046, enabled: true
                    }),
                    makeFilter({
                        filterType: "electric",
                        filterId: "Zone : Electricity",
                        color: 16777215, // Raios brancos para contraste
                        time: 0, blend: 1, intensity: 5,
                        animated: { time: { active: true, speed: 0.002, animType: "move" } },
                        zOrder: 2, rank: 10047, enabled: true
                    })
                ]);

            case 'zone_fire':
                return buildBase("Zone : Fire", [
                    makeFilter({
                        filterType: "xglow",
                        filterId: "Zone : Fire",
                        auraType: 1, color: colorInt, scale: 1.5, time: 0, auraIntensity: 1.8, subAuraIntensity: 0.25, threshold: 0.6, discard: false,
                        animated: { 
                            time: { active: true, speed: 0.0027, animType: "move" },
                            thickness: { active: true, loopDuration: 3000, animType: "cosOscillation", val1: 2, val2: 5 }
                        },
                        zOrder: 1, rank: 10048, enabled: true
                    }),
                    makeFilter({
                        filterType: "fire",
                        filterId: "Zone : Fire",
                        intensity: 1.5, color: 16777215, // Núcleo branco
                        amplitude: 1, time: 0, blend: 2, fireBlend: 1,
                        animated: { time: { active: true, speed: -0.0015, animType: "move" } },
                        zOrder: 2, rank: 10049, enabled: true
                    })
                ]);
            
            default:
                return {};
        }
    }

    async _activatePreviewTool(data) {
        const safeEffect = data.effect;
        
        if (!canvas.templates) canvas.templates.activate();

        const doc = new foundry.documents.MeasuredTemplateDocument(data, {parent: canvas.scene});
        const template = new foundry.canvas.placeables.MeasuredTemplate(doc);
        
        template.eventMode = "none"; 

        canvas.templates.preview.addChild(template);
        template.draw();

        const _onMouseMove = (event) => {
            const pos = event.data.getLocalPosition(canvas.app.stage);
            let snapped = {x: pos.x, y: pos.y};
            
            if (canvas.grid.getSnappedPoint) {
                snapped = canvas.grid.getSnappedPoint({x: pos.x, y: pos.y}, {mode: 3});
            } 
            
            template.document.x = snapped.x;
            template.document.y = snapped.y;
            template.refresh();
        };

        const _onMouseWheel = (event) => {
            event.preventDefault(); 
            event.stopPropagation();
            
            const delta = Math.sign(event.deltaY);
            template.document.direction += (delta * 15);
            template.refresh();
        };

        const _onClickLeft = async (event) => {
            if (event.data.originalEvent.button !== 0) return;

            const finalX = template.document.x;
            const finalY = template.document.y;
            const finalDirection = template.document.direction;
            const finalFillColor = template.document.fillColor; 

            _cleanup();

            let templateFlags = {};
            const isTMFXActive = game.modules.get("tokenmagic")?.active;

            if (isTMFXActive && safeEffect && safeEffect !== 'none') {
                try {
                    // Conversão de cor robusta
                    let colorInt;
                    if (foundry.utils.Color) {
                        colorInt = foundry.utils.Color.from(finalFillColor || 0xC9A060).valueOf();
                    } else {
                        const cVal = (typeof finalFillColor === 'object') ? finalFillColor.css : finalFillColor;
                        colorInt = parseInt(cVal.replace("#", ""), 16);
                    }
                    
                    const userId = game.user.id;
                    
                    templateFlags = this._getTMFXConfig(safeEffect, colorInt, userId);

                } catch (err) {
                    console.error("[DH-ERROR] Falha ao gerar efeitos Token Magic:", err);
                }
            }

            const finalData = {
                t: data.t,
                user: game.user.id,
                x: finalX,
                y: finalY,
                direction: finalDirection,
                distance: data.distance,
                fillColor: data.fillColor,
                angle: data.angle,
                width: data.width,
                hidden: data.hidden, // Passa o estado de ocultação
                flags: templateFlags
            };
            
            try {
                await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [finalData]);
            } catch(e) {
                console.error("Erro ao criar template:", e);
            }
        };

        const _onClickRight = (event) => {
            _cleanup();
        };

        const _cleanup = () => {
            canvas.stage.off("mousemove", _onMouseMove);
            canvas.stage.off("pointerdown", _onClickLeft);
            canvas.stage.off("rightdown", _onClickRight);
            canvas.app.view.removeEventListener("wheel", _onMouseWheel);
            
            canvas.templates.preview.removeChild(template);
            template.destroy({children: true});
        };

        canvas.stage.on("mousemove", _onMouseMove);
        canvas.stage.on("pointerdown", _onClickLeft);
        canvas.stage.on("rightdown", _onClickRight);
        canvas.app.view.addEventListener("wheel", _onMouseWheel, {passive: false});
    }
}

// ==================================================================
// LEVEL UP APP
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

/**
 * Atualizado: Aceita argumento para controlar se imagens são exibidas no prompt cinemático
 * @param {boolean|object} arg - Se false, suprime imagens. Se evento/undefined, trata como true.
 */
export async function activateRequestRoll(arg) {
    // Se arg for booleano false, usa false. Caso contrário (undefined ou evento), usa true.
    const showImages = (typeof arg === "boolean") ? arg : true;
    new RequestRollApp({ showImages }).render(true);
}

export async function activateLootConsumable() { new LootConsumableApp().render(true); }
export async function activateSpendHope() { new HopeSpenderApp().render(true); }
export async function activateTemplateCreator() { new TemplateCreatorApp().render(true); }

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

export async function showCinematicPrompt(data) { 
    // Force true ensures it pops up even if recently closed or minimized
    // Adicionado bloqueio para GM não ver a tela se ele mesmo iniciou (normalmente)
    if (game.user.isGM) return;

    // Calcular o centro da janela do navegador
    const width = 500; // Largura definida no DEFAULT_OPTIONS
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - 500) / 2; // Estimativa de altura

    new CinematicRollPrompt(data, {
        position: {
            left: left,
            top: top
        }
    }).render({ force: true }); 
}
export async function showMacros(...args) {
    let rawMacros = Array.isArray(args[0]) ? args[0] : args;
    const macros = rawMacros.filter(m => m !== undefined && m !== null);
    if (macros.length === 0) return ui.notifications.warn("QuickActions: No valid macros provided.");
    new ShowMacrosApp(macros).render(true);
}

