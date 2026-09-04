/**
 * Loot & Consumables Settings Module
 * Provides an ApplicationV2 menu covering everything QuickActions.LootConsumable() rolls:
 * which Daggerheart roll tables loot and consumables are drawn from, and the coin tier ranges.
 * Registered from the init hook in main.js.
 */

import { MODULE_ID, LOOT_CONSUMABLE_SOURCE, LOOT_SOURCE, LOOT_SOURCE_LABELS } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Default coin ranges keyed by tier. */
export const DEFAULT_COIN_TIERS = {
    tier1: { min: 10,   max: 50   },
    tier2: { min: 100,  max: 200  },
    tier3: { min: 500,  max: 1000 },
    tier4: { min: 1000, max: 2000 }
};

/**
 * Menu Application configuring the Loot & Consumables roller.
 * Triggered via the settings menu button registered in registerLootConsumableSettings().
 */
class LootConsumableSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-loot-consumable-settings-app",
        tag: "form",
        classes: [MODULE_ID, "loot-consumable-settings"],
        window: { title: "Loot & Consumables Configuration", icon: "fas fa-treasure-chest", resizable: false },
        position: { width: 480, height: "auto" }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/loot-consumable-settings.hbs` }
    };

    /**
     * Prepares context data for the template from stored settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with the active table source and tier ranges.
     */
    async _prepareContext(_options) {
        const source = game.settings.get(MODULE_ID, LOOT_CONSUMABLE_SOURCE);
        return {
            tiers: game.settings.get(MODULE_ID, "coinTierRanges"),
            sources: Object.values(LOOT_SOURCE).map(value => ({
                value,
                label: LOOT_SOURCE_LABELS[value],
                selected: value === source
            }))
        };
    }

    /**
     * Wires reset button and form submission.
     * Triggered by the AppV2 render lifecycle.
     * @param {object} context - Render context.
     * @param {object} options - Render options.
     */
    _onRender(context, options) {
        const resetBtn = this.element.querySelector(".reset-btn");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                for (const [key, val] of Object.entries(DEFAULT_COIN_TIERS)) {
                    this.element.querySelector(`input[name="${key}-min"]`).value = val.min;
                    this.element.querySelector(`input[name="${key}-max"]`).value = val.max;
                }
            });
        }

        this.element.addEventListener("submit", async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);

            const source = fd.get("source");
            if (Object.values(LOOT_SOURCE).includes(source)) {
                await game.settings.set(MODULE_ID, LOOT_CONSUMABLE_SOURCE, source);
            }

            const tiers = {};
            for (const key of ["tier1", "tier2", "tier3", "tier4"]) {
                tiers[key] = {
                    min: Number(fd.get(`${key}-min`)) || DEFAULT_COIN_TIERS[key].min,
                    max: Number(fd.get(`${key}-max`)) || DEFAULT_COIN_TIERS[key].max
                };
            }
            await game.settings.set(MODULE_ID, "coinTierRanges", tiers);
            this.close();
        });
    }
}

/**
 * Registers everything the Loot & Consumables roller reads — the table source, the coin tier
 * ranges, and the single settings menu button that edits both.
 * Called from the init hook in main.js.
 */
export function registerLootConsumableSettings() {
    // Edited through the menu below rather than as a standalone dropdown, so the roller's whole
    // configuration lives behind one button.
    game.settings.register(MODULE_ID, LOOT_CONSUMABLE_SOURCE, {
        name: "Loot & Consumable Table Source",
        scope: "world",
        config: false,
        type: String,
        default: LOOT_SOURCE.BOTH
    });

    game.settings.register(MODULE_ID, "coinTierRanges", {
        scope: "world",
        config: false,
        type: Object,
        default: { ...DEFAULT_COIN_TIERS }
    });

    game.settings.registerMenu(MODULE_ID, "lootConsumableSettingsMenu", {
        name: "Loot & Consumables Configuration",
        label: "Configure Loot & Consumables",
        hint: "Pick which Daggerheart roll tables loot and consumables are drawn from, and customize the coin range of each tier.",
        icon: "fas fa-treasure-chest",
        type: LootConsumableSettingsApp,
        restricted: true
    });
}
