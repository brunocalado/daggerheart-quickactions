/**
 * Shared helpers used across three or more call sites in the module.
 * All helpers must serve at least 3 call sites before being added here.
 */

/**
 * Builds the standard chat card HTML wrapper used throughout the module.
 * Provides a consistent header and dark card body.
 *
 * @param {string} title - Text shown in the card header (auto upper-cased via CSS).
 * @param {string} bodyHtml - HTML inserted inside the card body.
 * @param {object} [options={}]
 * @param {string} [options.titleColor="#C9A060"] - Accent color applied to borders and title.
 * @returns {string} Full HTML string ready for use as ChatMessage content.
 */
export function buildChatCard(title, bodyHtml, { titleColor = "#C9A060" } = {}) {
    return `
    <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden;">
        <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
            <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">${title}</h3>
        </header>
        <div class="card-content" style="background: #141414; padding: 20px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
            ${bodyHtml}
        </div>
    </div>`;
}
