/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Scan Settings Module
 * Provides an ApplicationV2 menu for customizing scan label text and chat card titles.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID, SCAN_DEFAULT_LABELS, SCAN_DEFAULT_TITLES } from "./constants.js";
import { getScanLabels, getScanTitle } from "./scan.js";

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
        window: { title: "DH_QUICKACTIONS.SCAN.settings.title", resizable: true },
        position: { width: 700, height: 520 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/scan-settings-menu.hbs` }
    };

    /**
     * Prepares context data for the template from stored settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with label arrays and titles.
     */
    async _prepareContext(_options) {
        return {
            enableScan: game.settings.get(MODULE_ID, "enableScan"),
            hpTitle: getScanTitle("hp"),
            stressTitle: getScanTitle("stress"),
            hpLabels: getScanLabels("hp"),
            stressLabels: getScanLabels("stress")
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
                const titleInput = this.element.querySelector(`input[name="${type}Title"]`);
                if (titleInput) titleInput.value = game.i18n.localize(SCAN_DEFAULT_TITLES[type]);

                for (const entry of SCAN_DEFAULT_LABELS[type]) {
                    const input = this.element.querySelector(`input[name="${type}Label-${entry.min}"]`);
                    if (input) input.value = game.i18n.localize(entry.label);
                }
            });
        });

        // Form submission persists all values to settings
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // A field still holding the localized default is stored as "", so it keeps following
            // the client's language instead of freezing the text of whoever saved the form.
            const custom = (value, defaultKey) => {
                const text = value || "";
                return text === game.i18n.localize(defaultKey) ? "" : text;
            };

            await game.settings.set(MODULE_ID, 'scanHpTitle', custom(formData.get('hpTitle'), SCAN_DEFAULT_TITLES.hp));
            await game.settings.set(MODULE_ID, 'scanStressTitle', custom(formData.get('stressTitle'), SCAN_DEFAULT_TITLES.stress));

            const collectLabels = type => SCAN_DEFAULT_LABELS[type].map(entry => ({
                min: entry.min,
                label: custom(formData.get(`${type}Label-${entry.min}`), entry.label)
            }));

            await game.settings.set(MODULE_ID, 'scanHpLabels', JSON.stringify(collectLabels('hp')));
            await game.settings.set(MODULE_ID, 'scanStressLabels', JSON.stringify(collectLabels('stress')));
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

    // The four text settings below default to "" and are resolved by getScanTitle / getScanLabels
    // when read: this runs in `init`, before translations load, so a localized default could not
    // be computed here.
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
        name: "DH_QUICKACTIONS.SETTINGS.scanSettingsMenu.name",
        label: "DH_QUICKACTIONS.SETTINGS.scanSettingsMenu.label",
        hint: "DH_QUICKACTIONS.SETTINGS.scanSettingsMenu.hint",
        icon: "fas fa-crosshairs",
        type: ScanSettingsApp,
        restricted: true
    });
}
