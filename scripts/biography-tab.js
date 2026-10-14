/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Biography Tab Visibility
 * Lets the GM hide the Biography tab on character sheets for everyone in the world.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID, HIDE_BIOGRAPHY_TAB } from "./constants.js";

/** Tab group declared by the system's CharacterSheet.TABS. */
const TAB_GROUP = "primary";

/** Id of the tab this feature hides — matches the system's PARTS/TABS entry. */
const BIOGRAPHY_TAB = "biography";

/** Tab activated when Biography is hidden while active — the system's TABS.primary.initial. */
const FALLBACK_TAB = "features";

/**
 * Registers the world setting. It is `config: false` — it is edited from the Interface Settings
 * window (ui-settings.js), where this module's GM-facing UI switches are collected.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function registerBiographyTabSettings() {
    game.settings.register(MODULE_ID, HIDE_BIOGRAPHY_TAB, {
        name: "DH_QUICKACTIONS.SETTINGS.hideBiographyTab.name",
        hint: "DH_QUICKACTIONS.SETTINGS.hideBiographyTab.hint",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: refreshCharacterSheets
    });
}

/**
 * Subscribes to the character sheet render hook.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function initBiographyTab() {
    Hooks.on("renderCharacterSheet", onRenderCharacterSheet);
}

/**
 * Re-renders every open character sheet so a setting change applies without reopening them.
 * Runs on each client via the settings onChange callback (world settings notify all clients).
 * @returns {void}
 */
function refreshCharacterSheets() {
    for (const app of foundry.applications.instances.values()) {
        if (app.rendered && app.document?.documentName === "Actor" && app.document.type === "character") app.render();
    }
}

/**
 * Hides the Biography tab entry and its content section on the Daggerheart character sheet.
 * The elements are hidden rather than removed so a later re-render restores them in place.
 *
 * @param {foundry.applications.api.ApplicationV2} app - The rendered character sheet.
 * @param {HTMLElement} element - The sheet's root element.
 * @returns {void}
 */
function onRenderCharacterSheet(app, element) {
    if (!game.settings.get(MODULE_ID, HIDE_BIOGRAPHY_TAB)) return;

    // Absent on the limited-permission sheet, which renders no tab navigation at all.
    const nav = element.querySelector(`nav.tabs[data-group="${TAB_GROUP}"]`);
    if (!nav) return;

    // A hidden section that stays active would leave the sheet body blank.
    if (app.tabGroups?.[TAB_GROUP] === BIOGRAPHY_TAB) app.changeTab(FALLBACK_TAB, TAB_GROUP);

    const tabLink = nav.querySelector(`[data-tab="${BIOGRAPHY_TAB}"]`);
    if (tabLink) tabLink.style.display = "none";

    const tabSection = element.querySelector(`[data-application-part="${BIOGRAPHY_TAB}"]`);
    if (tabSection) tabSection.style.display = "none";
}
