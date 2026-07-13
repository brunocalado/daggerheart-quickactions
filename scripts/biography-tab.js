/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Biography Tab Visibility
 * Lets each user hide the Biography tab on character sheets, while the GM keeps a world-level
 * policy that can either respect that choice or force the tab visible/hidden for everyone.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID, BIOGRAPHY_SETTINGS, BIOGRAPHY_POLICY } from "./constants.js";

/** Tab group declared by the system's CharacterSheet.TABS. */
const TAB_GROUP = "primary";

/** Id of the tab this feature hides — matches the system's PARTS/TABS entry. */
const BIOGRAPHY_TAB = "biography";

/** Tab activated when Biography is hidden while active — the system's TABS.primary.initial. */
const FALLBACK_TAB = "features";

/**
 * Registers the world policy and the per-user opt-out.
 * Called from the init hook in main.js.
 * @returns {void}
 */
export function registerBiographyTabSettings() {
    game.settings.register(MODULE_ID, BIOGRAPHY_SETTINGS.POLICY, {
        name: "Biography Tab Visibility",
        hint: "Controls the Biography tab on character sheets for the whole world. \"Each user decides\" honors every user's own \"Hide Biography Tab\" setting.",
        scope: "world",
        config: true,
        type: String,
        default: BIOGRAPHY_POLICY.USER,
        choices: {
            [BIOGRAPHY_POLICY.USER]: "Each user decides",
            [BIOGRAPHY_POLICY.VISIBLE]: "Always visible for everyone",
            [BIOGRAPHY_POLICY.HIDDEN]: "Always hidden for everyone"
        },
        onChange: refreshCharacterSheets
    });

    game.settings.register(MODULE_ID, BIOGRAPHY_SETTINGS.HIDE, {
        name: "Hide Biography Tab",
        hint: "Hides the Biography tab on character sheets for you only. Ignored while the GM forces the tab visible or hidden for everyone.",
        scope: "client",
        config: true,
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
 * Resolves whether the Biography tab must be hidden for the current user right now.
 * @returns {boolean} True when the tab should not be reachable on character sheets.
 */
function isBiographyHidden() {
    const policy = game.settings.get(MODULE_ID, BIOGRAPHY_SETTINGS.POLICY);
    if (policy === BIOGRAPHY_POLICY.HIDDEN) return true;
    if (policy === BIOGRAPHY_POLICY.VISIBLE) return false;
    return game.settings.get(MODULE_ID, BIOGRAPHY_SETTINGS.HIDE);
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
    if (!isBiographyHidden()) return;

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
