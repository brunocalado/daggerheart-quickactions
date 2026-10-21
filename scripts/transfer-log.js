/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Transfer Log
 * Posts a chat card listing what moved when items are dragged between a character and a party
 * stash. The system makes those moves silently; this only records them, never blocks or reroutes
 * a drop. Drops that follow each other closely are gathered into one card per character/party pair.
 * Registered from the ready hook in main.js.
 */

import { MODULE_ID, TRANSFER_LOG_ENABLED } from "./constants.js";
import { itemDisplay, postTransferSummary } from "./barter.js";

/** Actor types whose moves are recorded — one side of a transfer must be each. */
const PAIR_TYPES = ["character", "party"];

/** Quiet time after the last drop before its pair's card is posted. */
const FLUSH_DELAY_MS = 2500;

/**
 * Transfers waiting to be posted, keyed by `${characterId}|${partyId}`. Each entry holds both
 * actors, the moved lines keyed by `${fromId}|${name}` so repeated drops of one item sum into a
 * single line, and the pending flush timer.
 * @type {Map<string, {character: Actor, party: Actor, lines: Map<string, {fromId: string, name: string, count: number}>, timer: number}>}
 */
const pending = new Map();

/**
 * Tests whether two actors form a character/party pair, in either order.
 * @param {Actor} a
 * @param {Actor} b
 * @returns {boolean}
 */
function isPair(a, b) {
    return !!a && !!b && a.type !== b.type && PAIR_TYPES.includes(a.type) && PAIR_TYPES.includes(b.type);
}

/**
 * Adds one moved entry to its pair's pending card and (re)starts that pair's flush timer.
 * @param {Actor} fromActor - The actor the entry left.
 * @param {Actor} toActor - The actor the entry reached.
 * @param {{name: string, count: number}} entry - What moved.
 * @returns {void}
 */
function record(fromActor, toActor, { name, count }) {
    const character = fromActor.type === "character" ? fromActor : toActor;
    const party = character === fromActor ? toActor : fromActor;
    const key = `${character.id}|${party.id}`;

    let group = pending.get(key);
    if (!group) {
        group = { character, party, lines: new Map(), timer: null };
        pending.set(key, group);
    }

    const lineKey = `${fromActor.id}|${name}`;
    const line = group.lines.get(lineKey) ?? { fromId: fromActor.id, name, count: 0 };
    line.count += count;
    group.lines.set(lineKey, line);

    clearTimeout(group.timer);
    group.timer = setTimeout(() => flush(key), FLUSH_DELAY_MS);
}

/**
 * Posts a pair's pending card and forgets it.
 * @param {string} key - Pair key in {@link pending}.
 * @returns {Promise<void>}
 */
async function flush(key) {
    const group = pending.get(key);
    pending.delete(key);
    if (!group?.lines.size) return;

    const summary = [...group.lines.values()].map(({ fromId, name, count }) => ({
        fromId,
        label: count > 1 ? game.i18n.localize("DH_QUICKACTIONS.BARTER.summaryItem", { name, count }) : name
    }));
    // The speaker is the character side: it is the actor whose player acted, and a grouped card
    // can hold both directions, so it has no single origin.
    await postTransferSummary(game.i18n.localize("DH_QUICKACTIONS.TRANSFER_LOG.title"), group.character, group.party, summary, {
        speaker: ChatMessage.getSpeaker({ actor: group.character })
    });
}

/**
 * Wraps the system's `Actor#transferItem` so item moves between a character and a party are
 * recorded.
 * Called from the ready hook in main.js.
 * @returns {void}
 */
export function registerTransferLog() {
    const ActorClass = CONFIG.Actor.documentClass;
    const original = ActorClass.prototype.transferItem;
    if (typeof original !== "function") return;

    // The system routes every actor-to-actor item drop through transferItem({ item, quantity }),
    // and on a client that doesn't own both actors it only emits a socket and returns undefined;
    // the GM then runs the same method and gets the batch result. Logging on a result keeps the
    // record to the one client that wrote it. Re-check this if the system renames the method.
    ActorClass.prototype.transferItem = async function (args) {
        const item = args?.item;
        const origin = item?.actor;
        const tracked = game.settings.get(MODULE_ID, TRANSFER_LOG_ENABLED) && isPair(origin, this);
        // Read before the move: a fully moved item is deleted from the origin. The card is public,
        // so a mystified item keeps its mask even when the GM writes it.
        const name = tracked ? itemDisplay(item, { asGM: false }).name : null;
        const id = item?.id;
        const before = item?.system?.quantity ?? 1;

        const result = await original.call(this, args);

        if (tracked && Array.isArray(result) && result.length) {
            // What left the origin, not the requested quantity: the system's transfer dialog
            // resolves undefined when closed without confirming, and the drop still reaches here.
            const moved = before - (origin.items.get(id)?.system?.quantity ?? 0);
            if (moved > 0) record(origin, this, { name, count: moved });
        }
        return result;
    };
}
