/**
 * Request Roll Module
 * Contains the RequestRollApp and CinematicRollPrompt.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// REQUEST ROLL APP
// ==================================================================
export class RequestRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.showImages = options.showImages ?? true;
        /** @type {Set<string>} IDs of currently selected target users */
        this._selectedTargets = new Set();
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "request-roll-app",
        classes: ["dh-qa-app", "request-roll-app"],
        window: { title: "Roll Configuration", icon: "fas fa-dice-d20", resizable: false, controls: [] },
        position: { width: 650, height: "auto" }, // Increased Width for 2 columns
        actions: {
            roll: RequestRollApp.prototype._onRoll,
            cancel: RequestRollApp.prototype._onCancel,
            toggleUser: RequestRollApp.prototype._onTargetToggle
        }
    };

    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/request-roll.hbs` }
    };

    async _prepareContext(options) {
        // Filter users to remove GMs and keep only active users
        const connectedUsers = game.users.filter(u => u.active && !u.isGM).map(u => ({
            id: u.id,
            name: u.name,
            color: u.color.css
        }));
        
        // Retrieve cinematic mode flag
        const savedCinematic = game.user.getFlag(MODULE_ID, "cinematicMode") ?? false;

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

    /**
     * Toggles a user button in the "Send To" column and updates _selectedTargets.
     * Triggered by data-action="toggleUser" on user selection buttons.
     * @param {Event} event
     * @param {HTMLElement} target - The clicked button element
     */
    _onTargetToggle(event, target) {
        const targetId = target.dataset.target;
        const html = this.element;
        const userButtons = [...html.querySelectorAll('.dh-user-btn[data-target]:not([data-target="all"])')];
        const allBtn = html.querySelector('.dh-user-btn[data-target="all"]');
        const sendBtn = html.querySelector('[data-action="roll"]');
        const allUserIds = userButtons.map(b => b.dataset.target);

        if (targetId === "all") {
            // Toggle all: if every user already selected → clear; otherwise → select all
            if (this._selectedTargets.size === allUserIds.length && allUserIds.length > 0) {
                this._selectedTargets.clear();
            } else {
                allUserIds.forEach(id => this._selectedTargets.add(id));
            }
        } else {
            if (this._selectedTargets.has(targetId)) {
                this._selectedTargets.delete(targetId);
            } else {
                this._selectedTargets.add(targetId);
            }
        }

        // Sync visual state for individual buttons
        userButtons.forEach(btn => {
            btn.classList.toggle("selected", this._selectedTargets.has(btn.dataset.target));
        });

        // Sync "All Players" button — active only when every user is selected
        if (allBtn) {
            allBtn.classList.toggle("selected",
                allUserIds.length > 0 && this._selectedTargets.size === allUserIds.length);
        }

        // Enable Send Roll only when at least one target is selected
        if (sendBtn) sendBtn.disabled = this._selectedTargets.size === 0;
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

        // Resolve targets: empty array means broadcast to all, populated array means specific users
        const connectedUserIds = [...container.querySelectorAll('.dh-user-btn[data-target]:not([data-target="all"])')].map(b => b.dataset.target);
        const isAll = this._selectedTargets.size === connectedUserIds.length;
        const selectedIds = [...this._selectedTargets];
        const targetIds = isAll ? [] : selectedIds;

        // Persist Cinematic Mode choice
        await game.user.setFlag(MODULE_ID, "cinematicMode", cinematicMode);

        // LOOT: Trigger LootConsumable screen on targeted players
        if (specialRoll === "loot") {
            await game.settings.set(MODULE_ID, "cinematicRequest", {
                targetIds: targetIds,
                data: { type: "loot" },
                timestamp: Date.now()
            });
            this.close();
            return;
        }

        let rawCommand = "";
        let displayCommand = "";
        let cinematicTraitLabel = "";
        let cinematicDifficulty = difficulty;

        // BRANCH LOGIC: Special Roll vs Standard Roll
        if (specialRoll) {
            const capSpecial = specialRoll.toLowerCase(); // hope or fear

            // Non-Cinematic Hope/Fear sends direct command
            if (!cinematicMode) {
                let textCommand = `[[/fr type=${capSpecial}]]`;
                if (labelInput) textCommand += `{${labelInput}}`;

                await ChatMessage.create({
                    user: game.user.id,
                    content: textCommand,
                    whisper: targetIds
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
            
            await game.settings.set(MODULE_ID, "cinematicRequest", {
                targetIds: targetIds,
                data: dataPacket,
                timestamp: Date.now()
            });
            //ui.notifications.info("Cinematic Request sent to player(s) screen.");
            this.close();
            return;
        }

        // Standard Text Chat Logic (Traits)
        let whisperArray = targetIds;
        const content = buildChatCard(labelInput || "Roll Request", `
            <span style="color: #ffffff !important; font-size: 1.1em; font-weight: bold; text-shadow: 0px 0px 8px #000000; font-family: 'Lato', sans-serif; line-height: 1.4; width: 100%;">
                ${displayCommand}
            </span>
        `);

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
export class CinematicRollPrompt extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(data, options = {}) {
        super(options);
        this.data = data;
    }

    static DEFAULT_OPTIONS = {
        tag: "div",
        id: "cinematic-roll-prompt",
        classes: ["dh-qa-app"],
        window: { title: "Action Required", icon: "fas fa-dice-d20", resizable: false, controls: [] },
        position: { width: 500, height: "auto" },
        actions: {}
    };

    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/cinematic-roll-prompt.hbs` }
    };

    /**
     * Builds the context passed to the Handlebars template.
     * Uses HandlebarsApplicationMixin so the `renderHandlebarsApplication` hook fires,
     * which triggers Daggerheart's `enricherRenderSetup` to wire `.duality-roll-button`
     * and `.fate-roll-button` click handlers automatically.
     * @override
     * @returns {Promise<object>}
     */
    async _prepareContext(_options) {
        // Resolve the display label for the roll type
        let checkLabel = this.data.trait;
        if (!checkLabel || checkLabel === "Roll") checkLabel = "Duality Roll";

        // Resolve the trait image path (images optional via showImages flag)
        let imagePath = null;
        if (this.data.showImages !== false) {
            let imageName = "";
            if (this.data.rawTrait) {
                // Normal attribute roll (agility, strength, etc.) — use rawTrait directly
                imageName = this.data.rawTrait.toLowerCase();
            } else {
                // Special roll — map processed label to image name
                const specialImageMap = { Hope: "hope", Fear: "fear", "Duality Roll": "none" };
                imageName = specialImageMap[checkLabel] ?? "";
            }
            if (imageName) imagePath = `modules/${MODULE_ID}/assets/requestroll/${imageName}.webp`;
        }

        // Enrich the roll command into a native Daggerheart enriched button.
        // `renderHandlebarsApplication` (fired by HandlebarsApplicationMixin) triggers
        // Daggerheart's enricherRenderSetup, which wires the click handler on the result.
        const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;
        const enrichedRoll = await TextEditorImpl.enrichHTML(`[[${this.data.command}]]`);

        return {
            label: this.data.label,
            checkLabel,
            difficulty: this.data.difficulty,
            hasDifficulty: !!this.data.difficulty,
            imagePath,
            enrichedRoll
        };
    }

    /**
     * Attaches a click listener on the roll container to close the dialog after the
     * enriched button fires its roll. Called after every render.
     * @override
     */
    _onRender(_context, _options) {
        const container = this.element.querySelector(".cinematic-roll-container");
        if (!container) return;
        // Short delay lets Daggerheart's handler execute before the window closes
        container.addEventListener("click", () => setTimeout(() => this.close(), 100));
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