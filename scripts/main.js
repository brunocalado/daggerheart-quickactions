/**
 * Daggerheart Quick Actions
 * Main module that injects buttons into the menu and exposes the global API.
 */

// Import all functions from consolidated files
import { activateDowntime, activateFallingDamage, activateRequestRoll, helpAnAlly, scarCheck, activateLootConsumable, spotlightToken, showMacros, fateRoll, activateSpendHope, showCinematicPrompt, activateTemplateCreator, activateLevelUp } from "./apps.js";
import { activateDowntimeUI, getDowntimeUIInstance, openDowntimeUIForPlayer } from "./downtime_ui.js";
// Import Features
import { features } from "./features.js";
// Import Beastform
import { beastformAction } from "./beastform.js";

// ==================================================================
// GLOBAL API
// ==================================================================
Hooks.once("init", () => {
    // 1. Downtime Setting
    game.settings.register("daggerheart-quickactions", "downtimePCs", {
        name: "Downtime PCs",
        scope: "world",
        config: false,
        type: Number,
        default: 4
    });

    // 2. Beastform Root Path (Stored for automation)
    game.settings.register("daggerheart-quickactions", "beastformRootPath", {
        name: "Beastform Root Folder",
        hint: "Path used if you turn on 'Auto Update Beastform Paths'.",
        scope: "world",
        config: true,
        type: String,
        default: ""
    });

    // 3. Beastform Auto-Check
    game.settings.register("daggerheart-quickactions", "beastformAutoCheck", {
        name: "Auto Update Beastform Paths",
        hint: "WARNING: Only turn on this if you read the instructions in the wiki.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    // 4. Cinematic Request Synchronization (Force Open Logic)
    game.settings.register("daggerheart-quickactions", "cinematicRequest", {
        name: "Cinematic Roll Request",
        scope: "world",     // Sincroniza entre todos os clientes
        config: false,      // Invisível no menu
        default: {},
        type: Object,
        onChange: (value) => {
            // Essa função roda em TODOS os clientes conectados quando o valor muda
            if (!value || !value.timestamp) return;

            // Ignora requisições antigas (mais de 10s) para evitar abrir ao recarregar a página (F5)
            const timeDiff = Date.now() - value.timestamp;
            if (timeDiff > 10000) return;

            // Verifica o alvo
            // Se targetId for vazio, é para todos. Se tiver ID, verifica se sou eu.
            const isTarget = !value.targetId || value.targetId === game.user.id;

            if (isTarget) {
                // Chama a função exportada do apps.js para abrir a janela
                showCinematicPrompt(value.data);
            }
        }
    });

    // 5. Global craft entries (shared across all actors)
    game.settings.register("daggerheart-quickactions", "downtimeCraftEntries", {
        name: "Downtime Craft Entries",
        scope: "world",
        config: false,
        default: [],
        type: Array
    });

    // 6a. Persistent per-actor downtime configs (modifiers, maxChoices)
    game.settings.register("daggerheart-quickactions", "downtimeActorConfigs", {
        name: "Downtime Actor Configs",
        scope: "world",
        config: false,
        default: {},
        type: Object
    });

    // 6b. Downtime UI State (player choices, GM config)
    game.settings.register("daggerheart-quickactions", "downtimeUIState", {
        name: "Downtime UI State",
        scope: "world",
        config: false,
        default: {},
        type: Object,
        onChange: (value) => {
            if (!value?.timestamp) return;
            if (Date.now() - value.timestamp > 30000) return;
            const inst = getDowntimeUIInstance();
            if (inst?.rendered) inst.render();
        }
    });

    // 7. Downtime UI Open Broadcast
    game.settings.register("daggerheart-quickactions", "downtimeUIOpen", {
        name: "Downtime UI Open",
        scope: "world",
        config: false,
        default: {},
        type: Object,
        onChange: (value) => {
            if (!value?.timestamp) return;
            if (Date.now() - value.timestamp > 10000) return;
            if (game.user.isGM) return;
            openDowntimeUIForPlayer();
        }
    });

    globalThis.QuickActions = {
        Downtime: activateDowntime,
        FallingDamage: activateFallingDamage,
        RequestRoll: activateRequestRoll,
        HelpAnAlly: helpAnAlly,
        ScarCheck: scarCheck,
        LootConsumable: activateLootConsumable,
        SpotlightToken: spotlightToken,
        ShowMacros: showMacros,
        Fate: fateRoll,
        SpendHope: activateSpendHope, 
        Templates: activateTemplateCreator,
        LevelUp: activateLevelUp,
        Features: features,
        Beastform: beastformAction,
        DowntimeUI: activateDowntimeUI
    };
    console.log("Daggerheart Quick Actions | Global API Registered: QuickActions");
});

// ==================================================================
// READY HOOK: AUTOMATION
// ==================================================================
Hooks.on("ready", async () => {
    // Check if automation is enabled
    const autoCheck = game.settings.get("daggerheart-quickactions", "beastformAutoCheck");
    
    if (autoCheck) {
        const checkImage = "icons/creatures/mammals/rodent-rat-diseaed-gray.webp";
        const packName = "daggerheart.beastforms";
        const pack = game.packs.get(packName);

        if (pack) {
            const documents = await pack.getDocuments({ type: "beastform" });
            const agileScout = documents.find(d => d.name === "Agile Scout");

            if (agileScout) {
                // Check if it has the "default/wrong" image
                if (agileScout.system.tokenImg === checkImage) {
                    const savedRoot = game.settings.get("daggerheart-quickactions", "beastformRootPath");
                    
                    if (savedRoot) {
                        console.log("QuickActions | Auto-Check: Agile Scout image mismatch detected. Running Beastform fix...");
                        QuickActions.Beastform(savedRoot);
                    } else {
                        ui.notifications.warn("QuickActions: Beastform Auto-Fix triggered, but no Root Folder is saved in settings.");
                    }
                }
            }
        }
    }

    // Re-render DowntimeUI when any user's flags change (player choices via setFlag)
    Hooks.on("updateUser", (user, change) => {
        if (change?.flags?.["daggerheart-quickactions"]?.downtimeChoices !== undefined ||
            change?.flags?.["daggerheart-quickactions"]?.["-=downtimeChoices"] !== undefined) {
            const inst = getDowntimeUIInstance();
            if (inst?.rendered) inst.render();
        }
    });
});

// ==================================================================
// RENDER MENU HOOK
// ==================================================================
Hooks.on("renderDaggerheartMenu", (app, element, data) => {
    
    // Common style for the buttons
    const btnStyle = "width: 100%; margin-top: 5px; display: flex; align-items: center; justify-content: center; gap: 5px;";

    // Button 1: Earn Fear from Downtime
    const btnDowntime = document.createElement("button");
    btnDowntime.type = "button";
    btnDowntime.innerHTML = `<i class="fas fa-bed"></i> Downtime`;
    btnDowntime.classList.add("dh-custom-btn");
    btnDowntime.style.cssText = btnStyle;
    btnDowntime.onclick = activateDowntimeUI;

    // Button 2: Falling And Collision Damage
    const btnFalling = document.createElement("button");
    btnFalling.type = "button";
    btnFalling.innerHTML = `<i class="fas fa-skull-crossbones"></i> Falling Damage`;
    btnFalling.classList.add("dh-custom-btn");
    btnFalling.style.cssText = btnStyle;
    btnFalling.onclick = activateFallingDamage;

    // Button 3: Request Roll
    const btnRoll = document.createElement("button");
    btnRoll.type = "button";
    btnRoll.innerHTML = `<i class="fas fa-dice-d20"></i> Request Roll`;
    btnRoll.classList.add("dh-custom-btn");
    btnRoll.style.cssText = btnStyle;
    btnRoll.onclick = activateRequestRoll;

    // Button 4: Level Up
    const btnLevelUp = document.createElement("button");
    btnLevelUp.type = "button";
    btnLevelUp.innerHTML = `<i class="fas fa-arrow-up"></i> Level Up Players`;
    btnLevelUp.classList.add("dh-custom-btn");
    btnLevelUp.style.cssText = btnStyle;
    btnLevelUp.onclick = activateLevelUp;

    // Insertion into DOM (Sidebar)
    const fieldset = element.querySelector("fieldset");

    if (fieldset) {
        const newFieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.innerText = "Quick Actions";

        newFieldset.appendChild(legend);
        newFieldset.appendChild(btnDowntime);
        newFieldset.appendChild(btnFalling);
        newFieldset.appendChild(btnRoll);
        newFieldset.appendChild(btnLevelUp);

        fieldset.after(newFieldset);
    } else {
        element.appendChild(btnDowntime);
        element.appendChild(btnFalling);
        element.appendChild(btnRoll);
        element.appendChild(btnLevelUp);
    }
});