/**
 * Daggerheart Quick Actions
 * Main module that injects buttons into the menu and exposes the global API.
 */

// Import all functions from a single consolidated file
import { activateDowntime, activateFallingDamage, activateRequestRoll, helpAnAlly, scarCheck, activateLootConsumable, spotlightToken, showMacros, fateRoll, activateSpendHope } from "./apps.js";
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
        SpendHope: activateSpendHope, // Added SpendHope
        Features: features,
        Beastform: beastformAction
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
            // We need to find "Agile Scout". 
            // Using getDocuments() to ensure we have the system data.
            // Performance note: In a huge compendium index might be better, but for this specific check, loading is safer.
            const documents = await pack.getDocuments({ type: "beastform" });
            const agileScout = documents.find(d => d.name === "Agile Scout");

            if (agileScout) {
                // Check if it has the "default/wrong" image
                if (agileScout.system.tokenImg === checkImage) {
                    const savedRoot = game.settings.get("daggerheart-quickactions", "beastformRootPath");
                    
                    if (savedRoot) {
                        console.log("QuickActions | Auto-Check: Agile Scout image mismatch detected. Running Beastform fix...");
                        // Call the exported logic directly with the saved folder
                        QuickActions.Beastform(savedRoot);
                    } else {
                        ui.notifications.warn("QuickActions: Beastform Auto-Fix triggered, but no Root Folder is saved in settings.");
                    }
                }
            }
        }
    }
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
    btnDowntime.innerHTML = `<i class="fas fa-bed"></i> Earn Fear (Downtime)`;
    btnDowntime.classList.add("dh-custom-btn");
    btnDowntime.style.cssText = btnStyle;
    btnDowntime.onclick = activateDowntime;

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
        // Note: LootConsumable, Beastform, etc are not added to the sidebar menu here.

        fieldset.after(newFieldset);
    } else {
        element.appendChild(btnDowntime);
        element.appendChild(btnFalling);
        element.appendChild(btnRoll);
    }
});