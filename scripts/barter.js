/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Barter — peer-to-peer trading of inventory items and currency between two users who each
 * have a linked `character` actor.
 *
 * Two transport layers are used, per the split described in CLAUDE.md §7:
 * - `game.socket` broadcasts carry the fire-and-forget session chatter (invite, offer sync,
 *   cancel, completion). Every client receives them and drops anything not addressed to it.
 * - A registered User query asks an active GM to settle the trade. Players cannot write to each
 *   other's actors, so the GM client performs every create/update/delete in a single
 *   `foundry.documents.modifyBatch` call — which either applies completely or not at all.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/** Inventory item types that can be bartered, in tab order. @type {string[]} */
const BARTER_ITEM_TYPES = ["weapon", "armor", "consumable", "loot"];

/** Font Awesome icon shown on each inventory tab. */
const BARTER_TAB_ICONS = Object.freeze({
    weapon: "fa-solid fa-sword",
    armor: "fa-solid fa-shield-halved",
    consumable: "fa-solid fa-flask",
    loot: "fa-solid fa-gem"
});

/** Currency keys of the Daggerheart gold schema, smallest denomination first. @type {string[]} */
const GOLD_KEYS = ["coins", "handfuls", "bags", "chests"];

/** Fallback currency labels/icons used when the system's homebrew setting cannot be read. */
const GOLD_FALLBACK = Object.freeze({
    coins: { label: "Coins", icon: "fa-solid fa-coin-front" },
    handfuls: { label: "Handfuls", icon: "fa-solid fa-coins" },
    bags: { label: "Bags", icon: "fa-solid fa-sack" },
    chests: { label: "Chests", icon: "fa-solid fa-treasure-chest" }
});

/** Discriminator that separates Barter traffic from any other module socket traffic. */
const BARTER_SCOPE = "barter";

/** Name of the User query an active GM answers to settle a trade. */
const COMMIT_QUERY = `${MODULE_ID}.barterCommit`;

/** Socket message kinds exchanged by the two participants. */
const MESSAGES = Object.freeze({
    /** Initiator → recipient: "I want to trade, here is my opening offer". */
    INVITE: "invite",
    /** Recipient → initiator: invite accepted, window is open on my end. */
    ACCEPT: "accept",
    /** Recipient → initiator: invite refused. */
    DECLINE: "decline",
    /** Either → peer: my half of the session changed. */
    UPDATE: "update",
    /** Either → peer: session is over without a transfer. */
    CANCEL: "cancel",
    /** Initiator → recipient: the GM settled the trade. */
    COMPLETE: "complete"
});

/**
 * The single Barter window open on this client. Barter is inherently one-at-a-time: a second
 * concurrent session would let a user offer the same item twice.
 * @type {BarterApp|null}
 */
let currentApp = null;

/* -------------------------------------------- */
/*  Session Helpers                             */
/* -------------------------------------------- */

/**
 * Builds an empty offer side.
 * @param {string} [userId=""] - Id of the user who owns this side.
 * @param {string} [actorUuid=""] - Uuid of that user's linked character.
 * @returns {{userId: string, actorUuid: string, items: object[], gold: object, locked: boolean}}
 */
function emptySide(userId = "", actorUuid = "") {
    return { userId, actorUuid, items: [], gold: {}, locked: false };
}

/**
 * Resolves the enabled currencies from the Daggerheart homebrew settings, falling back to the
 * stock four when the setting is unavailable (system version drift, setting not yet registered).
 * @returns {Array<{key: string, label: string, icon: string}>} Enabled currencies in schema order.
 */
function getCurrencies() {
    let configured = null;
    try {
        configured = game.settings.get(CONFIG.DH.id, CONFIG.DH.SETTINGS.gameSettings.Homebrew)?.currency ?? null;
    } catch {
        configured = null;
    }

    return GOLD_KEYS.map(key => {
        const entry = configured?.[key];
        if (entry && entry.enabled === false) return null;
        return {
            key,
            label: entry?.label || GOLD_FALLBACK[key].label,
            icon: entry?.icon || GOLD_FALLBACK[key].icon
        };
    }).filter(Boolean);
}

/**
 * Lists the connected users who can take part in a trade — active, not this user, and driving a
 * linked `character` actor.
 * @returns {Array<{id: string, name: string, color: string, actorName: string, actorImg: string}>}
 */
function getEligibleUsers() {
    return game.users
        .filter(u => u.active && u.id !== game.user.id && u.character?.type === "character")
        .map(u => ({
            id: u.id,
            name: u.name,
            color: u.color.css,
            actorName: u.character.name,
            actorImg: u.character.img
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Broadcasts a Barter message. Foundry has no targeted emit, so every client receives the packet
 * and discards it unless its own id appears in `recipients`.
 * @param {string} message - One of {@link MESSAGES}.
 * @param {string[]} recipients - User ids the message is addressed to.
 * @param {object} [payload={}] - Additional message-specific fields.
 * @returns {void}
 */
function emitBarter(message, recipients, payload = {}) {
    game.socket.emit(`module.${MODULE_ID}`, {
        scope: BARTER_SCOPE,
        message,
        recipients,
        senderId: game.user.id,
        ...payload
    });
}

/* -------------------------------------------- */
/*  Barter Application                          */
/* -------------------------------------------- */

/**
 * The trade window, rendered identically for both participants. The left column is always the
 * local user's own inventory and offer; the right column is the peer's offer (or, before a trade
 * has been started, the picker used to choose whom to trade with).
 */
class BarterApp extends HandlebarsApplicationMixin(ApplicationV2) {
    /**
     * @param {object} options
     * @param {object} options.session - The shared session state.
     * @param {"initiator"|"recipient"} options.side - Which half of the session this client owns.
     */
    constructor({ session, side, ...options } = {}) {
        super(options);

        /** @type {object} Shared session state, kept in sync with the peer over the socket. */
        this.session = session;

        /** @type {"initiator"|"recipient"} The half of the session this client is authoritative for. */
        this.side = side;

        /** @type {foundry.documents.Actor} The local user's linked character. */
        this.actor = foundry.utils.fromUuidSync(session[side].actorUuid);

        /** @type {string} Currently visible inventory tab. */
        this._activeTab = BARTER_ITEM_TYPES[0];

        /** @type {string|null} User picked in the "Start Trade" list (initiator, draft state only). */
        this._selectedUserId = null;

        /** @type {boolean} Suppresses the cancel broadcast when the window closes for a known reason. */
        this._closingQuietly = false;
    }

    static DEFAULT_OPTIONS = {
        tag: "div",
        id: "dh-qa-barter-app",
        classes: ["dh-qa-app", MODULE_ID, "dqa-barter"],
        window: { title: "Barter", icon: "fas fa-right-left", resizable: true, controls: [] },
        position: { width: 900, height: 660 },
        actions: {
            selectTab: BarterApp.prototype._onSelectTab,
            toggleItem: BarterApp.prototype._onToggleItem,
            stepQuantity: BarterApp.prototype._onStepQuantity,
            selectUser: BarterApp.prototype._onSelectUser,
            startTrade: BarterApp.prototype._onStartTrade,
            toggleLock: BarterApp.prototype._onToggleLock,
            approve: BarterApp.prototype._onApprove,
            cancel: BarterApp.prototype._onCancel
        }
    };

    static PARTS = {
        content: {
            template: `modules/${MODULE_ID}/templates/barter.hbs`,
            // Foundry resolves each selector with querySelector, so the grid entry must name the
            // one tab that is actually visible rather than all four.
            scrollable: [".dqa-barter-grid.active", ".dqa-barter-peer-items", ".dqa-barter-users"]
        }
    };

    /** @returns {object} This client's half of the session. */
    get mine() {
        return this.session[this.side];
    }

    /** @returns {"initiator"|"recipient"} Key of the peer's half of the session. */
    get peerKey() {
        return this.side === "initiator" ? "recipient" : "initiator";
    }

    /** @returns {object} The peer's half of the session. */
    get theirs() {
        return this.session[this.peerKey];
    }

    /** @returns {boolean} Whether this client started the trade and therefore approves it. */
    get isInitiator() {
        return this.side === "initiator";
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /**
     * Builds the two-column context: own inventory grouped into tabs on the left, the peer's
     * offer (or the user picker) on the right.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        const currencies = getCurrencies();
        const offered = new Map(this.mine.items.map(entry => [entry.id, entry.quantity]));

        const tabs = BARTER_ITEM_TYPES.map(type => {
            const items = (this.actor.itemTypes[type] ?? []).map(item => {
                const owned = Math.max(1, item.system?.quantity ?? 1);
                const quantity = offered.get(item.id) ?? 0;
                return {
                    id: item.id,
                    img: item.img,
                    name: item.name,
                    owned,
                    quantity,
                    selected: quantity > 0,
                    stackable: owned > 1
                };
            });
            return {
                type,
                label: game.i18n.localize(`TYPES.Item.${type}`),
                icon: BARTER_TAB_ICONS[type],
                count: items.length,
                items,
                active: type === this._activeTab
            };
        });

        const myGold = currencies.map(currency => ({
            ...currency,
            owned: this.actor.system?.gold?.[currency.key] ?? 0,
            offered: this.mine.gold[currency.key] ?? 0
        }));

        const peerUser = this.theirs.userId ? game.users.get(this.theirs.userId) : null;
        const peerActor = this.theirs.actorUuid ? foundry.utils.fromUuidSync(this.theirs.actorUuid) : null;

        return {
            status: this.session.status,
            isDraft: this.session.status === "draft",
            isPending: this.session.status === "pending",
            isActive: this.session.status === "active",
            isInitiator: this.isInitiator,

            actorName: this.actor.name,
            actorImg: this.actor.img,
            tabs,
            myGold,
            myLocked: this.mine.locked,
            myOfferCount: this.mine.items.length,

            peerName: peerUser?.name ?? "",
            peerActorName: peerActor?.name ?? "",
            peerActorImg: peerActor?.img ?? "icons/svg/mystery-man.svg",
            peerItems: this.theirs.items,
            peerGold: currencies
                .map(currency => ({ ...currency, amount: this.theirs.gold[currency.key] ?? 0 }))
                .filter(entry => entry.amount > 0),
            peerLocked: this.theirs.locked,
            peerEmpty: !this.theirs.items.length && !Object.values(this.theirs.gold).some(v => v > 0),

            users: this.session.status === "draft" ? getEligibleUsers() : [],
            selectedUserId: this._selectedUserId,
            canStart: this.session.status === "draft" && !!this._selectedUserId,
            canApprove: this.isInitiator && this.session.status === "active" && this.theirs.locked
        };
    }

    /**
     * Wires the currency inputs, which are `change` events rather than clicks and therefore fall
     * outside `DEFAULT_OPTIONS.actions`. Called from `_onRender`.
     * @param {object} _context - Render context (unused).
     * @param {object} _options - Render options (unused).
     * @returns {void}
     */
    _onRender(_context, _options) {
        for (const input of this.element.querySelectorAll(".dqa-barter-gold-input")) {
            input.addEventListener("change", () => this._onGoldChanged(input));
        }
    }

    /* -------------------------------------------- */
    /*  Local Offer Editing                         */
    /* -------------------------------------------- */

    /**
     * Switches the visible inventory tab without a full re-render, so the grid scroll position
     * of the other tabs survives. Triggered by `data-action="selectTab"`.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked tab button carrying `data-tab`.
     * @returns {void}
     */
    _onSelectTab(_event, target) {
        const tab = target.dataset.tab;
        if (!BARTER_ITEM_TYPES.includes(tab)) return;
        this._activeTab = tab;

        for (const button of this.element.querySelectorAll(".dqa-barter-tab")) {
            button.classList.toggle("active", button.dataset.tab === tab);
        }
        for (const grid of this.element.querySelectorAll(".dqa-barter-grid")) {
            grid.classList.toggle("active", grid.dataset.tab === tab);
        }
    }

    /**
     * Adds or removes an item from this client's offer. Triggered by `data-action="toggleItem"`.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked tile carrying `data-item-id`.
     * @returns {void}
     */
    _onToggleItem(_event, target) {
        const itemId = target.dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (!item) return;

        const index = this.mine.items.findIndex(entry => entry.id === itemId);
        if (index >= 0) this.mine.items.splice(index, 1);
        else this.mine.items.push({ id: itemId, name: item.name, img: item.img, quantity: 1 });

        this._onOfferChanged();
    }

    /**
     * Adjusts how many of a stacked item are offered. Triggered by `data-action="stepQuantity"`.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The stepper button carrying `data-item-id` and `data-delta`.
     * @returns {void}
     */
    _onStepQuantity(_event, target) {
        const itemId = target.dataset.itemId;
        const entry = this.mine.items.find(e => e.id === itemId);
        if (!entry) return;

        const owned = Math.max(1, this.actor.items.get(itemId)?.system?.quantity ?? 1);
        const next = Math.clamp(entry.quantity + Number(target.dataset.delta), 1, owned);
        if (next === entry.quantity) return;

        entry.quantity = next;
        this._onOfferChanged();
    }

    /**
     * Clamps a currency input to what the actor actually holds and folds it into the offer.
     * Bound in `_onRender`.
     * @param {HTMLInputElement} input - The changed currency input.
     * @returns {void}
     */
    _onGoldChanged(input) {
        const key = input.dataset.currency;
        const owned = Number(input.dataset.owned) || 0;
        const amount = Math.clamp(Math.floor(Number(input.value) || 0), 0, owned);

        input.value = String(amount);
        if (amount > 0) this.mine.gold[key] = amount;
        else delete this.mine.gold[key];

        this._onOfferChanged();
    }

    /**
     * Applies the consequences of any change to this client's offer: the change invalidates both
     * confirmations, is pushed to the peer, and the window is redrawn.
     * @returns {void}
     */
    _onOfferChanged() {
        this.mine.locked = false;
        this._pushOffer(true);
        this.render();
    }

    /**
     * Sends this client's half of the session to the peer.
     * @param {boolean} clearPeerLock - Whether the peer's confirmation must be revoked, which is
     *   the case for every offer edit so nobody can confirm and then quietly swap the goods.
     * @returns {void}
     */
    _pushOffer(clearPeerLock) {
        if (this.session.status !== "active") return;
        const peerId = this.theirs.userId;
        if (!peerId) return;

        if (clearPeerLock) this.theirs.locked = false;

        emitBarter(MESSAGES.UPDATE, [peerId], {
            sessionId: this.session.id,
            offer: { items: this.mine.items, gold: this.mine.gold, locked: this.mine.locked },
            clearPeerLock
        });
    }

    /* -------------------------------------------- */
    /*  Session Control                             */
    /* -------------------------------------------- */

    /**
     * Highlights the trade partner picked from the list. Triggered by `data-action="selectUser"`.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked user button carrying `data-user-id`.
     * @returns {void}
     */
    _onSelectUser(_event, target) {
        this._selectedUserId = target.dataset.userId;

        for (const button of this.element.querySelectorAll(".dqa-barter-user")) {
            button.classList.toggle("selected", button.dataset.userId === this._selectedUserId);
        }
        const startBtn = this.element.querySelector('[data-action="startTrade"]');
        if (startBtn) startBtn.disabled = false;
    }

    /**
     * Sends the trade invite to the selected user. Triggered by `data-action="startTrade"`.
     * @returns {void}
     */
    _onStartTrade() {
        if (this.session.status !== "draft") return;

        const user = game.users.get(this._selectedUserId);
        if (!user?.active || user.character?.type !== "character") {
            ui.notifications.warn("Barter: that user is no longer available to trade.");
            this._selectedUserId = null;
            this.render();
            return;
        }

        this.session.recipient = emptySide(user.id, user.character.uuid);
        this.session.status = "pending";
        emitBarter(MESSAGES.INVITE, [user.id], { session: this.session });

        ui.notifications.info(`Barter: trade request sent to ${user.name}.`);
        this.render();
    }

    /**
     * Toggles this client's confirmation. Triggered by `data-action="toggleLock"`.
     * @returns {void}
     */
    _onToggleLock() {
        if (this.session.status !== "active") return;

        this.mine.locked = !this.mine.locked;
        this._pushOffer(false);
        this.render();
    }

    /**
     * Asks an active GM to settle the trade, then tells the peer it is done. Only the initiator
     * has this button, and only once the peer has confirmed.
     * Triggered by `data-action="approve"`.
     * @returns {Promise<void>}
     */
    async _onApprove() {
        if (!this.isInitiator || this.session.status !== "active" || !this.theirs.locked) return;

        const button = this.element.querySelector('[data-action="approve"]');
        if (button) button.disabled = true;

        try {
            // A GM has to write to both actors; when the initiator is the GM, skip the round trip.
            if (game.user.isGM) await settleBarter(this.session, game.user);
            else {
                const gm = game.users.activeGM;
                if (!gm) throw new Error("a Gamemaster must be connected to settle a trade");
                await gm.query(COMMIT_QUERY, { session: this.session }, { timeout: 30000 });
            }
        } catch (error) {
            if (button) button.disabled = false;
            ui.notifications.error(`Barter: trade failed — ${error.message}`);
            console.error(`${MODULE_ID} | Barter settlement failed`, error);
            return;
        }

        this.session.status = "completed";
        emitBarter(MESSAGES.COMPLETE, [this.theirs.userId], { sessionId: this.session.id });
        ui.notifications.info("Barter: trade completed.");
        this._closingQuietly = true;
        this.close();
    }

    /**
     * Closes the window, which implicitly cancels the session. Triggered by `data-action="cancel"`.
     * @returns {Promise<void>}
     */
    async _onCancel() {
        await this.close();
    }

    /* -------------------------------------------- */
    /*  Peer Messages                               */
    /* -------------------------------------------- */

    /**
     * Applies a message received from the trade partner. The peer is authoritative for its own
     * half of the session only — identity fields are never taken from the wire mid-session.
     * @param {object} data - The socket payload.
     * @returns {void}
     */
    _onPeerMessage(data) {
        switch (data.message) {
            // Only the initiator ever awaits an answer to an invite; ignoring these elsewhere
            // keeps a stray packet from overwriting a side that is not the sender's to touch.
            case MESSAGES.ACCEPT:
                if (!this.isInitiator) return;
                this.session.recipient = emptySide(data.senderId, data.actorUuid);
                this.session.status = "active";
                ui.notifications.info(`Barter: ${game.users.get(data.senderId)?.name ?? "The other trader"} joined the trade.`);
                // The recipient only has the offer as it stood when the invite was sent; anything
                // adjusted while waiting has to be replayed now that syncing is live.
                this._pushOffer(false);
                break;

            case MESSAGES.DECLINE:
                if (!this.isInitiator) return;
                this.session.recipient = emptySide();
                this.session.status = "draft";
                this._selectedUserId = null;
                ui.notifications.warn(`Barter: ${game.users.get(data.senderId)?.name ?? "The other trader"} declined${data.reason ? ` — ${data.reason}` : ""}.`);
                break;

            case MESSAGES.UPDATE:
                Object.assign(this.theirs, {
                    items: data.offer?.items ?? [],
                    gold: data.offer?.gold ?? {},
                    locked: !!data.offer?.locked
                });
                if (data.clearPeerLock) this.mine.locked = false;
                break;

            case MESSAGES.CANCEL:
                ui.notifications.warn(`Barter: trade cancelled${data.reason ? ` — ${data.reason}` : ""}.`);
                this._closingQuietly = true;
                this.close();
                return;

            case MESSAGES.COMPLETE:
                this.session.status = "completed";
                ui.notifications.info("Barter: trade completed.");
                this._closingQuietly = true;
                this.close();
                return;

            default:
                return;
        }

        this.render();
    }

    /**
     * Releases the singleton and, unless the session already ended, lets the partner know the
     * trade is off. Called from the close lifecycle.
     * @param {object} _options - Close options (unused).
     * @returns {void}
     */
    _onClose(_options) {
        if (currentApp === this) currentApp = null;
        if (this._closingQuietly) return;

        const peerId = this.theirs.userId;
        if (peerId && ["pending", "active"].includes(this.session.status)) {
            emitBarter(MESSAGES.CANCEL, [peerId], {
                sessionId: this.session.id,
                reason: `${game.user.name} closed the trade window`
            });
        }
    }
}

/* -------------------------------------------- */
/*  Settlement (GM side)                        */
/* -------------------------------------------- */

/**
 * Reads the running quantity of an item inside a settlement plan, seeding it from the item's
 * current stack size the first time it is touched. Both the giving and the receiving side of a
 * trade can reference the same document, so every adjustment has to go through this ledger.
 * @param {Map<string, object>} ledger - Plan ledger keyed by `actorId.itemId`.
 * @param {foundry.documents.Actor} actor - Actor holding the item.
 * @param {foundry.documents.Item} item - The item being adjusted.
 * @returns {{actor: foundry.documents.Actor, item: foundry.documents.Item, original: number, quantity: number}}
 */
function ledgerEntry(ledger, actor, item) {
    const key = `${actor.id}.${item.id}`;
    let entry = ledger.get(key);
    if (!entry) {
        const original = Math.max(1, item.system?.quantity ?? 1);
        entry = { actor, item, original, quantity: original };
        ledger.set(key, entry);
    }
    return entry;
}

/**
 * Two items are treated as the same stack when they share an origin, a name and a description —
 * mirroring how the Daggerheart system merges inventory items on transfer.
 * @param {foundry.documents.Item} a - Candidate already on the receiving actor.
 * @param {foundry.documents.Item} b - Incoming item.
 * @returns {boolean} True when the incoming item should merge into the candidate's stack.
 */
function isSameStack(a, b) {
    return a.type === b.type
        && a.name === b.name
        && a._stats?.compendiumSource === b._stats?.compendiumSource
        && a.system?.description === b.system?.description;
}

/**
 * Validates one side's offer against live actor data and folds it into the settlement plan.
 * Everything here throws on the first inconsistency so that no partial trade is ever built.
 * @param {object} offer - The offering side of the session.
 * @param {foundry.documents.Actor} from - Actor giving the goods.
 * @param {foundry.documents.Actor} to - Actor receiving them.
 * @param {object} plan - Accumulating settlement plan.
 * @returns {void}
 */
function planTransfer(offer, from, to, plan) {
    for (const entry of offer.items ?? []) {
        const item = from.items.get(entry.id);
        if (!item) throw new Error(`${from.name} no longer carries one of the offered items`);
        if (!BARTER_ITEM_TYPES.includes(item.type)) throw new Error(`${item.name} is not a tradeable item`);

        const source = ledgerEntry(plan.ledger, from, item);
        const quantity = Math.floor(Number(entry.quantity) || 0);
        if (quantity < 1 || quantity > source.original) throw new Error(`invalid quantity offered for ${item.name}`);
        source.quantity -= quantity;
        plan.summary.push({ fromId: from.id, label: `${item.name}${quantity > 1 ? ` ×${quantity}` : ""}` });

        // Character actors merge loot and consumables into existing stacks; anything else — and
        // any item the receiver does not already own — arrives as its own document.
        const stackable = to.system?.metadata?.quantifiable?.includes(item.type) ?? false;
        const existing = stackable ? to.items.find(candidate => isSameStack(candidate, item)) : null;

        if (existing) {
            ledgerEntry(plan.ledger, to, existing).quantity += quantity;
            continue;
        }

        const copies = stackable
            ? [foundry.utils.mergeObject(item.toObject(), { system: { quantity } })]
            : Array.from({ length: quantity }, () => foundry.utils.mergeObject(item.toObject(), { system: { quantity: 1 } }));
        for (const copy of copies) delete copy._id;

        if (!plan.creates.has(to)) plan.creates.set(to, []);
        plan.creates.get(to).push(...copies);
    }

    for (const [key, raw] of Object.entries(offer.gold ?? {})) {
        if (!GOLD_KEYS.includes(key)) throw new Error(`unknown currency "${key}"`);

        const amount = Math.floor(Number(raw) || 0);
        if (amount <= 0) continue;
        if (amount > (from.system?.gold?.[key] ?? 0)) throw new Error(`${from.name} does not have ${amount} ${key}`);

        adjustGold(plan.gold, from, key, -amount);
        adjustGold(plan.gold, to, key, amount);
        plan.summary.push({ fromId: from.id, label: `${amount} ${key}` });
    }
}

/**
 * Applies a currency delta inside the settlement plan, seeding the running total from the
 * actor's current holdings so the two directions of a trade net out to a single update.
 * @param {Map<foundry.documents.Actor, object>} gold - Plan currency totals.
 * @param {foundry.documents.Actor} actor - Actor whose purse changes.
 * @param {string} key - Currency key.
 * @param {number} delta - Signed amount.
 * @returns {void}
 */
function adjustGold(gold, actor, key, delta) {
    let purse = gold.get(actor);
    if (!purse) {
        purse = {};
        gold.set(actor, purse);
    }
    purse[key] = (purse[key] ?? actor.system?.gold?.[key] ?? 0) + delta;
}

/**
 * Settles a trade on behalf of both participants. Runs only on a GM client, which is the only
 * one permitted to write to both actors. Every modification goes into a single
 * `foundry.documents.modifyBatch` call: if any one of them is refused, none are applied.
 * @param {object} session - The session as agreed by both participants.
 * @param {foundry.documents.User} requester - The user who approved the trade.
 * @returns {Promise<{ok: true}>} Resolves once the batch has been written.
 */
async function settleBarter(session, requester) {
    if (!game.user.isGM) throw new Error("only a Gamemaster can settle a trade");

    const { initiator, recipient } = session ?? {};
    if (!initiator?.actorUuid || !recipient?.actorUuid) throw new Error("the trade session is incomplete");
    if (requester.id !== initiator.userId) throw new Error("only the user who started the trade can approve it");
    if (!recipient.locked) throw new Error("the other trader has not confirmed their offer");

    const [fromActor, toActor] = await Promise.all([
        foundry.utils.fromUuid(initiator.actorUuid),
        foundry.utils.fromUuid(recipient.actorUuid)
    ]);
    if (!fromActor || !toActor) throw new Error("one of the trading actors no longer exists");
    if (fromActor.id === toActor.id) throw new Error("an actor cannot trade with itself");
    if (fromActor.type !== "character" || toActor.type !== "character") throw new Error("both traders must use a character actor");

    // The claimed actors must really belong to the claimed users — the session travelled over an
    // untrusted socket, so nothing in it is taken on faith.
    for (const [side, actor] of [[initiator, fromActor], [recipient, toActor]]) {
        const user = game.users.get(side.userId);
        if (!user) throw new Error("one of the traders is no longer connected");
        if (user.character?.id !== actor.id) throw new Error(`${actor.name} is not ${user.name}'s assigned character`);
    }

    const plan = { ledger: new Map(), creates: new Map(), gold: new Map(), summary: [] };
    planTransfer(initiator, fromActor, toActor, plan);
    planTransfer(recipient, toActor, fromActor, plan);
    if (!plan.summary.length) throw new Error("there is nothing to trade");

    const operations = [];

    for (const [actor, copies] of plan.creates) {
        operations.push({ action: "create", documentName: "Item", parent: actor, data: copies });
    }

    const updates = new Map();
    const deletes = new Map();
    for (const { actor, item, original, quantity } of plan.ledger.values()) {
        if (quantity === original) continue;
        const bucket = quantity > 0 ? updates : deletes;
        if (!bucket.has(actor)) bucket.set(actor, []);
        bucket.get(actor).push(quantity > 0 ? { _id: item.id, "system.quantity": quantity } : item.id);
    }
    for (const [actor, itemUpdates] of updates) {
        operations.push({ action: "update", documentName: "Item", parent: actor, updates: itemUpdates });
    }
    for (const [actor, ids] of deletes) {
        operations.push({ action: "delete", documentName: "Item", parent: actor, ids });
    }

    const actorUpdates = [...plan.gold].map(([actor, purse]) => {
        const update = { _id: actor.id };
        for (const [key, value] of Object.entries(purse)) update[`system.gold.${key}`] = value;
        return update;
    });
    if (actorUpdates.length) operations.push({ action: "update", documentName: "Actor", updates: actorUpdates });

    await foundry.documents.modifyBatch(operations);
    await postBarterSummary(fromActor, toActor, plan.summary);

    return { ok: true };
}

/**
 * Posts the public record of a completed trade. Authored by the settling GM so both participants
 * see the same card.
 * @param {foundry.documents.Actor} fromActor - The initiator's character.
 * @param {foundry.documents.Actor} toActor - The recipient's character.
 * @param {Array<{fromId: string, label: string}>} summary - Everything that changed hands.
 * @returns {Promise<void>}
 */
async function postBarterSummary(fromActor, toActor, summary) {
    const block = (actor) => {
        const given = summary.filter(line => line.fromId === actor.id);
        const body = given.length
            ? given.map(line => `<li style="list-style: none;">${foundry.utils.escapeHTML(line.label)}</li>`).join("")
            : `<li style="list-style: none; font-style: italic; opacity: 0.7;">nothing</li>`;
        return `
            <div style="width: 100%; margin-bottom: 10px;">
                <div style="color: #C9A060 !important; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">
                    ${foundry.utils.escapeHTML(actor.name)} gave
                </div>
                <ul style="margin: 0; padding: 0; color: #ffffff !important;">${body}</ul>
            </div>`;
    };

    await ChatMessage.create({
        author: game.user.id,
        content: buildChatCard("Barter", `
            <div style="width: 100%; text-align: left;">
                ${block(fromActor)}
                ${block(toActor)}
            </div>
        `),
        style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
}

/* -------------------------------------------- */
/*  Socket Routing                              */
/* -------------------------------------------- */

/**
 * Prompts the invited user and, on acceptance, opens the same window bound to the incoming
 * session. Declining is always answered so the initiator never waits on a dead invite.
 * @param {object} data - The INVITE socket payload.
 * @returns {Promise<void>}
 */
async function onBarterInvite(data) {
    const session = data.session;
    const initiatorUser = game.users.get(session?.initiator?.userId);
    const decline = (reason) => emitBarter(MESSAGES.DECLINE, [session.initiator.userId], { sessionId: session.id, reason });

    const actor = game.user.character;
    if (!actor || actor.type !== "character") return decline("they have no linked character");
    if (currentApp) return decline("they are already in a trade");

    const initiatorActor = foundry.utils.fromUuidSync(session.initiator.actorUuid);
    const offerCount = session.initiator.items.length + Object.values(session.initiator.gold ?? {}).filter(v => v > 0).length;
    const accepted = await DialogV2.confirm({
        window: { title: "Barter", icon: "fas fa-right-left" },
        content: `<p><strong>${foundry.utils.escapeHTML(initiatorUser?.name ?? "Someone")}</strong>
            (${foundry.utils.escapeHTML(initiatorActor?.name ?? "unknown character")}) wants to trade with you.</p>
            <p>They are opening with ${offerCount} item${offerCount === 1 ? "" : "s"} on the table.</p>`,
        yes: { label: "Open Trade" },
        no: { label: "Decline" },
        modal: false,
        rejectClose: false
    });

    if (!accepted) return decline("");

    // The window may have been opened for another session while the prompt was up.
    if (currentApp) return decline("they are already in a trade");

    session.recipient = emptySide(game.user.id, actor.uuid);
    session.status = "active";

    currentApp = new BarterApp({ session, side: "recipient" });
    currentApp.render(true);

    emitBarter(MESSAGES.ACCEPT, [session.initiator.userId], { sessionId: session.id, actorUuid: actor.uuid });
}

/**
 * Routes an incoming module socket packet to the open Barter window.
 * @param {object} data - The socket payload.
 * @returns {void}
 */
function onBarterSocket(data) {
    if (data?.scope !== BARTER_SCOPE) return;
    if (!data.recipients?.includes(game.user.id)) return;

    if (data.message === MESSAGES.INVITE) {
        onBarterInvite(data);
        return;
    }

    if (currentApp?.session.id === data.sessionId) {
        currentApp._onPeerMessage(data);
        return;
    }

    // The session this packet belongs to is gone on this end (window closed, page reloaded).
    // Answer anything that expects a partner so the sender is not left waiting.
    if (data.message !== MESSAGES.CANCEL && data.message !== MESSAGES.COMPLETE && data.senderId) {
        emitBarter(MESSAGES.CANCEL, [data.senderId], {
            sessionId: data.sessionId,
            reason: `${game.user.name} is no longer in this trade`
        });
    }
}

/* -------------------------------------------- */
/*  Public API                                  */
/* -------------------------------------------- */

/**
 * Registers the Barter socket listener and the GM settlement query. Called once from the `init`
 * hook — `game.socket` and `CONFIG.queries` are both available by then.
 * @returns {void}
 */
export function registerBarter() {
    game.socket.on(`module.${MODULE_ID}`, onBarterSocket);
    CONFIG.queries[COMMIT_QUERY] = (data, { user }) => settleBarter(data?.session, user);
}

/**
 * Opens the Barter window for the current user. Exposed on the global API as `QuickActions.Barter`.
 * @returns {Promise<void>}
 */
export async function activateBarter() {
    if (currentApp) {
        currentApp.bringToFront();
        return;
    }

    const actor = game.user.character;
    if (!actor || actor.type !== "character") {
        ui.notifications.warn("Barter: you need a linked character actor to trade.");
        return;
    }

    const session = {
        id: foundry.utils.randomID(),
        status: "draft",
        initiator: emptySide(game.user.id, actor.uuid),
        recipient: emptySide()
    };

    currentApp = new BarterApp({ session, side: "initiator" });
    currentApp.render(true);
}
