/**
 * Request Roll Module
 * Contains the RequestRollApp and CinematicRollPrompt.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// REQUEST ROLL APP
// ==================================================================
export class RequestRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        // Receives the showImages option (defaults to true if not passed)
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

    static PARTS = {
        form: { template: "modules/daggerheart-quickactions/templates/request-roll.hbs" }
    };

    async _prepareContext(options) {
        // Filter users to remove GMs and keep only active users
        const connectedUsers = game.users.filter(u => u.active && !u.isGM).map(u => ({
            id: u.id,
            name: u.name,
            color: u.color.css
        }));
        
        // Retrieve cinematic mode flag
        const savedCinematic = game.user.getFlag("daggerheart-quickactions", "cinematicMode") ?? false;

        return {
            connectedUsers,
            cinematicMode: savedCinematic,
            difficulty: 15
        };
    }

    _onRender(context, options) {
        const html = this.element;
        
        const traitButtons = html.querySelectorAll('.dh-trait-btn:not(.dh-special-btn)');
        const specialButtons = html.querySelectorAll('.dh-special-btn');
        
        const hiddenTraitInput = html.querySelector('input[name="trait"]');
        const hiddenSpecialInput = html.querySelector('input[name="specialRoll"]');

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

        const dcInput = html.querySelector('input[name="difficulty"]');
        
        // Listener para modificadores (+/-)
        html.querySelectorAll('[data-action="mod-dc"]').forEach(btn => {
            btn.onclick = (e) => {
                const mod = parseInt(btn.dataset.value);
                let currentVal = parseInt(dcInput.value) || 0;
                let newVal = currentVal + mod;
                if (newVal < 0) newVal = 0;
                dcInput.value = newVal;
            };
        });

        // Listener para limpar dificuldade
        const clearBtn = html.querySelector('[data-action="clear-dc"]');
        if (clearBtn) {
            clearBtn.onclick = () => {
                dcInput.value = "";
            };
        }
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

        // Persist Cinematic Mode choice
        await game.user.setFlag("daggerheart-quickactions", "cinematicMode", cinematicMode);

        let rawCommand = "";
        let displayCommand = "";
        let cinematicTraitLabel = "";
        let cinematicDifficulty = difficulty;

        // BRANCH LOGIC: Special Roll vs Standard Roll
        if (specialRoll) {
            const capSpecial = specialRoll.toLowerCase(); // hope or fear

            // Non-Cinematic Hope/Fear sends direct command
            if (!cinematicMode) {
                // Simple command: [[/fr type=hope]] or [[/fr type=fear]]
                // Adds {label} if present
                let textCommand = `[[/fr type=${capSpecial}]]`;
                if (labelInput) {
                    textCommand += `{${labelInput}}`;
                }

                await ChatMessage.create({
                    user: game.user.id,
                    content: textCommand
                    // Speaker is not strictly necessary for this command as Foundry resolves it
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
                rawTrait: specialRoll ? "" : trait, // If special, do not send rawTrait to avoid fetching attribute image
                showImages: this.showImages // Passes image configuration to client
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
// CINEMATIC ROLL PROMPT APP
// ==================================================================
export class CinematicRollPrompt extends ApplicationV2 {
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
        // ... (HTML generation logic remains the same as in apps.js, omitted for brevity but included in file) ...
        // For the sake of the diff, I will assume the user wants the full content here.
        // Since I am creating a new file, I will paste the full content of CinematicRollPrompt from apps.js
        // See apps.js content in context for the implementation.
        // I will use the exact implementation from apps.js.
        
        // Check Text Logic (Trait or Duality Roll or Hope/Fear)
        let checkLabel = this.data.trait;
        if (!checkLabel || checkLabel === "Roll") {
            checkLabel = "Duality Roll";
        }

        // Image Logic
        let imageHtml = "";
        
        // Checks if images should be displayed (default is true if undefined)
        if (this.data.showImages !== false) {
            let imageName = "";
            
            if (this.data.rawTrait) {
                // If rawTrait exists, it is a normal attribute (agility, strength, etc)
                imageName = this.data.rawTrait.toLowerCase();
            } else {
                // If no rawTrait, check the processed label
                if (checkLabel === "Hope") imageName = "hope";
                else if (checkLabel === "Fear") imageName = "fear";
                else if (checkLabel === "Duality Roll") imageName = "none";
            }

            if (imageName) {
                const imagePath = `modules/daggerheart-quickactions/assets/requestroll/${imageName}.webp`;
                imageHtml = `<img src="${imagePath}" style="max-width: 400px; border: none; filter: drop-shadow(0 0 10px rgba(201, 160, 96, 0.5)); margin-bottom: 10px;" />`;
            }
        }

        // Difficulty Logic (Do not display if empty)
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
        // Retrieves stored command (e.g., "/dr trait=strength difficulty=15")
        // Preference for button data-command if it exists (ensures it matches HTML)
        const commandToExecute = target.dataset.command || this.data.command;

        if (commandToExecute) {
            ui.chat.processMessage(commandToExecute);
        }

        this.close();
    }
}

export async function activateRequestRoll(arg) {
    // If arg is boolean false, use false. Otherwise (undefined or event), use true.
    const showImages = (typeof arg === "boolean") ? arg : true;
    new RequestRollApp({ showImages }).render(true);
}

export async function showCinematicPrompt(data) { 
    // Force true ensures it pops up even if recently closed or minimized
    // Block GM from seeing the screen if they initiated it
    if (game.user.isGM) return;

    // Calculate browser window center
    const width = 500; // Largura definida no DEFAULT_OPTIONS
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - 500) / 2; // Height estimate

    new CinematicRollPrompt(data, {
        position: {
            left: left,
            top: top
        }
    }).render({ force: true }); 
}