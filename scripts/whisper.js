/*!
 * Daggerheart: Quick Actions
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Whisper — pick any number of connected users and send them a plain-text private message.
 */

import { MODULE_ID } from "./constants.js";
import { buildChatCard } from "./helpers.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Application listing every connected user as a toggle button, with a plain-text message box.
 * The message is delivered as a whispered ChatMessage to the selected users only.
 */
class WhisperApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        /** @type {Set<string>} Ids of the users currently selected as recipients. */
        this._selectedTargets = new Set();
    }

    static DEFAULT_OPTIONS = {
        tag: "div",
        id: "dh-qa-whisper-app",
        classes: ["dh-qa-app", MODULE_ID, "dqa-whisper"],
        window: { title: "Whisper", icon: "fas fa-comment-dots", resizable: false, controls: [] },
        position: { width: 620, height: "auto" },
        actions: {
            toggleUser: WhisperApp.prototype._onToggleUser,
            send: WhisperApp.prototype._onSend,
            cancel: WhisperApp.prototype._onCancel
        }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/whisper.hbs` }
    };

    /**
     * Lists the connected users available as recipients, excluding the sender.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        const users = game.users
            .filter(u => u.active && u.id !== game.user.id)
            .map(u => ({ id: u.id, name: u.name, color: u.color.css, isGM: u.isGM }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return { users, hasUsers: users.length > 0 };
    }

    /**
     * Focuses the message box and wires the Ctrl+Enter shortcut — keyboard events are not
     * covered by `actions`, so they are bound here. Called from `_onRender`.
     * @param {object} _context - Render context (unused).
     * @param {object} _options - Render options (unused).
     * @returns {void}
     */
    _onRender(_context, _options) {
        const textarea = this.element.querySelector('textarea[name="message"]');
        if (!textarea) return;

        textarea.focus();
        textarea.addEventListener("keydown", event => {
            if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
            event.preventDefault();
            this._onSend();
        });
    }

    /**
     * Toggles a single recipient on or off. Triggered by `data-action="toggleUser"`.
     * @param {PointerEvent} _event - The originating click (unused).
     * @param {HTMLElement} target - The clicked button carrying `data-user-id`.
     * @returns {void}
     */
    _onToggleUser(_event, target) {
        const userId = target.dataset.userId;

        if (this._selectedTargets.has(userId)) this._selectedTargets.delete(userId);
        else this._selectedTargets.add(userId);

        target.classList.toggle("selected", this._selectedTargets.has(userId));

        const sendBtn = this.element.querySelector('[data-action="send"]');
        if (sendBtn) sendBtn.disabled = this._selectedTargets.size === 0;
    }

    /**
     * Whispers the typed text to every selected user. Triggered by `data-action="send"` and by
     * the Ctrl+Enter shortcut bound in `_onRender`.
     * @returns {Promise<void>}
     */
    async _onSend() {
        const recipients = [...this._selectedTargets];
        if (!recipients.length) {
            ui.notifications.warn("Whisper: select at least one recipient.");
            return;
        }

        const message = (this.element.querySelector('textarea[name="message"]')?.value ?? "").trim();
        if (!message) {
            ui.notifications.warn("Whisper: type a message before sending.");
            return;
        }

        // Plain text feature: everything typed is escaped, so pasted markup is shown, never rendered.
        // Line breaks are the only formatting carried over to the card.
        const safeMessage = foundry.utils.escapeHTML(message).replace(/\r?\n/g, "<br>");

        await ChatMessage.create({
            author: game.user.id,
            speaker: ChatMessage.getSpeaker({ user: game.user }),
            content: buildChatCard("Whisper", `
                <span style="color: #ffffff !important; font-size: 1.05em; text-shadow: 0 0 8px #000000; font-family: 'Lato', sans-serif; line-height: 1.5; width: 100%; text-align: left;">
                    ${safeMessage}
                </span>
            `),
            style: CONST.CHAT_MESSAGE_STYLES.OTHER,
            whisper: recipients
        });

        const names = recipients.map(id => game.users.get(id)?.name).filter(name => name).join(", ");
        ui.notifications.info(`Whisper sent to ${names}.`);
        this.close();
    }

    /**
     * Closes the window without sending. Triggered by `data-action="cancel"`.
     * @returns {void}
     */
    _onCancel() {
        this.close();
    }
}

/**
 * Opens the Whisper window. Exposed on the global API as `QuickActions.Whisper`.
 * @returns {Promise<void>}
 */
export async function activateWhisper() {
    new WhisperApp().render(true);
}
