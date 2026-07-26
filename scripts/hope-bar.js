/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Hope Bar
 * Draws a row of Hope diamonds just above character tokens on the canvas.
 *
 * The bar is a plain PIXI container parented to the Token itself — not to `token.bars`, which
 * bar replacement modules clear wholesale on every redraw. Being a Token child means canvas zoom,
 * panning and token visibility all come for free, exactly like the native resource bars.
 */

import { MODULE_ID, HOPE_BAR_ENABLED } from "./constants.js";

const BG_PATH = `modules/${MODULE_ID}/assets/hope-bar/hope1-bg.png`;
const FG_PATH = `modules/${MODULE_ID}/assets/hope-bar/hope1-fg.png`;

/**
 * Slot count the bar is sized against. Daggerheart characters cap Hope at 6; Scars lower the
 * maximum and can be healed back. Keeping the baseline fixed means a scarred character shows
 * locked slots rather than a silently shorter bar, and a raised maximum simply extends it.
 */
const BASE_SLOTS = 6;

/** Source diamond dimensions and the horizontal pitch measured across the hope1..hope6 sheets. */
const ART_W = 75;
const ART_H = 80;
const ART_PITCH = 80;

/** Bar width at BASE_SLOTS, as a fraction of the token width. */
const WIDTH_RATIO = 1;

/** Gap between the bar and the token's top edge, in units of slot height. */
const GAP_RATIO = 0.15;

/** Opacity of slots locked off by a Scar — faded out rather than marked. */
const LOCKED_ALPHA = 0.45;

/** Token → its Hope bar container. Weak so destroyed tokens drop out on their own. */
const _bars = new WeakMap();

let _bgTex = null;
let _fgTex = null;
let _loading = null;

// -------------------------------------------------------------------
// Public init — called from main.js inside Hooks.once("init")
// -------------------------------------------------------------------
export function initHopeBar() {
    Hooks.on("drawToken", _syncToken);
    Hooks.on("refreshToken", _syncToken);
    Hooks.on("hoverToken", _syncToken);
    Hooks.on("controlToken", _syncToken);
    Hooks.on("destroyToken", _destroyBar);
    Hooks.on("canvasReady", refreshHopeBars);

    // Hope max moves through Active Effects and Scars, so any of these can change the layout.
    // Re-syncing is cheap: the container is only rebuilt when the value/max/size signature moves.
    Hooks.on("updateActor", (actor, changes) => {
        if (changes?.system) _syncActor(actor);
    });
    for (const hook of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
        Hooks.on(hook, effect => _syncActor(_effectActor(effect)));
    }
    for (const hook of ["createItem", "updateItem", "deleteItem"]) {
        Hooks.on(hook, item => _syncActor(item?.parent?.documentName === "Actor" ? item.parent : null));
    }

    // Changing the display mode doesn't necessarily trigger a token refresh.
    Hooks.on("updateToken", (doc, changes) => {
        if ("displayBars" in (changes ?? {})) _syncToken(doc.object);
    });
}

/**
 * Re-syncs every token on the current scene. Used by the setting's onChange and on canvas ready.
 * @returns {void}
 */
export function refreshHopeBars() {
    if (!canvas?.ready) return;
    for (const token of canvas.tokens?.placeables ?? []) _syncToken(token);
}

// -------------------------------------------------------------------
// Sync
// -------------------------------------------------------------------

/**
 * Brings a single token's Hope bar in line with the actor's current Hope.
 * @param {Token} token - The token placeable to sync.
 * @returns {void}
 */
function _syncToken(token) {
    if (!token?.document) return;

    const data = _hopeData(token);
    if (!data) return _destroyBar(token);
    if (!_ensureTextures()) return;

    let bar = _bars.get(token);
    if (!bar || bar.destroyed || bar.parent !== token) {
        _destroyBar(token);
        bar = new PIXI.Container();
        bar.eventMode = "none"; // Must never swallow clicks aimed at the token.
        token.addChild(bar);
        _bars.set(token, bar);
    }

    // Rebuilding sprites on every refresh would fire on each frame of a token drag.
    const key = `${data.value}|${data.max}|${token.w}|${token.h}`;
    if (bar.dqaLayoutKey !== key) {
        _buildSlots(bar, token, data);
        bar.dqaLayoutKey = key;
    }

    bar.visible = _isVisible(token);
}

/**
 * Syncs every token of an actor on the current scene.
 * @param {Actor|null} actor - The actor whose tokens should be re-synced.
 * @returns {void}
 */
function _syncActor(actor) {
    if (!actor || !canvas?.ready || !canvas.scene) return;
    for (const doc of actor.getDependentTokens({ scenes: canvas.scene })) {
        if (doc.object) _syncToken(doc.object);
    }
}

/**
 * Resolves the owning actor of an Active Effect, which may hang off an Item.
 * @param {ActiveEffect} effect - The effect that changed.
 * @returns {Actor|null} The actor, or null when the effect lives outside one.
 */
function _effectActor(effect) {
    const parent = effect?.parent;
    if (parent?.documentName === "Actor") return parent;
    if (parent?.parent?.documentName === "Actor") return parent.parent;
    return null;
}

/**
 * Reads the Hope this token should display.
 * Always through `actor.system`, so Active Effects are already applied.
 * @param {Token} token - The token placeable.
 * @returns {{value: number, max: number}|null} Hope, or null when no bar should be drawn.
 */
function _hopeData(token) {
    if (!game.settings.get(MODULE_ID, HOPE_BAR_ENABLED)) return null;

    const actor = token.actor;
    if (actor?.type !== "character") return null;

    const hope = actor.system?.resources?.hope;
    if (!hope) return null;

    const max = Math.round(Number(hope.max) || 0);
    if (max <= 0) return null;

    return { value: Math.clamp(Math.round(Number(hope.value) || 0), 0, max), max };
}

// -------------------------------------------------------------------
// Drawing
// -------------------------------------------------------------------

/**
 * Rebuilds the diamond sprites for a token.
 * @param {PIXI.Container} bar - The bar container to fill.
 * @param {Token} token - The token the bar belongs to.
 * @param {{value: number, max: number}} data - Current and maximum Hope.
 * @returns {void}
 */
function _buildSlots(bar, token, { value, max }) {
    for (const child of bar.removeChildren()) child.destroy({ children: true });

    const slots = Math.max(BASE_SLOTS, max);

    // Pinned to the 6-slot baseline so the diamonds stay the same size whatever the maximum is:
    // a Scar leaves a gap, a raised maximum widens the bar past the token instead of shrinking
    // every diamond.
    const scale = (WIDTH_RATIO * token.w) / ((BASE_SLOTS - 1) * ART_PITCH + ART_W);
    const slotW = ART_W * scale;
    const slotH = ART_H * scale;
    const pitch = ART_PITCH * scale;

    const x0 = (token.w - ((slots - 1) * pitch + slotW)) / 2;
    const y0 = -slotH * (1 + GAP_RATIO);

    for (let i = 0; i < slots; i++) {
        const x = x0 + i * pitch;
        const locked = i >= max;

        const bg = new PIXI.Sprite(_bgTex);
        bg.width = slotW;
        bg.height = slotH;
        bg.position.set(x, y0);
        if (locked) bg.alpha = LOCKED_ALPHA;
        bar.addChild(bg);

        if (i < value) {
            const fg = new PIXI.Sprite(_fgTex);
            fg.width = slotW;
            fg.height = slotH;
            fg.position.set(x, y0);
            bar.addChild(fg);
        }
    }
}

/**
 * Applies the token's own "Display Bars" setting to the Hope bar, so it appears and disappears
 * alongside the native resource bars.
 * @param {Token} token - The token placeable.
 * @returns {boolean} Whether the bar should currently be visible.
 */
function _isVisible(token) {
    const MODES = CONST.TOKEN_DISPLAY_MODES;
    const owner = token.actor?.isOwner ?? false;
    // `highlightObjects` is the Alt-key reveal — without it the Hope bar would be the one overlay
    // still hidden while every other one is forced visible.
    const hover = token.hover || (token.layer?.highlightObjects ?? false);

    switch (token.document.displayBars) {
        case MODES.NONE: return false;
        case MODES.CONTROL: return token.controlled;
        case MODES.OWNER_HOVER: return owner && hover;
        case MODES.HOVER: return hover;
        case MODES.OWNER: return owner;
        case MODES.ALWAYS: return true;
        default: return false;
    }
}

// -------------------------------------------------------------------
// Textures and teardown
// -------------------------------------------------------------------

/**
 * Loads the two source diamonds once. Every slot on every token shares them, so the whole bar
 * batches into a couple of draw calls.
 * @returns {boolean} Whether the textures are ready to use right now.
 */
function _ensureTextures() {
    if (_bgTex && _fgTex) return true;
    if (_loading) return false;

    _loading = Promise.all([
        foundry.canvas.loadTexture(BG_PATH),
        foundry.canvas.loadTexture(FG_PATH)
    ]).then(([bg, fg]) => {
        _bgTex = bg;
        _fgTex = fg;
        // The 75x80 source renders at roughly a fifth of that size; mipmaps stop the diamonds
        // shimmering as the canvas is zoomed.
        for (const tex of [bg, fg]) {
            if (tex?.baseTexture) tex.baseTexture.mipmap = PIXI.MIPMAP_MODES.ON;
        }
        refreshHopeBars(); // Tokens drawn while the textures were loading have no bar yet.
    }).catch(err => {
        console.error(`${MODULE_ID} | Hope bar artwork failed to load`, err);
    });

    return false;
}

/**
 * Removes a token's Hope bar, if it has one.
 * @param {Token} token - The token placeable.
 * @returns {void}
 */
function _destroyBar(token) {
    const bar = _bars.get(token);
    if (!bar) return;
    _bars.delete(token);
    if (!bar.destroyed) bar.destroy({ children: true });
}
