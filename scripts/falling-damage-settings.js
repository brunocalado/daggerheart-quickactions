/**
 * Falling Damage Settings Module
 * Provides an ApplicationV2 menu for customizing falling damage dice formulas.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Default falling damage formulas, keyed by fall height category. */
export const DEFAULT_FORMULAS = {
    veryclose: "1d10+3",
    close: "1d20+5",
    far: "1d100+15",
    collision: "1d20+5"
};

/**
 * Menu Application for customizing falling damage dice formulas.
 * Triggered via a settings menu button registered in registerFallingDamageSettings().
 */
class FallingDamageSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-falling-damage-settings-app",
        tag: "form",
        classes: ["falling-damage-settings"],
        window: { title: "Falling Damage Configuration", icon: "fas fa-skull-crossbones", resizable: false },
        position: { width: 460, height: "auto" }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/falling-damage-settings.hbs` }
    };

    /**
     * Prepares context data for the template from stored settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with current formulas.
     */
    async _prepareContext(_options) {
        return {
            formulas: game.settings.get(MODULE_ID, "fallingDamageFormulas")
        };
    }

    /**
     * Wires reset button and form submission.
     * Triggered by the AppV2 render lifecycle.
     */
    _onRender(context, options) {
        // Reset button restores default values into inputs without saving
        const resetBtn = this.element.querySelector(".reset-btn");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                this.element.querySelector('input[name="veryclose"]').value = DEFAULT_FORMULAS.veryclose;
                this.element.querySelector('input[name="close"]').value = DEFAULT_FORMULAS.close;
                this.element.querySelector('input[name="far"]').value = DEFAULT_FORMULAS.far;
                this.element.querySelector('input[name="collision"]').value = DEFAULT_FORMULAS.collision;
            });
        }

        // Form submission persists all values to settings
        this.element.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            const formulas = {
                veryclose: (formData.get("veryclose") || DEFAULT_FORMULAS.veryclose).trim(),
                close: (formData.get("close") || DEFAULT_FORMULAS.close).trim(),
                far: (formData.get("far") || DEFAULT_FORMULAS.far).trim(),
                collision: (formData.get("collision") || DEFAULT_FORMULAS.collision).trim()
            };

            await game.settings.set(MODULE_ID, "fallingDamageFormulas", formulas);
            this.close();
        });
    }
}

/**
 * Registers all falling damage settings and the menu button.
 * Called from the init hook in main.js.
 */
export function registerFallingDamageSettings() {
    game.settings.register(MODULE_ID, "fallingDamageFormulas", {
        scope: "world",
        config: false,
        type: Object,
        default: { ...DEFAULT_FORMULAS }
    });

    game.settings.registerMenu(MODULE_ID, "fallingDamageSettingsMenu", {
        name: "Falling Damage Configuration",
        label: "Configure Falling Damage",
        hint: "Customize the dice formulas for each fall height category.",
        icon: "fas fa-skull-crossbones",
        type: FallingDamageSettingsApp,
        restricted: true
    });
}
