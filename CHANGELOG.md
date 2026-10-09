# 0.7.8

- [Changed] Chain Lightning (`QuickActions.Features("Chain Lightning")`) now follows the Arcana card. Select the caster's token: the window reads the caster's last Chain Lightning Spellcast Roll from chat (or you type it). Every adversary within Close range whose Difficulty the Spellcast Roll meets, or all of them on a critical, makes a reaction roll against the Spellcast result. Those who fail take one shared 2d8+4 magic damage roll, applied through the system, so resistance, immunity and thresholds count. The lightning then jumps to adversaries not yet targeted within Close range of anyone who marked HP, until nobody is left. Before, the selected token was treated as the first target and rolled its own save, the chain also jumped from targets that took no damage, the reaction Difficulty was typed by hand, and damage ignored magic resistance and immunity.
- [Changed] Chain Lightning targets any adversary token that isn't Friendly (the same split the system's combat tracker makes), so a Neutral adversary is no longer left out. Adversaries with every HP marked are listed on the card as Defeated, and the chain does not pass through them.
- [Changed] Chain Lightning's window has its own template and the module's look: switches instead of checkboxes, and it closes as soon as you cast. The "Show 3D Dice?" option is gone.
- [Added] The Chain Lightning results card shows each target's token image, which pans the map to it, and gives the GM an undo button per target that reverts the HP that target actually marked.
- [Added] With Daggerheart Distances 0.3.0 or later active, Chain Lightning measures Close range the way its rings show it, including elevation when its 3D mode is on. Without it, the system's own range check is used.
- [Added] With Sequencer and JB2A (Patreon or free) active, Chain Lightning is animated: bolts jump from the caster to each target and along the chain, every target that takes damage catches fire, and each wave has lightning and fire sounds. All the reaction and damage dice are thrown in a single Dice So Nice roll, the animation waits for the dice to clear, and every player's camera pans to each wave, or follows it bolt by bolt when its tokens don't fit on the GM's screen. The sounds are from lentikula's Basic Spell Impacts pack, released under CC0.
- [Changed] The README was rewritten in plain prose, with the same content.
- Checked in a disposable Foundry 14.369 / Daggerheart 2.10.11 world with a GM and a player client: the chain, the Neutral and Defeated cases, the undo of a target near its maximum HP, the Distances measurement at the edge of Close, the animation with Sequencer 4.2.3 and JB2A Patreon 0.9.2, the single Dice So Nice throw, and the macro with Sequencer turned off. Nothing went to the error log or notifications. The headless browser does not draw the canvas, so how the animation looks was not checked.

# 0.7.7

- [Changed] Loot & Consumables and Custom Tables: the roll card is now posted to the whole table instead of whispered to the GM and the player who rolled. When a player sent the loot to the party stash, the other players saw items appear in the party with no card explaining where they came from.
- Checked in a disposable Foundry 14.368 / Daggerheart 2.10.7 world with a GM and two player clients: one player rolled both dialogs into the party stash, and both cards, each with its "Sent to … (party stash)" line, showed up in the chat of the other player and of the GM. The items reached the party. Nothing went to the error log or notifications.
- Light Sources 0.8.0 needs no change here: on a GM and a player client all 18 sources registered with no "Skipping light source" warning, a Torch lit from a stack of 3 left 2, and a Hooded Lantern lit on its Shuttered pattern and was put out again.

# 0.7.6

- [Changed] Light Sources integration: requires **Light Sources 0.5.0** or later. Light Sources 0.5.0 needs every light pattern to carry a stable id, and skipped any source without one, so with it installed none of this module's eighteen sources registered. Each pattern now has an id (`standard`, `open`, `shuttered`, `high-beam`, …); the names shown in the Token HUD are unchanged.
- Checked in a disposable Foundry 14.368 / Daggerheart 2.10.7 world with Light Sources 0.5.0, on a GM and a player client: all 18 sources registered on both, with no "Skipping light source" warning. The player's Token HUD listed the Hooded Lantern as **Open** and **Shuttered**, and clicking Open lit the token (dim 60, bright 30). Nothing went to the error log or notifications.

# 0.7.5

- [Changed] Light Sources integration: the eighteen sources now use Light Sources' new `consume` values and require Light Sources 0.2.1 or later. Torches, candles, matches, glowsticks, flares and the three *Hope & Fear* consumables are `"copy"`: lighting one spends one from the stack, as before. Lanterns, the Oil Lamp, the Candelabra, the Miner's Helmet, the Tactical Flashlight, the Smartphone, Alistair's Torch and the Mandragorian Torch are `"none"`: lighting spends nothing and the light burns on the item. The new Light Sources refuses the old `true`/`false` values, so with it installed nothing from this module registered until this change.
- A GM who customized one of these sources in Light Sources' editor must open it and save it, or click **Restore Module Default**. A customized source keeps the old boolean, and it lights without spending anything until that is done.
- Checked in a disposable Foundry 14.368 / Daggerheart 2.10.6 world with the unreleased Light Sources code: no "Skipping light source" warning after `ready`, all 18 sources stored with `consume` `"copy"` or `"none"` as listed above, 2 Torches went to 1 on `activate` with no item attached to the light, and a Hooded Lantern kept its quantity with the light attached to the lantern. Nothing went to the error log or notifications.
- [Changed] Releases are now built and published automatically: each version gets a GitHub release with `module.json` and `module.zip`, and is registered on foundryvtt.com. The manifest link is now `https://github.com/brunocalado/daggerheart-quickactions/releases/latest/download/module.json`. The old link on `main` keeps working, because the `module.json` there points to the new one.

# 0.7.4

- [Changed] GM Menu: the Daggerheart system's sidebar tab (the purple skull) now sits **right below Chat** instead of at the bottom of the tab strip, just above Settings, so the GM's most-used tools are one short reach from the chat. The tab keeps its skull icon, its menu and its GM-only visibility; only its position changed. The module rebuilds the sidebar's tab list with the same entries in a new order, before the sidebar is created, which is the same mechanism the system uses to add the tab in the first place. If the system tab or Chat is missing, for example because another module replaced the sidebar, nothing is moved. There is no setting for this.
- Checked in a disposable Foundry 14.368 / Daggerheart 2.10.6 world as GM: the tab strip read Chat, Daggerheart menu, Combat, … Compendium, Settings, both in the rendered buttons and in `CONFIG.ui.sidebar.TABS`, and it kept that order after the sidebar was re-rendered. Clicking the tab opened the menu with the skull and its sections in place, and switching back to Chat worked. Nothing went to the error log or notifications. The player view was not opened; the tab is GM-only, and that check does not depend on the order.


# 0.7.3

- [Changed] Downtime UI: the GM can now pick moves, targets and feature options on **any player's row**, not only watch them. When a player misses the session, the GM switches their row on with the **Include** toggle (offline players still start excluded) and chooses their moves directly. The GM can also fill in a row for a connected player who asks for help. Players still edit only their own row. The choices are stored on the player's user exactly as if they had made them, so **Start Downtime** applies them the same way. If the GM and that player edit the row at the same moment, the last click wins. The GM reviews the result before starting the rest.
- Checked in a disposable Foundry 14.368 / Daggerheart 2.10.5 world, with an offline player whose character was at 5 Stress. The GM included the row and chose Clear Stress, and every control on the row was enabled for the GM. The choice was saved to the offline user. Start Downtime then rolled the Fear, cleared 3 Stress (d4 roll of 2 + Tier 1), and posted the summary card.

# 0.7.2

- [Added] **Light Sources** integration: four *Hope & Fear* items from the Daggerheart system's own compendiums now register alongside this module's fourteen, so they light up from the Token HUD with no manual configuration. **Mandragorian Torch** burns like an ordinary torch and is never consumed, since it is durable loot; the book's "only the bearer can see it" has no token-light equivalent, so everyone sees it. **Warding Candle** lights a halo in Close range for one hour. **Glowmoss Mushroom** glows blue with no time limit, because "until your next long rest" has no minute equivalent, so the player puts it out. **Sunlight Orb** lights a wide area for 24 hours; a player who wants it to stay put can drop it from the Token HUD. The three consumables spend one item when lit.
- [Changed] Light Sources integration: every light's **color intensity** is now between 0.1 and 0.2, down from as high as 0.8, which washed the whole scene out in the light's color. The lights keep their order from strongest to weakest. A world where the GM already edited one of these sources keeps the GM's values until **Restore Module Default** is clicked in the Light Sources configuration window.
- [Fixed] Light Sources integration: the **Emergency Flare** was rendering with no animation. It used `roiling`, which in Foundry V14 belongs to the darkness animation set, so on an ordinary light it was ignored. It now uses `flame`.
- Checked in a disposable Foundry 14.368 / Daggerheart 2.10.5 world with Light Sources 0.0.9: all 18 sources registered with the expected consumption, duration, intensity and animation, and nothing went to the error log or notifications. `flame` and `sunburst` are present in `CONFIG.Canvas.lightAnimations`, and `roiling` is not.

# 0.7.1

- [Added] Loot & Consumables: a **Mod** field beside the dice stepper, for the calls the stepper cannot make. It only moves in steps of twelve, so "roll 2d12+5" and "roll 1d12+1d6" — a shift of the rarity band, and a spread finer than the jump from 1d12 to 2d12 — both had to be typed. Leave it blank and the roll is exactly the pool beside it, as before. `5`, `+5`, `-2`, `1d6` and `+1d6` are all accepted; the unsigned form has the operator added for you.
- This is **not** the free-text formula field removed in 0.6.7. That one replaced the whole roll, which is what made it dangerous; this one only adds a term, so the d12 pool stays bounded at 1–5 and still covers the common case in a single click.
- [Changed] Loot & Consumables: the reach hint is now derived from the **formula actually being rolled**, through `Roll#evaluate({minimize})` and `({maximize})`, instead of the `diceCount × 12` arithmetic it used before — which would simply have been wrong next to an extra term. It is clamped the same way a draw is clamped, so the hint reports the effective band: `+5` reads `Reaches 6–17`, `+1d6` reads `Reaches 2–18`, and `-2` reads `Reaches 1–10`. A formula that overshoots the table reads `Reaches 60–60`, which says on its own that the dice have stopped deciding anything — no warning needed, since landing on the last entry is the correct thing to do when there is no 104th position.
- [Changed] Loot & Consumables: the dice stepper was narrowed and the Mod field placed on the same line, its label inline to the left — the pool and the modifier are one formula, so they read as one row. The `1d12` box no longer stretches across the window; the space it used to take is what the new field occupies. Named **Mod** rather than *Bonus* because the field accepts `-2` as readily as `+5`, and a field called Bonus that takes penalties misleads the first time someone uses one.
- [Fixed] Loot & Consumables: two alignment defects in the new row, both found by measuring it rather than looking at it. The `−` / `+` buttons rendered five pixels taller than the box between them, because core sets a `min-height` on buttons that won the stepper's own `stretch`; and the **Mod** label sat seven pixels above the centre of its field, because core gives labels a `margin-bottom` and `align-items: center` centres the margin box rather than the text. Both are now pinned explicitly.
- An invalid formula is refused when the field loses focus, with the previous value restored — `Roll.validate` runs there rather than at roll time, since a bad formula found partway through a queue of five would already have played the earlier animations. Queued entries carry their own modifier and show it in the pending list (`Loot — 2d12 + 5`), and the chat card's caption line reports the full formula and its total. The field is hidden in Coins mode, which has no dice pool.
- Verified against a live Foundry 14.367 / Daggerheart 2.9.4 client: all six hint cases above were read off the rendered dialog and matched; `banana+++` was refused and `+5` restored; a queue of `1d12 + 1d6` and `2d12 + 5` resolved into one card with each entry rolling its own formula (`→ 16` and `→ 15`, both inside their reported bands); `1d12 + 100` landed on 60 as designed; items reached the sheet; Coins mode hid the field. The row was measured rather than eyeballed — all four controls 34px tall with identical top and bottom edges, the field 202px wide in a 418px row, and the label centred on the field to within half a pixel.

# 0.7.0

- [Added] **Custom Tables**: a second loot roller, for the GM's *own* roll tables — homebrew treasure, a third-party adventure's list, a translated table. Pick a table, tap **+** for more draws, and **Add to Roll** stacks draws from several tables into a single **ROLL** and a single chat card, with the same **To Myself / To Party** destination choice and the same whisper-to-GM-and-roller behaviour as Loot & Consumables. Opened with `QuickActions.CustomTables()` or the **Custom Tables** macro in this module's Macros compendium.
- [Added] Custom Tables: each table is rolled with **its own formula**, through `RollTable#roll()`. That is the whole reason this is a separate roller rather than an option inside Loot & Consumables: that one reads the Daggerheart tables as one rarity-ordered index — position 7 is the seventh-cheapest entry, which is why stacking d12s reaches rarer loot and why the pool is capped at 5d12 for exactly 60 positions. None of that is true of an arbitrary table, and making it configurable would have meant the dice pool silently meaning two different things depending on a setting. Delegating the draw to the table's own formula costs less code and cannot drift from what its author built — nested tables are followed too, for free.
- [Added] Custom Tables: the draw count has **no ceiling**. The SRD roller's 5d12 limit comes from a number its tables actually have; a homebrew table has no equivalent, so picking one would have been inventing a rule. The stepper is `−`/`+` only, which makes a runaway count cost a click per draw.
- [Added] **Custom Tables Configuration** settings menu (GM): drag roll tables in from the **Rollable Tables** directory or from any compendium, remove them individually, or clear the list. Each row shows the table's live name and how many entries it holds, so a rename shows up without re-adding it; a table that was deleted, or whose compendium is gone, is flagged in red and kept on the list rather than dropped silently — whether it moved or should go is the GM's call. The menu also states the three things worth knowing before adding a table, described below.
- Custom Tables hands out **items only**. A result pointing at an Item is created on the sheet, in one batch; a text entry, or a link to an actor or journal, is reported in the chat card and nothing is written. The card's "Sent to …" line only appears when something actually landed.
- Custom Tables uses `roll()` rather than `draw()`, which means it never writes to the GM's table: no chat card of the core's own competing with this module's, and no drawn-state written back. The trade-off is that a table set to draw **without replacement** still repeats — stated in the settings menu rather than left to be discovered.
- A table configured by the GM is resolved on the **rolling user's** client, so a world roll table created in the sidebar — which starts with no player access at all — works for the GM and fails for everyone else. The settings menu says so, and an unreachable table is reported **before any die is thrown**, leaving the queue and both actors untouched.
- Loot & Consumables is **untouched** by this release: not a renamed method, not a shared helper, not a line. Its rarity-scale assumptions stay stated in exactly one place, and nothing in the new roller can reach them. The two apps live side by side in `scripts/apps.js` and deliberately share no code — including the delivery path, which was left duplicated rather than extracted, so a future change to one cannot silently alter the other.
- Verified end to end against a live Foundry 14.367 / Daggerheart 2.9.4 client: a three-draw roll produced three card rows carrying the table's own `1d3` formula and total, three `@UUID` links, and three items on the sheet (including a legitimate repeat, since replacement is not honoured); a queue across two different tables resolved into one card and cleared itself; a text result and a result pointing at a journal were listed but granted nothing and suppressed the destination line; a table whose uuid no longer resolves raised its error and created zero messages and zero items; the settings menu listed entry counts, flagged the broken table and removed it; the empty state replaced the ROLL button with a pointer to the settings menu. Loot & Consumables was rolled afterwards in the same session and still reported `Reaches 1–12 · 24 items in reach` and delivered its item.

# 0.6.9

- [Changed] Loot & Consumables: resolving a queued roll is roughly twice as fast. The book-picking die used to be thrown once per draw, right after that draw's own d12 pool, so a queue of four with both books enabled sat through eight Dice So Nice animations one after another. All the picks are now settled in a **single throw of coins** at the start — one coin per draw, heads for Hope & Fear, tails for Core Set — and each draw still gets its own d12 moment afterwards, so the same queue of four costs five animations instead of eight.
- [Changed] Loot & Consumables: the book-picking die is a **coin** rather than a second d12. Thrown together the way they now are, a d12 picking the book was indistinguishable from the d12s rolling the pool — a coin reads as a coin flip at a glance. The odds are unchanged: it was 1–6 / 7–12 before and it is tails / heads now, 50/50 either way. A coin is only thrown for draws that actually have a choice to make; with a single book configured, nothing is flipped. A queue long enough to out-run Dice So Nice's 20-dice ceiling splits across several throws rather than flipping coins nobody sees land.
- [Changed] Loot & Consumables: the roll tables are read **once per ROLL** instead of once per queued draw. A queue of five used to re-fetch the same compendium documents and rebuild the same rarity index five times over. Drawing the same item twice in one queue now loads it once too, and still creates both copies.
- [Changed] Loot & Consumables: an unconfigured coin tier or an unreachable roll table is now reported **before any die is thrown**, rather than partway through a queue whose animations had already started playing.
- [Changed] Loot & Consumables: a selected button is filled solid gold instead of only carrying a brighter border and glow — at a glance the chosen Loot / Consumable / Coins type, coin tier, and To Myself / To Party destination now read as chosen even next to a hovered neighbour.

# 0.6.8

- [Added] Downtime UI: the **Shapeshifter** transformation's two downtime moves — **Change Shape** (swap your ancestry) and **Only Skin Deep** (swap which ancestry feature is active). Both spend a move and are recorded in the resolution summary; the swap itself stays the player's to apply, since either would otherwise mean deleting and recreating sheet items on the module's guess.
- [Added] Downtime UI: Duneborne's **Oasis** — during a short rest, reroll one die used for a downtime move and keep the higher result. A water badge on Tend to Wounds / Clear Stress / Repair Armor / Forage marks which roll it applies to, and a selector hands the reroll to an ally instead (no Hope cost, unlike Recovery). Both dice are shown through Dice So Nice, and the summary spells out the swap: `[Roll: 3→2 Oasis, kept 3]`. An instance already upgraded to long-rest quality by Efficient or Recovery no longer rolls, so it quietly gives the reroll up.
- [Added] Downtime UI: **Timekeeper's Pendant** grants +1 downtime move each rest, the same way Celestial Trance does.
- [Added] Downtime UI: **Pipeweed** appears as a free **Smoke Pipeweed** move during a short rest for anyone holding the leaf. Smoking one clears an additional Stress for *every* PC who chose Clear Stress — not just the smoker — so it is totalled before anyone resolves, like the Prepare pairing bonus. Each leaf smoked adds its own +1, and one Pipeweed is spent (the item is deleted when the last is used).
- [Added] Downtime UI: armour with the **Self-Healing** feature ("When you take a rest, clear an Armor Slot") — the Trollhide Cuirass and anything else carrying it — now clears one Armor Slot automatically on every rest, short or long. Detection reads the system's own `system.armorFeatures` entry rather than matching the item by name, so homebrew armour granting Self-Healing works without configuration; only equipped armour counts. Unlike Premium Bedroll, whose +1 is folded into the Clear Stress roll, this stacks on top of Repair Armor rather than being skipped when that move was chosen, and it is a no-op when no slots are marked.
- [Changed] Downtime UI: the Forager choice dropdown is now keyed to Forage specifically rather than to "is a bonus move", so Smoke Pipeweed does not inherit it. Bonus moves are also excluded from the move count by a shared list instead of a hardcoded `core_forager` comparison.
- [Added] Downtime UI: support for the Warlock's **Favor** class feature. An actor carrying it gets a **Show Tribute** move — describe how you honour your patron and gain Favor equal to your Spellcast trait. Unlike Forager's free bonus move it spends one of the actor's choices, exactly as the feature reads ("You can use a downtime move to show tribute to your patron"), and it is offered on both short and long rests since the feature draws no distinction. The move records that it was spent; the Favor itself is applied by the player, so nothing is written to the sheet.
- [Changed] Downtime UI: the Efficient / Recovery upgrade badges no longer appear on moves whose outcome has no short/long rest distinction. Previously only **Prepare** was excluded by name; that exclusion is now a list (`NO_UPGRADE_MOVES`) covering Show Tribute, Change Shape and Only Skin Deep too.
- Every feature added above joins the **Core** tab of the Downtime configuration, so the GM can repoint it at homebrew or a renamed item exactly like the existing ones. Existing worlds pick them up without a reset — the Core list merges saved entries over the defaults.
- Every feature above was verified end to end against a live Foundry 14.367 / Daggerheart 2.9.2 client: move availability per rest type, the Oasis reroll on both d4 and d6 (including the ally grant landing on the beneficiary and not the grantor, and the real `Forager` domain card on a Druid rather than a stand-in), the party-wide Pipeweed bonus reaching a PC who owns no Pipeweed, quantity decrement through to item deletion, bonus moves not counting against the limit, and both legacy `downtimeChoices` shapes migrating without the new fields. Self-Healing was checked in all four states — unworn armour (nothing happens), worn with marks, worn with none left (silent no-op), and on a long rest — plus 8 trials pairing it with Repair Armor, where it fired in exactly the runs the repair roll left a slot behind. Across 12 sampled Oasis rerolls the kept value was the higher of the two dice every time, with both outcomes (reroll wins, first roll wins) observed.

# 0.6.7

- [Added] Cinematic Roll Images: every one of the nine cases now ships with a **default image**, so Cinematic Mode works out of the box instead of staying inert until the GM configures something. All nine are core Foundry icons (`icons/…`) — nothing is bundled with the module, which is why the AI artwork removed in 0.6.4 was not restored: Agility a pair of winged boots, Strength a stone fist, Finesse a set of lockpicks, Instinct a third eye, Presence a figure projecting their voice, Knowledge a book of runes, Hope a golden starburst, Fear a burning purple skull, and the generic Duality Roll a glowing two-halves symbol.
- [Added] Cinematic Roll Images: **Reset to Default** and **Clear All** buttons at the bottom of the settings menu. Reset restores the nine stock icons — which is how a world created before this release, whose stored map is all-blank, picks them up. Clear All blanks every case, switching Cinematic Mode off entirely. Both save immediately, like the existing per-row Browse and Clear.

- [Fixed] Loot & Consumables: rolling raised `Table 'Loot' not found in compendium.` / `Table 'Consumables' not found` since Daggerheart 2.9.2 renamed those roll tables ("Loot" → "Core Set Items", "Consumables" → "Core Set Consumables") and added two *Hope & Fear* tables. The roller now resolves the tables by their stable compendium id via `fromUuid`, not by name, so a future rename can't break it again.
- [Added] Loot & Consumables: a **Table Source** option — *Core Set only*, *Hope & Fear only*, or *Core Set + Hope & Fear* (the default). With both enabled the books share **one rarity scale** instead of being chained end to end: position 7 is the seventh-cheapest entry in *either* book, so a `1d12` sees 24 common items rather than 12. A second, visible d12 then decides which book the entry comes from (1–6 Core Set, 7–12 Hope & Fear), so the table watches the pick happen instead of trusting a hidden coin flip. Chaining them would have buried the Hope & Fear commons past position 60, where no sensible dice pool reaches.
- [Added] Loot & Consumables: **Add to Roll** stacks several draws before rolling — a GM call like "3d12 loot, then 2d12 loot, then Tier 2 coins" is set up once, resolved by a single **ROLL**, and reported as one chat card listing everything drawn. Queued entries can be removed individually; the queue clears after rolling. With nothing queued, ROLL still resolves the single selection on screen, as before.
- [Added] Loot & Consumables: when the rolling user's linked character belongs to a party sheet they own, a **To Myself / To Party** button pair chooses where the results land — a radio pair, so exactly one is always active. The buttons are hidden entirely when there is no such party. The chat card records which destination was used. Every drawn item is created in one batch, and all queued coins in a single gold update.
- [Changed] Loot & Consumables: the **Coin Tier Configuration** settings menu is now **Loot & Consumables Configuration** — one window covering everything `QuickActions.LootConsumable()` rolls, holding the new table-source dropdown alongside the existing coin tier ranges. Coin ranges themselves are unchanged and keep their stored values.
- [Changed] Loot & Consumables: the fixed 1d12–5d12 buttons and the free-text formula field are gone, replaced by a **−/+** stepper capped at 5d12 — the tables hold 60 rarity-ordered entries (five bands of twelve), so a larger pool could only run past the last one and be clamped back. A hint under the stepper spells out what the current pool buys ("Reaches 1–12 · 24 items in reach"), which is where the second book's effect shows up: twice the candidates at the same rarity, not rarer loot.

# 0.6.6

- [Changed] GM Menu: hide the system's **Downtime Fear** section (new in Daggerheart 2.9.1 — Short Rest / Long Rest / Extended Downtime buttons that roll downtime Fear). This module's own Downtime UI already handles rest and downtime Fear generation, so the system's section is redundant. Removed from the "GM Tools" menu the same way the built-in "Falling And Collision Damage" section already was, by matching its `rollDowntimeFear` action buttons and dropping the enclosing `<fieldset>` on `renderDaggerheartMenu`.


# 0.6.5

- [Changed] Request Roll: **Cinematic Mode now always opens** the full-screen prompt on the targeted players' screens, whether or not the GM has configured an image for the resolved case (see 0.6.4) — the prompt template already omits the image cleanly when none is set, so there was no reason to fall back to a plain chat message. The roll request is also still posted to chat as before, alongside the cinematic prompt rather than instead of it, so there's a persistent record even before a player acknowledges the prompt.


# 0.6.4

- removed ai assets
- [Added] Light source registration now also seeds the Light Sources module's compatibility settings (Item Types: Loot/Consumable, Actor Types: Character) via its new `registerCompatibility` API, so lit items work in the Token HUD without the GM having to open that module's Compatibility window by hand. Only applies when the GM hasn't already configured those settings themselves; requires a Light Sources version that exposes `registerCompatibility` (guarded with optional chaining, so older versions keep working as before).
- [Changed] **Cinematic Mode** (Request Roll) is no longer a manual checkbox — a new **Cinematic Roll Images** settings menu (*Configure Settings → Daggerheart: Quick Actions*) lets the GM assign an image to each of the 9 roll cases (the six traits, Hope, Fear, and the generic Duality Roll fallback) through Foundry's native file picker, with an instant-save Browse/Clear button per row. A roll request now goes through the full-screen cinematic prompt automatically, only when the resolved case has an image configured; cases left empty fall back to the existing plain whispered chat message, exactly as before. With nothing configured — the default — the feature is fully inert. The manual "Cinematic Mode" toggle was removed from the Roll Configuration dialog, and "Grant Resources" moved up to sit alongside Advantage/Disadvantage/Reaction as a symmetric, centered 2×2 grid of bordered toggle chips, so it's clear which label belongs to which switch.
- [Removed] Removed the 9 bundled AI-generated cinematic prompt images (`assets/requestroll/agility.webp`, `strength.webp`, `finesse.webp`, `instinct.webp`, `presence.webp`, `knowledge.webp`, `hope.webp`, `fear.webp`, `none.webp`). The module ships with none configured — the GM supplies their own through the new Cinematic Roll Images settings menu above.
- [Removed] **Breaking**: `QuickActions.RequestRoll(false)` no longer suppresses cinematic images — the argument is ignored. Cinematic Mode is fully automatic now, driven entirely by what the GM has configured, so there is nothing left for the call to override.
- [Removed] Removed the bundled AI-generated chat card background image (`assets/chat-messages/skull.webp`), previously shown (behind a dark overlay) on every module chat card — Roll Request, Short/Long Rest, Loot, Scan, Barter, Help an Ally, Scar Check, Hope Spent, Whisper, Chain Lightning, Unleash Chaos, and more. Every card now uses a plain dark background instead: the shared `buildChatCard` helper (`scripts/helpers.js`) and the two Features cards that built their own markup by hand (`Unleash Chaos`, `Chain Lightning` in `scripts/features.js`) were all updated to drop the background image and its darkening overlay layer. The per-call `overlayOpacity` option, which only ever controlled how much of that image showed through, was removed along with it.

# 0.6.3

- [Fixed] Party Sheet: the Downtime button added in 0.4.3 never appeared, and the Short Rest / Long Rest buttons it was meant to replace were never removed — the hook was registered as `renderParty`, but the Daggerheart system's Party sheet class is `PartySheet`, so Foundry fires `renderPartySheet` instead and the handler never ran. Corrected the hook name.

# 0.6.2

- [Removed] Removed unused audio files (`assets/sfx-critical`) and their credits from `README.md`.

# 0.6.1

- [Added] **Token Hope Bar**: a row of Hope diamonds drawn just above every `character` token on the canvas — filled for the Hope currently held, empty for the rest. It follows each token's own **Display Bars** setting, so *Always for Everyone*, *When Hovered*, *When Controlled* and the owner-only modes apply to it exactly as they do to the native Hit Points and Stress bars, including the Alt-key reveal that forces every overlay visible at once.
- [Added] Token Hope Bar: **Scars are shown rather than hidden**. A Scar lowers maximum Hope, and a bar that simply got shorter would make that invisible — so the row keeps its six-slot baseline and fades out the slots the Scar locked off. Healing the Scar brings them back. Because the maximum is read from `actor.system` after Active Effects are applied, anything the system does to Hope — Scars, effects, items — is reflected without the module knowing about any of it, and a maximum raised past 6 simply extends the row instead of shrinking every diamond.
- [Added] Token Hope Bar: **Token Hope Bar** setting (GM, on by default) in *Configure Settings → Module Settings*. Turning it off leaves the canvas untouched, for worlds that already render Hope through a token bar module such as Bar Brawl. The change applies immediately on every client, with no reload.
- The whole row is generated in code from a single pair of diamond images, so it costs two textures no matter how many slots or tokens are on screen. The container is parented to the token itself rather than to its bar container — bar replacement modules clear that container on every redraw, which would have made the Hope bar flicker in and out — and being a child of the token means canvas zoom, panning and token visibility are inherited for free, the same way the native bars behave.

# 0.6.0

- [Changed] Barter: the item grids now fit exactly six tiles per row with no dead strip at the right edge. They were built as wrapped rows of fixed 58px tiles, so whatever width was left over after the last tile that fit became empty space — and how much of it there was depended on how the window had been resized. The grids are now a six-column layout in which the tiles divide the panel's width between themselves, staying square and ending flush with the border at any window size.
- [Added] Barter: a faint lattice of empty slots behind the inventory, carrying the grid across the rest of the box instead of stopping at the last item. How many rows fit can only be measured — the cell size follows the column count, which follows the live width of the scroll box — so the window re-measures on every render, on each tab switch, and while it is being resized. Tabs with nothing in them keep their "No … available" message rather than showing a bare lattice.
- [Fixed] Barter: adding or removing items on your character sheet while the Barter window was open changed nothing in it, and re-triggering the window only brought the stale copy back to the front — the only way to see the new inventory was to close it and open it again. Both panels now follow live document data: item and currency changes on either actor are picked up as they happen, and re-triggering the window also refreshes it. Anything on the table that the new data no longer supports is trimmed — an item that was deleted or given away, a stack that shrank below the offered amount, coin beyond what the purse still holds — and in a player trade that trim clears both confirmations and is pushed to the partner, since an offer neither side agreed to cannot stay approved.
- [Added] Barter: **right-click a tile to open the item's sheet**, for your own items, for the party stash's, and for what a trade partner has put on the table. Foundry will not render the sheet of a document the user cannot see, so a tile belonging to an actor you hold no permission on says so instead of silently doing nothing — the Gamemaster has to grant at least Limited ownership for it to open.
- [Added] Barter: compatibility with the **Daggerheart: Unidentified Items** module. A mystified item was shown in the trade window under its real name and artwork, because that module deliberately leaves the real values on the document and masks them wherever they are displayed — and Barter was reading them directly. Every place Barter shows an item now goes through that module's display API, so players see the masked alias, icon and tooltip while Gamemasters still see the real thing, exactly as on sheets and inventory rows. That covers three routes the identity could have escaped by: the inventory grids on both panels, the trade packet itself — offers carry a name and image so the partner can draw a tile without touching a document they may have no permission on, and those are now masked for the recipient before leaving the client, in the opening invite as well as in every later update — and the public chat receipt of a completed trade, which is always written for the widest possible audience even though a Gamemaster builds it. Masked tiles are marked with a `?` in the corner. Without that module installed nothing changes.
- [Changed] Barter: the scrollbars are gold to match the rest of the window, instead of the red they inherited from the core theme.

# 0.5.9

- [Fixed] Token Tooltip: the adversary tooltip listed only Reactions and Passives — every action feature was silently dropped. The grouping loop matched `system.featureForm` against `"reaction"` and `"passive"` and discarded everything else, so an adversary's actions never appeared at all. All three groups are now listed, in the order **Actions / Reactions / Passives**, and any feature whose `featureForm` is missing or unrecognised falls into Actions rather than vanishing. The loop also skips items that are not of type `feature`, so nothing unrelated leaks into the lists.
- [Fixed] Token Tooltip: adversary feature names were cut off at 15 characters with an ellipsis (`Armor-Shredding…`), which made features with a shared prefix indistinguishable. Feature names are now shown in full. The actor name in the tooltip header is still shortened as before.
- [Changed] Token Tooltip: widened to fit the larger feature lists. The maximum width rose for every size option — Small 240→330px, Normal 290→400px, Large 350→480px, Extra Large 420→560px, Huge 500→660px. The minimum widths are unchanged, so a tooltip with few features stays as compact as it was. Feature lists now wrap onto additional lines instead of pushing the tooltip past that maximum.

# 0.5.8

- [Fixed] Loot & Consumables: clicking the rolled item in the chat card opened the **Table Result** sheet instead of the item, and the link could not be dragged onto a character sheet. The card was built from `TableResult#uuid`, which identifies the table entry itself — not the document it points at. The referenced item now comes from `TableResult#documentUuid`, so the link opens the real item sheet and drops onto a sheet like any other item link. The same corrected UUID is used when the item is auto-added to the roller's linked actor, and results that are plain text rather than a document reference still fall back to their name as before. This reverses the change made in 0.4.2, which had moved the lookup to `#uuid` on the wrong assumption that it resolved to the referenced document.

# 0.5.7

- [Added] Barter: **party stash trading**. The "Trade With" list now carries a **Party** group above the players, listing every party sheet that names your character as a member *and* that you hold Owner permission on — without ownership the option is not offered at all, since the transfer could not be written. Picking one turns the right-hand column into a second editable inventory: the left column is what you give the party, the right is what you take from it, with the same tabs, quantity steppers and currency fields on both sides. There is no invite, no confirmation step and no GM involved — you already own both actors, so your own client settles it the moment you press **Complete Transfer**. It still runs through the same validation against live actor data and the same single `foundry.documents.modifyBatch` call as a player trade, so it applies in full or not at all, and it posts the same chat receipt.
- [Changed] Barter: entries in the trade partner list now read as `Character - Username` on a single line instead of stacking the two names, with the username kept in that user's own color. Party entries use the same shape, tagged *Party Stash* in place of a username.
- [Changed] Barter: the currency row was rebuilt as a two-column grid — two currencies per line, with label, input and "/ owned" total aligned in columns. Disabled currencies simply leave fewer cells filled.
- [Fixed] Barter: the portrait in the trade partner list overflowed its row and overlapped the entry's border. Both core and the system size bare `img` elements, so the thumbnail is now pinned on every axis and the row clips its own contents.
- [Fixed] Barter: the currency inputs were far taller than the labels beside them, because they inherited Foundry's default input sizing. Their height is now pinned to the label's line height, so the whole row reads as one line.
- [Changed] The **Quick Actions** button in the character sheet header now carries a gold border matching its label, so it reads as a button rather than loose text next to the window controls. Hovering brightens the border and adds a soft gold glow.
- [Fixed] Barter: **Approve Trade** / **Start Trade** and **Cancel** rendered at visibly different heights — Cancel had a 1px border and an inherited font size against the others' 2px border and explicit size. All three footer buttons now share one box model.

# 0.5.6

- [Added] **Interface Settings** window (GM only), reachable from *Configure Settings → Module Settings*. It collects the world-wide interface changes this module makes in one place instead of leaving them scattered through the settings list.
- [Added] Interface Settings: **Daggerheart Menu Enhancements** — a single switch that turns off *all* of this module's changes to the system's sidebar menu at once: the purple skull tab icon, the search bar, the alphabetical section ordering, the collapsible sections and the two-column button grid. With it off the menu looks exactly as the system built it. The module's own **Quick Actions** section stays in the menu either way — only its layout falls back to the system default. The change applies on the spot, on every client, with no reload.
- [Changed] **Biography Tab Visibility** (GM) moved out of the settings list into the new Interface Settings window. Its behaviour and stored value are unchanged. The per-user **Hide Biography Tab** switch stays in the settings list, where every player can reach it.

# 0.5.5

- [Added] Downtime UI: **Users** tab in the config window, listing every non-GM user with a switch that decides whether they take part in downtime. A user switched off is hidden from the Downtime window even while connected, and is skipped when the downtime effects are applied — for table members who should never join a rest (spectators, a second screen, a shared account). Each row shows the user's assigned character, and offline users are dimmed, so it is clear who is being switched off. The change takes effect as soon as the config is saved: a player who was just disabled has their Downtime window closed, and everyone else's re-renders.
- [Changed] Downtime UI: the GM toolbar's **Moves** button is now **Config**, with a gear icon instead of the plus sign — the window it opens is titled **Downtime Config** and holds the Core, Craft, Custom, Item Moves and Users tabs, not just moves.
- [Changed] Downtime UI: the consecutive short rest pips are now clickable by the GM. Clicking a pip sets the counter to that position, and clicking the last filled pip lowers it by one, so the count can be corrected by hand when a rest happens outside the module or the automatic count drifts. It stays GM-only — the strip is never rendered for players, and the counter is a world setting they cannot write.
- [Changed] Downtime UI: in the config window's Craft, Custom and Item Moves tabs, the `+` button that adds a row now sits above its list instead of below it, so it stays in the same place no matter how many rows the list has. New rows are still appended to the end of the list.
- [Removed] Downtime UI: the small colored dot drawn before each player's name in the row header.
- [Fixed] Foundry's orange focus/selected ring no longer appears on the Downtime window or its config window either — the 0.5.4 fix covered the module's other windows, but these two were still showing the ring stuck to the selected Short/Long and config tab buttons. As before, buttons everywhere else in Foundry are untouched and the module's own gold styling is preserved.

# 0.5.4

- [Added] Request Roll: the "Send To" list now shows each connected player's linked character name alongside their username, formatted as `Character - Username`, when that player has an actor assigned. Both name parts are truncated with an ellipsis past a fixed default length so long names don't overflow the column; hover a name to see the untruncated version. The Send To column and window were widened to fit the extra text.
- [Changed] Request Roll: Advantage, Disadvantage, Reaction, Grant Resources and Cinematic Mode are now sliding toggle switches in the module's gold accent instead of plain checkboxes. The switch skin lives in `styles/app-base.css` as an opt-in `.dh-toggle` class, so it can be reused by other windows without changing checkboxes elsewhere.
- [Changed] Request Roll: Advantage and Disadvantage are now mutually exclusive — turning one on automatically turns the other off, since the two cancel each other out.
- [Fixed] Foundry's orange focus/selected ring no longer appears on the module's buttons. Core draws it globally on `button:focus` and `button.active`, and since `.active` is what this module uses for its own selected state, the ring stuck permanently to selected trait and target buttons. It is now switched off inside the module's windows only — buttons everywhere else in Foundry are untouched — and the module's own coloured glows (gold trait, Hope, Fear, Loot) are preserved.
- [Removed] Request Roll: the **Cancel** button — the window's own close (X) already does the job, so it was only taking up space.
- [Added] Request Roll: a bulb button next to the **Label** field opens a panel of 33 ready-made labels grouped by trait — Agility (Sprint / Maneuver, Leap, Dodge / Evade, Acrobatics / Balance, Scale, Catch), Strength (Lift / Push / Pull, Smash / Break / Wreck, Grapple, Endure, Intimidate), Finesse (Control / Manipulate, Hide / Sneak / Prowl, Tinker / Disable / Pick Lock, Pickpocket / Sleight of Hand, Aim), Instinct (Perceive / Sense, Navigate, Track, Forage / Survive, Anticipate / React, Handle Animal), Presence (Charm / Persuade / Convince, Perform, Deceive, Intimidate, Command / Inspire, Distract) and Knowledge (Recall, Analyse / Investigate, Comprehend / Decipher, Strategize, Treat / Medic). Each one carries a tooltip describing the kind of action it covers. Clicking a label fills the Label field and pre-selects its trait in one step — the trait is only a suggestion and stays freely changeable, so you can pair any label with any trait, or with a Hope / Fear / Loot roll.

# 0.5.3

- [Added] **Barter**: player-to-player trading between two users who each have a linked `character` actor. The window shows your own inventory on the left as an icon grid split into Weapons / Armor / Consumables / Loot tabs — clicking an icon puts it on the table with a green border, and stacked items get a quantity stepper. Coins can be offered alongside items, honoring whichever currencies the world has enabled. Pick a connected player, press **Start Trade**, and the same window opens on their screen showing your offer; they can add items and coins of their own or accept as-is. Editing an offer revokes both confirmations, so an agreed trade can never be swapped out from under either side.
- [Added] Barter settlement runs on a connected GM client through a registered User query, and writes every item create/update/delete and both purses in a single `foundry.documents.modifyBatch` call — the trade either applies in full or not at all. The GM re-validates the whole session against live actor data first, so nothing arriving over the socket is trusted. Completed trades are posted to chat as a receipt.
- [Added] API: `QuickActions.Barter()` opens the Barter window from a macro or script.
- [Added] Quick Actions Macros: the **Barter** macro now ships on the suggested default list, so it shows up on the character sheet palette in new worlds and after **Reset to Default**.

# 0.5.2

- [Added] **Whisper**: new window listing every connected user as a toggle button (GMs flagged with a crown, each name in the user's own color). Pick any number of recipients, type a message, and it goes out as a whispered chat card in the module's visual style, visible only to them. The message is plain text — everything typed is escaped, so pasted markup is delivered literally instead of rendered, and only line breaks are carried over. Ctrl+Enter sends.
- [Added] API: `QuickActions.Whisper()` opens the Whisper window from a macro or script.
- [Added] Quick Actions Macros: the **Whisper** macro now ships on the suggested default list, so it shows up on the character sheet palette in new worlds and after **Reset to Default**.

# 0.5.1

- [Added] GM Menu (sidebar "GM Tools" tab): search/filter bar, deterministic section ordering (the system's own "Refresh Features" always first, everything else alphabetical), and collapsible sections with state remembered per user — makes the shared menu usable even with many modules contributing their own sections.
- [Changed] GM Menu: "Quick Actions" section is now a compact 2x2 button grid instead of 4 stacked full-width buttons (Downtime, Falling Damage, Request Roll, Level Up).

# 0.5.0

- [Added] **Light Sources** integration: on `ready`, the module registers all 14 light-bearing items from its Items compendium (Candle, Torch, Alistair's Torch, Hooded Lantern, Bullseye Lantern, Storm Lantern, Oil Lamp, Candelabra, Miner's Helmet, Tactical Flashlight, Smartphone, Matches, Glowstick, Emergency Flare) with the optional **Light Sources** module's API, so they light up automatically from the Token HUD with no manual configuration. No-op if Light Sources isn't installed.

# 0.4.9

- [Added] Character Sheet: **Quick Actions** button in the window header of every character sheet, right next to the controls (three dots) button. It opens the same macro palette as `QuickActions.ShowMacros()`, but over a list the GM curates — so players get one-click access to the macros the table actually uses.
- [Added] **Quick Actions Macros** settings menu (GM only) — drag macros in from the Macro directory or from any compendium, remove them one by one, **Preview** the resulting palette, **Reset to Default** to restore the module's four built-in macros, **Clear All** to empty the list, and a button to turn the whole feature off (the header button then disappears from open character sheets immediately, on every client).
- [Added] API: `QuickActions.QuickActionsMenu()` opens the curated macro palette from a macro or script.

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