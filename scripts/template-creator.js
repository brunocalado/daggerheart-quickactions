/**
 * Template Creator App
 * Provides an interactive tool for placing measured templates on the canvas.
 * Supports Token Magic FX effects if the tokenmagic module is active.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// V14 REGION HELPERS
// ==================================================================

/**
 * Converts template-style data into a V14 RegionDocument data object.
 * In V14, measured templates are stored as Region documents with the flag
 * flags.core.MeasuredTemplate = true. Direct Region creation avoids the
 * deprecated MeasuredTemplateDocument constructor and createDocuments shim.
 * @param {object} data - Template data (t, x, y, distance, direction, angle, width, fillColor, hidden, user, flags)
 * @returns {object} Region document data ready for createEmbeddedDocuments("Region", [...])
 */
function buildRegionDataFromTemplate(data) {
    const dp = canvas.dimensions.distancePixels;
    const x = Math.round(data.x || 0);
    const y = Math.round(data.y || 0);
    const distance = Math.abs(data.distance || 0);
    const direction = Math.normalizeDegrees(data.direction || 0);
    const angle = Math.clamp(data.angle == null ? 90 : (data.angle || 0), 0, 360);
    const width = Math.abs(data.width || 0);
    const fillColor = data.fillColor || "#ff0000";
    const hidden = !!data.hidden;
    const userId = data.user ?? game.user.id;

    let shape;
    switch (data.t) {
        case "cone":
            shape = { type: "cone", x, y, radius: distance * dp, angle, rotation: direction, curvature: "round", gridBased: false };
            break;
        case "ray":
            shape = { type: "line", x, y, length: distance * dp, width: width * dp, rotation: direction, gridBased: false };
            break;
        default:
            shape = { type: "circle", x, y, radius: distance * dp, gridBased: false };
    }

    const shapeName = shape.type.charAt(0).toUpperCase() + shape.type.slice(1);
    const userName = game.users.get(userId)?.name;
    const name = userName ? `${shapeName} Template [${userName}]` : `${shapeName} Template`;
    const ownership = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
    ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const flags = foundry.utils.deepClone(data.flags || {});
    foundry.utils.setProperty(flags, "core.MeasuredTemplate", true);

    return {
        name,
        color: fillColor,
        shapes: [shape],
        elevation: { bottom: data.elevation || 0, top: null },
        levels: [],
        restriction: { enabled: false, type: "move", priority: 0 },
        attachment: { token: null },
        behaviors: [],
        visibility: hidden ? CONST.REGION_VISIBILITY.OBSERVER : CONST.REGION_VISIBILITY.ALWAYS,
        highlightMode: "coverage",
        displayMeasurements: true,
        hidden: false,
        locked: false,
        ownership,
        flags
    };
}

/**
 * Draws a template preview shape onto a PIXI.Graphics object.
 * Replicates the visual output of the deprecated MeasuredTemplate.getConeShape /
 * getCircleShape / getRayShape static methods without calling them.
 * @param {PIXI.Graphics} g - Graphics context (cleared on each call)
 * @param {string} t - Template type: "circle" | "cone" | "ray"
 * @param {number} distance - Distance in grid units
 * @param {number} direction - Direction in degrees
 * @param {number} angle - Cone angle in degrees
 * @param {number} width - Ray width in grid units
 * @param {string} fillColor - Hex color string
 */
function drawPreviewShape(g, t, distance, direction, angle, width, fillColor) {
    const dp = canvas.dimensions.distancePixels;
    const s = canvas.dimensions.uiScale ?? 1;
    const hexColor = foundry.utils.Color.from(fillColor || "#C9A060").valueOf();

    g.clear();
    g.lineStyle(3 * s, 0x000000, 0.75).beginFill(hexColor, 0.3);

    switch (t) {
        case "circle": {
            g.drawCircle(0, 0, distance * dp);
            break;
        }
        case "cone": {
            const d = distance * dp;
            const a = Math.min(angle || 90, 360);
            if (d > 0 && a > 0) {
                if (a >= 360) {
                    g.drawCircle(0, 0, d);
                } else {
                    // Round cone: approximate with a ray every 3 degrees (same logic as old getConeShape)
                    const da = Math.min(a, 3);
                    const steps = Math.floor(a / da);
                    const angles = Array.from({ length: steps }, (_, i) => (a / -2) + i * da).concat([a / 2]);
                    const pts = [0, 0];
                    for (const deg of angles) {
                        const rad = Math.toRadians(direction + deg);
                        pts.push(Math.cos(rad) * d, Math.sin(rad) * d);
                    }
                    pts.push(0, 0);
                    g.drawPolygon(pts);
                }
            }
            break;
        }
        case "ray": {
            const len = distance * dp;
            const hw = ((width || 5) * dp) / 2;
            const dirRad = Math.toRadians(direction);
            const cos = Math.cos(dirRad);
            const sin = Math.sin(dirRad);
            // Perpendicular offset (90° CCW)
            const px = -sin * hw;
            const py = cos * hw;
            g.drawPolygon([px, py, cos * len + px, sin * len + py, cos * len - px, sin * len - py, -px, -py]);
            break;
        }
    }

    g.endFill();

    // Origin and direction-endpoint markers
    const dirRad = Math.toRadians(direction);
    const d = distance * dp;
    g.lineStyle(2 * s, 0x000000).beginFill(0x000000, 0.5)
        .drawCircle(0, 0, 6 * s)
        .drawCircle(Math.cos(dirRad) * d, Math.sin(dirRad) * d, 6 * s)
        .endFill();
}

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
     *
     * Uses a raw PIXI.Container preview (instead of the deprecated MeasuredTemplate
     * placeable) and creates the final document as a Region (V14 native storage).
     * @param {object} data - The initial template data object.
     */
    async _activatePreviewTool(data) {
        const safeEffect = data.effect;

        if (!canvas.templates) canvas.templates.activate();

        // Custom PIXI preview — avoids deprecated MeasuredTemplateDocument constructor
        // and the deprecated getConeShape / getCircleShape / getRayShape static methods.
        const previewContainer = new PIXI.Container();
        const previewGraphics = new PIXI.Graphics();
        previewContainer.addChild(previewGraphics);
        previewContainer.eventMode = "none";

        const previewState = { x: 0, y: 0, direction: data.direction ?? 0 };

        canvas.templates.preview.addChild(previewContainer);
        drawPreviewShape(previewGraphics, data.t, data.distance, previewState.direction, data.angle, data.width, data.fillColor);

        const _onMouseMove = (event) => {
            const pos = event.data.getLocalPosition(canvas.app.stage);
            let snapped = { x: pos.x, y: pos.y };

            if (canvas.grid.getSnappedPoint) {
                snapped = canvas.grid.getSnappedPoint({ x: pos.x, y: pos.y }, { mode: 3 });
            }

            previewState.x = snapped.x;
            previewState.y = snapped.y;
            previewContainer.position.set(snapped.x, snapped.y);
        };

        const _onMouseWheel = (event) => {
            event.preventDefault();
            event.stopPropagation();

            const delta = Math.sign(event.deltaY);
            previewState.direction = Math.normalizeDegrees(previewState.direction + delta * 15);
            drawPreviewShape(previewGraphics, data.t, data.distance, previewState.direction, data.angle, data.width, data.fillColor);
        };

        const _onClickLeft = async (event) => {
            if (event.data.originalEvent.button !== 0) return;

            const finalX = previewState.x;
            const finalY = previewState.y;
            const finalDirection = previewState.direction;
            const finalFillColor = data.fillColor;

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

            const templateData = {
                t: data.t,
                user: game.user.id,
                x: finalX,
                y: finalY,
                direction: finalDirection,
                distance: data.distance,
                fillColor: finalFillColor,
                angle: data.angle,
                width: data.width,
                hidden: data.hidden,
                flags: templateFlags
            };

            try {
                // V14: templates are stored as Region documents with flags.core.MeasuredTemplate = true.
                // Creating via "Region" avoids the deprecated MeasuredTemplate compat shim entirely.
                await canvas.scene.createEmbeddedDocuments("Region", [buildRegionDataFromTemplate(templateData)]);
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

            canvas.templates.preview.removeChild(previewContainer);
            previewContainer.destroy({ children: true });
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
