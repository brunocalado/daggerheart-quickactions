/**
 * Features Module
 * Contains specific complex macros and features accessed via QuickActions.Features()
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// EMBEDDED TEMPLATE (Inline HTML)
// ==================================================================
const CHAIN_LIGHTNING_TEMPLATE_PATH = "modules/daggerheart-quickactions/templates/chain-lightning-inline.hbs";
const CHAIN_LIGHTNING_TEMPLATE_CONTENT = `
<div class="dh-qa-app" style="display: flex; flex-direction: column; gap: 10px;">
    <p class="notes" style="margin-bottom: 10px;">Configure the Chain Lightning effect.</p>
    
    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label style="font-weight: bold; color: #C9A060;">Difficulty</label>
        <input type="number" name="dc" value="15" min="1" max="30" class="dh-input" style="width: 60px; text-align: center;">
    </div>

    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label style="font-weight: bold; color: #C9A060;">Damage Formula</label>
        <input type="text" name="damage" value="2d8+4" placeholder="e.g. 2d8+4" class="dh-input" style="width: 150px; text-align: center;">
    </div>

    <!-- Rename Option -->
    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
        <label style="font-weight: bold; color: #C9A060;">Rename Targets (1, 2...)?</label>
        <input type="checkbox" name="renameTargets" style="accent-color: #C9A060; transform: scale(1.2);">
    </div>

    <!-- 3D Dice Option -->
    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
        <label style="font-weight: bold; color: #C9A060;">Show 3D Dice?</label>
        <input type="checkbox" name="use3dDice" checked style="accent-color: #C9A060; transform: scale(1.2);">
    </div>

    <div class="form-group" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">
        <label style="font-weight: bold; color: #C9A060;">Apply Damage?</label>
        <input type="checkbox" name="applyDamage" checked style="accent-color: #C9A060; transform: scale(1.2);">
    </div>

    <div class="form-footer">
        <button type="submit" class="dh-btn" style="width: 100%;">
            <i class="fas fa-bolt"></i> Cast Chain Lightning
        </button>
    </div>
</div>
`;

// ==================================================================
// TEMPLATE COMPILATION (Cache Injection)
// ==================================================================
if (typeof Handlebars !== "undefined") {
    const compiledTemplate = Handlebars.compile(CHAIN_LIGHTNING_TEMPLATE_CONTENT);
    Handlebars.templates = Handlebars.templates || {};
    Handlebars.templates[CHAIN_LIGHTNING_TEMPLATE_PATH] = compiledTemplate;
    Handlebars.registerPartial(CHAIN_LIGHTNING_TEMPLATE_PATH, compiledTemplate);
}

// ==================================================================
// EXPORTED FUNCTION
// ==================================================================

export async function features(featureName, ...args) {
    if (!featureName) {
        ui.notifications.warn("QuickActions.Features: No feature name provided.");
        return;
    }

    switch (featureName) {
        case 'Chain Lightning':
            // Check if a token is selected before opening the app
            if (!canvas.tokens.controlled.length) {
                ui.notifications.warn("Select a token first!");
                return;
            }
            new ChainLightningApp().render(true);
            break;
        default:
            ui.notifications.warn(`QuickActions.Features: Feature '${featureName}' not found.`);
    }
}

// ==================================================================
// CHAIN LIGHTNING APP V2
// ==================================================================

class ChainLightningApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "chain-lightning-app",
        classes: ["dh-qa-app", "chain-app"],
        window: {
            title: "Chain Lightning",
            icon: "fas fa-bolt",
            resizable: false,
            controls: []
        },
        position: {
            width: 350,
            height: "auto"
        },
        form: {
            handler: ChainLightningApp.prototype._onSubmit,
            submitOnChange: false,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: CHAIN_LIGHTNING_TEMPLATE_PATH
        }
    };

    /**
     * Handle Form Submission
     */
    async _onSubmit(event, form, formData) {
        const originToken = canvas.tokens.controlled[0];
        if (!originToken) return;

        // 1. Get Form Data
        const dc = parseInt(formData.object.dc);
        const damageFormula = formData.object.damage;
        const shouldApplyDamage = formData.object.applyDamage; // Boolean
        const shouldRename = formData.object.renameTargets;   // Boolean
        const use3dDice = formData.object.use3dDice;          // Boolean

        // 2. Validate
        if (isNaN(dc) || dc < 1) {
            ui.notifications.error("Invalid difficulty!");
            return;
        }
        if (!damageFormula) {
            ui.notifications.error("Invalid damage formula!");
            return;
        }

        // 3. Execution Logic
        await this._executeChainLightning(originToken, dc, damageFormula, shouldApplyDamage, shouldRename, use3dDice);
    }

    /**
     * Core Logic for Chain Lightning
     */
    async _executeChainLightning(originToken, dc, damageFormula, shouldApplyDamage, shouldRename, use3dDice) {
        const results = [];
        const processedIDs = new Set(); // To track who has already been hit
        let renameCounter = 1;

        // --- HELPER: Apply Damage ---
        const applyDamageToActor = async (token, damage) => {
            if (!token.actor || damage === null || damage === 0) return 0;

            const major = token.actor.system.damageThresholds?.major || 0;
            const severe = token.actor.system.damageThresholds?.severe || 0;
            const doubleSevere = severe * 2;

            let hitPointsToAdd = 0;

            if (damage < major) {
                hitPointsToAdd = 1;
            } else if (damage >= major && damage < severe) {
                hitPointsToAdd = 2;
            } else if (damage >= severe && damage < doubleSevere) {
                hitPointsToAdd = 3;
            } else if (damage >= doubleSevere) {
                hitPointsToAdd = 4;
            }

            if (shouldApplyDamage && hitPointsToAdd > 0) {
                const currentHP = token.actor.system.resources?.hitPoints?.value || 0;
                const newHP = currentHP + hitPointsToAdd;
                await token.actor.update({ "system.resources.hitPoints.value": newHP });
            }

            return hitPointsToAdd;
        };

        // --- HELPER: Process Token Roll ---
        const processToken = async (token, isChained = false) => {
            // Renaming Logic
            if (shouldRename) {
                await token.document.update({ 
                    name: `${token.name} ${renameCounter++}`,
                    displayBars: 40, // Owner
                    displayName: 50  // Always
                });
            }

            // Roll Save
            const roll = new Roll("1d20");
            await roll.evaluate(); 
            if (use3dDice && game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);

            const total = roll.total;
            const success = total === 20 || total >= dc;

            let damageResult = null;
            let tookDamage = false;
            let hitPointsAdded = 0;

            // Damage Calculation: Only take damage if failed
            if (!success) {
                const damageRoll = new Roll(damageFormula);
                await damageRoll.evaluate();
                if (use3dDice && game.dice3d) await game.dice3d.showForRoll(damageRoll, game.user, true);

                damageResult = damageRoll.total;
                tookDamage = true;
                hitPointsAdded = await applyDamageToActor(token, damageResult);
            } 

            return {
                token: token,
                name: token.name,
                roll: total,
                success: success,
                damage: damageResult,
                critical: total === 20,
                tookDamage: tookDamage, // Crucial for chaining
                isChained: isChained,
                hitPointsAdded: hitPointsAdded
            };
        };

        // --- HELPER: Find Valid Targets in Range ---
        // Finds all valid targets within 30ft of ANY token in the 'sources' list
        const findNewTargets = (sources) => {
            const validTargets = [];
            
            // Iterate over all potential tokens on canvas
            for (const t of canvas.tokens.placeables) {
                // Skip if already processed
                if (processedIDs.has(t.id)) continue;

                // Validate Type: Adversary AND Hostile
                const isAdversary = t.actor?.type === "adversary";
                const isHostile = t.document.disposition === -1;
                if (!isAdversary || !isHostile) continue;

                // Check distance against ALL current sources
                // If it is within range of AT LEAST ONE source, it gets hit
                let inRange = false;
                for (const source of sources) {
                    const measurement = canvas.grid.measurePath([source.center, t.center]);
                    if (measurement.distance <= 30) {
                        inRange = true;
                        break; // Found a source near enough
                    }
                }

                if (inRange) {
                    validTargets.push(t);
                    processedIDs.add(t.id); // Mark as processed immediately so duplicates aren't added
                }
            }
            return validTargets;
        };


        // --- STEP 1: Process Origin ---
        processedIDs.add(originToken.id);
        const originResult = await processToken(originToken, false);
        results.push(originResult);

        // --- STEP 2: Initial Burst & Chain ---
        let currentWaveSources = [originToken];
        
        // Loop for Waves
        let safetyCounter = 0;
        
        while (currentWaveSources.length > 0 && safetyCounter < 20) {
            // Find all targets near the current sources
            const nextTargets = findNewTargets(currentWaveSources);
            
            if (nextTargets.length === 0) break; // No more targets in range

            // Prepare list for NEXT wave sources
            const potentialNextSources = [];

            // Determine if this is the first wave (Neighbors of Origin) or subsequent (Chained)
            // safetyCounter == 0 means first wave (neighbors of origin). They are NOT chained.
            // safetyCounter > 0 means subsequent waves. They ARE chained.
            const isChainedWave = safetyCounter > 0;

            for (const target of nextTargets) {
                const result = await processToken(target, isChainedWave); 
                results.push(result);

                // If this target took damage, they become a source for the next wave
                if (result.tookDamage) {
                    potentialNextSources.push(target);
                }
            }

            // Update sources for next iteration
            currentWaveSources = potentialNextSources;
            safetyCounter++;
        }

        // --- STEP 3: Chat Message ---
        await this._createChatMessage(results, dc, damageFormula, shouldApplyDamage, originToken);
    }

    async _createChatMessage(results, dc, damageFormula, applied, originToken) {
        const titleColor = "#C9A060"; // Gold
        const bgImage = "modules/daggerheart-quickactions/assets/chat-messages/skull.webp";

        let listItemsHtml = "";

        results.forEach((r) => {
            const statusIcon = r.success ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>';
            const statusColor = r.success ? '#4CAF50' : '#f44336'; 
            
            const critText = r.critical ? ' <i class="fas fa-star" style="color: #FFD700; font-size: 0.8em;" title="Critical"></i>' : '';
            
            // Chained Indicator on new line
            const chainedIndicator = r.isChained 
                ? `<div style="margin-top: 2px; color: #4a90e2; font-size: 0.85em; display: flex; align-items: center;">
                        <i class="fas fa-bolt" style="margin-right: 4px;"></i> CHAINED
                   </div>` 
                : '';
            
            const damageText = r.damage !== null 
                ? `<span style="color: #ff6b6b; font-weight: bold;">${r.damage} dmg</span>` 
                : '<span style="color: #aaa;">No dmg</span>';
                
            let hpText = "";
            if (applied && r.hitPointsAdded > 0) {
                hpText = ` <span style="background: #333; color: #ff9800; padding: 0 4px; border-radius: 3px; font-size: 0.85em;">+${r.hitPointsAdded}HP</span>`;
            } else if (!applied && r.hitPointsAdded > 0) {
                hpText = ` <span style="color: #777; font-size: 0.85em;">+${r.hitPointsAdded}HP</span>`;
            }

            listItemsHtml += `
            <div style="display: flex; flex-direction: column; background: rgba(0,0,0,0.4); margin-bottom: 4px; padding: 6px 8px; border-radius: 4px; border-left: 3px solid ${statusColor}; font-size: 0.95em;">
                
                <!-- Line 1: Icon + Name -->
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                    <span style="color: ${statusColor}; width: 15px; text-align: center;">${statusIcon}</span>
                    <strong style="color: #e0e0e0; font-size: 1.05em;">${r.name}</strong>
                </div>

                <!-- Line 2: Stats (Right Aligned) -->
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 2px;">
                    <span style="color: #ccc; font-size: 0.9em;">Roll: <span style="color: #4a90e2; font-weight: bold;">${r.roll}</span>${critText}</span>
                    <span style="color: #666;">|</span>
                    <span style="font-size: 0.9em;">${damageText}</span>
                    ${hpText ? `<span style="color: #666;">|</span>` : ''}
                    ${hpText}
                </div>

                <!-- Line 3: Chained Indicator (if applicable) -->
                ${chainedIndicator}
            </div>
            `;
        });

        const content = `
        <div class="chat-card" style="border: 2px solid ${titleColor}; border-radius: 8px; overflow: hidden; font-family: 'Lato', sans-serif;">
            <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid ${titleColor};">
                <h3 class="noborder" style="margin: 0; font-weight: bold; color: ${titleColor} !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
                    Chain Lightning
                </h3>
            </header>
            
            <div class="card-content" style="background-image: url('${bgImage}'); background-repeat: no-repeat; background-position: center; background-size: cover; padding: 0; min-height: 150px; position: relative;">
                
                <!-- Overlay to darken background -->
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.88); z-index: 0;"></div>
                
                <!-- Content -->
                <div style="position: relative; z-index: 1; padding: 15px;">
                    
                    <div style="display: flex; justify-content: space-around; margin-bottom: 10px; font-size: 0.9em; color: #aaa; border-bottom: 1px solid #444; padding-bottom: 5px;">
                        <span><strong>Dif:</strong> ${dc}</span>
                        <span><strong>Dmg:</strong> ${damageFormula}</span>
                        <span><strong>Mode:</strong> ${applied ? '<span style="color:#f44336">Damage</span>' : '<span style="color:#4a90e2">Info</span>'}</span>
                    </div>

                    <div style="padding-right: 5px;">
                        ${listItemsHtml}
                    </div>
                </div>
            </div>
        </div>`;

        await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ token: originToken }),
            content: content,
            style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
    }
}