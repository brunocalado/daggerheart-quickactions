/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Cinematic Roll Images Settings
 * Lets the GM assign an image to each Request Roll case (traits, Hope, Fear, and the generic
 * Duality Roll fallback). Cinematic Mode auto-activates per request in request_roll.js only when
 * the resolved case has an image configured here — with nothing configured, the feature is inert.
 * Registered from the init hook in main.js.
 */

import {
    MODULE_ID,
    CINEMATIC_IMAGES,
    CINEMATIC_CASE_KEYS,
    CINEMATIC_CASE_LABELS,
    DEFAULT_CINEMATIC_IMAGES
} from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Reads the stored per-case image map from world settings.
 * Cloned on the way out so callers can freely mutate the result before writing it back.
 * @returns {Record<string, string>} Case key → image path (or "" when unset).
 */
export function getStoredCinematicImages() {
    const stored = game.settings.get(MODULE_ID, CINEMATIC_IMAGES);
    return foundry.utils.deepClone(stored ?? DEFAULT_CINEMATIC_IMAGES);
}

/**
 * Resolves the configured image path for a single Request Roll case.
 * @param {string} caseKey - One of CINEMATIC_CASE_KEYS.
 * @returns {string} The configured image path, or "" when the case has no image assigned.
 */
export function getCinematicImagePath(caseKey) {
    return getStoredCinematicImages()[caseKey] ?? "";
}

/**
 * Settings menu Application where the GM assigns an image to each Cinematic Roll case.
 * Every change (browse or clear) is persisted immediately — there is no submit step.
 */
class CinematicImagesSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-cinematic-images-settings-app",
        tag: "div",
        classes: ["dh-qa-app", MODULE_ID, "dqa-cinematic-images"],
        window: { title: "Cinematic Roll Images", icon: "fas fa-images", resizable: true },
        position: { width: 480, height: "auto" },
        actions: {
            browseImage: CinematicImagesSettingsApp.prototype._onBrowseImage,
            clearImage: CinematicImagesSettingsApp.prototype._onClearImage
        }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/cinematic-images-settings.hbs` }
    };

    /**
     * Builds one row per Cinematic Roll case from the stored image map.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        const stored = getStoredCinematicImages();
        const rows = CINEMATIC_CASE_KEYS.map(key => ({
            key,
            label: CINEMATIC_CASE_LABELS[key],
            path: stored[key] || "",
            hasImage: !!stored[key]
        }));

        return { rows };
    }

    /**
     * Opens Foundry's file picker scoped to images and persists the chosen path for that case.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked button, carrying `data-case`.
     * @returns {Promise<void>}
     */
    async _onBrowseImage(_event, target) {
        const caseKey = target.dataset.case;
        const stored = getStoredCinematicImages();

        const FilePickerClass = foundry.applications.apps.FilePicker.implementation
            ?? foundry.applications.apps.FilePicker;

        new FilePickerClass({
            type: "image",
            current: stored[caseKey] || "",
            callback: async path => {
                const images = getStoredCinematicImages();
                images[caseKey] = path;
                await game.settings.set(MODULE_ID, CINEMATIC_IMAGES, images);
                this.render();
            }
        }).browse();
    }

    /**
     * Clears the configured image for a case, falling that case back to the plain chat message.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked button, carrying `data-case`.
     * @returns {Promise<void>}
     */
    async _onClearImage(_event, target) {
        const caseKey = target.dataset.case;
        const images = getStoredCinematicImages();
        images[caseKey] = "";
        await game.settings.set(MODULE_ID, CINEMATIC_IMAGES, images);
        this.render();
    }
}

/**
 * Registers the cinematic image map setting and its settings-menu button.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function registerCinematicImagesSettings() {
    game.settings.register(MODULE_ID, CINEMATIC_IMAGES, {
        name: "Cinematic Roll Images",
        scope: "world",
        config: false,
        type: Object,
        default: { ...DEFAULT_CINEMATIC_IMAGES }
    });

    game.settings.registerMenu(MODULE_ID, "cinematicImagesSettingsMenu", {
        name: "Cinematic Roll Images",
        label: "Configure Cinematic Images",
        hint: "Assign an image to each Request Roll case. Cinematic Mode only activates for cases with an image configured — cases left empty fall back to a plain chat message.",
        icon: "fas fa-images",
        type: CinematicImagesSettingsApp,
        restricted: true
    });
}
