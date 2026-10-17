/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Daggerheart Quick Actions
 * Main module that injects buttons into the menu and exposes the global API.
 */

import { MODULE_ID, DOWNTIME_DISABLED_USERS, HOPE_BAR_ENABLED, TOKEN_TOOLTIP_ENABLED } from "./constants.js";

// Import all functions from consolidated files
import { activateDowntime, activateFallingDamage, helpAnAlly, scarCheck, activateLootConsumable, activateCustomTables, spotlightToken, showMacros, fateRoll, activateSpendHope, activateLevelUp } from "./apps.js";
import { activateTemplateCreator } from "./template-creator.js";
import { activateDowntimeUI, getDowntimeUIInstance, openDowntimeUIForPlayer } from "./downtime_ui.js";
import { activateRequestRoll, showCinematicPrompt } from "./request_roll.js";
// Import Whisper (send a plain-text private message to selected connected users)
import { activateWhisper } from "./whisper.js";
// Import Barter (peer-to-peer item and currency trading between two linked characters)
import { activateBarter, registerBarter } from "./barter.js";
// Import Scan
import { scan } from "./scan.js";
// Import Features
import { features, registerChainLightning } from "./features.js";
// Import Token Tooltip
import { initTokenTooltip } from "./token-tooltip.js";
// Import Hope Bar (Hope diamonds drawn above character tokens on the canvas)
import { initHopeBar, refreshHopeBars } from "./hope-bar.js";
// Import Scan Settings
import { registerScanSettings } from "./scan-settings.js";
// Import Falling Damage Settings
import { registerFallingDamageSettings } from "./falling-damage-settings.js";
// Import Coin Tier Settings
import { registerLootConsumableSettings } from "./loot-consumable-settings.js";
// Import Custom Tables (GM-curated roll tables for the Custom Tables roller)
import { registerCustomTablesSettings } from "./custom-tables-settings.js";
// Import Quick Actions macro list (settings menu + character sheet header button)
import { registerQuickActionsMacrosSettings, initQuickActionsButton, showQuickActionsMacros } from "./quick-actions-macros.js";
// Import Cinematic Roll Images (settings menu for the Request Roll cinematic prompt images)
import { registerCinematicImagesSettings } from "./cinematic-images-settings.js";
// Import Light Sources module integration
import { registerLightSources } from "./light-sources-integration.js";
// Import Daggerheart Menu Enhancer (search, ordering and collapsible sections for the system's GM menu)
import { initDaggerheartMenuEnhancer } from "./daggerheart-menu-enhancer.js";
// Import Interface Settings (single window for every UI change this module makes)
import { registerUISettings } from "./ui-settings.js";

// ==================================================================
// GLOBAL API
// ==================================================================
Hooks.once("init", () => {
    // 1. Downtime Setting
    game.settings.register(MODULE_ID, "downtimePCs", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimePCs.name",
        scope: "world",
        config: false,
        type: Number,
        default: 4
    });

    // 2. Cinematic Request Synchronization (Force Open Logic)
    game.settings.register(MODULE_ID, "cinematicRequest", {
        name: "DH_QUICKACTIONS.SETTINGS.cinematicRequest.name",
        scope: "world",     // Synchronizes between all clients
        config: false,      // Invisible in menu
        default: {},
        type: Object,
        onChange: (value) => {
            // This function runs on ALL connected clients when the value changes
            if (!value || !value.timestamp) return;

            // Verificação de tempo removida para evitar problemas com relógios dessincronizados.
            // O evento onChange nativo do Foundry já previne execução no carregamento (F5).

            // Support new targetIds array and legacy targetId string
            // Empty targetIds (or legacy empty targetId) means broadcast to all
            const targetIds = value.targetIds ?? (value.targetId ? [value.targetId] : []);
            const isTarget = targetIds.length === 0 || targetIds.includes(game.user.id);

            if (isTarget) {
                if (value.data?.type === "loot") {
                    if (!game.user.isGM) activateLootConsumable();
                } else {
                    showCinematicPrompt(value.data);
                }
            }
        }
    });

    // 5. Global craft entries (shared across all actors)
    game.settings.register(MODULE_ID, "downtimeCraftEntries", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeCraftEntries.name",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 5b. Global custom moves (shared across all actors)
    game.settings.register(MODULE_ID, "downtimeCustomMoves", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeCustomMoves.name",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 5c. Global item move entries (shared across all actors)
    game.settings.register(MODULE_ID, "downtimeItemMoveEntries", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeItemMoveEntries.name",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 5d. Core feature entries (e.g. Efficient)
    game.settings.register(MODULE_ID, "downtimeCoreFeatures", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeCoreFeatures.name",
        scope: "world",
        config: false,
        default: [
            { key: "efficient", itemUuid: "Compendium.daggerheart.ancestries.Item.2xlqKOkDxWHbuj4t" },
            { key: "forager", itemUuid: "Compendium.daggerheart.domains.Item.06UapZuaA5S6fAKl" }
        ],
        type: Array
    });

    // 5e. Users switched off in the Downtime config — never take part in downtime
    game.settings.register(MODULE_ID, DOWNTIME_DISABLED_USERS, {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeDisabledUsers.name",
        scope: "world",
        config: false,
        default: [],
        type: Array,
        onChange: (value) => {
            const inst = getDowntimeUIInstance();
            if (!inst?.rendered) return;
            // A player who was just switched off must lose the window entirely.
            if (!game.user.isGM && (value ?? []).includes(game.user.id)) {
                inst.close();
                return;
            }
            inst._debouncedRender();
        }
    });

    // 6a. Persistent per-actor downtime configs (modifiers, maxChoices)
    game.settings.register(MODULE_ID, "shortRestCount", {
        name: "DH_QUICKACTIONS.SETTINGS.shortRestCount.name",
        scope: "world",
        config: false,
        type: Number,
        default: 0
    });

    game.settings.register(MODULE_ID, "downtimeActorConfigs", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeActorConfigs.name",
        scope: "world",
        config: false,
        default: {},
        type: Object
    });

    // 6b. Downtime UI State (player choices, GM config)
    game.settings.register(MODULE_ID, "downtimeUIState", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeUIState.name",
        scope: "world",
        config: false,
        default: {},
        type: Object,
        onChange: (value) => {
            if (!value?.timestamp) return;
            // Removed timestamp check to avoid clock sync issues
            const inst = getDowntimeUIInstance();
            if (inst?.rendered) inst._debouncedRender();
        }
    });

    // 7. Downtime UI Open Broadcast
    game.settings.register(MODULE_ID, "downtimeUIOpen", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeUIOpen.name",
        scope: "world",
        config: false,
        default: {},
        type: Object,
        onChange: (value) => {
            if (!value?.timestamp) return;
            // Removed timestamp check to avoid clock sync issues
            if (game.user.isGM) return;
            openDowntimeUIForPlayer();
        }
    });

    // 7b. Downtime UI Close Broadcast
    game.settings.register(MODULE_ID, "downtimeUIClosed", {
        name: "DH_QUICKACTIONS.SETTINGS.downtimeUIClosed.name",
        scope: "world",
        config: false,
        default: {},
        type: Object,
        onChange: (value) => {
            if (!value?.timestamp) return;
            if (game.user.isGM) return;
            const inst = getDowntimeUIInstance();
            if (inst?.rendered) inst.close();
        }
    });

    // 8. Token Hover Tooltip
    // Edited from the Interface Settings window (ui-settings.js).
    game.settings.register(MODULE_ID, TOKEN_TOOLTIP_ENABLED, {
        name: "DH_QUICKACTIONS.SETTINGS.tokenTooltip.name",
        hint: "DH_QUICKACTIONS.SETTINGS.tokenTooltip.hint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    // 8b. Token Tooltip Size
    game.settings.register(MODULE_ID, "tokenTooltipSize", {
        name: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.name",
        hint: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.hint",
        scope: "client",
        config: true,
        type: String,
        default: "normal",
        choices: {
            small: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.choices.small",
            normal: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.choices.normal",
            large: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.choices.large",
            xlarge: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.choices.xlarge",
            xxlarge: "DH_QUICKACTIONS.SETTINGS.tokenTooltipSize.choices.xxlarge"
        }
    });

    // 8c. Hope Bar — edited from the Interface Settings window (ui-settings.js).
    game.settings.register(MODULE_ID, HOPE_BAR_ENABLED, {
        name: "DH_QUICKACTIONS.SETTINGS.hopeBarEnabled.name",
        hint: "DH_QUICKACTIONS.SETTINGS.hopeBarEnabled.hint",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
        onChange: () => refreshHopeBars()
    });

    registerScanSettings();
    registerFallingDamageSettings();
    registerLootConsumableSettings();
    registerCustomTablesSettings();
    registerQuickActionsMacrosSettings();
    registerCinematicImagesSettings();
    initTokenTooltip();
    initHopeBar();
    initQuickActionsButton();
    initDaggerheartMenuEnhancer();
    registerChainLightning();
    // After the features that own the settings it edits — their registration must come first.
    registerUISettings();
    registerBarter();

    globalThis.QuickActions = {
        Downtime: activateDowntime,
        FallingDamage: activateFallingDamage,
        RequestRoll: activateRequestRoll,
        Whisper: activateWhisper,
        Barter: activateBarter,
        HelpAnAlly: helpAnAlly,
        ScarCheck: scarCheck,
        LootConsumable: activateLootConsumable,
        CustomTables: activateCustomTables,
        SpotlightToken: spotlightToken,
        ShowMacros: showMacros,
        QuickActionsMenu: showQuickActionsMacros,
        Fate: fateRoll,
        SpendHope: activateSpendHope, 
        Templates: activateTemplateCreator,
        LevelUp: activateLevelUp,
        Scan: scan,
        Features: features,
        DowntimeUI: activateDowntimeUI
    };
    console.log("Daggerheart Quick Actions | Global API Registered: QuickActions");
});

// ==================================================================
// READY HOOK: AUTOMATION
// ==================================================================
Hooks.on("ready", async () => {
    // Register this module's compendium light sources with the Light Sources module, if active.
    registerLightSources();

    // Re-render DowntimeUI when any user's flags change (player choices via setFlag)
    Hooks.on("updateUser", (user, change) => {
        if (change?.flags?.[MODULE_ID]?.downtimeChoices !== undefined ||
            change?.flags?.[MODULE_ID]?.["-=downtimeChoices"] !== undefined) {
            const inst = getDowntimeUIInstance();
            if (inst?.rendered) inst._debouncedRender();
        }
    });
});

// ==================================================================
// PARTY SHEET HOOK — Replace rest buttons with Downtime button (GM only)
// ==================================================================
Hooks.on("renderPartySheet", (app, html) => {
    // Always remove Short Rest and Long Rest buttons — this module replaces them
    html.querySelectorAll('button[data-action="triggerRest"]').forEach(btn => btn.remove());

    if (!game.user.isGM) return;
    if (html.querySelector(".dqa-downtime-party-btn")) return;

    const actionsSection = html.querySelector(".actions-section");
    if (!actionsSection) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dqa-downtime-party-btn");
    btn.innerHTML = `<i class="fa-solid fa-moon"></i><span>${game.i18n.localize("DAGGERHEART.GENERAL.downtime")}</span>`;

    btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        activateDowntimeUI();
    });

    actionsSection.appendChild(btn);
});

// ==================================================================
// RENDER MENU HOOK
// ==================================================================
Hooks.on("renderDaggerheartMenu", (app, element, data) => {

    const buttonDefs = [
        { icon: "fa-bed", label: "DH_QUICKACTIONS.MENU.downtime", onClick: activateDowntimeUI },
        { icon: "fa-skull-crossbones", label: "DH_QUICKACTIONS.MENU.fallDamage", onClick: activateFallingDamage },
        { icon: "fa-dice-d20", label: "DH_QUICKACTIONS.MENU.requestRoll", onClick: activateRequestRoll },
        { icon: "fa-arrow-up", label: "DH_QUICKACTIONS.MENU.levelUp", onClick: activateLevelUp }
    ];

    const newFieldset = document.createElement("fieldset");
    newFieldset.classList.add(MODULE_ID, "dqa-menu-quick-actions-grid");

    const legend = document.createElement("legend");
    legend.innerText = game.i18n.localize("DH_QUICKACTIONS.MENU.quickActions");
    newFieldset.appendChild(legend);

    for (const { icon, label, onClick } of buttonDefs) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerHTML = `<i class="fas ${icon}"></i> ${game.i18n.localize(label)}`;
        btn.classList.add("dh-custom-btn", "dqa-menu-grid-btn");
        btn.onclick = onClick;
        newFieldset.appendChild(btn);
    }

    // Insertion into DOM (Sidebar). Placement doesn't matter here — the menu enhancer
    // (daggerheart-menu-enhancer.js) reorders every fieldset in the menu right after this.
    const fieldset = element.querySelector("fieldset");
    if (fieldset) fieldset.after(newFieldset);
    else element.appendChild(newFieldset);

    // This module's Falling Damage button always replaces the system's built-in one.
    element.querySelector('[data-action="createFallCollisionDamage"]')?.closest('fieldset')?.remove();

    // The system's "Downtime Fear" section (Daggerheart 2.9.1+) is superseded by this
    // module's own Downtime UI, which handles rest/downtime fear generation itself.
    element.querySelector('[data-action="rollDowntimeFear"]')?.closest('fieldset')?.remove();
});