/**
 * Daggerheart Quick Actions
 * Main module that injects buttons into the menu and exposes the global API.
 */

// Import all functions from a single consolidated file
import { activateDowntime, activateFallingDamage, activateRequestRoll, helpAnAlly, scarCheck, activateLootConsumable, spotlightToken, showMacros, fateRoll } from "./apps.js";
// Import Features
import { features } from "./features.js";

// ==================================================================
// GLOBAL API
// ==================================================================
Hooks.once("init", () => {
    // Register the setting to memorize the number of PCs for Downtime
    game.settings.register("daggerheart-quickactions", "downtimePCs", {
        name: "Downtime PCs",
        scope: "world",      // "world" ensures the GM's choice persists for the game
        config: false,       // false because we change it via the UI, not the settings menu
        type: Number,
        default: 4
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
        Features: features // Added Features function
    };
    console.log("Daggerheart Quick Actions | Global API Registered: QuickActions");
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
        // Note: LootConsumable is not added to the sidebar menu here, only the global API,
        // similar to the ScarCheck pattern.

        fieldset.after(newFieldset);
    } else {
        element.appendChild(btnDowntime);
        element.appendChild(btnFalling);
        element.appendChild(btnRoll);
    }
});