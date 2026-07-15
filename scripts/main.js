/**
 * Daggerheart Quick Actions
 * Main module that injects buttons into the menu and exposes the global API.
 */

import { MODULE_ID } from "./constants.js";

// Import all functions from consolidated files
import { activateDowntime, activateFallingDamage, helpAnAlly, scarCheck, activateLootConsumable, spotlightToken, showMacros, fateRoll, activateSpendHope, activateLevelUp } from "./apps.js";
import { activateTemplateCreator } from "./template-creator.js";
import { activateDowntimeUI, getDowntimeUIInstance, openDowntimeUIForPlayer } from "./downtime_ui.js";
import { activateRequestRoll, showCinematicPrompt } from "./request_roll.js";
// Import Scan
import { scan } from "./scan.js";
// Import Features
import { features } from "./features.js";
// Import Token Tooltip
import { initTokenTooltip } from "./token-tooltip.js";
// Import Scan Settings
import { registerScanSettings } from "./scan-settings.js";
// Import Falling Damage Settings
import { registerFallingDamageSettings } from "./falling-damage-settings.js";
// Import Coin Tier Settings
import { registerCoinTierSettings } from "./loot-consumable-settings.js";
// Import Biography Tab visibility
import { registerBiographyTabSettings, initBiographyTab } from "./biography-tab.js";
// Import Quick Actions macro list (settings menu + character sheet header button)
import { registerQuickActionsMacrosSettings, initQuickActionsButton, showQuickActionsMacros } from "./quick-actions-macros.js";
// Import Light Sources module integration
import { registerLightSources } from "./light-sources-integration.js";
// Import Daggerheart Menu Enhancer (search, ordering and collapsible sections for the system's GM menu)
import { initDaggerheartMenuEnhancer } from "./daggerheart-menu-enhancer.js";

// ==================================================================
// GLOBAL API
// ==================================================================
Hooks.once("init", () => {
    // 1. Downtime Setting
    game.settings.register(MODULE_ID, "downtimePCs", {
        name: "Downtime PCs",
        scope: "world",
        config: false,
        type: Number,
        default: 4
    });

    // 2. Cinematic Request Synchronization (Force Open Logic)
    game.settings.register(MODULE_ID, "cinematicRequest", {
        name: "Cinematic Roll Request",
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
        name: "Downtime Craft Entries",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 5b. Global custom moves (shared across all actors)
    game.settings.register(MODULE_ID, "downtimeCustomMoves", {
        name: "Downtime Custom Moves",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 5c. Global item move entries (shared across all actors)
    game.settings.register(MODULE_ID, "downtimeItemMoveEntries", {
        name: "Downtime Item Move Entries",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 5d. Core feature entries (e.g. Efficient)
    game.settings.register(MODULE_ID, "downtimeCoreFeatures", {
        name: "Downtime Core Features",
        scope: "world",
        config: false,
        default: [
            { key: "efficient", label: "Efficient", itemUuid: "Compendium.daggerheart.ancestries.Item.2xlqKOkDxWHbuj4t" },
            { key: "forager", label: "Forager", itemUuid: "Compendium.daggerheart.domains.Item.06UapZuaA5S6fAKl" }
        ],
        type: Array
    });

    // 6a. Persistent per-actor downtime configs (modifiers, maxChoices)
    game.settings.register(MODULE_ID, "shortRestCount", {
        name: "Short Rest Count",
        scope: "world",
        config: false,
        type: Number,
        default: 0
    });

    game.settings.register(MODULE_ID, "downtimeActorConfigs", {
        name: "Downtime Actor Configs",
        scope: "world",
        config: false,
        default: {},
        type: Object
    });

    // 6b. Downtime UI State (player choices, GM config)
    game.settings.register(MODULE_ID, "downtimeUIState", {
        name: "Downtime UI State",
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
        name: "Downtime UI Open",
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
        name: "Downtime UI Close",
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
    game.settings.register(MODULE_ID, "tokenTooltip", {
        name: "Token Hover Tooltip",
        hint: "Show a stat summary tooltip when hovering over character tokens on the canvas.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true
    });

    // 8b. Token Tooltip Size
    game.settings.register(MODULE_ID, "tokenTooltipSize", {
        name: "Token Tooltip Size",
        hint: "Controls the size of the token hover tooltip.",
        scope: "client",
        config: true,
        type: String,
        default: "normal",
        choices: {
            small: "Small",
            normal: "Normal",
            large: "Large",
            xlarge: "Extra Large",
            xxlarge: "Massive"
        }
    });

    registerScanSettings();
    registerFallingDamageSettings();
    registerCoinTierSettings();
    registerBiographyTabSettings();
    registerQuickActionsMacrosSettings();
    initTokenTooltip();
    initBiographyTab();
    initQuickActionsButton();
    initDaggerheartMenuEnhancer();

    globalThis.QuickActions = {
        Downtime: activateDowntime,
        FallingDamage: activateFallingDamage,
        RequestRoll: activateRequestRoll,
        HelpAnAlly: helpAnAlly,
        ScarCheck: scarCheck,
        LootConsumable: activateLootConsumable,
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
Hooks.on("renderParty", (app, html) => {
    // Always remove Short Rest and Long Rest buttons — this module replaces them
    html.querySelectorAll('button[data-action="triggerRest"]').forEach(btn => btn.remove());

    if (!game.user.isGM) return;
    if (html.querySelector(".dqa-downtime-party-btn")) return;

    const actionsSection = html.querySelector(".actions-section");
    if (!actionsSection) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dqa-downtime-party-btn");
    btn.innerHTML = `<i class="fa-solid fa-moon"></i><span>Downtime</span>`;

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
        { icon: "fa-bed", label: "Downtime", onClick: activateDowntimeUI },
        { icon: "fa-skull-crossbones", label: "Fall Damage", onClick: activateFallingDamage },
        { icon: "fa-dice-d20", label: "Request Roll", onClick: activateRequestRoll },
        { icon: "fa-arrow-up", label: "Level Up", onClick: activateLevelUp }
    ];

    const newFieldset = document.createElement("fieldset");
    newFieldset.classList.add(MODULE_ID, "dqa-menu-quick-actions-grid");

    const legend = document.createElement("legend");
    legend.innerText = "Quick Actions";
    newFieldset.appendChild(legend);

    for (const { icon, label, onClick } of buttonDefs) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
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
});