/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Transfer Log
 * Posts a chat card listing what moved when items or currency are dragged between a character and
 * a party stash. The system makes those moves silently; this only records them, never blocks or reroutes
 * a drop. Drops that follow each other closely are gathered into one card per character/party pair.
 * Registered from the ready hook in main.js.
 */

import { MODULE_ID, TRANSFER_LOG_ENABLED } from "./constants.js";
import { GOLD_KEYS, getCurrencies, itemDisplay, postTransferSummary } from "./barter.js";

/** Actor types whose moves are recorded — one side of a transfer must be each. */
const PAIR_TYPES = ["character", "party"];

/** Quiet time after the last drop before its pair's card is posted. */
const FLUSH_DELAY_MS = 2500;

/** How far apart the two halves of one currency drop may land and still be paired. */
const PAIR_WINDOW_MS = 1000;

/**
 * Transfers waiting to be posted, keyed by `${characterId}|${partyId}`. Each entry holds both
 * actors, the moved lines keyed by origin, kind and item name or currency key, so repeated drops
 * of one item or one currency sum into a single line, and the pending flush timer.
 * @type {Map<string, {character: Actor, party: Actor, lines: Map<string, {fromId: string, kind: string, name: string, count: number}>, timer: number}>}
 */
const pending = new Map();

/**
 * Single-key gold changes written by this client that still wait for their other half.
 * @type {Array<{actor: Actor, key: string, delta: number, at: number}>}
 */
const unmatched = [];

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
 * @param {{kind: "item"|"gold", name: string, count: number}} entry - What moved; `name` is the
 *   item's display name, or the currency key for gold.
 * @returns {void}
 */
function record(fromActor, toActor, { kind, name, count }) {
    const character = fromActor.type === "character" ? fromActor : toActor;
    const party = character === fromActor ? toActor : fromActor;
    const key = `${character.id}|${party.id}`;

    let group = pending.get(key);
    if (!group) {
        group = { character, party, lines: new Map(), timer: null };
        pending.set(key, group);
    }

    const lineKey = `${fromActor.id}|${kind}|${name}`;
    const line = group.lines.get(lineKey) ?? { fromId: fromActor.id, kind, name, count: 0 };
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

    const currencies = getCurrencies();
    const summary = [...group.lines.values()].map(({ fromId, kind, name, count }) => {
        if (kind === "gold") {
            const currency = currencies.find(c => c.key === name)?.label ?? name;
            return { fromId, label: game.i18n.localize("DH_QUICKACTIONS.BARTER.summaryGold", { amount: count, currency }) };
        }
        return { fromId, label: count > 1 ? game.i18n.localize("DH_QUICKACTIONS.BARTER.summaryItem", { name, count }) : name };
    });
    // The speaker is the character side: it is the actor whose player acted, and a grouped card
    // can hold both directions, so it has no single origin.
    await postTransferSummary(game.i18n.localize("DH_QUICKACTIONS.TRANSFER_LOG.title"), group.character, group.party, summary, {
        speaker: ChatMessage.getSpeaker({ actor: group.character })
    });
}

/**
 * Pairs a gold change with the opposite change of another actor of the pair, or queues it to wait
 * for one. The two halves of a drop are not awaited in sequence, so either may arrive first.
 * @param {{actor: Actor, key: string, delta: number, at: number}} entry
 * @returns {void}
 */
function matchOrQueue(entry) {
    while (unmatched.length && entry.at - unmatched[0].at > PAIR_WINDOW_MS) unmatched.shift();
    const index = unmatched.findIndex(other => other.key === entry.key && other.delta === -entry.delta
        && other.actor !== entry.actor && isPair(other.actor, entry.actor));
    if (index < 0) {
        unmatched.push(entry);
        return;
    }
    const [other] = unmatched.splice(index, 1);
    const [from, to] = entry.delta < 0 ? [entry.actor, other.actor] : [other.actor, entry.actor];
    record(from, to, { kind: "gold", name: entry.key, count: Math.abs(entry.delta) });
}

/**
 * Wraps the system's `Actor#transferItem` and watches actor updates, so item and currency moves
 * between a character and a party are recorded.
 * Called from the ready hook in main.js.
 * @returns {void}
 */
export function registerTransferLog() {
    // The system's currency drop is two independent updates, origin down and target up by the same
    // amount, with nothing linking them; pairing them back is the only signal. Re-check this if the
    // system starts batching that drop. Wrapping the sheet's _onDrop instead would miss the case
    // where a player drops and the GM's client writes both updates.
    Hooks.on("preUpdateActor", (actor, changed, options) => {
        if (!PAIR_TYPES.includes(actor.type) || options[MODULE_ID]?.barter) return;
        if (!foundry.utils.hasProperty(changed, "system.gold")) return;
        // Stashed on the operation rather than in a module-level map, which would keep stale
        // entries when an update is refused after preUpdate. One options object is shared by every
        // actor of a batch operation, hence keyed by id.
        options[MODULE_ID] ??= {};
        (options[MODULE_ID].goldBefore ??= {})[actor.id] = { ...actor.system.gold };
    });

    Hooks.on("updateActor", (actor, changed, options, userId) => {
        if (userId !== game.user.id || options[MODULE_ID]?.barter) return;
        const before = options[MODULE_ID]?.goldBefore?.[actor.id];
        if (!before || !game.settings.get(MODULE_ID, TRANSFER_LOG_ENABLED)) return;
        const keys = Object.keys(foundry.utils.flattenObject(changed))
            .filter(k => k !== "_id" && !k.startsWith("_stats."));
        // Only an update touching exactly one gold key looks like the system's drop.
        if (keys.length !== 1 || !GOLD_KEYS.some(g => keys[0] === `system.gold.${g}`)) return;
        const key = keys[0].slice("system.gold.".length);
        const delta = (actor.system.gold?.[key] ?? 0) - (before[key] ?? 0);
        if (delta) matchOrQueue({ actor, key, delta, at: Date.now() });
    });

    const ActorClass = CONFIG.Actor.documentClass;
    const original = ActorClass.prototype.transferItem;
    if (typeof original !== "function") return;

    // The system routes every actor-to-actor item drop through transferItem({ item, quantity }),
    // and on a client that doesn't own both actors it only emits a socket and returns undefined;
    // the GM then runs the same method and gets the batch result. Logging on a result keeps the
    // record to the one client that wrote it. Re-check this if the system renames the method.
    // Wrapping one prototype method rather than replacing the system's Actor class with a subclass,
    // which would fight every other module doing the same; and rather than pairing createItem with
    // deleteItem/updateItem across two actors, which guesses at what this call already knows.
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
            if (moved > 0) record(origin, this, { kind: "item", name, count: moved });
        }
        return result;
    };
}
