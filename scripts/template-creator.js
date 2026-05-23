/**
 * Template Creator App
 * Provides an interactive tool for placing measured templates on the canvas.
 * Supports Token Magic FX effects if the tokenmagic module is active.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// TEMPLATE CREATOR APP
// ==================================================================
class TemplateCreatorApp extends HandlebarsApplicationMixin(ApplicationV2) {

    /**
     * @param {object} options - Application options passed to ApplicationV2.
     */
    constructor(options = {}) {
        super(options);

        // Retrieve saved settings from user flags for persistence across sessions.
        const savedSettings = game.user.getFlag(MODULE_ID, "templateSettings") || {};

        this.localState = {
            type: savedSettings.type || 'circle',
            range: savedSettings.range || 'm',
            effect: savedSettings.effect || 'none',
            hidden: savedSettings.hidden || false
        };
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        tag: "div",
        id: "daggerheart-template-app",
        classes: ["dh-qa-app"],
        window: {
            title: "Template Tool",
            icon: "fas fa-shapes",
            resizable: false,
            controls: []
        },
        position: { width: 420, height: "auto" },
        actions: {
            selectType: TemplateCreatorApp.#onSelectType,
            selectRange: TemplateCreatorApp.#onSelectRange,
            toggleHidden: TemplateCreatorApp.#onToggleHidden,
            changeEffect: TemplateCreatorApp.#onChangeEffect,
            createTemplate: TemplateCreatorApp.#onCreateTemplate,
            copyCode: TemplateCreatorApp.#onCopyCode,
            chatCode: TemplateCreatorApp.#onChatCode
        }
    };

    /** @override */
    static PARTS = {
        form: { template: `modules/${MODULE_ID}/templates/template-creator.hbs` }
    };

    /**
     * Prepares context data passed to the Handlebars template.
     * Triggered by the AppV2 render lifecycle.
     * @param {object} options - Render options.
     * @returns {object} Context object for the template.
     */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        return {
            ...context,
            type: this.localState.type,
            range: this.localState.range,
            effect: this.localState.effect,
            hidden: this.localState.hidden,
            hasTokenMagic: game.modules.get("tokenmagic")?.active,
            codeString: this._computeCodeString()
        };
    }

    /**
     * Computes the @Template code string from the current local state.
     * @returns {string} The template enricher code, e.g. "@Template[type:circle|range:vc]".
     */
    _computeCodeString() {
        const shapeMap = { circle: "circle", cone: "cone", front: "rect", ray: "ray" };
        const shapeText = shapeMap[this.localState.type] ?? "circle";
        return `@Template[type:${shapeText}|range:${this.localState.range}]`;
    }

    // ------------------------------------------------------------------
    // STATIC ACTIONS
    // ------------------------------------------------------------------

    /**
     * Handles shape type button clicks.
     * Triggered by data-action="selectType".
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onSelectType(event, target) {
        this.localState.type = target.dataset.value;
        this.render();
    }

    /**
     * Handles distance/range button clicks.
     * Triggered by data-action="selectRange".
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onSelectRange(event, target) {
        this.localState.range = target.dataset.value;
        this.render();
    }

    /**
     * Handles the "Hide Template" checkbox toggle.
     * Triggered by data-action="toggleHidden".
     * @param {Event} event
     * @param {HTMLInputElement} target
     */
    static #onToggleHidden(event, target) {
        this.localState.hidden = target.checked;
    }

    /**
     * Handles the magic effect dropdown change.
     * Triggered by data-action="changeEffect".
     * @param {Event} event
     * @param {HTMLSelectElement} target
     */
    static #onChangeEffect(event, target) {
        this.localState.effect = target.value;
    }

    /**
     * Handles the "Place Template" button click.
     * Triggered by data-action="createTemplate".
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static async #onCreateTemplate(event, target) {
        await this._saveAndPlaceTemplate();
    }

    /**
     * Copies the current code string to the clipboard.
     * Triggered by data-action="copyCode".
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static #onCopyCode(event, target) {
        const code = this._computeCodeString();
        game.clipboard.copyPlainText(code);
        ui.notifications.info("Template code copied to clipboard!");
    }

    /**
     * Sends the current code string as a chat message.
     * Triggered by data-action="chatCode".
     * @param {PointerEvent} event
     * @param {HTMLElement} target
     */
    static async #onChatCode(event, target) {
        const code = this._computeCodeString();
        if (!code) return;

        const content = buildChatCard("Template Tool", `
            <div style="color: #ffffff !important; font-size: 1.2em; font-weight: bold; margin-bottom: 10px; text-shadow: 0px 0px 8px #000;">
                ${code}
            </div>
            <div style="color: #ccc; font-size: 0.9em; font-style: italic;">
                Click above to place the template
            </div>
        `);

        await ChatMessage.create({
            user: game.user.id,
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    }

    // ------------------------------------------------------------------
    // TEMPLATE CREATION
    // ------------------------------------------------------------------

    /**
     * Reads final state from the DOM, persists it, then activates the preview tool.
     * Called by the #onCreateTemplate action.
     */
    async _saveAndPlaceTemplate() {
        // Read any in-flight DOM values not yet synced to localState.
        const selectEl = this.element.querySelector('#dh-effect-select');
        if (selectEl) this.localState.effect = selectEl.value;

        const checkboxEl = this.element.querySelector('#dh-hidden-checkbox');
        if (checkboxEl) this.localState.hidden = checkboxEl.checked;

        // Persist state for next open.
        await game.user.setFlag(MODULE_ID, "templateSettings", this.localState);

        const ranges = { m: 5, vc: 15, c: 30, f: 60 };
        const shapes = { circle: "circle", cone: "cone", ray: "ray", front: "cone" };

        const dist = ranges[this.localState.range] ?? 5;
        const selectedType = this.localState.type;
        const dbType = shapes[selectedType] ?? "circle";
        const userColor = game.user.color?.css ?? "#C9A060";

        const templateData = {
            t: dbType,
            user: game.user.id,
            distance: dist,
            fillColor: userColor,
            direction: 0,
            x: 0,
            y: 0,
            effect: this.localState.effect,
            hidden: this.localState.hidden
        };

        if (selectedType === "cone") templateData.angle = 53.13;
        else if (selectedType === "front") templateData.angle = 180;

        if (selectedType === "ray") templateData.width = 5;

        this.close();
        this._activatePreviewTool(templateData);
    }

    // ------------------------------------------------------------------
    // TOKEN MAGIC FX
    // ------------------------------------------------------------------

    /**
     * Builds the Token Magic FX flags object for a given effect name.
     * @param {string} effectName - The effect key (e.g. "glow", "fire").
     * @param {number} colorInt - Integer color value derived from the user's color.
     * @param {string} userId - The ID of the placing user.
     * @returns {object} Flags object to merge into the template document.
     */
    _getTMFXConfig(effectName, colorInt, userId) {
        const randomID = foundry.utils.randomID;

        const buildBase = (presetName, filters) => ({
            tokenmagic: {
                templateData: { opacity: 1, tint: null, preset: presetName },
                filters: filters,
                options: null
            }
        });

        const makeFilter = (params) => ({
            tmFilters: {
                tmFilterId: params.filterId,
                tmFilterInternalId: randomID(),
                tmFilterType: params.filterType,
                tmFilterOwner: userId,
                tmParams: {
                    ...params,
                    placeableId: randomID(),
                    filterInternalId: randomID(),
                    filterOwner: userId,
                    placeableType: "MeasuredTemplate",
                    updateId: randomID()
                }
            }
        });

        switch (effectName) {
            case 'glow':
                return buildBase("Glowing Outline", [
                    makeFilter({
                        filterType: "glow", filterId: "Glowing Outline",
                        outerStrength: 5.5, innerStrength: 0, color: colorInt, quality: 0.5, padding: 10,
                        animated: { outerStrength: { active: true, loopDuration: 3000, animType: "syncCosOscillation", val1: 5.5, val2: 1.5 } },
                        zOrder: 1, rank: 10004, enabled: true
                    })
                ]);

            case 'rays':
                return buildBase("Annihilating Rays", [
                    makeFilter({
                        filterType: "xray", filterId: "Annihilating Rays",
                        time: 0, color: colorInt, blend: 9, dimX: 1, dimY: 1, anchorX: 0.5, anchorY: 0.5, divisor: 6, intensity: 4,
                        animated: { time: { active: true, speed: 0.0012, animType: "move" } },
                        zOrder: 1, rank: 10001, enabled: true
                    })
                ]);

            case 'bulge':
                return buildBase("Bulging Out", [
                    makeFilter({
                        filterType: "bulgepinch", filterId: "Bulging Out",
                        padding: 150, strength: 0, radiusPercent: 200,
                        animated: { strength: { active: true, animType: "cosOscillation", loopDuration: 2000, val1: 0, val2: 0.45 } },
                        zOrder: 1, rank: 10004, enabled: true
                    })
                ]);

            case 'classic_rays':
                return buildBase("Classic Rays", [
                    makeFilter({
                        filterType: "ray", filterId: "Classic Rays",
                        time: 0, color: colorInt, alpha: 0.5, divisor: 32, anchorX: 0.5, anchorY: 0.5,
                        animated: { time: { active: true, speed: 0.0005, animType: "move" } },
                        zOrder: 1, rank: 10005, enabled: true
                    })
                ]);

            case 'classic_rays_2':
                return buildBase("Classic Rays 2", [
                    makeFilter({
                        filterType: "ray", filterId: "Classic Rays 2",
                        time: 0, color: colorInt, alpha: 1, divisor: 16, anchorX: 0.5, anchorY: 0.5, alphaDiscard: true,
                        animated: { time: { active: true, speed: 0.0009, animType: "move" } },
                        zOrder: 1, rank: 10006, enabled: true
                    })
                ]);

            case 'fairy':
                return buildBase("Fairy Fireflies : Frenetic", [
                    makeFilter({
                        filterType: "globes", filterId: "Fairy Fireflies : Frenetic",
                        color: colorInt, time: 98.8, zOrder: 1, distortion: 1.45, scale: 80, alphaDiscard: true,
                        animated: { time: { active: true, animType: "move", speed: 0.0016 } },
                        rank: 10010, enabled: true
                    }),
                    makeFilter({
                        filterType: "glow", filterId: "Fairy Fireflies : Frenetic",
                        outerStrength: 7.5, innerStrength: 0.5, color: colorInt, quality: 0.5, padding: 10, zOrder: 2,
                        animated: { outerStrength: { active: true, loopDuration: 3000, animType: "syncCosOscillation", val1: 7.5, val2: 5.5 } },
                        rank: 10011, enabled: true
                    })
                ]);

            case 'fire':
                return buildBase("Fire Rays", [
                    makeFilter({
                        filterType: "ray", filterId: "Fire Rays",
                        time: 0, color: colorInt, alpha: 1, divisor: 24, anchorX: 0.5, anchorY: 0.5, alphaDiscard: true, zOrder: 1,
                        animated: { time: { active: true, speed: 0.0009, animType: "move" } },
                        rank: 10015, enabled: true
                    }),
                    makeFilter({
                        filterType: "glow", filterId: "Fire Rays",
                        outerStrength: 1, innerStrength: 1, color: colorInt, quality: 0.5, padding: 10, zOrder: 2,
                        rank: 10016, enabled: true
                    }),
                    makeFilter({
                        filterType: "fire", filterId: "Fire Rays",
                        intensity: 1.5, color: 16777215, amplitude: 1.3, time: 0, blend: 2, fireBlend: 1, zOrder: 3,
                        animated: { time: { active: true, speed: -0.0016, animType: "move" } },
                        rank: 10017, enabled: true
                    })
                ]);

            case 'flames':
                return buildBase("Flames", [
                    makeFilter({
                        filterType: "fire", filterId: "Flames",
                        intensity: 1.5, color: colorInt,
                        amplitude: 1.3, time: 0, blend: 2, fireBlend: 1,
                        animated: { time: { active: true, speed: -0.0016, animType: "move" } },
                        zOrder: 1, rank: 10018, enabled: true
                    })
                ]);

            case 'protoplasm':
                return buildBase("Protoplasm", [
                    makeFilter({
                        filterType: "liquid", filterId: "Protoplasm",
                        color: colorInt, time: 0, blend: 8, intensity: 4, spectral: true, scale: 1.4,
                        animated: { time: { active: true, speed: 0.001, animType: "move" } },
                        zOrder: 1, rank: 10027, enabled: true
                    })
                ]);

            case 'water':
                return buildBase("Watery Surface", [
                    makeFilter({
                        filterType: "flood", filterId: "Watery Surface",
                        color: colorInt, time: 0, billowy: 0.43, tintIntensity: 0.72, glint: 0.31, scale: 70, padding: 10,
                        animated: { time: { active: true, speed: 0.0006, animType: "move" } },
                        zOrder: 1, rank: 10038, enabled: true
                    })
                ]);

            case 'zone_blizzard':
                return buildBase("Zone : Blizzard", [
                    makeFilter({
                        filterType: "xglow", filterId: "Zone : Blizzard",
                        auraType: 1, color: colorInt, thickness: 4.5, scale: 5, time: 0, auraIntensity: 0.25, subAuraIntensity: 1, threshold: 0.5, discard: false,
                        animated: {
                            time: { active: true, speed: 0.0018, animType: "move" },
                            thickness: { val1: 2, val2: 3.3, animType: "cosOscillation", loopDuration: 3000 },
                            subAuraIntensity: { val1: 0.05, val2: 0.1, animType: "cosOscillation", loopDuration: 6000 },
                            auraIntensity: { val1: 0.9, val2: 2.2, animType: "cosOscillation", loopDuration: 3000 }
                        },
                        zOrder: 1, rank: 10042, enabled: true
                    }),
                    makeFilter({
                        filterType: "smoke", filterId: "Zone : Blizzard",
                        color: colorInt, time: 0, blend: 2, dimY: 1,
                        animated: {
                            time: { active: true, speed: -0.005, animType: "move" },
                            dimX: { val1: 0.4, val2: 0.2, animType: "cosOscillation", loopDuration: 3000 }
                        },
                        zOrder: 2, rank: 10043, enabled: true
                    })
                ]);

            case 'zone_electricity':
                return buildBase("Zone : Electricity", [
                    makeFilter({
                        filterType: "xglow", filterId: "Zone : Electricity",
                        auraType: 2, color: colorInt, scale: 1.5, time: 0, auraIntensity: 1, subAuraIntensity: 0.9, threshold: 0, discard: true,
                        animated: {
                            time: { active: true, speed: 0.0027, animType: "move" },
                            thickness: { active: true, loopDuration: 3000, animType: "cosOscillation", val1: 1, val2: 2 }
                        },
                        zOrder: 1, rank: 10046, enabled: true
                    }),
                    makeFilter({
                        filterType: "electric", filterId: "Zone : Electricity",
                        color: 16777215, // White lightning for contrast
                        time: 0, blend: 1, intensity: 5,
                        animated: { time: { active: true, speed: 0.002, animType: "move" } },
                        zOrder: 2, rank: 10047, enabled: true
                    })
                ]);

            case 'zone_fire':
                return buildBase("Zone : Fire", [
                    makeFilter({
                        filterType: "xglow", filterId: "Zone : Fire",
                        auraType: 1, color: colorInt, scale: 1.5, time: 0, auraIntensity: 1.8, subAuraIntensity: 0.25, threshold: 0.6, discard: false,
                        animated: {
                            time: { active: true, speed: 0.0027, animType: "move" },
                            thickness: { active: true, loopDuration: 3000, animType: "cosOscillation", val1: 2, val2: 5 }
                        },
                        zOrder: 1, rank: 10048, enabled: true
                    }),
                    makeFilter({
                        filterType: "fire", filterId: "Zone : Fire",
                        intensity: 1.5, color: 16777215, // White core
                        amplitude: 1, time: 0, blend: 2, fireBlend: 1,
                        animated: { time: { active: true, speed: -0.0015, animType: "move" } },
                        zOrder: 2, rank: 10049, enabled: true
                    })
                ]);

            default:
                return {};
        }
    }

    // ------------------------------------------------------------------
    // PREVIEW TOOL
    // ------------------------------------------------------------------

    /**
     * Activates the interactive canvas preview mode for template placement.
     * Supports mouse movement for positioning, wheel for rotation,
     * left-click to confirm, and right-click to cancel.
     * @param {object} data - The initial template document data.
     */
    async _activatePreviewTool(data) {
        const safeEffect = data.effect;

        if (!canvas.templates) canvas.templates.activate();

        const doc = new foundry.documents.MeasuredTemplateDocument(data, { parent: canvas.scene });
        const template = new foundry.canvas.placeables.MeasuredTemplate(doc);

        template.eventMode = "none";

        canvas.templates.preview.addChild(template);
        template.draw();

        const _onMouseMove = (event) => {
            const pos = event.data.getLocalPosition(canvas.app.stage);
            let snapped = { x: pos.x, y: pos.y };

            if (canvas.grid.getSnappedPoint) {
                snapped = canvas.grid.getSnappedPoint({ x: pos.x, y: pos.y }, { mode: 3 });
            }

            template.document.x = snapped.x;
            template.document.y = snapped.y;
            template.refresh();
        };

        const _onMouseWheel = (event) => {
            event.preventDefault();
            event.stopPropagation();

            const delta = Math.sign(event.deltaY);
            template.document.direction += (delta * 15);
            template.refresh();
        };

        const _onClickLeft = async (event) => {
            if (event.data.originalEvent.button !== 0) return;

            const finalX = template.document.x;
            const finalY = template.document.y;
            const finalDirection = template.document.direction;
            const finalFillColor = template.document.fillColor;

            _cleanup();

            let templateFlags = {};
            const isTMFXActive = game.modules.get("tokenmagic")?.active;

            if (isTMFXActive && safeEffect && safeEffect !== 'none') {
                try {
                    let colorInt;
                    if (foundry.utils.Color) {
                        colorInt = foundry.utils.Color.from(finalFillColor || 0xC9A060).valueOf();
                    } else {
                        const cVal = (typeof finalFillColor === 'object') ? finalFillColor.css : finalFillColor;
                        colorInt = parseInt(cVal.replace("#", ""), 16);
                    }

                    templateFlags = this._getTMFXConfig(safeEffect, colorInt, game.user.id);
                } catch (err) {
                    console.error("[DH-ERROR] Failed to generate Token Magic effects:", err);
                }
            }

            const finalData = {
                t: data.t,
                user: game.user.id,
                x: finalX,
                y: finalY,
                direction: finalDirection,
                distance: data.distance,
                fillColor: data.fillColor,
                angle: data.angle,
                width: data.width,
                hidden: data.hidden,
                flags: templateFlags
            };

            try {
                await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [finalData]);
            } catch (e) {
                console.error("[DH-ERROR] Failed to create template:", e);
            }
        };

        const _onClickRight = (event) => {
            _cleanup();
        };

        const _cleanup = () => {
            canvas.stage.off("mousemove", _onMouseMove);
            canvas.stage.off("pointerdown", _onClickLeft);
            canvas.stage.off("rightdown", _onClickRight);
            canvas.app.view.removeEventListener("wheel", _onMouseWheel);

            canvas.templates.preview.removeChild(template);
            template.destroy({ children: true });
        };

        canvas.stage.on("mousemove", _onMouseMove);
        canvas.stage.on("pointerdown", _onClickLeft);
        canvas.stage.on("rightdown", _onClickRight);
        canvas.app.view.addEventListener("wheel", _onMouseWheel, { passive: false });
    }
}

// ==================================================================
// EXPORTED FUNCTION
// ==================================================================

/**
 * Opens the Template Creator application.
 * Exposed via the global QuickActions API.
 * @returns {Promise<void>}
 */
export async function activateTemplateCreator() {
    new TemplateCreatorApp().render(true);
}
