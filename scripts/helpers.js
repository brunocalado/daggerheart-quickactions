/**
 * Shared helpers used across three or more call sites in the module.
 * All helpers must serve at least 3 call sites before being added here.
 */

import { MODULE_ID, CHAT_CARD_BG } from "./constants.js";

/**
 * Builds the standard chat card HTML wrapper used throughout the module.
 * Provides consistent header, background image, and dark overlay.
 *
 * @param {string} title - Text shown in the card header (auto upper-cased via CSS).
 * @param {string} bodyHtml - HTML inserted inside the foreground content container.
 * @param {object} [options={}]
 * @param {string} [options.titleColor="#C9A060"] - Accent color applied to borders and title.
 * @param {number} [options.overlayOpacity=0.85] - Opacity of the dark background overlay (0–1).
 * @returns {string} Full HTML string ready for use as ChatMessage content.
 */
export function buildChatCard(title, bodyHtml, { titleColor = "#C9A060", overlayOpacity = 0.85 } = {}) {
    return `
    <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">${title}</h3>
        </header>
        <div class="card-content" style="background-image: url('${CHAT_CARD_BG}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 20px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, ${overlayOpacity}); z-index: 0;"></div>
            <div style="position: relative; z-index: 1; width: 100%; display: flex; flex-direction: column; align-items: center;">
                ${bodyHtml}
            </div>
        </div>
    </div>`;
}
