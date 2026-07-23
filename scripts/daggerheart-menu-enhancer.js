/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Daggerheart Menu Enhancer
 * The Daggerheart system's own sidebar menu ("GM Tools", fired via the renderDaggerheartMenu
 * hook) is a shared surface: every installed module that hooks it appends its own <fieldset>
 * to the same element. With many modules installed the menu grows into a long, unordered list
 * that is hard to scan. This file adds a search/filter bar, deterministic fieldset ordering,
 * and persisted collapsible sections on top of that shared menu — without touching any other
 * module's code.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID, MENU_COLLAPSED_SECTIONS } from "./constants.js";

/** Legend text of the system's own built-in section, always pinned first. */
const PINNED_LEGEND = "Refresh Features";

/**
 * Registers the collapsed-state setting and subscribes to the menu's render hook.
 * Called once from the init hook in main.js.
 * @returns {void}
 */
export function initDaggerheartMenuEnhancer() {
    game.settings.register(MODULE_ID, MENU_COLLAPSED_SECTIONS, {
        scope: "client",
        config: false,
        type: Object,
        default: {}
    });

    Hooks.on("renderDaggerheartMenu", (app, element) => {
        // Deferred to the next frame so every other module's own renderDaggerheartMenu
        // callback (synchronous DOM builders, same as this one) has already appended its
        // fieldset before we sort/decorate the menu. Modules that insert their fieldset
        // asynchronously would simply miss this pass until the menu is reopened.
        requestAnimationFrame(() => enhanceMenu(element));
    });

    // The menu's sidebar tab button is rebuilt whenever the sidebar re-renders, so re-apply
    // the skull swap on every render. Also runs once on ready for the initial sidebar already
    // present before this hook was registered.
    Hooks.on("renderSidebar", (app, element) => swapMenuTabIcon(element));
    Hooks.once("ready", () => {
        if (ui.sidebar?.element) swapMenuTabIcon(ui.sidebar.element);
    });
}

/**
 * Replaces the Daggerheart menu sidebar tab's FoundryBorne logo image with a purple skull icon.
 * The tab button belongs to the system's sidebar navigation, so this is called on every sidebar
 * render. Idempotent: it no-ops once the skull is already in place.
 * @param {HTMLElement} element - Root element of the rendered sidebar.
 * @returns {void}
 */
function swapMenuTabIcon(element) {
    const button = element.querySelector('button[data-action="tab"][data-tab="daggerheartMenu"]');
    if (!button || button.querySelector(".dqa-menu-tab-skull")) return;

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-skull dqa-menu-tab-skull";

    const img = button.querySelector("img");
    if (img) img.replaceWith(icon);
    else button.appendChild(icon);
}

/**
 * Reorganizes the shared Daggerheart menu: adds a search/filter toolbar, pins the system's
 * "Refresh Features" section first with the rest sorted alphabetically, and makes every
 * fieldset collapsible with per-user persisted state.
 *
 * All structural DOM operations (moving/inserting nodes) happen on the fieldsets' own parent —
 * NOT on `element` itself. The system's own template (daggerheart-menu/main.hbs) wraps the
 * heading and fieldsets in their own inner <div>, itself nested inside `element` (the tab's
 * root section). Moving fieldsets relative to `element` would rip them out of that inner
 * wrapper into the tab's root layout, which has its own overflow/sizing rules — that DOM
 * container is not built to hold raw <fieldset> children and hides them.
 *
 * @param {HTMLElement} element - Root element of the rendered Daggerheart menu (used only as a
 *   CSS scope class — never as a parent for inserting or moving nodes).
 * @returns {void}
 */
function enhanceMenu(element) {
    element.classList.add(MODULE_ID);

    const fieldsets = Array.from(element.querySelectorAll("fieldset"));
    if (!fieldsets.length) return;

    const container = fieldsets[0].parentElement;

    sortFieldsets(container, fieldsets);
    makeCollapsible(fieldsets);
    ensureToolbar(container, element, fieldsets);
}

/**
 * Reorders fieldsets in place: the pinned system section first, everything else alphabetically
 * by legend text. Re-appending existing nodes (within their own parent) moves them without
 * cloning, losing listeners, or relocating them to a different container.
 * @param {HTMLElement} container - The fieldsets' actual parent element.
 * @param {HTMLElement[]} fieldsets - Every fieldset currently in the menu.
 * @returns {void}
 */
function sortFieldsets(container, fieldsets) {
    const sorted = [...fieldsets].sort((a, b) => {
        const aPinned = legendText(a) === PINNED_LEGEND;
        const bPinned = legendText(b) === PINNED_LEGEND;
        if (aPinned !== bPinned) return aPinned ? -1 : 1;
        return legendText(a).localeCompare(legendText(b));
    });

    for (const fieldset of sorted) container.appendChild(fieldset);
}

/**
 * Wires click-to-collapse behavior on every fieldset's legend and restores each section's
 * persisted collapsed state for the current user.
 * @param {HTMLElement[]} fieldsets - Every fieldset currently in the menu.
 * @returns {void}
 */
function makeCollapsible(fieldsets) {
    const collapsed = game.settings.get(MODULE_ID, MENU_COLLAPSED_SECTIONS);

    for (const fieldset of fieldsets) {
        const legend = fieldset.querySelector("legend");
        if (!legend || fieldset.dataset.dqaEnhanced) continue;
        fieldset.dataset.dqaEnhanced = "1";

        legend.classList.add("dqa-collapsible-legend");
        const key = slugify(legendText(fieldset));

        if (collapsed[key]) fieldset.classList.add("dqa-collapsed");

        legend.addEventListener("click", () => {
            fieldset.classList.toggle("dqa-collapsed");
            const state = game.settings.get(MODULE_ID, MENU_COLLAPSED_SECTIONS);
            state[key] = fieldset.classList.contains("dqa-collapsed");
            game.settings.set(MODULE_ID, MENU_COLLAPSED_SECTIONS, state);
        });
    }
}

/**
 * Injects the search/filter toolbar right after the menu's heading, if not already present.
 * @param {HTMLElement} container - The fieldsets' actual parent element (also holds the <h2>).
 * @param {HTMLElement} element - Root element of the rendered Daggerheart menu, used only to
 *   guard against inserting the toolbar twice on the same render.
 * @param {HTMLElement[]} fieldsets - Every fieldset currently in the menu.
 * @returns {void}
 */
function ensureToolbar(container, element, fieldsets) {
    if (element.querySelector(".dqa-menu-toolbar")) return;

    const toolbar = document.createElement("div");
    toolbar.classList.add("dqa-menu-toolbar");
    toolbar.innerHTML = `
        <input type="search" class="dqa-menu-search" placeholder="Search...">
        <button type="button" class="dqa-menu-collapse-all"><i class="fas fa-compress"></i></button>
        <button type="button" class="dqa-menu-expand-all"><i class="fas fa-expand"></i></button>
    `;

    toolbar.querySelector(".dqa-menu-search").addEventListener("input", (e) => {
        filterFieldsets(fieldsets, e.target.value.trim().toLowerCase());
    });

    toolbar.querySelector(".dqa-menu-collapse-all").addEventListener("click", () => {
        setAllCollapsed(fieldsets, true);
    });

    toolbar.querySelector(".dqa-menu-expand-all").addEventListener("click", () => {
        setAllCollapsed(fieldsets, false);
    });

    // The system's own "GM Tools" heading just repeats what the sidebar tab icon already
    // says and wastes vertical space — tag it so CSS can hide it and reclaim that space.
    const heading = container.querySelector(":scope > h2");
    if (heading) {
        heading.classList.add("dqa-menu-heading");
        heading.insertAdjacentElement("afterend", toolbar);
    } else {
        container.insertBefore(toolbar, container.firstChild);
    }
}

/**
 * Shows or hides each fieldset depending on whether its legend or any of its buttons/labels
 * match the given query. An empty query shows every fieldset again. A matching fieldset that
 * is collapsed is also visually forced open (its persisted collapsed state is untouched) so
 * the GM sees the result immediately instead of having to click it open after finding it.
 * @param {HTMLElement[]} fieldsets - Every fieldset currently in the menu.
 * @param {string} query - Lowercased search text.
 * @returns {void}
 */
function filterFieldsets(fieldsets, query) {
    for (const fieldset of fieldsets) {
        const matches = !query || fieldset.textContent.toLowerCase().includes(query);
        fieldset.classList.toggle("dqa-search-hidden", !matches);
        fieldset.classList.toggle("dqa-search-expanded", Boolean(query) && matches);
    }
}

/**
 * Collapses or expands every fieldset and persists the new state for the current user.
 * @param {HTMLElement[]} fieldsets - Every fieldset currently in the menu.
 * @param {boolean} value - True to collapse all, false to expand all.
 * @returns {void}
 */
function setAllCollapsed(fieldsets, value) {
    const state = game.settings.get(MODULE_ID, MENU_COLLAPSED_SECTIONS);

    for (const fieldset of fieldsets) {
        fieldset.classList.toggle("dqa-collapsed", value);
        state[slugify(legendText(fieldset))] = value;
    }

    game.settings.set(MODULE_ID, MENU_COLLAPSED_SECTIONS, state);
}

/**
 * Reads a fieldset's legend text.
 * @param {HTMLElement} fieldset - The fieldset to read.
 * @returns {string} The legend's text content, or an empty string if absent.
 */
function legendText(fieldset) {
    return fieldset.querySelector("legend")?.textContent?.trim() ?? "";
}

/**
 * Turns arbitrary legend text into a stable, collision-safe settings key.
 * @param {string} text - Text to slugify.
 * @returns {string} Lowercased, hyphen-separated slug.
 */
function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
