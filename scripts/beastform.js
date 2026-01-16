/**
 * Beastform Automation Module
 * Handles directory creation and compendium updates for Daggerheart Beastforms.
 * Compatible with Foundry V13.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

// ==================================================================
// LOGIC: PROCESS BEASTFORMS
// ==================================================================

/**
 * Core function to create folders and update the compendium.
 * @param {string} rootFolder - The root path (e.g., "assets/druid")
 */
async function processBeastformsLogic(rootFolder) {
    if (!rootFolder) {
        ui.notifications.error("QuickActions: Root folder is required.");
        return;
    }

    const packName = "daggerheart.beastforms";
    const source = "data"; // Default to User Data
    const FP = foundry.applications?.apps?.FilePicker || FilePicker;

    // 1. Access Compendium
    const pack = game.packs.get(packName);
    if (!pack) {
        ui.notifications.error(`Compendium "${packName}" not found.`);
        return;
    }

    ui.notifications.info(`QuickActions: Processing Beastforms in '${rootFolder}'...`);

    // Load Documents
    const documents = await pack.getDocuments();
    
    // Filter: beastform AND not evolved
    const items = documents.filter(i => 
        i.type === "beastform" && 
        i.system.beastformType !== "evolved"
    );

    if (items.length === 0) {
        return ui.notifications.warn("No valid beastforms found to process.");
    }

    // --- PHASE 1: FOLDER CREATION ---
    const ensurePath = async (fullPath) => {
        const parts = fullPath.split("/").filter(p => p.trim() !== "");
        let currentBuild = "";
        
        for (const part of parts) {
            const parent = currentBuild;
            currentBuild = currentBuild ? `${currentBuild}/${part}` : part;
            
            try {
                const browsePath = parent || ".";
                const result = await FP.browse(source, browsePath);
                
                // Check existence (handling generic encoding)
                const exists = result.dirs.some(dir => decodeURIComponent(dir).endsWith(currentBuild));

                if (!exists) {
                    console.log(`QuickActions | Creating directory: ${currentBuild}`);
                    await FP.createDirectory(source, currentBuild);
                }
            } catch (err) {
                console.error(`QuickActions | Error creating ${currentBuild}:`, err);
                throw err;
            }
        }
    };

    try {
        const pathsToEnsure = new Set();
        
        items.forEach(item => {
            const tierFolder = `Tier${item.system.tier ?? 0}`;
            // Remove spaces for folder safety
            const subFolder = item.name.replace(/\s/g, ""); 
            pathsToEnsure.add(`${rootFolder}/${tierFolder}/${subFolder}`);
        });

        // Execute creation
        for (const folderPath of pathsToEnsure) {
            await ensurePath(folderPath);
        }
        
    } catch (err) {
        console.error(err);
        return ui.notifications.error("QuickActions: Critical error creating folders. Process aborted.");
    }

    // --- PHASE 2: COMPENDIUM UPDATE ---
    const wasLocked = pack.locked;
    let updateCount = 0;

    try {
        if (wasLocked) await pack.configure({locked: false});

        const updates = items.map(item => {
            const tierFolder = `Tier${item.system.tier ?? 0}`;
            const subFolder = item.name.replace(/\s/g, "");
            
            // Add Wildcard syntax
            const newPath = `${rootFolder}/${tierFolder}/${subFolder}/*`;

            return {
                _id: item.id,
                "system.tokenImg": newPath
            };
        });

        if (updates.length > 0) {
            console.log(`QuickActions | Updating ${updates.length} beastforms...`);
            await Item.updateDocuments(updates, { pack: packName });
            updateCount = updates.length;
        }

        ui.notifications.info(`QuickActions: Success! Folders created and ${updateCount} items updated.`);

    } catch (err) {
        console.error("QuickActions | Error updating items:", err);
        ui.notifications.error("QuickActions: Error during compendium update.");
    } finally {
        if (wasLocked) await pack.configure({locked: true});
    }
}

// ==================================================================
// APPLICATION V2: CONFIG DIALOG
// ==================================================================

class BeastformApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        id: "beastform-app",
        classes: ["dh-qa-app", "beastform-app"], // Reusing CSS from apps
        window: {
            title: "Beastform Configuration",
            icon: "fas fa-paw",
            resizable: false,
            controls: []
        },
        position: {
            width: 450,
            height: "auto"
        },
        form: {
            handler: BeastformApp.prototype._onSubmit,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: "modules/daggerheart-quickactions/templates/beastform.hbs"
        }
    };

    async _onSubmit(event, form, formData) {
        const rootFolder = formData.object.rootFolder;
        if (!rootFolder) {
            ui.notifications.warn("Please specify a root folder.");
            return;
        }
        // Save to settings for convenience/automation
        await game.settings.set("daggerheart-quickactions", "beastformRootPath", rootFolder);
        
        await processBeastformsLogic(rootFolder);
    }
}

// ==================================================================
// EXPORTED FUNCTION
// ==================================================================

/**
 * Main entry point. 
 * If rootFolder is provided, executes immediately.
 * If not, opens the configuration dialog.
 * * @param {string} [rootFolder] - Optional root path
 */
export async function beastformAction(rootFolder) {
    if (rootFolder && typeof rootFolder === "string") {
        await processBeastformsLogic(rootFolder);
    } else {
        new BeastformApp().render(true);
    }
}