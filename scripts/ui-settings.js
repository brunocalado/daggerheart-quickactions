/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Interface Settings
 * Single window collecting every change this module makes to the Foundry / Daggerheart interface,
 * so they are switched on and off from one place instead of being scattered through the settings
 * list. The settings themselves stay registered by the feature that owns them (`config: false`) —
 * this window only reads and writes them.
 * Registered from the init hook in main.js.
 */

import {
    MODULE_ID, HIDE_BIOGRAPHY_TAB, MENU_ENHANCEMENTS_ENABLED, TOKEN_TOOLTIP_ENABLED, HOPE_BAR_ENABLED
} from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Settings menu Application holding this module's interface switches.
 *
 * GM-only: every switch here is world-scope. Per-client UI settings stay in the settings list,
 * where players can reach them.
 */
class UISettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-ui-settings-app",
        tag: "div",
        classes: ["dh-qa-app", MODULE_ID, "dqa-ui-settings"],
        window: { title: "Interface Settings", icon: "fas fa-sliders", resizable: true },
        position: { width: 540, height: "auto" }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/ui-settings.hbs` }
    };

    /**
     * Reads the current value of every switch shown in the window.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        return {
            menuEnhancements: game.settings.get(MODULE_ID, MENU_ENHANCEMENTS_ENABLED),
            tokenTooltip: game.settings.get(MODULE_ID, TOKEN_TOOLTIP_ENABLED),
            hopeBar: game.settings.get(MODULE_ID, HOPE_BAR_ENABLED),
            hideBiography: game.settings.get(MODULE_ID, HIDE_BIOGRAPHY_TAB)
        };
    }

    /**
     * Wires the switches. These are `change` events rather than clicks, so they are bound here
     * instead of through `DEFAULT_OPTIONS.actions`.
     * Called from `_onRender`.
     * @param {object} _context - Render context (unused).
     * @param {object} _options - Render options (unused).
     * @returns {void}
     */
    _onRender(_context, _options) {
        this.element.querySelector('[name="menuEnhancements"]')?.addEventListener("change", event => {
            game.settings.set(MODULE_ID, MENU_ENHANCEMENTS_ENABLED, event.target.checked);
        });

        this.element.querySelector('[name="tokenTooltip"]')?.addEventListener("change", event => {
            game.settings.set(MODULE_ID, TOKEN_TOOLTIP_ENABLED, event.target.checked);
        });

        this.element.querySelector('[name="hopeBar"]')?.addEventListener("change", event => {
            game.settings.set(MODULE_ID, HOPE_BAR_ENABLED, event.target.checked);
        });

        this.element.querySelector('[name="hideBiography"]')?.addEventListener("change", event => {
            game.settings.set(MODULE_ID, HIDE_BIOGRAPHY_TAB, event.target.checked);
        });
    }
}

/**
 * Registers the Interface Settings menu button.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function registerUISettings() {
    game.settings.registerMenu(MODULE_ID, "uiSettingsMenu", {
        name: "Interface Settings",
        label: "Configure Interface",
        hint: "World-wide interface changes made by this module, in one place: the Daggerheart sidebar menu enhancements, the token tooltip and Hope bar, and the character sheet Biography tab.",
        icon: "fas fa-sliders",
        type: UISettingsApp,
        restricted: true
    });
}
