/**
 * Request Roll Module
 * Contains the RequestRollApp and CinematicRollPrompt.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";
import { getCinematicImagePath } from "./cinematic-images-settings.js";
import { tr } from "./i18n.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** @type {number} Max characters kept for each name part ("Actor" / "User") in the Send To list before an ellipsis is applied. */
const SEND_TO_NAME_PART_LIMIT = 14;

/**
 * Truncates a name to a fixed maximum length, appending an ellipsis when cut.
 * Keeps combined "Actor - User" labels in the Send To list from overflowing the column.
 * @param {string} name
 * @param {number} maxLength
 * @returns {string}
 */
function truncateName(name, maxLength) {
    if (!name || name.length <= maxLength) return name;
    return `${name.slice(0, maxLength - 1)}…`;
}

/**
 * Ready-made roll labels, grouped by the trait each one usually calls for. `label` is both
 * the chip caption and the text dropped into the Label field; `hint` is shown as a tooltip
 * so the panel stays compact while still explaining what each action covers.
 *
 * Picking one fills the Label field and pre-selects that trait as a shortcut — the trait
 * stays freely changeable afterwards, so the pairing is a hint, never a lock.
 * @type {Readonly<Array<{trait: string, traitLabel: string, suggestions: Array<{label: string, hint: string}>}>>}
 */
const LABEL_SUGGESTIONS = Object.freeze([
    {
        trait: "agility",
        suggestions: [
            { id: "sprintManeuver" },
            { id: "leap" },
            { id: "dodgeEvade" },
            { id: "acrobaticsBalance" },
            { id: "scale" },
            { id: "catch" }
        ]
    },
    {
        trait: "strength",
        suggestions: [
            { id: "liftPushPull" },
            { id: "smashBreakWreck" },
            { id: "grapple" },
            { id: "endure" },
            { id: "intimidatePhysical" }
        ]
    },
    {
        trait: "finesse",
        suggestions: [
            { id: "controlManipulate" },
            { id: "hideSneakProwl" },
            { id: "tinkerDisablePick" },
            { id: "pickpocketSleightOf" },
            { id: "aim" }
        ]
    },
    {
        trait: "instinct",
        suggestions: [
            { id: "perceiveSense" },
            { id: "navigate" },
            { id: "track" },
            { id: "forageSurvive" },
            { id: "anticipateReact" },
            { id: "handleAnimal" }
        ]
    },
    {
        trait: "presence",
        suggestions: [
            { id: "charmPersuadeConvince" },
            { id: "perform" },
            { id: "deceive" },
            { id: "intimidateVerbalSocial" },
            { id: "commandInspire" },
            { id: "distract" }
        ]
    },
    {
        trait: "knowledge",
        suggestions: [
            { id: "recall" },
            { id: "analyseInvestigate" },
            { id: "comprehendDecipher" },
            { id: "strategize" },
            { id: "treatMedic" }
        ]
    }
]);

// ==================================================================
// REQUEST ROLL APP
// ==================================================================
export class RequestRollApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        /** @type {Set<string>} IDs of currently selected target users */
        this._selectedTargets = new Set();
    }

    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "request-roll-app",
        classes: ["dh-qa-app", "request-roll-app"],
        window: { title: "DHQA.RequestRoll.Title", icon: "fas fa-dice-d20", resizable: false, controls: [] },
        position: { width: 740, height: "auto" }, // Widened to fit "Actor - User" labels in the Send To column
        actions: {
            roll: RequestRollApp.prototype._onRoll,
            toggleUser: RequestRollApp.prototype._onTargetToggle,
            toggleSuggestions: RequestRollApp.prototype._onToggleSuggestions,
            applySuggestion: RequestRollApp.prototype._onApplySuggestion
        }
    };

    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/request-roll.hbs` }
    };

    async _prepareContext(options) {
        // Filter users to remove GMs and keep only active users
        const connectedUsers = game.users.filter(u => u.active && !u.isGM).map(u => {
            const actorName = u.character?.name ?? null;
            const label = actorName
                ? `${truncateName(actorName, SEND_TO_NAME_PART_LIMIT)} - ${truncateName(u.name, SEND_TO_NAME_PART_LIMIT)}`
                : truncateName(u.name, SEND_TO_NAME_PART_LIMIT);
            const fullLabel = actorName ? `${actorName} - ${u.name}` : u.name;

            return {
                id: u.id,
                label,
                fullLabel,
                color: u.color.css
            };
        });
        
        return {
            connectedUsers,
            labelSuggestions: LABEL_SUGGESTIONS.map(group => ({
                trait: group.trait,
                traitLabel: game.i18n.localize(`DHQA.CinematicCase.${group.trait}`),
                suggestions: group.suggestions.map(({ id }) => ({
                    label: tr(`RequestRoll.Suggestions.${group.trait}.${id}.label`),
                    hint: tr(`RequestRoll.Suggestions.${group.trait}.${id}.hint`)
                }))
            })),
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

        // Advantage and Disadvantage cancel each other out, so they can never be on at
        // the same time — switching one on silently switches the other off.
        const advantageInput = html.querySelector('input[name="advantage"]');
        const disadvantageInput = html.querySelector('input[name="disadvantage"]');
        if (advantageInput && disadvantageInput) {
            advantageInput.onchange = () => {
                if (advantageInput.checked) disadvantageInput.checked = false;
            };
            disadvantageInput.onchange = () => {
                if (disadvantageInput.checked) advantageInput.checked = false;
            };
        }

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
     * Shows or hides the suggested-label panel, keeping the toggle button's visual and
     * ARIA state in sync. The window is sized to its content, so it has to be re-measured
     * whenever the panel changes the form's height.
     * @param {boolean} visible - Whether the panel should be shown.
     */
    _setSuggestionsVisible(visible) {
        const html = this.element;
        const panel = html.querySelector(".dh-suggestions");
        const toggleBtn = html.querySelector('[data-action="toggleSuggestions"]');
        if (!panel) return;

        panel.hidden = !visible;
        toggleBtn?.classList.toggle("active", visible);
        toggleBtn?.setAttribute("aria-expanded", String(visible));
        this.setPosition({ height: "auto" });
    }

    /**
     * Opens or closes the suggested-label panel next to the Label field.
     * Triggered by data-action="toggleSuggestions".
     * @param {PointerEvent} event
     * @param {HTMLElement} target - The clicked toggle button.
     */
    _onToggleSuggestions(event, target) {
        this._setSuggestionsVisible(target.getAttribute("aria-expanded") !== "true");
    }

    /**
     * Fills the Label field with the chosen suggestion and pre-selects its matching trait.
     * The trait button is clicked rather than updated directly so selection runs through the
     * same logic wired in `_onRender` — which also means the trait is only pre-selected, and
     * the GM stays free to pick a different one (or a Hope/Fear/Loot roll) afterwards.
     * Triggered by data-action="applySuggestion".
     * @param {PointerEvent} event
     * @param {HTMLElement} target - The clicked suggestion chip.
     */
    _onApplySuggestion(event, target) {
        const html = this.element;
        const labelInput = html.querySelector('input[name="label"]');
        if (labelInput) labelInput.value = target.dataset.label ?? "";

        html.querySelector(`.dh-trait-btn[data-trait="${target.dataset.trait}"]`)?.click();
        this._setSuggestionsVisible(false);
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
        const labelInput = (container.querySelector('[name="label"]').value || "").trim();

        // Resolve targets: empty array means broadcast to all, populated array means specific users
        const connectedUserIds = [...container.querySelectorAll('.dh-user-btn[data-target]:not([data-target="all"])')].map(b => b.dataset.target);
        const isAll = this._selectedTargets.size === connectedUserIds.length;
        const selectedIds = [...this._selectedTargets];
        const targetIds = isAll ? [] : selectedIds;

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

        // Resolve which of the 9 Cinematic Roll cases this request maps to. An image is
        // optional here — the prompt template omits it gracefully when the GM hasn't
        // configured one for this case — so Cinematic Mode always opens on the players'
        // screen regardless of whether configuredPath resolves to anything.
        const caseKey = specialRoll ? specialRoll.toLowerCase() : (trait ? trait.toLowerCase() : "none");
        const configuredPath = getCinematicImagePath(caseKey);

        let rawCommand = "";
        let cinematicTraitLabel = "";
        let cinematicDifficulty = difficulty;

        // BRANCH LOGIC: Special Roll vs Standard Roll
        if (specialRoll) {
            const capSpecial = specialRoll.toLowerCase(); // hope or fear
            const displaySpecial = capSpecial.charAt(0).toUpperCase() + capSpecial.slice(1);
            rawCommand = `/fr type=${displaySpecial}`;

            cinematicTraitLabel = game.i18n.localize(`DHQA.CinematicCase.${capSpecial}`); // "Hope" or "Fear"
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

            cinematicTraitLabel = trait ? game.i18n.localize(`DHQA.CinematicCase.${trait.toLowerCase()}`) : "";
        }

        // Open the Cinematic Roll prompt on the targeted players' screens.
        const dataPacket = {
            command: rawCommand,
            label: labelInput || tr("RequestRoll.DefaultLabel"),
            difficulty: cinematicDifficulty,
            trait: cinematicTraitLabel,
            imagePath: configuredPath // Resolved from the GM's world settings at request time; may be empty
        };

        await game.settings.set(MODULE_ID, "cinematicRequest", {
            targetIds: targetIds,
            data: dataPacket,
            timestamp: Date.now()
        });

        // Also drop the request into chat, so it's visible even before the player
        // acknowledges the cinematic prompt.
        let displayCommand = `[[${rawCommand}]]`;
        if (labelInput) displayCommand += `{${labelInput}}`;

        const content = buildChatCard(labelInput || tr("RequestRoll.ChatTitle"), `
            <span style="color: #ffffff !important; font-size: 1.1em; font-weight: bold; text-shadow: 0px 0px 8px #000000; font-family: 'Lato', sans-serif; line-height: 1.4; width: 100%;">
                ${displayCommand}
            </span>
        `);

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            whisper: targetIds
        });

        this.close();
    }
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
        window: { title: "DHQA.RequestRoll.PromptTitle", icon: "fas fa-dice-d20", resizable: false, controls: [] },
        position: { width: 500, height: "auto" },
        actions: {}
    };

    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/cinematic-roll-prompt.hbs` }
    };

    /**
     * Builds the context passed to the Handlebars template.
     * The click handler on the resulting `.duality-roll-button` / `.fate-roll-button` needs no
     * wiring here — Daggerheart registers one delegated listener on `window.document` at init
     * (`enricherRenderSetup`), so a click on this ApplicationV2's button simply bubbles up to it.
     * @override
     * @returns {Promise<object>}
     */
    async _prepareContext(_options) {
        // Resolve the display label for the roll type
        let checkLabel = this.data.trait;
        if (!checkLabel || checkLabel === "Roll") checkLabel = tr("RequestRoll.DualityRoll");

        // Image path was already resolved from the GM's Cinematic Roll Images settings when the
        // request was sent (see RequestRollApp._onRoll) — this prompt just displays it.
        const imagePath = this.data.imagePath || null;

        // Enrich the roll command into a native Daggerheart enriched button. Its click handler
        // needs no wiring here — see the delegated-listener note on the method doc above.
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

export async function activateRequestRoll() {
    new RequestRollApp().render(true);
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