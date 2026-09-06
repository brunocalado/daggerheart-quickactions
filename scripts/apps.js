/**
 * Consolidated file containing all Quick Actions applications.
 * Contains: Downtime (Fear), Falling Damage, Help an Ally, Scar Check, Loot & Consumables, Fate Roll, Hope Spender, Templates, and Level Up.
 * Compatible with Foundry V13 (ApplicationV2).
 */

import { MODULE_ID, LOOT_CONSUMABLE_SOURCE, LOOT_CONSUMABLE_TABLES, LOOT_SOURCE } from "./constants.js";
import { buildChatCard } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// HELPERS
// ==================================================================

export async function rollD4WithDiceSoNice() {
    try {
        const roll = new Roll("1d4");
        await roll.evaluate();
        if (game.dice3d) {
            await game.dice3d.showForRoll(roll, game.user, true);
        }
        return roll.total;
    } catch (error) {
        console.error("Error rolling 1d4:", error);
        ui.notifications.error("Error rolling the die!");
        return null;
    }
}

export async function rollD6WithDiceSoNice() {
    try {
        const roll = new Roll("1d6");
        await roll.evaluate();
        if (game.dice3d) {
            await game.dice3d.showForRoll(roll, game.user, true);
        }
        return roll.total;
    } catch (error) {
        console.error("Error rolling 1d6:", error);
        ui.notifications.error("Error rolling the die!");
        return null;
    }
}

/**
 * Executes the visual fate roll logic (Cards, Colors, Dice So Nice settings)
 */
async function performVisualFateRoll(dieFormula, rollType) {
    const actor = canvas.tokens.controlled[0]?.actor || game.user.character;
    const roll = new Roll(dieFormula);
    await roll.evaluate();

    let appearance = {};

    if (rollType === 'hope') {
        appearance = {
            colorset: "custom",
            foreground: "#000000",
            background: "#FFD700",
            outline: "#000000",
            texture: "none"
        };
    } else if (rollType === 'fear') {
        appearance = {
            colorset: "custom",
            foreground: "#FFFFFF",
            background: "#2c003e",
            outline: "#000000",
            texture: "none"
        };
    }

    if (roll.terms[0]) {
        roll.terms[0].options.appearance = appearance;
    }

    const title = `${rollType.charAt(0).toUpperCase() + rollType.slice(1)} Roll`;
    const glowColor = rollType === 'hope' ? '#FFD700' : '#800080';
    const content = buildChatCard(title, `
        <div style="color: #ffffff; font-size: 0.9em; margin-bottom: 5px;">Result</div>
        <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px ${glowColor}, 2px 2px 0px #000; font-family: 'Lato', sans-serif; line-height: 1;">
            ${roll.total}
        </div>
    `);

    await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: actor }),
        content: content,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}

// ==================================================================
// 1. DOWNTIME APP
// ==================================================================
class DowntimeApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "downtime-app",
        classes: ["dh-qa-app", "downtime-app"],
        window: { title: "Choose Rest Type", icon: "fas fa-bed", resizable: false, controls: [] },
        position: { width: 400, height: "auto" },
        actions: { shortRest: DowntimeApp.prototype._onShortRest, longRest: DowntimeApp.prototype._onLongRest }
    };
    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/downtime.hbs` } };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.numberOfPCs = game.settings.get(MODULE_ID, "downtimePCs");
        return context;
    }
    async _onShortRest() { await this._processRest("short"); this.close(); }
    async _onLongRest() { await this._processRest("long"); this.close(); }

    async _processRest(type) {
        const pcInput = this.element.querySelector('[name="numberOfPCs"]');
        let numberOfPCs = pcInput && pcInput.value ? parseInt(pcInput.value, 10) : 4;
        await game.settings.set(MODULE_ID, "downtimePCs", numberOfPCs);

        const currentFear = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear);
        const fearRoll = await rollD4WithDiceSoNice();
        if (fearRoll === null) return;

        let addedFear = fearRoll;
        let calculationText = `(1d4) ${fearRoll}`;
        if (type === "long") {
            addedFear += numberOfPCs;
            calculationText = `(1d4 + ${numberOfPCs} PCs) ${fearRoll} + ${numberOfPCs}`;
        }
        let newFear = Math.min(currentFear + addedFear, 12);
        await game.settings.set(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Resources.Fear, newFear);

        const MESSAGE_TITLE = type === "short" ? "Short Rest" : "Long Rest";
        const content = buildChatCard(MESSAGE_TITLE, `
            <div style="color: #ffffff; font-size: 1.4em; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; font-family: 'Aleo', serif;">The GM earns Fear</div>
            <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 15px #800080, 2px 2px 2px #000; font-family: 'Lato', sans-serif;">+${addedFear}</div>
            <div style="color: #ccc; font-size: 0.8em; margin-top: 5px; font-style: italic;">${calculationText}</div>
            <div style="color: #e0e0e0; font-size: 0.9em; margin-top: 8px; font-weight: bold; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 4px;">Current Total: ${newFear}</div>
        `);
        await ChatMessage.create({ user: game.user.id, style: CONST.CHAT_MESSAGE_STYLES.OTHER, content: content });
    }
}

// ==================================================================
// 2. FALLING DAMAGE APP
// ==================================================================
class FallingDamageApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "falling-damage-app",
        classes: ["dh-qa-app", "falling-app"],
        window: { title: "Falling & Collision Damage", icon: "fas fa-skull-crossbones", resizable: false, controls: [] },
        position: { width: 420, height: "auto" },
        actions: { rollDamage: FallingDamageApp.prototype._onRollDamage, cancel: FallingDamageApp.prototype._onCancel }
    };
    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/falling.hbs` } };

    /**
     * Prepares context data with current falling damage formulas from settings.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context with formulas.
     */
    async _prepareContext(_options) {
        const formulas = game.settings.get(MODULE_ID, "fallingDamageFormulas");
        return { formulas };
    }

    async _onRollDamage(event, target) {
        const selection = target.dataset.height;
        if (!selection) return;
        const formulas = game.settings.get(MODULE_ID, "fallingDamageFormulas");
        let damageFormula = "", heightText = "", damageType = "Physical Damage";
        switch (selection) {
            case "veryclose": damageFormula = formulas.veryclose; heightText = "Very Close Range"; break;
            case "close": damageFormula = formulas.close; heightText = "Close Range"; break;
            case "far": damageFormula = formulas.far; heightText = "Far/Very Far Range"; break;
            case "collision": damageFormula = formulas.collision; heightText = "Collision"; damageType = "Direct Physical Damage"; break;
        }
        try {
            const roll = new Roll(damageFormula);
            await roll.evaluate();
            // BaseRoll class is required so Foundry uses foundryRoll.hbs, which renders the Deal Damage / Apply Healing buttons.
            const rollJSON = roll.toJSON();
            rollJSON.class = 'BaseRoll';
            await foundry.documents.ChatMessage.implementation.create({
                author: game.user.id,
                speaker: foundry.documents.ChatMessage.implementation.getSpeaker(),
                flavor: `${heightText} — ${damageType} (${damageFormula})`,
                rolls: [rollJSON],
                sound: CONFIG.sounds.dice
            });
            this.close();
        } catch (error) { console.error("Falling Damage Error:", error); ui.notifications.error("Error calculating falling damage."); }
    }
    _onCancel() { this.close(); }
}

// ==================================================================
// 4. LOOT & CONSUMABLES APP
// ==================================================================

/**
 * How many d12s may be stacked. Each Daggerheart table holds 60 rarity-ordered entries — five
 * bands of twelve — so 5d12 (max 60) already reaches the last one. The ceiling does not change
 * with the source: both books share one rarity scale, they do not extend it.
 * @type {number}
 */
const MAX_DICE = 5;

/**
 * How many dice Dice So Nice renders in one throw. The queue's source coins are flipped together
 * so the picks cost a single animation, which means a long enough queue could out-run that cap —
 * such a queue is split into several throws rather than flipping coins nobody sees land.
 * @type {number}
 */
const MAX_DSN_DICE = 20;

/** Actor type of the Daggerheart party sheet, which carries its own inventory and gold. */
const PARTY_TYPE = "party";

/**
 * Party sheets the given character belongs to and that this user can write to. `Actor#parties` is
 * maintained by the system — DhParty#prepareBaseData registers the party on each of its members —
 * so it is the same relationship the sheet's own "view party" button follows. OWNER is required
 * because handing loot over means creating items on the party actor.
 * @param {foundry.documents.Actor|null} actor - The rolling user's linked character.
 * @returns {Array<foundry.documents.Actor>} Eligible parties, the world's active party first.
 */
function getOwnedParties(actor) {
    const parties = [...(actor?.parties ?? [])].filter(p => p?.type === PARTY_TYPE && p.isOwner);
    const active = game.actors.party;
    return parties.sort((a, b) => (b === active) - (a === active));
}

/**
 * One-line summary of a queued draw, shown in the dialog's pending list.
 * @param {{type: string, diceCount?: number, coinsTier?: number}} entry - Queue entry.
 * @returns {string} Label such as "Loot — 3d12" or "Coins — Tier 2".
 */
function describeQueueEntry(entry) {
    return entry.type === "Coins" ? `Coins — Tier ${entry.coinsTier}` : `${entry.type} — ${entry.diceCount}d12`;
}

class LootConsumableApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) {
        super(options);
        this.localState = { type: "Loot", diceCount: 1, coinsTier: 1, queue: [], toParty: false };
    }
    static DEFAULT_OPTIONS = {
        tag: "form", id: "loot-consumable-app", classes: ["dh-qa-app", "loot-consumable-app"],
        window: { title: "Loot & Consumables", icon: "fas fa-treasure-chest", resizable: false, controls: [] },
        position: { width: 450, height: "auto" },
        actions: {
            selectType: LootConsumableApp.prototype._onSelectType,
            adjustDice: LootConsumableApp.prototype._onAdjustDice,
            selectTier: LootConsumableApp.prototype._onSelectTier,
            queueRoll: LootConsumableApp.prototype._onQueueRoll,
            unqueueRoll: LootConsumableApp.prototype._onUnqueueRoll,
            selectDestination: LootConsumableApp.prototype._onSelectDestination,
            roll: LootConsumableApp.prototype._onRoll
        }
    };
    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/lootConsumable.hbs` } };

    /** @returns {number} How many books the configured source draws from — 2 for "Both". */
    get tableCount() {
        return game.settings.get(MODULE_ID, LOOT_CONSUMABLE_SOURCE) === LOOT_SOURCE.BOTH ? 2 : 1;
    }

    /** @returns {number} Largest dice pool that can still land on a new rarity position. */
    get maxDice() { return MAX_DICE; }

    /**
     * Builds context for the template: mode flags, the dice pool and its live ceiling, the
     * pending queue, and where the results are headed.
     * @param {object} options - Render options.
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(options) {
        const maxDice = this.maxDice;
        const diceCount = Math.min(this.localState.diceCount, maxDice);
        this.localState.diceCount = diceCount;

        // Spells out what the current pool actually buys: the rarity band it can land on, and how
        // many entries sit on that band once both books are in play. This is the whole point of
        // the second source — twice the candidates at the same rarity, not rarer loot.
        const reachHint = `Reaches ${diceCount}–${diceCount * 12} · ${(diceCount * 12 - diceCount + 1) * this.tableCount} items in reach`;

        const linkedActor = game.user.character;
        const party = getOwnedParties(linkedActor)[0] ?? null;
        if (!party) this.localState.toParty = false;

        return {
            isLoot: this.localState.type === "Loot",
            isConsumable: this.localState.type === "Consumable",
            isCoins: this.localState.type === "Coins",
            diceCount,
            maxDice,
            reachHint,
            atMinDice: diceCount <= 1,
            atMaxDice: diceCount >= maxDice,
            coinsTier: this.localState.coinsTier,
            queue: this.localState.queue.map((entry, index) => ({ index, label: describeQueueEntry(entry) })),
            queueSize: this.localState.queue.length,
            hasQueue: this.localState.queue.length > 0,
            hasParty: Boolean(party),
            toParty: this.localState.toParty,
            partyName: party?.name ?? ""
        };
    }

    _onSelectType(event, target) { this.localState.type = target.dataset.type; this.render(); }

    /**
     * Adds or removes a d12 from the roll pool. More dice push the (bell-curved) total further
     * down the rarity-ordered table — and, with the "Both" source, into the Hope & Fear range.
     * @param {PointerEvent} event - Click event.
     * @param {HTMLElement} target - The clicked +/- button, carrying data-delta.
     */
    _onAdjustDice(event, target) {
        const delta = Number(target.dataset.delta) || 0;
        this.localState.diceCount = Math.max(1, Math.min(this.maxDice, this.localState.diceCount + delta));
        this.render();
    }

    /**
     * Stores the selected coin tier in local state and re-renders.
     * @param {PointerEvent} event - Click event.
     * @param {HTMLElement} target - The clicked tier button.
     */
    _onSelectTier(event, target) { this.localState.coinsTier = Number(target.dataset.tier); this.render(); }

    /** @returns {object} The dialog's current selection, as a queue entry. */
    _currentEntry() {
        const { type, diceCount, coinsTier } = this.localState;
        return type === "Coins" ? { type, coinsTier } : { type, diceCount };
    }

    /**
     * Stacks the current selection onto the pending queue, so a GM call like "3d12 loot and then
     * 2d12 loot" is set up once and resolved by a single ROLL into a single chat card.
     * Triggered by `data-action="queueRoll"`.
     */
    _onQueueRoll() {
        this.localState.queue.push(this._currentEntry());
        this.render();
    }

    /**
     * Drops one pending entry from the queue.
     * @param {PointerEvent} event - Click event.
     * @param {HTMLElement} target - The clicked remove button, carrying data-index.
     */
    _onUnqueueRoll(event, target) {
        this.localState.queue.splice(Number(target.dataset.index), 1);
        this.render();
    }

    /**
     * Picks where the results land — the rolling character's own sheet, or their party stash.
     * The two buttons behave as a radio pair, so exactly one is always active.
     * @param {PointerEvent} event - Click event.
     * @param {HTMLElement} target - The clicked button, carrying data-destination.
     */
    _onSelectDestination(event, target) {
        this.localState.toParty = target.dataset.destination === "party";
        this.render();
    }

    /**
     * Loads the roll table(s) for one draw type and flattens them into a rarity-position index.
     * Done once per type per ROLL rather than once per queue entry: the tables cannot change
     * mid-roll, so a queue of five draws used to re-read the same compendium documents and
     * rebuild the same index five times over.
     * @param {string} type - Draw type, "Loot" or "Consumable".
     * @returns {Promise<{tables: Array<foundry.documents.RollTable>, byPosition: Map<number, Array<object>>, span: number}|null>}
     *          The loaded index, or null when the tables could not be resolved (a notification has
     *          already been raised).
     */
    async _resolveTableSet(type) {
        // Resolved by stable compendium id (fromUuid), never by name: Daggerheart 2.9.2 renamed
        // these tables ("Loot" -> "Core Set Items", "Consumables" -> "Core Set Consumables").
        const uuids = LOOT_CONSUMABLE_TABLES[type];
        if (!uuids) { ui.notifications.error(`Unknown loot type '${type}'.`); return null; }

        const source = game.settings.get(MODULE_ID, LOOT_CONSUMABLE_SOURCE);
        const sourceKeys = source === LOOT_SOURCE.BOTH ? [LOOT_SOURCE.CORE, LOOT_SOURCE.HOPE_AND_FEAR] : [source];

        const tables = [];
        for (const key of sourceKeys) {
            const doc = await fromUuid(uuids[key]);
            if (doc) tables.push(doc);
        }
        if (!tables.length) { ui.notifications.error("Daggerheart loot/consumable roll table not found — is the system installed?"); return null; }

        // Both books share ONE rarity scale rather than being chained end to end: position 7 is
        // the seventh-cheapest entry in *either* book. Chaining them would bury the Hope & Fear
        // commons past position 60, where no sane dice pool reaches them — this way a 1d12 sees
        // 24 common items instead of 12, which is the point of enabling the second source.
        const byPosition = new Map();
        let span = 0;
        for (const t of tables) {
            for (const r of t.results) {
                span = Math.max(span, r.range[1]);
                for (let p = r.range[0]; p <= r.range[1]; p++) {
                    if (!byPosition.has(p)) byPosition.set(p, []);
                    byPosition.get(p).push({ table: t, result: r });
                }
            }
        }

        return { tables, byPosition, span };
    }

    /**
     * Flips the source coins for a whole queue in one throw, before any draw happens — heads takes
     * the Hope & Fear entry, tails the Core Set one.
     *
     * A coin rather than the old second d12 because it is unmistakable: it lands among nothing but
     * d12s and reads as a coin flip at a glance, where a second d12 needed its own separate throw
     * to be told apart from the pool. Thrown up front rather than per draw because the source pick
     * is not the dramatic beat — the pool is. This trades N single-die animations for one, and
     * every draw still gets its own d12 moment afterwards.
     * @param {number} count - How many coins to flip; 0 throws nothing.
     * @returns {Promise<Array<boolean>>} One flag per coin, in order: true when Hope & Fear won.
     */
    async _flipSourceCoins(count) {
        const flips = [];
        for (let thrown = 0; thrown < count; thrown += MAX_DSN_DICE) {
            const roll = new Roll(`${Math.min(MAX_DSN_DICE, count - thrown)}dc`);
            await roll.evaluate();
            if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
            // Coin#getResultLabel maps 1 to heads and 0 to tails. Read the faces individually —
            // roll.total would just sum them into a meaningless count of heads.
            for (const r of roll.dice[0].results) flips.push(r.result === 1);
        }
        return flips;
    }

    /**
     * Resolves one queued loot/consumable draw against an already-loaded table index.
     * @param {{type: string, diceCount: number}} entry - Queue entry to resolve.
     * @param {object} tableSet - The index for this entry's type, from _resolveTableSet.
     * @param {boolean} hopeAndFear - Whether this draw's source coin came up heads.
     * @returns {Promise<object>} The draw.
     */
    async _resolveDraw(entry, tableSet, hopeAndFear) {
        const { byPosition, span } = tableSet;

        const formula = `${Math.max(1, Number(entry.diceCount) || 1)}d12`;
        const roll = new Roll(formula);
        await roll.evaluate();

        if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

        const total = Math.max(1, Math.min(span, roll.total));
        // Candidates land in table order, so index 0 is always the Core Set entry. A position only
        // one book covers has a single candidate, and the coin is ignored rather than discarding
        // the result.
        const candidates = byPosition.get(total) ?? [];
        const picked = (hopeAndFear && candidates.length > 1) ? candidates[1] : candidates[0];

        // TableResult#uuid is the *result document's own* uuid — linking it opens the Table Result
        // sheet instead of the item. The referenced document lives in `documentUuid` (V13+ schema).
        const result = picked?.result ?? null;
        return {
            formula,
            total,
            result,
            table: picked?.table ?? null,
            referencedUuid: result?.type === "document" ? result.documentUuid : null
        };
    }

    async _onRoll(event, target) {
        // Whisper to GM(s) and the rolling user only — deduplicate in case the roller is also GM.
        const gmIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        const whisper = [...new Set([...gmIds, game.user.id])];

        // ROLL resolves the whole pending queue; with nothing queued it just rolls what is on
        // screen, which keeps the one-off case a single click.
        const entries = this.localState.queue.length ? [...this.localState.queue] : [this._currentEntry()];

        // Every table the queue touches, loaded once up front. This also settles which draws even
        // need a source coin: with a single configured book there is nothing to choose between.
        const tableSets = new Map();
        const coinTiers = new Map();
        for (const entry of entries) {
            if (entry.type === "Coins") {
                if (coinTiers.has(entry.coinsTier)) continue;
                const tier = game.settings.get(MODULE_ID, "coinTierRanges")?.[`tier${entry.coinsTier}`];
                if (!tier) { ui.notifications.error(`Coin tier ${entry.coinsTier} is not configured.`); return; }
                coinTiers.set(entry.coinsTier, tier);
                continue;
            }
            if (tableSets.has(entry.type)) continue;
            const set = await this._resolveTableSet(entry.type);
            // Nothing has been written yet and no die has been thrown, so bailing anywhere in this
            // pre-flight leaves the queue and both actors untouched — the GM can fix the setting
            // and roll again without having watched a doomed roll play out first.
            if (!set) return;
            tableSets.set(entry.type, set);
        }

        // One throw settles every source pick in the queue, then the draws roll one at a time.
        const needsCoin = entries.map(e => e.type !== "Coins" && tableSets.get(e.type).tables.length > 1);
        const flips = await this._flipSourceCoins(needsCoin.filter(Boolean).length);
        let flipIndex = 0;
        const hopeAndFearByEntry = needsCoin.map(needs => needs && flips[flipIndex++]);

        const linkedActor = game.user.character;
        const party = getOwnedParties(linkedActor)[0] ?? null;
        const destination = (this.localState.toParty && party) ? party : linkedActor;

        const rows = [];
        const drawnUuids = [];
        let coinTotal = 0;

        for (const [index, entry] of entries.entries()) {
            if (entry.type === "Coins") {
                const tier = coinTiers.get(entry.coinsTier);
                const amount = Math.floor(Math.random() * (tier.max - tier.min + 1)) + tier.min;
                coinTotal += amount;
                rows.push(this._buildRow(`Coins &middot; Tier ${entry.coinsTier}`, `<i class="fas fa-coins"></i> ${amount} Coins`, null, rows.length));
                continue;
            }

            const draw = await this._resolveDraw(entry, tableSets.get(entry.type), hopeAndFearByEntry[index]);

            if (draw.referencedUuid) drawnUuids.push(draw.referencedUuid);
            const name = draw.result ? (draw.result.name || draw.result.description) : "Nothing found";
            const display = draw.referencedUuid ? `@UUID[${draw.referencedUuid}]{${name}}` : name;
            const meta = `${entry.type} &middot; ${draw.formula} &rarr; ${draw.total}${draw.table ? ` &middot; ${foundry.utils.escapeHTML(draw.table.name)}` : ""}`;
            rows.push(this._buildRow(meta, display, draw.result?.img ?? null, rows.length));
        }

        // One batch per collection rather than a write per queue entry.
        if (destination) {
            if (drawnUuids.length) {
                try {
                    const sources = [];
                    // Cached because a queue can draw the same entry twice — two copies of one
                    // item is a legitimate result, but it is not two reasons to load it.
                    const resolved = new Map();
                    for (const uuid of drawnUuids) {
                        if (!resolved.has(uuid)) resolved.set(uuid, await fromUuid(uuid));
                        const doc = resolved.get(uuid);
                        // Guard: only embed if the resolved document is actually an Item.
                        if (doc instanceof Item) sources.push(doc.toObject());
                    }
                    if (sources.length) await destination.createEmbeddedDocuments("Item", sources);
                } catch (err) {
                    console.error(`${MODULE_ID} | Failed to add rolled items to ${destination.name}:`, err);
                }
            }
            if (coinTotal) {
                const currentCoins = foundry.utils.getProperty(destination, "system.gold.coins");
                if (currentCoins !== undefined) {
                    await destination.update({ "system.gold.coins": currentCoins + coinTotal });
                }
            }
        }

        // Record where everything landed, so the table can see whether it went to the party stash
        // or into one character's pocket.
        const granted = drawnUuids.length > 0 || coinTotal > 0;
        const destinationLine = (destination && granted)
            ? `<div style="color: #ccc; font-size: 0.85em; margin-bottom: 10px; font-style: italic;">
                   <i class="fas ${destination === party ? "fa-users" : "fa-user"}"></i>
                   Sent to <strong style="color: #C9A060;">${foundry.utils.escapeHTML(destination.name)}</strong>${destination === party ? " (party stash)" : ""}
               </div>`
            : "";

        const title = entries.length > 1 ? "Loot & Consumables" : `${entries[0].type} Roll`;
        const content = buildChatCard(title, `${destinationLine}${rows.join("")}`);
        await ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker(), content, style: CONST.CHAT_MESSAGE_STYLES.OTHER, whisper });

        this.localState.queue = [];
        this.render();
    }

    /**
     * One result block of the chat card. Kept inline-styled like every other card in this module,
     * since chat content is stored as raw HTML and cannot rely on the module stylesheet.
     * @param {string} metaHtml - Small caption line (type, formula, total, table).
     * @param {string} bodyHtml - The result itself — an @UUID link, a name, or a coin amount.
     * @param {string|null} img - Optional artwork for the drawn entry.
     * @param {number} index - Position in the card; anything past the first gets a separator.
     * @returns {string} HTML for the row.
     */
    _buildRow(metaHtml, bodyHtml, img, index) {
        const separator = index > 0 ? "border-top: 1px solid rgba(255,255,255,0.15); margin-top: 10px; padding-top: 10px;" : "";
        const artwork = img ? `<img src="${img}" style="width: 40px; height: 40px; border: none; flex: 0 0 auto;" />` : "";
        return `
            <div style="width: 100%; ${separator}">
                <div style="color: #C9A060; font-size: 0.8em; letter-spacing: 0.5px; margin-bottom: 4px;">${metaHtml}</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    ${artwork}
                    <div style="color: #ffffff !important; font-size: 1.3em; font-weight: bold; text-shadow: 0px 0px 10px #C9A060; font-family: 'Lato', sans-serif; line-height: 1.2;">${bodyHtml}</div>
                </div>
            </div>`;
    }
}

// ==================================================================
// 5. HELP AN ALLY
// ==================================================================
export async function helpAnAlly() {
    const selectedToken = canvas.tokens.controlled[0];
    if (!selectedToken) { ui.notifications.warn("Please select a token first!"); return; }
    const actor = selectedToken.actor;
    if (!actor) return;
    const currentHope = actor.system.resources?.hope?.value;
    if (currentHope === undefined) { ui.notifications.warn("No Hope resource!"); return; }

    if (currentHope <= 0) {
        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({actor: actor}),
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            content: buildChatCard("Help an Ally", `
                <i class="fas fa-heart-broken" style="font-size: 32px; color: #ff6b6b; margin-bottom: 10px;"></i>
                <div style="color: #ff6b6b; font-size: 1.1em; font-weight: bold; font-family: 'Aleo', serif;">No Hope remaining!</div>
            `)
        });
        return;
    }

    const roll = new Roll("1d6"); await roll.evaluate();
    await actor.update({"system.resources.hope.value": currentHope - 1});

    const content = buildChatCard("Help an Ally", `
        <div style="color: #ffffff !important; font-size: 3.5em; font-weight: bold; text-shadow: 0px 0px 15px #4CAF50, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">${roll.total}</div>
        <div style="color: #ccc; font-size: 0.9em; margin-top: 10px; font-style: italic;">Hope used: ${currentHope} → ${currentHope - 1}</div>
    `);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({actor: actor}), flavor: "<strong>Help an Ally</strong>", content: content });
}

// ==================================================================
// 6. SCAR CHECK
// ==================================================================
export async function scarCheck() {
    const token = canvas.tokens.controlled[0];
    if (!token || !token.actor) { ui.notifications.error("Select a token with an actor!"); return; }
    
    const currentLevel = token.actor.system.levelData?.level?.current;
    if (currentLevel === undefined) { ui.notifications.error("Could not find level data!"); return; }

    const roll = new Roll("1d12"); await roll.evaluate();
    const isScar = roll.total <= currentLevel;
    const resultColor = isScar ? "#ff6b6b" : "#4CAF50";
    const resultTitle = isScar ? "YOU TAKE A SCAR" : "SAFE";
    const resultIcon = isScar ? "fas fa-skull" : "fas fa-shield-alt";
    const resultDesc = isScar ? "Mark a Scar manually on your sheet." : "No scar taken.";

    const content = buildChatCard("Scar Check", `
        <div style="color: #ccc; font-size: 0.9em; margin-bottom: 5px; font-weight: bold; text-shadow: 1px 1px 0 #000;">Level: ${currentLevel} vs Roll:</div>
        <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 10px ${resultColor}, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">${roll.total}</div>
        <i class="${resultIcon}" style="font-size: 24px; color: ${resultColor}; margin: 10px 0; text-shadow: 1px 1px 0 #000;"></i>
        <div style="color: ${resultColor}; font-size: 1.2em; font-weight: bold; text-transform: uppercase; font-family: 'Aleo', serif; text-shadow: 1px 1px 0 #000;">${resultTitle}</div>
        <div style="color: #eee; font-size: 0.9em; margin-top: 5px; font-style: italic;">${resultDesc}</div>
    `);
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({token: token}), flavor: "<strong>Scar Check</strong>", content: content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
}

// ==================================================================
// 7. SPOTLIGHT TOKEN
// ==================================================================
export async function spotlightToken() {
    if (!game.combat) return ui.notifications.warn("No active combat found!");
    const token = canvas.tokens.controlled[0];
    if (!token || !token.inCombat) return ui.notifications.warn("Select a combatant token!");
    const turnIndex = game.combat.turns.findIndex(turn => turn.id === token.combatant?.id);
    if (turnIndex !== -1) await game.combat.update({ turn: turnIndex });
    else ui.notifications.warn("Token not found in combat.");
}

// ==================================================================
// 8. SHOW MACROS APP
// ==================================================================
class ShowMacrosApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(macroNames, options = {}) { super(options); this.macroNames = macroNames; }
    static DEFAULT_OPTIONS = { tag: "form", id: "show-macros-app", classes: ["dh-qa-app", "show-macros-app"], window: { title: "Macros", icon: "fas fa-play-circle", resizable: true }, position: { width: 300, height: "auto" }, actions: { executeMacro: ShowMacrosApp.prototype._onExecuteMacro } };
    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/showmacros.hbs` } };

    async _prepareContext(options) {
        const macroList = [];
        const pack = game.packs.get(`${MODULE_ID}.macros`);
        let index = pack ? await pack.getIndex() : null;

        for (const input of this.macroNames) {
            let identifier = input, displayName = input, displayImg = "icons/svg/dice-target.svg";
            if (typeof input === "object" && input !== null) { identifier = input.uuid; displayName = input.name; displayImg = input.img; }
            if (typeof input === "string") {
                if (index) { const entry = index.find(m => m.name === input); if (entry) { displayName = entry.name; displayImg = entry.img; } }
                try { const doc = await fromUuid(input); if (doc) { displayName = doc.name; displayImg = doc.img; } } catch(e){}
                if (!input.includes(".")) { const wm = game.macros.get(input); if (wm) { displayName = wm.name; displayImg = wm.img; identifier = wm.uuid; } }
            }
            if (identifier) macroList.push({ id: identifier, name: displayName, img: displayImg });
        }
        return { macros: macroList };
    }

    async _onExecuteMacro(event, target) {
        const identifier = target.dataset.macro;
        let macro = null;
        const pack = game.packs.get(`${MODULE_ID}.macros`);
        if (pack) { const index = await pack.getIndex(); const entry = index.find(m => m.name === identifier); if (entry) macro = await pack.getDocument(entry._id); }
        if (!macro) try { macro = await fromUuid(identifier); } catch(e){}
        if (!macro) macro = game.macros.find(m => m.name === identifier);
        if (macro && typeof macro.execute === 'function') macro.execute();
        else ui.notifications.warn(`Macro '${identifier}' not found.`);
    }
}

// ==================================================================
// 9. FATE ROLL
// ==================================================================
class FateRollDialog extends ApplicationV2 {
    constructor(rollType, options = {}) { super(options); this.rollType = rollType; }
    static DEFAULT_OPTIONS = { tag: "div", id: "dh-fate-ask-dialog", window: { title: "Select Fate Die", icon: "fas fa-dice", resizable: false }, position: { width: 320, height: "auto" }, actions: { roll: FateRollDialog.prototype._onRoll } };
    async _renderHTML(context, options) {
        const dice = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"];
        const buttons = dice.map(d => `<button type="button" class="dh-btn" data-action="roll" data-value="${d}" style="margin: 4px; width: 30%; flex: 1 0 30%;">${d}</button>`).join("");
        return `<div class="dh-qa-app" style="background: #191919; padding: 15px; height: 100%;"><p style="color: #C9A060; font-family: 'Aleo', serif; text-align: center; margin-bottom: 10px; font-size: 1.1em;">Rolling <strong>${this.rollType.toUpperCase()}</strong>. Choose die:</p><div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 5px;">${buttons}</div></div>`;
    }
    _replaceHTML(result, content, options) { content.innerHTML = result; return content; }
    async _onRoll(event, target) { await performVisualFateRoll(target.dataset.value, this.rollType); this.close(); }
}

export async function fateRoll(rollType = 'hope', mode = 'default') {
    if (mode === 'system') { if (ui.chat) await ui.chat.processMessage(`/fr type=${rollType}`); return; }
    if (mode === 'ask') { new FateRollDialog(rollType).render(true); return; }
    await performVisualFateRoll('1d12', rollType);
}

// ==================================================================
// 10. HOPE SPENDER APP
// ==================================================================
class HopeSpenderApp extends ApplicationV2 {
    static DEFAULT_OPTIONS = { id: "daggerheart-hope-spender-v2", tag: "div", window: { title: "Spend Hope", icon: "fas fa-sun", resizable: false }, position: { width: 320, height: "auto" }, actions: { spend: HopeSpenderApp.prototype._onSpend } };
    async _renderHTML(context, options) {
        const buttons = [1, 2, 3, 4, 5, 6].map(num => `<button type="button" class="dh-hope-btn" data-action="spend" data-value="${num}">${num}</button>`).join("");
        return `<style>.dh-wrapper { background: #191919; padding: 10px; display: flex; flex-direction: column; gap: 10px; color: #C9A060; height: 100%; } .dh-title { text-align: center; font-family: 'Aleo', serif; font-size: 1.1em; border-bottom: 1px solid #444; padding-bottom: 5px; } .dh-hope-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .dh-hope-btn { background: #2a2a2a; color: #C9A060; border: 1px solid #C9A060; font-family: 'Aleo', serif; font-size: 1.5em; font-weight: bold; height: 50px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; } .dh-hope-btn:hover { background: #C9A060; color: #191919; box-shadow: 0 0 8px #C9A060; }</style><div class="dh-wrapper"><div class="dh-title">Select Hope to Spend</div><div class="dh-hope-grid">${buttons}</div></div>`;
    }
    _replaceHTML(result, content, options) { content.innerHTML = result; return content; }
    async _onSpend(event, target) {
        const spendAmount = parseInt(target.dataset.value);
        const token = canvas.tokens.controlled[0];
        if (!token) return ui.notifications.warn("Select a token!");
        const actor = token.actor;
        const currentHope = actor.system.resources?.hope?.value;
        if (currentHope === undefined) return ui.notifications.warn("No Hope resource!");
        if (currentHope < spendAmount) return ui.notifications.error("Not enough Hope!");
        await actor.update({"system.resources.hope.value": currentHope - spendAmount});
        const content = buildChatCard("Hope Spent", `
            <div style="color: #ffffff !important; font-size: 3em; font-weight: bold; text-shadow: 0px 0px 15px #C9A060, 2px 2px 0 #000; font-family: 'Lato', sans-serif;">-${spendAmount}</div>
            <div style="color: #ccc; font-size: 0.9em; margin-top: 10px; font-style: italic;">Hope Remaining: ${currentHope} → <span style="color: #C9A060; font-weight: bold;">${currentHope - spendAmount}</span></div>
        `);
        await ChatMessage.create({ user: game.user.id, speaker: ChatMessage.getSpeaker({actor: actor}), content: content, style: CONST.CHAT_MESSAGE_STYLES.OTHER });
        this.close();
    }
}

// TemplateCreatorApp has been moved to scripts/template-creator.js
// 12. LEVEL UP APP
// ==================================================================
class LevelUpApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static _instance = null;

    static DEFAULT_OPTIONS = {
        id: "daggerheart-level-up",
        classes: ["dh-level-up"],
        window: { title: "Level Up Players", icon: "fas fa-arrow-up", resizable: false, controls: [] },
        position: { width: 420, height: "auto" },
        actions: { levelUp: LevelUpApp.prototype._onLevelUp, levelUpAll: LevelUpApp.prototype._onLevelUpAll }
    };

    static PARTS = { form: { template: `modules/${MODULE_ID}/templates/level-up.hbs` } };

    async _prepareContext() {
        const players = [];
        for (const user of game.users) {
            if (user.isGM) continue;
            const actor = user.character;
            const hasActor = !!actor;
            const currentLevel = hasActor ? (actor.system?.levelData?.level?.current ?? "?") : null;
            const changedLevel = hasActor ? (actor.system?.levelData?.level?.changed ?? currentLevel) : null;
            const hasPending = hasActor && changedLevel !== null && changedLevel > currentLevel;

            players.push({
                userId: user.id,
                userName: user.name,
                userColor: user.color?.toString() || "#ffffff",
                actorId: actor?.id || null,
                characterName: actor?.name || null,
                avatar: actor?.img || "icons/svg/mystery-man.svg",
                currentLevel,
                changedLevel,
                hasPending,
                hasActor
            });
        }
        const hasAnyActor = players.some(p => p.hasActor);
        return { players, hasAnyActor };
    }

    async _onLevelUpAll() {
        const actors = [];
        for (const user of game.users) {
            if (user.isGM) continue;
            const actor = user.character;
            if (!actor) continue;
            const currentLevel = actor.system?.levelData?.level?.current ?? 1;
            const changedLevel = actor.system?.levelData?.level?.changed ?? currentLevel;
            await actor.update({ "system.levelData.level.changed": changedLevel + 1 });
            actors.push(actor.name);
        }
        if (actors.length) {
            ui.notifications.info(`Leveled up: ${actors.join(", ")}`);
        }
        this.render();
    }

    async _onLevelUp(event, target) {
        const actorId = target.dataset.actorId;
        const actor = game.actors.get(actorId);
        if (!actor) {
            ui.notifications.error("Actor not found.");
            return;
        }
        const currentLevel = actor.system?.levelData?.level?.current ?? 1;
        const changedLevel = actor.system?.levelData?.level?.changed ?? currentLevel;
        const newChanged = changedLevel + 1;

        await actor.update({ "system.levelData.level.changed": newChanged });
        ui.notifications.info(`${actor.name} leveled up to ${newChanged}!`);
        this.render();
    }

    _onClose(options) {
        super._onClose(options);
        LevelUpApp._instance = null;
    }
}

// ==================================================================
// EXPORTED FUNCTIONS
// ==================================================================
export async function activateDowntime() { new DowntimeApp().render(true); }
export async function activateFallingDamage() { new FallingDamageApp().render(true); }
export async function activateLootConsumable() { new LootConsumableApp().render(true); }
export async function activateSpendHope() { new HopeSpenderApp().render(true); }

export async function activateLevelUp() {
    if (!game.user.isGM) {
        ui.notifications.warn("Only the GM can use Level Up.");
        return;
    }
    if (LevelUpApp._instance?.rendered) {
        LevelUpApp._instance.bringToFront();
        return;
    }
    LevelUpApp._instance = new LevelUpApp();
    LevelUpApp._instance.render(true);
}

export async function showMacros(...args) {
    let rawMacros = Array.isArray(args[0]) ? args[0] : args;
    const macros = rawMacros.filter(m => m !== undefined && m !== null);
    if (macros.length === 0) return ui.notifications.warn("QuickActions: No valid macros provided.");
    new ShowMacrosApp(macros).render(true);
}
