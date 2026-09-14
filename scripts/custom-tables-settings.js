/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Custom Tables Settings Module
 * Lets the GM curate the roll tables QuickActions.CustomTables() draws from, added by drag & drop
 * from the Rollable Tables directory or from any compendium.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID, CUSTOM_TABLES } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** @returns {Array<{uuid: string, label: string}>} The stored table list. */
function getStoredTables() {
    const stored = game.settings.get(MODULE_ID, CUSTOM_TABLES);
    return Array.isArray(stored) ? stored : [];
}

/**
 * Persists the table list.
 * @param {Array<{uuid: string, label: string}>} tables - The list to store.
 * @returns {Promise<void>}
 */
async function setStoredTables(tables) {
    await game.settings.set(MODULE_ID, CUSTOM_TABLES, tables);
}

/**
 * Extracts a RollTable uuid from a drag & drop payload, whatever shape Foundry hands us
 * (world tables and compendium entries use slightly different data).
 * @param {DragEvent} event - The drop event.
 * @returns {string|null} The dropped table uuid, or null when the payload is not a RollTable.
 */
function getDroppedTableUuid(event) {
    const TextEditorClass = foundry.applications.ux.TextEditor.implementation ?? foundry.applications.ux.TextEditor;

    let data = null;
    try {
        data = TextEditorClass.getDragEventData(event);
    } catch (_err) {
        return null;
    }
    if (!data || data.type !== "RollTable") return null;

    if (data.uuid) return data.uuid;
    if (data.pack && data.id) return `Compendium.${data.pack}.RollTable.${data.id}`;
    if (data.id) return `RollTable.${data.id}`;
    return null;
}

/**
 * Menu Application configuring the Custom Tables roller.
 * Triggered via the settings menu button registered in registerCustomTablesSettings().
 */
class CustomTablesSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-custom-tables-settings-app",
        tag: "form",
        classes: [MODULE_ID, "custom-tables-settings"],
        window: { title: "Custom Tables Configuration", icon: "fas fa-dice-d20", resizable: true },
        position: { width: 520, height: "auto" },
        actions: {
            removeTable: CustomTablesSettingsApp.prototype._onRemoveTable,
            clearTables: CustomTablesSettingsApp.prototype._onClearTables
        }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/custom-tables-settings.hbs` }
    };

    /**
     * Prepares context data for the template, resolving each stored uuid so a table that was
     * deleted or whose compendium is gone is shown as missing rather than silently listed.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        const stored = getStoredTables();
        const tables = [];
        for (const entry of stored) {
            const doc = await fromUuid(entry.uuid).catch(() => null);
            tables.push({
                uuid: entry.uuid,
                // The live name wins while the table resolves, so a rename shows up here without
                // the GM having to remove and re-add it.
                label: doc?.name ?? entry.label,
                results: doc?.results?.size ?? 0,
                missing: !doc
            });
        }
        return { tables, hasTables: tables.length > 0 };
    }

    /**
     * Wires the drag & drop listeners — actions only cover clicks, so the drop zone is bound here.
     * Called from the AppV2 render lifecycle.
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
            await this._onDropTable(event);
        });
    }

    /**
     * Validates a dropped payload and appends it to the stored list.
     * Called from the drop listener attached in `_onRender`.
     * @param {DragEvent} event - The drop event.
     * @returns {Promise<void>}
     */
    async _onDropTable(event) {
        const uuid = getDroppedTableUuid(event);
        if (!uuid) {
            ui.notifications.warn("Quick Actions: only Rollable Tables can be dropped here.");
            return;
        }

        const table = await fromUuid(uuid);
        if (!table || table.documentName !== "RollTable") {
            ui.notifications.warn("Quick Actions: that table could not be resolved.");
            return;
        }

        const stored = getStoredTables();
        if (stored.some(entry => entry.uuid === uuid)) {
            ui.notifications.info(`Quick Actions: "${table.name}" is already on the list.`);
            return;
        }

        stored.push({ uuid, label: table.name });
        await setStoredTables(stored);
        this.render();
    }

    /**
     * Removes a single table from the list.
     * Triggered by `data-action="removeTable"`.
     * @param {PointerEvent} event - Click event.
     * @param {HTMLElement} target - The clicked button, carrying data-uuid.
     * @returns {Promise<void>}
     */
    async _onRemoveTable(event, target) {
        const uuid = target.dataset.uuid;
        await setStoredTables(getStoredTables().filter(entry => entry.uuid !== uuid));
        this.render();
    }

    /**
     * Empties the list.
     * Triggered by `data-action="clearTables"`.
     * @returns {Promise<void>}
     */
    async _onClearTables() {
        await setStoredTables([]);
        this.render();
    }
}

/**
 * Registers the stored table list and the settings menu button that edits it.
 * Called from the init hook in main.js.
 */
export function registerCustomTablesSettings() {
    // Edited through the menu below rather than as a standalone field — the value is a list of
    // dropped documents, which no stock setting control can render.
    game.settings.register(MODULE_ID, CUSTOM_TABLES, {
        scope: "world",
        config: false,
        type: Array,
        default: []
    });

    game.settings.registerMenu(MODULE_ID, "customTablesSettingsMenu", {
        name: "Custom Tables Configuration",
        label: "Configure Custom Tables",
        hint: "Pick the roll tables the Custom Tables roller draws from. Each table is rolled with its own formula.",
        icon: "fas fa-dice-d20",
        type: CustomTablesSettingsApp,
        restricted: true
    });
}
