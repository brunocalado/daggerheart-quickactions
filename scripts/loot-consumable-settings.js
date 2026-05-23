/**
 * Loot Consumable Settings Module
 * Provides an ApplicationV2 menu for customizing coin tier min/max ranges.
 * Registered from the init hook in main.js.
 */

const MODULE_ID = "daggerheart-quickactions";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Default coin ranges keyed by tier. */
export const DEFAULT_COIN_TIERS = {
    tier1: { min: 10,   max: 50   },
    tier2: { min: 100,  max: 200  },
    tier3: { min: 500,  max: 1000 },
    tier4: { min: 1000, max: 2000 }
};

/**
 * Menu Application for customizing coin tier ranges.
 * Triggered via a settings menu button registered in registerCoinTierSettings().
 */
class CoinTierSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-coin-tier-settings-app",
        tag: "form",
        classes: ["daggerheart-quickactions", "coin-tier-settings"],
        window: { title: "Coin Tier Configuration", icon: "fas fa-coins", resizable: false },
        position: { width: 460, height: "auto" }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/loot-consumable-settings.hbs` }
    };

    /**
     * Prepares context data for the template from stored settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with current tier ranges.
     */
    async _prepareContext(_options) {
        return {
            tiers: game.settings.get(MODULE_ID, "coinTierRanges")
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
 * Registers the coin tier ranges setting and the settings menu button.
 * Called from the init hook in main.js.
 */
export function registerCoinTierSettings() {
    game.settings.register(MODULE_ID, "coinTierRanges", {
        scope: "world",
        config: false,
        type: Object,
        default: { ...DEFAULT_COIN_TIERS }
    });

    game.settings.registerMenu(MODULE_ID, "coinTierSettingsMenu", {
        name: "Coin Tier Configuration",
        label: "Configure Coin Tiers",
        hint: "Customize the min/max coin range for each loot tier.",
        icon: "fas fa-coins",
        type: CoinTierSettingsApp,
        restricted: true
    });
}
