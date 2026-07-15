/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "./constants.js";

/** Module id of the optional "Light Sources" module this integration targets. */
const LIGHT_SOURCES_MODULE_ID = "light-sources";

/**
 * Light source definitions for every light-bearing item in this module's Items compendium.
 * Matches the Entry Schema of the Light Sources module's `registerSources` API.
 *
 * `consume` is `true` only for items that are single-use/expendable by nature (Candle, Torch,
 * Matches, Glowstick, Emergency Flare) — durable fuel-burning equipment (lanterns, Oil Lamp,
 * Candelabra, Miner's Helmet) is not consumed by this flag since its actual fuel (e.g. oil
 * flasks) is tracked as a separate item outside this compendium.
 *
 * Duration values are converted to minutes from the "Duration:" line in each item's
 * description. Two items describe two possible fuel/duration options but ship with a single
 * light pattern here, so the duration picks one side: Miner's Helmet uses the Candle option
 * (1 hour) as the cheaper default, and Tactical Flashlight uses the High Beam option (2 hours)
 * since its only patterns (High Beam, Strobe) both correspond to high-intensity use. Matches
 * describe a 1-round duration, which has no direct minute equivalent — set to 1 minute as the
 * practical floor. All of these can be adjusted by the GM afterward in the Light Sources
 * module's Configure Light Sources window.
 * @type {Readonly<object[]>}
 */
const LIGHT_SOURCE_ENTRIES = Object.freeze([
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.1fFTkBx73yzxOlV3`, // Candle
        patterns: [
            {
                name: "Standard",
                light: { dim: 10, bright: 5, angle: 360, color: "#ffaa55", alpha: 0.2, animation: { type: "torch", speed: 2, intensity: 2, reverse: false } }
            }
        ],
        consume: true,
        durationMode: "world",
        durationMinutes: 60
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.1jDbk3QxoS5RRuu4`, // Alistair's Torch
        patterns: [
            {
                name: "Blinding Light",
                light: { dim: 240, bright: 120, angle: 360, color: "#eebbff", alpha: 0.6, animation: { type: "ghost", speed: 3, intensity: 4, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 0
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.68oCAtOyvAvs1dio`, // Hooded Lantern
        patterns: [
            {
                name: "Open",
                light: { dim: 60, bright: 30, angle: 360, color: "#ffcc44", alpha: 0.4, animation: { type: "torch", speed: 4, intensity: 4, reverse: false } }
            },
            {
                name: "Shuttered",
                light: { dim: 5, bright: 0, angle: 360, color: "#ffcc44", alpha: 0.1, animation: { type: "torch", speed: 2, intensity: 1, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 360
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.9JnM53wNZLEZGyFy`, // Miner's Helmet
        patterns: [
            {
                name: "Forward Beam",
                light: { dim: 60, bright: 30, angle: 60, color: "#ffcc44", alpha: 0.35, animation: { type: "torch", speed: 3, intensity: 3, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 60
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.FazQWlSPq24xDHwj`, // Bullseye Lantern
        patterns: [
            {
                name: "Directional Beam",
                light: { dim: 120, bright: 60, angle: 60, color: "#ffcc44", alpha: 0.4, animation: { type: "torch", speed: 4, intensity: 4, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 360
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.JxH9qnuJWQsmCsQL`, // Tactical Flashlight
        patterns: [
            {
                name: "High Beam",
                light: { dim: 120, bright: 60, angle: 30, color: "#ffffff", alpha: 0.6, animation: { type: "", speed: 0, intensity: 0, reverse: false } }
            },
            {
                name: "Strobe",
                light: { dim: 60, bright: 30, angle: 30, color: "#ffffff", alpha: 0.8, animation: { type: "pulse", speed: 10, intensity: 10, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 120
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.Kldt6DyQ48BzF5Iz`, // Smartphone
        patterns: [
            {
                name: "Camera Flash",
                light: { dim: 30, bright: 15, angle: 90, color: "#ddddff", alpha: 0.3, animation: { type: "", speed: 0, intensity: 0, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 240
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.NZjWWyH9JaLrC88m`, // Candelabra
        patterns: [
            {
                name: "Lit",
                light: { dim: 40, bright: 20, angle: 360, color: "#ffaa55", alpha: 0.4, animation: { type: "torch", speed: 3, intensity: 3, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 60
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.aq3dBdKJJn415mEf`, // Storm Lantern
        patterns: [
            {
                name: "Standard",
                light: { dim: 60, bright: 30, angle: 360, color: "#ffcc44", alpha: 0.4, animation: { type: "torch", speed: 3, intensity: 3, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 360
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.c7mo1VL19SHbLzhL`, // Matches
        patterns: [
            {
                name: "Spark",
                light: { dim: 10, bright: 5, angle: 360, color: "#ffdd44", alpha: 0.2, animation: { type: "pulse", speed: 8, intensity: 2, reverse: false } }
            }
        ],
        consume: true,
        durationMode: "world",
        durationMinutes: 1
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.fxRWWh0F5VCo4FNR`, // Glowstick
        patterns: [
            {
                name: "Neon Green",
                light: { dim: 20, bright: 10, angle: 360, color: "#00ff00", alpha: 0.4, animation: { type: "", speed: 0, intensity: 0, reverse: false } }
            }
        ],
        consume: true,
        durationMode: "world",
        durationMinutes: 720
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.iIHwv6YjjyPqgIAB`, // Torch
        patterns: [
            {
                name: "Standard",
                light: { dim: 40, bright: 20, angle: 360, color: "#ff8800", alpha: 0.5, animation: { type: "torch", speed: 6, intensity: 6, reverse: false } }
            }
        ],
        consume: true,
        durationMode: "world",
        durationMinutes: 60
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.kdmrQRjDAqWhXsO5`, // Emergency Flare
        patterns: [
            {
                name: "Sputtering Red",
                light: { dim: 100, bright: 50, angle: 360, color: "#ff2200", alpha: 0.6, animation: { type: "roiling", speed: 7, intensity: 8, reverse: false } }
            }
        ],
        consume: true,
        durationMode: "world",
        durationMinutes: 30
    },
    {
        uuid: `Compendium.${MODULE_ID}.items.Item.vx79OFR4aItsklBD`, // Oil Lamp
        patterns: [
            {
                name: "Standard",
                light: { dim: 30, bright: 15, angle: 360, color: "#ffbb44", alpha: 0.35, animation: { type: "torch", speed: 3, intensity: 3, reverse: false } }
            }
        ],
        consume: false,
        durationMode: "world",
        durationMinutes: 360
    }
]);

/**
 * Waits for the Light Sources module to assign its public API, retrying at a fixed interval.
 * Both modules attach their own logic to the `ready` hook, and Foundry does not guarantee any
 * relative order between different modules' async `ready` handlers — the API can still be
 * unassigned the instant this module's own `ready` handler runs.
 * @param {number} retries - Maximum number of polling attempts.
 * @param {number} delayMs - Delay between polling attempts, in milliseconds.
 * @returns {Promise<object|null>} The resolved API object, or `null` if it never appeared.
 */
async function waitForLightSourcesApi(retries = 20, delayMs = 250) {
    for (let i = 0; i < retries; i++) {
        const api = game.modules.get(LIGHT_SOURCES_MODULE_ID)?.api;
        if (api) return api;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return null;
}

/**
 * Registers this module's light-bearing compendium items with the Light Sources module's
 * public API, if that module is installed and active. Safe no-op otherwise.
 * Called from the `ready` hook in main.js.
 * @returns {Promise<void>}
 */
export async function registerLightSources() {
    const mod = game.modules.get(LIGHT_SOURCES_MODULE_ID);
    if (!mod?.active) return;

    const api = await waitForLightSourcesApi();
    if (!api) {
        console.warn("Daggerheart Quick Actions | Light Sources is active but its API never became available");
        return;
    }

    await api.registerSources(LIGHT_SOURCE_ENTRIES, { managedBy: MODULE_ID });
    console.log("Daggerheart Quick Actions | Registered light sources with the Light Sources module");
}
