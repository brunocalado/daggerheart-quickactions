/**
 * Scan Settings Module
 * Provides an ApplicationV2 menu for customizing scan label text and chat card titles.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID } from "./constants.js";
import { getDefaultScanLabels, getDefaultScanTitle } from "./scan-defaults.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Menu Application for customizing Scan feature labels and chat card titles.
 * Triggered via a settings menu button registered in registerScanSettings().
 */
class ScanSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-scan-settings-app",
        tag: "form",
        classes: ["scan-settings-wrapper"],
        window: { title: "DHQA.Scan.ConfigTitle", resizable: true },
        position: { width: 700, height: 520 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/scan-settings-menu.hbs` }
    };

    /**
     * Reads one stored label set, falling back to the localized defaults while nothing is saved.
     * @param {string} key - World setting key.
     * @param {"hp"|"stress"} type - Which default set to fall back to.
     * @returns {Array<{min: number, label: string}>}
     */
    #readLabels(key, type) {
        try {
            const parsed = JSON.parse(game.settings.get(MODULE_ID, key));
            if (Array.isArray(parsed) && parsed.length) return parsed;
        } catch { /* unset: fall through to the localized defaults */ }
        return getDefaultScanLabels(type);
    }

    /**
     * Prepares context data for the template from stored settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with label arrays and titles.
     */
    async _prepareContext(_options) {
        return {
            enableScan: game.settings.get(MODULE_ID, "enableScan"),
            hpTitle: game.settings.get(MODULE_ID, "scanHpTitle") || getDefaultScanTitle("hp"),
            stressTitle: game.settings.get(MODULE_ID, "scanStressTitle") || getDefaultScanTitle("stress"),
            hpLabels: this.#readLabels("scanHpLabels", "hp"),
            stressLabels: this.#readLabels("scanStressLabels", "stress")
        };
    }

    /**
     * Wires tab switching, reset buttons, and form submission.
     * Triggered by the AppV2 render lifecycle.
     */
    _onRender(context, options) {
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // Reset buttons restore default text into the input fields without saving
        this.element.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.reset;
                const defaults = getDefaultScanLabels(type);
                const defaultTitle = getDefaultScanTitle(type);

                const titleInput = this.element.querySelector(`input[name="${type}Title"]`);
                if (titleInput) titleInput.value = defaultTitle;

                for (const entry of defaults) {
                    const input = this.element.querySelector(`input[name="${type}Label-${entry.min}"]`);
                    if (input) input.value = entry.label;
                }
            });
        });

        // Form submission persists all values to settings
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            await game.settings.set(MODULE_ID, 'scanHpTitle', formData.get('hpTitle') || getDefaultScanTitle('hp'));
            await game.settings.set(MODULE_ID, 'scanStressTitle', formData.get('stressTitle') || getDefaultScanTitle('stress'));

            const collectLabels = (type, defaults) => {
                return defaults.map(entry => ({
                    min: entry.min,
                    label: formData.get(`${type}Label-${entry.min}`) || entry.label
                }));
            };

            await game.settings.set(MODULE_ID, 'scanHpLabels', JSON.stringify(collectLabels('hp', getDefaultScanLabels('hp'))));
            await game.settings.set(MODULE_ID, 'scanStressLabels', JSON.stringify(collectLabels('stress', getDefaultScanLabels('stress'))));
            await game.settings.set(MODULE_ID, 'enableScan', formData.get('enableScan') === 'true');

            this.close();
        });
    }
}

/**
 * Registers all scan-related settings and the menu button.
 * Called from the init hook in main.js.
 */
export function registerScanSettings() {
    game.settings.register(MODULE_ID, "enableScan", {
        scope: "world",
        config: false,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE_ID, "scanHpTitle", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "scanStressTitle", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "scanHpLabels", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "scanStressLabels", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.registerMenu(MODULE_ID, "scanSettingsMenu", {
        name: "DHQA.Scan.MenuName",
        label: "DHQA.Scan.MenuLabel",
        hint: "DHQA.Scan.MenuHint",
        icon: "fas fa-crosshairs",
        type: ScanSettingsApp,
        restricted: true
    });
}
