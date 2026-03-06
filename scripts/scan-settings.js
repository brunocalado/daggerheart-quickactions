/**
 * Scan Settings Module
 * Provides an ApplicationV2 menu for customizing scan label text and chat card titles.
 * Registered from the init hook in main.js.
 */

const MODULE_ID = "daggerheart-quickactions";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Default HP label descriptors, keyed by minimum percentage threshold. */
const DEFAULT_HP_LABELS = [
    { min: 100, label: "Imposing; their form is pristine, radiating an aura of untouched power." },
    { min: 75,  label: "Weathered; minor injuries or disruptions mark their form, but their stance remains firm." },
    { min: 50,  label: "Battered; visible wounds or flickering essence betray the toll of battle, slowing them down." },
    { min: 25,  label: "Broken; they stagger with ragged desperation, their existence hanging by a thread." },
    { min: 0,   label: "Fallen; the vessel has succumbed, collapsing into stillness or dissipation." },
];

/** Default Stress label descriptors, keyed by minimum percentage threshold. */
const DEFAULT_STRESS_LABELS = [
    { min: 100, label: "Unshakeable; their mind is a fortress, operating with absolute, terrifying clarity." },
    { min: 70,  label: "Guarded; a subtle tension tightens their movements, the weight of the moment setting in." },
    { min: 50,  label: "Rattled; hesitation fractures their focus, erratic energy revealing their inner turmoil." },
    { min: 25,  label: "Overwhelmed; panic or instability has taken hold, leaving them erratic and unpredictable." },
    { min: 0,   label: "Shattered; their mental defenses have crumbled, leaving them utterly exposed and vulnerable to any threat." },
];

/**
 * Menu Application for customizing Scan feature labels and chat card titles.
 * Triggered via a settings menu button registered in registerScanSettings().
 */
class ScanSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-qa-scan-settings-app",
        tag: "form",
        classes: ["scan-settings-wrapper"],
        window: { title: "Scan Configuration", resizable: true },
        position: { width: 700, height: 520 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/scan-settings-menu.hbs` }
    };

    /**
     * Prepares context data for the template from stored settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with label arrays and titles.
     */
    async _prepareContext(_options) {
        return {
            hpTitle: game.settings.get(MODULE_ID, "scanHpTitle"),
            stressTitle: game.settings.get(MODULE_ID, "scanStressTitle"),
            hpLabels: JSON.parse(game.settings.get(MODULE_ID, "scanHpLabels")),
            stressLabels: JSON.parse(game.settings.get(MODULE_ID, "scanStressLabels"))
        };
    }

    /**
     * Wires tab switching, reset buttons, and form submission.
     * Triggered by the AppV2 render lifecycle.
     */
    _onRender(context, options) {
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // Reset buttons restore default text into the input fields without saving
        this.element.querySelectorAll('.reset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.reset;
                const defaults = type === "hp" ? DEFAULT_HP_LABELS : DEFAULT_STRESS_LABELS;
                const defaultTitle = type === "hp" ? "Physical State" : "Mental State";

                const titleInput = this.element.querySelector(`input[name="${type}Title"]`);
                if (titleInput) titleInput.value = defaultTitle;

                for (const entry of defaults) {
                    const input = this.element.querySelector(`input[name="${type}Label-${entry.min}"]`);
                    if (input) input.value = entry.label;
                }
            });
        });

        // Form submission persists all values to settings
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            await game.settings.set(MODULE_ID, 'scanHpTitle', formData.get('hpTitle') || 'Physical State');
            await game.settings.set(MODULE_ID, 'scanStressTitle', formData.get('stressTitle') || 'Mental State');

            const collectLabels = (type, defaults) => {
                return defaults.map(entry => ({
                    min: entry.min,
                    label: formData.get(`${type}Label-${entry.min}`) || entry.label
                }));
            };

            await game.settings.set(MODULE_ID, 'scanHpLabels', JSON.stringify(collectLabels('hp', DEFAULT_HP_LABELS)));
            await game.settings.set(MODULE_ID, 'scanStressLabels', JSON.stringify(collectLabels('stress', DEFAULT_STRESS_LABELS)));

            this.close();
        });
    }
}

/**
 * Registers all scan-related settings and the menu button.
 * Called from the init hook in main.js.
 */
export function registerScanSettings() {
    game.settings.register(MODULE_ID, "scanHpTitle", {
        scope: "world",
        config: false,
        type: String,
        default: "Physical State"
    });

    game.settings.register(MODULE_ID, "scanStressTitle", {
        scope: "world",
        config: false,
        type: String,
        default: "Mental State"
    });

    game.settings.register(MODULE_ID, "scanHpLabels", {
        scope: "world",
        config: false,
        type: String,
        default: JSON.stringify(DEFAULT_HP_LABELS)
    });

    game.settings.register(MODULE_ID, "scanStressLabels", {
        scope: "world",
        config: false,
        type: String,
        default: JSON.stringify(DEFAULT_STRESS_LABELS)
    });

    game.settings.registerMenu(MODULE_ID, "scanSettingsMenu", {
        name: "Scan Labels Configuration",
        label: "Configure Scan Labels",
        hint: "Customize the descriptive labels and titles shown in the Scan chat card.",
        icon: "fas fa-crosshairs",
        type: ScanSettingsApp,
        restricted: true
    });
}
