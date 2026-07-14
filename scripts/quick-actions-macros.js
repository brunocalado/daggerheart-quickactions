/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Quick Actions Macros
 * Lets the GM curate a macro list (world or compendium macros, added by drag & drop) and exposes it
 * through a "Quick Actions" button injected into the character sheet header. Clicking that button is
 * a shortcut for QuickActions.ShowMacros() over the curated list.
 * Registered from the init hook in main.js.
 */

import {
    MODULE_ID,
    QUICK_ACTIONS_MACROS,
    QUICK_ACTIONS_ENABLED,
    DEFAULT_QUICK_ACTIONS_MACROS,
    DEFAULT_MACRO_IMG
} from "./constants.js";
import { showMacros } from "./apps.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Class used to find (and de-duplicate) the button injected into the sheet header. */
const HEADER_BUTTON_CLASS = "dqa-quick-actions-btn";

/**
 * Reads the curated macro list from world settings.
 * Cloned on the way out: while the setting is untouched, `get` hands back the shared default array.
 * @returns {Array<{uuid: string, name: string, img: string}>} Stored entries, never null.
 */
function getStoredMacros() {
    const stored = game.settings.get(MODULE_ID, QUICK_ACTIONS_MACROS);
    return Array.isArray(stored) ? foundry.utils.deepClone(stored) : [];
}

/**
 * Whether the character sheet "Quick Actions" button is turned on.
 * @returns {boolean} True while the feature is enabled.
 */
function isEnabled() {
    return game.settings.get(MODULE_ID, QUICK_ACTIONS_ENABLED);
}

/**
 * Persists the curated macro list to world settings.
 * @param {Array<{uuid: string, name: string, img: string}>} entries - Entries to store.
 * @returns {Promise<void>}
 */
async function setStoredMacros(entries) {
    await game.settings.set(MODULE_ID, QUICK_ACTIONS_MACROS, entries);
}

/**
 * Re-resolves every stored entry against the live world/compendium data, so renamed or re-imaged
 * macros display their current state and deleted ones can be flagged.
 * @param {Array<{uuid: string, name: string, img: string}>} entries - Stored entries.
 * @returns {Promise<Array<{uuid: string, name: string, img: string, source: string, missing: boolean}>>}
 */
async function resolveMacros(entries) {
    const resolved = [];
    for (const entry of entries) {
        if (!entry?.uuid) continue;

        let doc = null;
        try {
            doc = await fromUuid(entry.uuid);
        } catch (_err) {
            // A disabled or removed compendium makes fromUuid throw — treat it as a missing macro.
        }

        const isCompendium = entry.uuid.startsWith("Compendium.");
        const packTitle = doc?.pack ? game.packs.get(doc.pack)?.title : null;

        resolved.push({
            uuid: entry.uuid,
            name: doc?.name ?? entry.name ?? entry.uuid,
            img: doc?.img ?? entry.img ?? DEFAULT_MACRO_IMG,
            source: packTitle ?? (isCompendium ? "Compendium" : "World"),
            missing: !doc
        });
    }
    return resolved;
}

/**
 * Extracts a Macro uuid from a drag & drop payload, whatever shape Foundry hands us
 * (world macros, hotbar macros and compendium entries all use slightly different data).
 * @param {DragEvent} event - The drop event.
 * @returns {string|null} The dropped macro uuid, or null when the payload is not a Macro.
 */
function getDroppedMacroUuid(event) {
    const TextEditorClass = foundry.applications.ux.TextEditor.implementation ?? foundry.applications.ux.TextEditor;

    let data = null;
    try {
        data = TextEditorClass.getDragEventData(event);
    } catch (_err) {
        return null;
    }
    if (!data || data.type !== "Macro") return null;

    if (data.uuid) return data.uuid;
    if (data.pack && data.id) return `Compendium.${data.pack}.Macro.${data.id}`;
    if (data.id) return `Macro.${data.id}`;
    return null;
}

/**
 * Opens the ShowMacros window with the curated list, resolving names and images first so the
 * window never shows a stale label.
 * Called by the character sheet header button and exposed as QuickActions.QuickActionsMenu().
 * @returns {Promise<void>}
 */
export async function showQuickActionsMacros() {
    const stored = getStoredMacros();
    if (!stored.length) {
        ui.notifications.warn("Quick Actions: no macros configured. A GM can add them in the module settings.");
        return;
    }

    const resolved = await resolveMacros(stored);
    const available = resolved.filter(entry => !entry.missing);
    if (!available.length) {
        ui.notifications.warn("Quick Actions: none of the configured macros could be found.");
        return;
    }

    await showMacros(available.map(({ uuid, name, img }) => ({ uuid, name, img })));
}

/**
 * Settings menu Application where the GM curates the Quick Actions macro list.
 * Macros are added by dragging them in from the Macro directory or from a compendium, and removed
 * with the per-row trash button. Every change is persisted immediately — there is no submit step.
 */
class QuickActionsMacrosApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-quick-actions-macros-app",
        tag: "div",
        classes: ["dh-qa-app", MODULE_ID, "dqa-quick-actions-macros"],
        window: { title: "Quick Actions Macros", icon: "fas fa-bolt", resizable: true },
        position: { width: 480, height: 560 },
        actions: {
            removeMacro: QuickActionsMacrosApp.prototype._onRemoveMacro,
            clearMacros: QuickActionsMacrosApp.prototype._onClearMacros,
            resetMacros: QuickActionsMacrosApp.prototype._onResetMacros,
            previewMacros: QuickActionsMacrosApp.prototype._onPreviewMacros,
            toggleFeature: QuickActionsMacrosApp.prototype._onToggleFeature
        }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/quick-actions-macros.hbs` }
    };

    /**
     * Builds the macro rows shown in the list.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        const macros = await resolveMacros(getStoredMacros());
        return { macros, hasMacros: macros.length > 0, enabled: isEnabled() };
    }

    /**
     * Wires the drag & drop listeners — actions only cover clicks, so the drop zone is bound here.
     * Called from `_onRender`.
     * @param {object} _context - Render context (unused).
     * @param {object} _options - Render options (unused).
     * @returns {void}
     */
    _onRender(_context, _options) {
        const dropZone = this.element.querySelector(".dqa-drop-zone");
        if (!dropZone) return;

        dropZone.addEventListener("dragover", event => {
            event.preventDefault();
            dropZone.classList.add("dqa-dragging");
        });

        dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dqa-dragging"));

        dropZone.addEventListener("drop", async event => {
            event.preventDefault();
            dropZone.classList.remove("dqa-dragging");
            await this._onDropMacro(event);
        });
    }

    /**
     * Validates a dropped payload and appends it to the stored list.
     * Called from the drop listener attached in `_onRender`.
     * @param {DragEvent} event - The drop event.
     * @returns {Promise<void>}
     */
    async _onDropMacro(event) {
        const uuid = getDroppedMacroUuid(event);
        if (!uuid) {
            ui.notifications.warn("Quick Actions: only Macros can be dropped here.");
            return;
        }

        const macro = await fromUuid(uuid);
        if (!macro || macro.documentName !== "Macro") {
            ui.notifications.warn("Quick Actions: that macro could not be resolved.");
            return;
        }

        const stored = getStoredMacros();
        if (stored.some(entry => entry.uuid === uuid)) {
            ui.notifications.info(`Quick Actions: "${macro.name}" is already on the list.`);
            return;
        }

        stored.push({ uuid, name: macro.name, img: macro.img ?? DEFAULT_MACRO_IMG });
        await setStoredMacros(stored);
        this.render();
    }

    /**
     * Removes a single macro from the list.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked element carrying `data-uuid`.
     * @returns {Promise<void>}
     */
    async _onRemoveMacro(_event, target) {
        const uuid = target.dataset.uuid;
        await setStoredMacros(getStoredMacros().filter(entry => entry.uuid !== uuid));
        this.render();
    }

    /**
     * Empties the list after confirmation.
     * @returns {Promise<void>}
     */
    async _onClearMacros() {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Quick Actions Macros" },
            content: "<p>Remove every macro from the Quick Actions list?</p>",
            modal: true
        });
        if (!confirmed) return;

        await setStoredMacros([]);
        this.render();
    }

    /**
     * Replaces the list with the macros the module ships with, discarding any customization.
     * @returns {Promise<void>}
     */
    async _onResetMacros() {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Quick Actions Macros" },
            content: "<p>Replace the current list with the module's default macros?</p>",
            modal: true
        });
        if (!confirmed) return;

        await setStoredMacros(DEFAULT_QUICK_ACTIONS_MACROS.map(entry => ({ ...entry })));
        this.render();
    }

    /**
     * Opens the Quick Actions window so the GM can check the list without leaving the settings.
     * @returns {Promise<void>}
     */
    async _onPreviewMacros() {
        await showQuickActionsMacros();
    }

    /**
     * Turns the whole feature on or off. The setting's onChange adds or removes the button on every
     * character sheet that is already open, on every client.
     * @returns {Promise<void>}
     */
    async _onToggleFeature() {
        await game.settings.set(MODULE_ID, QUICK_ACTIONS_ENABLED, !isEnabled());
        this.render();
    }
}

/**
 * Registers the macro list setting and its settings-menu button.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function registerQuickActionsMacrosSettings() {
    game.settings.register(MODULE_ID, QUICK_ACTIONS_MACROS, {
        name: "Quick Actions Macros",
        scope: "world",
        config: false,
        type: Array,
        default: DEFAULT_QUICK_ACTIONS_MACROS.map(entry => ({ ...entry }))
    });

    game.settings.register(MODULE_ID, QUICK_ACTIONS_ENABLED, {
        name: "Quick Actions Button",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        onChange: refreshHeaderButtons
    });

    game.settings.registerMenu(MODULE_ID, "quickActionsMacrosMenu", {
        name: "Quick Actions Macros",
        label: "Configure Quick Actions",
        hint: "Choose the macros listed by the \"Quick Actions\" button on character sheets. Drag macros in from the Macro directory or a compendium.",
        icon: "fas fa-bolt",
        type: QuickActionsMacrosApp,
        restricted: true
    });
}

/**
 * Subscribes to the character sheet render hook that injects the header button.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function initQuickActionsButton() {
    Hooks.on("renderCharacterSheet", onRenderCharacterSheet);
}

/**
 * Injects the "Quick Actions" button into the character sheet window header, immediately before the
 * controls (three dots) button — or removes it again once the feature is turned off.
 *
 * The AppV2 window frame is built once and survives re-renders, so the button is only added when it
 * is not already there.
 *
 * @param {foundry.applications.api.ApplicationV2} _app - The rendered character sheet (unused).
 * @param {HTMLElement} element - The sheet's root element.
 * @returns {void}
 */
function onRenderCharacterSheet(_app, element) {
    const header = element.querySelector(".window-header");
    if (!header) return;

    const existing = header.querySelector(`.${HEADER_BUTTON_CLASS}`);
    if (!isEnabled()) {
        existing?.remove();
        return;
    }
    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `header-control ${MODULE_ID} ${HEADER_BUTTON_CLASS}`;
    button.setAttribute("aria-label", "Quick Actions");
    button.innerHTML = `<i class="fa-solid fa-bolt"></i><span>Quick Actions</span>`;

    // The header is inside the sheet's own click delegation; stop the event so it cannot bubble
    // into the sheet's action handling or start a window drag.
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        showQuickActionsMacros();
    });

    const controlsToggle = header.querySelector('[data-action="toggleControls"]');
    if (controlsToggle) header.insertBefore(button, controlsToggle);
    else header.appendChild(button);
}

/**
 * Adds or removes the header button on every character sheet that is already open, so toggling the
 * feature takes effect without reopening sheets.
 * Runs on every client through the QUICK_ACTIONS_ENABLED onChange callback (it is a world setting).
 * @returns {void}
 */
function refreshHeaderButtons() {
    for (const app of foundry.applications.instances.values()) {
        if (!app.rendered) continue;
        if (app.document?.documentName !== "Actor" || app.document.type !== "character") continue;
        onRenderCharacterSheet(app, app.element);
    }
}
