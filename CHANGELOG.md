# 0.4.8

- [Added] Character Sheet: **Hide Biography Tab** — a per-user setting (off by default) that hides the Biography tab on character sheets for that user only.
- [Added] Character Sheet: **Biography Tab Visibility** — a world setting for the GM that decides whether each user picks their own choice (default), or the tab is forced visible or hidden for everyone. Changing either setting updates open character sheets immediately, and if Biography is the active tab when it gets hidden the sheet falls back to Features.

# 0.4.7

- [Changed] Unleash Chaos: recharge cost is now chosen explicitly via a dialog — **1 Stress** (default), **1 HP**, or **Nothing** (for the free recovery at the start of a session) — instead of being decided automatically.

# 0.4.6

- [Added] Downtime UI: the same downtime move can now be chosen more than once, as the rules allow. Each move shows a `×N` count badge with add (`+`) / remove (`−`) controls, and every repeat is an independent instance — targeted moves (Tend to Wounds, Repair Armor) can point each repeat at a different ally, and Efficient/Recovery upgrade slots apply to exactly one instance instead of every copy. Selection is stored as a list of move instances (with a migration for choices saved in the previous format).
- https://github.com/brunocalado/daggerheart-quickactions/issues/2

# 0.4.5

- [Fixed] Downtime UI: "Repair Armor" (Short and Long Rest) was a silent no-op — the Daggerheart system moved armor tracking from `item.system.marks` to `item.system.armor.current`/`.max`, so the module's lookup never matched any armor item. Now uses the system's own `actor.system.updateArmorValue()` API to reduce or fully clear Armor Slots, matching native rest behavior and also covering armor bonuses granted by Active Effects (e.g. domain cards), not just the equipped item.
- https://github.com/brunocalado/daggerheart-quickactions/issues/1

# 0.4.4

- [Fixed] Templates: eliminated V14 deprecation warnings (`MeasuredTemplateDocument`, `getConeShape`, `core.coneTemplateType`) by migrating to native V14 Region API. Preview now uses raw PIXI.Graphics instead of the deprecated `MeasuredTemplate` placeable; template creation now calls `createEmbeddedDocuments("Region", ...)` directly with `flags.core.MeasuredTemplate = true` instead of the deprecated `MeasuredTemplate` compat shim.
- [Added] Templates: new **Rect** shape type — places a square Region centered on the click point, sized to the selected range. Generates `@Template[type:rect|range:...]` code. Fixed **Front** code string to correctly emit `@Template[type:front|...]` instead of `rect`.


# 0.4.3

- [Changed] Party Sheet: removed Short Rest and Long Rest buttons from the party sheet actions bar — they are replaced by the Downtime UI button
- [Added] Party Sheet: Downtime button injected into the party sheet actions bar (GM only) — opens the Downtime UI directly from the party sheet

# 0.4.2

- [Added] Loot Consumable: rolled items are now automatically added to the rolling user's linked actor's inventory (if one exists)
- [Added] Loot Consumable: rolled coin amounts are automatically added to the linked actor's `system.gold.coins` field
- [Changed] Loot Consumable: chat messages are now whispered to GM(s) and the rolling user only — no longer visible to all players
- [Fixed] Loot Consumable: use V14-compliant `TableResult#uuid` API; no more deprecation warnings for `documentId` / `documentCollection`
- [Fixed] Request Roll: Cinematic mode now uses Daggerheart's native enriched roll buttons (`.duality-roll-button` / `.fate-roll-button`) instead of `ui.chat.processMessage()`, eliminating the `SYSTEM is not defined` crash. `CinematicRollPrompt` refactored to use `HandlebarsApplicationMixin` and template rendering via `_prepareContext`, allowing Daggerheart's `enricherRenderSetup` hook to wire click handlers automatically.

# 0.4.1

- [Changed] Refactor: extracted `MODULE_ID` to `scripts/constants.js` as the single source of truth — all 11 scripts now import the constant instead of declaring it locally or using string literals
- [Changed] Refactor: extracted `buildChatCard()` helper to `scripts/helpers.js` — eliminates duplicated chat card HTML across apps.js, scan.js, request_roll.js, and template-creator.js
- [Fixed] Downtime Rest: item feature refresh now batches all item updates into a single `updateDocuments()` call per actor instead of sequential awaited updates

# 0.4.0

- v14 only
- [Changed] Hide system's "Falling And Collision Damage" menu — module's Falling Damage implementation is superior
- [Added] Falling Damage: customizable dice formulas via module settings. GMs can change the formula for each fall height category (Very Close, Close, Far/Very Far, Collision) and reset to Daggerheart official defaults at any time
- [Fixed] Falling Damage: chat messages now render with Deal Damage / Apply Healing buttons using Daggerheart's standard foundryRoll template
- [Changed] Scan: moved "Enable Token Scan" setting from module settings menu into Scan Configuration app under new "General" tab
- [Added] Downtime UI: visual pip counter in GM toolbar showing consecutive short rests taken (resets on long rest). Informational only — GM can still choose any rest type regardless of counter state
- [Fixed] Loot Consumable: removed deprecated TableResult API usage (TableResult#text, TableResult#documentId, TableResult#documentCollection) — no more console warnings on roll
- [Added] Request Roll: Loot button — reorganized top row to **None | Hope | Fear | Loot** in a single horizontal line. Selecting Loot and sending opens the Loot & Consumables screen on targeted players' clients.
- [Added] Loot Consumable: new **Coins** type alongside Loot and Consumable. Select a tier (Tier 1–4) and click Roll to generate a random coin amount within that tier's range. Defaults: Tier 1 = 10–50, Tier 2 = 100–200, Tier 3 = 500–1,000, Tier 4 = 1,000–2,000.
- [Added] Loot Consumable: **Coin Tier Configuration** settings menu — GMs can customize the min/max coin range for each tier and reset to defaults at any time.

# 0.3.3

- Request Roll: you can pick users.

# 0.3.2
- Unleash Chaos Macro
- Templates fix.
- [Removed] Beastform art updater feature and all related settings.
- [Added] Recovery core feature for Downtime UI: during a short rest, choose one long rest downtime move instead. Can spend 1 Hope to grant the same benefit to an ally. Fully compatible with Efficient (both can be active simultaneously as independent upgrade slots).

# 0.3.1
- CSS refactor
- [Added] HP, Stress, Armor, and Hope resource bars in Downtime UI player rows
- [Fixed] Debounce Downtime UI re-renders to prevent redundant render bursts from concurrent state changes

# 0.3.0
- QuickActions.Scan(); will be a wisper
- CSS refactor
- QuickActions.Scan(); supports customization
- Tooltip will be disabled on drag token
- Adversary Tooltip will show reaction and passive features

# 0.2.9
- New: QuickActions.Scan();
/* WARNING: This will only work if you enable the module setting.
This allows the player to obtain information about a targeted adversary token. 
They will be informed about the HP and Stress status without revealing numerical values. 
During the game, it is common for players to ask: "I look at the goblin, how does it look?" 
The GM usually responds: "He looks quite wounded and exhausted." 
This macro aims to give players the autonomy to do this themselves. 
Example output: 
Physical State: Injured 
Mental State: Completely overwhelmed, paralyzed by panic and unable to think clearly 
*/

# 0.2.8
- A player can see the Adversary Tooltip if their token is marked with a friendly disposition.
- small css fix for Tooltip

# 0.2.7
- Token Tooltip will no longer cause problems to the Token HUD.

# 0.2.6
- DowntimeUI will auto close for players

# 0.2.5
- Fix for: Automated: Premium Bedroll

# 0.2.4
- Fix for: Automated: Premium Bedroll

# 0.2.3
- Deleting a token will delete its tooltip.
- Tooltip size can be adjusted via user settings; each user can customize this individually.
- Improved visuals for Tooltip Adversary, Companion and characters.
- DowntimeUI: Automated Beastbound

# 0.2.2
- Tooltip for Adversaries
- Tooltip for Companion

# 0.2.1
- Tooltip for Players

# 0.2.0
- Warn about Domain Cards
- DowntimeUI: visual improvement

# 0.1.9
- Bug fix: Automated: Eloquent
- DowntimeUI: visual improvement and informative text
- Automated: Soothing Speech
- Automated: Armorer

# 0.1.8
- Added scrollbar to DowntimeUI
- DowntimeUI: Automatically disable offline users
- Automated: Efficient
- Automated: Forage: Items will be added to the actor sheet
- Automated: Celestial Trance
- Automated: Premium Bedroll
- Automated: Eloquent
- Better visual

# 0.1.7
- removed timeDiff to prevent Downtime fail
- DowntimeUI chat message looks nice now

# 0.1.6
- removed timeDiff to prevent RequestRoll fail

# 0.1.5
- more timeDiff to prevent RequestRoll fail

# 0.1.4
- New Feature: Advanced Downtime UI

# 0.1.3
- You can level up players

# 0.1.2
- QuickActions.RequestRoll(); is easier to pick a player

# 0.1.1
- new: QuickActions.Templates();

# 0.1.0
- QuickActions.RequestRoll() works for fate rolls now
- // You can use QuickActions.RequestRoll(false); to prevent it from use images.
QuickActions.RequestRoll();

# 0.0.9
- request roll show dialog to player

# 0.0.8
- request roll grant resources and style improve
- fate roll can use system or you can trigger a dice choice https://github.com/brunocalado/daggerheart-quickactions/wiki
- GM Quick Actions
- AerisCinematicCritsforDaggerheart improved. // READ THIS: https://github.com/brunocalado/daggerheart-quickactions/wiki/Aeris-Cinematic-Crits

# 0.0.7
- QuickActions.SpendHope();

# 0.0.6
- show macros can read world macro from UUID

# 0.0.5
- beastform art updater: READ https://github.com/brunocalado/daggerheart-quickactions/wiki#beastform
- ShowMacros suporta UUID https://github.com/brunocalado/daggerheart-quickactions#via-api--macros
- fate roll style fixed

# 0.0.4
- removed loot table to use from the system

# 0.0.3
- You can choose how many PCs for downtime