# Blood & Bridle — The Sheridan Lift

A 4-phase plan to lift the game from McCarthy-with-Sheridan-frame to full Sheridan-pixel-art. Companion to the conversation of 2026-06-18.

---

## Goal

Four phases, in order. Each one is a complete system — new files, modified files, tests, audio, visuals, examples. Phases compound: the kitchen table gives the player a place, the rivals give the world people, the heir gives the future a face, the brand gives the past a symbol.

| Phase | What it gives the game | Visual assets (PixelLab) | What it replaces |
|---|---|---|---|
| **11 — Bunkhouse** | A *place* for the moral economy | 15 hand portraits + 6 scenes | Buttons on a modal |
| **12 — Rivals** | *People* in the world | 12 rival portraits + 9 scenes + 4 banners | Bidders in a list |
| **13 — Heir** | A *face* for the future | 12 heir portraits + 3 scenes | A number in the dynasty |
| **14 — Brand** | A *symbol* for the past | 10 brand surfaces + 3 scenes | A glyph on the title card |

---

## Visual identity decision (2026-06-18)

After auditing the auth state and image generation backends, the recommendation is:

**Default: pixel art for the bulk. High-quality for 4 hero moments.**

### Why hybrid

1. **Budget** — $0 floor is hard. PixelLab is free (~80/2000 calls remaining). gpt-image-2 via OpenAI Codex is ~$0.04/image. Hero shots only: 4 × $0.04 = **~$0.20 total**.
2. **Consistency** — 90 horse portraits are pixel art. Switching everything to high-quality means regenerating 90 horses (~144 calls, ~$5.76) or accepting mixed styles.
3. **Genre fit** — Kentucky Route Zero is the strongest reference: a slow, melancholic, neo-noir adventure with pixel art that handles grief, debt, and the dying American dream. The pixel art *amplifies* the silence.
4. **Player experience** — Pixel-art-with-Sheridan-writing is uncommon and memorable. High-quality-with-Sheridan-writing is expected.
5. **Bias toward done** — Pixel art is generated, integrated, shipped. High-quality adds review loops.

### Hero shots (high-quality via gpt-image-2)

1. **Title card** — the gate, the brand, the 4-line intro. First impression.
2. **Brand-loss scene** — iron cold, gate open, developer at the road. The ending.
3. **Branding scene** — iron in fire, heifer in chute, smoke. Visceral.
4. **Funeral scene** — church, fresh grave, snow, wind. Somber.

### Pixel art for the rest

Horses (90 done), hand portraits (15), rival portraits (12), heir portraits (12), brand surfaces (10), scene compositions (12). All via PixelLab MCP. ~80/2000 calls remaining, 74 needed for Phase 11-14. **Within free tier. No spend.**

---

## Auth state (verified 2026-06-18)

| Backend | State | Capability |
|---|---|---|
| **FAL** | ✓ key set, **account locked** ("User is locked. Reason: Exhausted balance") | None until top-up |
| **OpenAI Codex** | ✗ `refresh_token_reused` | **Needs re-auth** — `codex` in terminal, then `hermes auth` |
| **Nous Portal** | ✓ logged in, refresh available | Text inference only (no image gen) |
| **PixelLab** | ✓ working | Free tier, ~80/2000 calls remaining |

**Working path:** PixelLab (free) for bulk + re-auth Codex (gpt-image-2) for hero shots.

**Re-auth Codex:**
```bash
codex  # in terminal, generates fresh tokens
hermes auth  # re-authenticates with the new tokens
```

---

## Phase 11 — The Bunkhouse as a Real Room

The moral economy stops being a button and becomes a scene. The hands have faces.

### What it is

A new modal that's not a UI, it's a *room*. The kitchen table. The radio in the corner. The coffee on the stove. Two or three hands sitting down. The hands have **portraits** — pixel-art, 64×96, side view, three moods each. The hands have voices. The hands have a *look*. When Mae speaks, you see Mae's face. When Eli disagrees, you see Eli disagree. The room has a **scene composition** — pixel-art, 256×192, the bunkhouse interior with the table, the chairs, the radio, the window. The scene changes with the season.

### PixelLab assets (Phase 11)

**Hand portraits (`assets/people/hands/`)**
- `mae_neutral.png` `mae_concerned.png` `mae_arguing.png`
- `eli_neutral.png` `eli_concerned.png` `eli_arguing.png`
- `reyes_neutral.png` `reyes_concerned.png` `reyes_arguing.png`
- `elena_neutral.png` `elena_concerned.png` `elena_arguing.png`
- `voss_neutral.png` `voss_concerned.png` `voss_arguing.png`

**Scene compositions (`assets/scenes/bunkhouse/`)**
- `bunkhouse_winter.png` `bunkhouse_summer.png` `bunkhouse_spring.png` `bunkhouse_fall.png`
- `kitchen_table_winter.png` `kitchen_table_summer.png`

### Systems

- 12 kitchen table scenes tied to critical decisions
- Hand voices (Mae/Eli/Reyes/Elena/Voss)
- Hand morale gates speech (>30 to speak, >80 to advocate)
- Scene effects on morale, corners, log

### New UI surface (the kitchen table scene modal)

```
+--------------------------------------------------+
|  [bunkhouse_winter.png — 256x192 background]    |
|                                                  |
|     [mae_neutral.png]    "I've seen this         |
|                           before, didn't end    |
|                           well."                 |
|                                                  |
|     [player_choice_1]                            |
|     [player_choice_2]                            |
|     [player_choice_3]                            |
+--------------------------------------------------+
```

### What changes in code

**New files:**
- `src/scenes.js` — kitchen table scene library (~400 lines)
- `src/hands-voice.js` — hand voice objects (~150 lines)
- `scripts/people-generator.mjs` — hand portraits generator
- `scripts/scenes-generator.mjs` — bunkhouse scene generator
- `tests/scenes.test.mjs` — scene library, scene triggers, scene outcomes
- `tests/hands-voice.test.mjs` — voice schema, common phrases, stance on topics
- `tests/people-portraits.test.mjs` — hand portrait assets load

**Modified files:**
- `src/app.js` — kitchen table scene modal with portrait + scene background
- `src/labor.js` — add `voice` field, add `portrait` field (path to portrait)
- `src/moral.js` — moral choices now trigger scenes
- `src/audio.js` — 5 new stingers (chairScrape, coffeePour, doorClose, radioHum, windDistant)
- `src/styles.css` — kitchen table scene modal styles, portrait positioning

### Tests
- ~50 new tests

---

## Phase 12 — The Rivals as People You See

Cobb, William, Edith, Henry stop being bidders and start being family you encounter. They have faces. They are at the brandings, the show, the auction, the funeral.

### PixelLab assets (Phase 12)

**Rival portraits (`assets/people/rivals/`)**
- `cobb_neutral.png` `cobb_concerned.png` `cobb_arguing.png`
- `william_neutral.png` `william_concerned.png` `william_arguing.png`
- `edith_neutral.png` `edith_concerned.png` `edith_arguing.png`
- `henry_neutral.png` `henry_concerned.png` `henry_arguing.png`

**Scene compositions (`assets/scenes/rivals/`)**
- `brandings_summer.png` `brandings_fall.png`
- `show_spring.png` `show_summer.png` `show_fall.png`
- `auction_spring.png` `auction_fall.png`
- `funeral_winter.png` `funeral_summer.png`

**Rival banner sprites (`assets/brand/banners/`)**
- `banner_cobb.png` `banner_william.png` `banner_edith.png` `banner_ash_coulee.png`

### Systems

- Rival state and rival arcs
- 3-5 lines of dialogue per rival
- Show circuit (3 shows per year)
- Brandings (annual event)
- Rival-specific events
- Rivals at the funeral

### What changes in code

**New files:**
- `src/rivals.js` — rival state, rival arcs, rival dialogue (~500 lines)
- `src/show-circuit.js` — show circuit system (~300 lines)
- `tests/rivals.test.mjs` — rival state, rival arcs, rival dialogue
- `tests/show-circuit.test.mjs` — show circuit, show results

**Modified files:**
- `src/auction.js` — add William as bidder, Edith as seller
- `src/community.js` — rival-specific events
- `src/events.js` — rival-specific events
- `src/slow-time.js` — rival mention lines
- `src/endings.js` — rivals at endings
- `src/app.js` — brandings modal, show circuit modal, funeral modal
- `src/audio.js` — show circuit stingers (announcer, crowd, ribbon-award bell, brandings iron)
- `src/styles.css` — brandings scene, show circuit banner, rival names in UI

### Tests
- ~55 new tests

---

## Phase 13 — The Heir as a Kid Who Came Back

The dynasty mechanic becomes a relationship. Not a save file, a *person with a face*.

### PixelLab assets (Phase 13)

**Heir portraits (`assets/people/heirs/`)**
- `daughter_neutral.png` `daughter_concerned.png` `daughter_arguing.png`
- `son_neutral.png` `son_concerned.png` `son_arguing.png`
- `niece_neutral.png` `niece_concerned.png` `niece_arguing.png`
- `nephew_neutral.png` `nephew_concerned.png` `nephew_arguing.png`

**Scene compositions (`assets/scenes/heir/`)**
- `heir_arrival.png` `heir_departure.png` `heir_kitchen_table.png`

### Systems

- 4 possible heirs (daughter, son, niece, nephew)
- Heir schema (relationship, morale, stance)
- Heir arc (3-5 seasons)
- Heir choice (take over, refuse, compromise)
- Heir at kitchen table (uses bunkhouse scene background)

### What changes in code

**New files:**
- `src/heir-character.js` — heir schema, heir arcs, heir dialogue (~400 lines)
- `tests/heir-character.test.mjs` — heir character, heir arc, heir choice, heir dialogue

**Modified files:**
- `src/dynasty.js` — heir choice mechanic (relational, not numeric)
- `src/scenes.js` — heir at kitchen table, heir arrival scene, heir departure scene
- `src/slow-time.js` — heir mention lines
- `src/endings.js` — heir-driven ending variants
- `src/app.js` — heir arrival modal, heir choice modal
- `src/audio.js` — 3 new stingers (truckArrival, gateOpen, truckDeparture)
- `src/styles.css` — heir arrival scene, heir at kitchen table

### Tests
- ~45 new tests

---

## Phase 14 — The Brand as a Thing That Gets Defended

The brand stops being a glyph and starts being a presence. On the trucks, the hay barn, the home fence, the heifer's hip, the daughter's jacket.

### PixelLab assets (Phase 14)

**Brand surface sprites (`assets/brand/surfaces/`)**
- `gate_brand.png` `gate_brand_night.png`
- `truck_brand.png` `truck_brand_moving.png`
- `hay_barn_brand.png` `hay_barn_brand_evening.png`
- `heifer_brand.png` `heifer_brand_done.png`
- `jacket_brand.png` `salve_brand.png`

**Brand scene compositions (`assets/scenes/brand/`)**
- `branding_scene.png` `gate_scene.png` `brand_loss.png`

**High-quality hero shots (gpt-image-2)**
- `hero_title_card.png` (1024x576)
- `hero_brand_loss.png` (1024x576)
- `hero_branding.png` (1024x576)
- `hero_funeral.png` (1024x576)

### Systems

- 8 brand surfaces in the world
- Brand presence (0-100) with effects on horsemen + country
- Brand scenes (branding, burning, gate, loss)
- Brand as inheritance
- Brand as UI

### What changes in code

**New files:**
- `src/brand-presence.js` — brand surfaces, brand inventory, brand-loss scenes (~400 lines)
- `tests/brand-presence.test.mjs` — brand surfaces, brand presence, brand loss, brand inheritance

**Modified files:**
- `src/brand.js` — add `presence` field, brand surfaces
- `src/app.js` — brand on the dashboard, brand on the trucks, brand on the gate (title card)
- `src/endings.js` — brand-loss scene, brand inheritance scene
- `src/dynasty.js` — brand inheritance mechanic
- `src/scenes.js` — brand scenes
- `src/audio.js` — 4 new stingers (ironInFire, hammerStrike, calfBawl, propaneTorch)
- `src/styles.css` — brand presence throughout the UI, brand on trucks, brand on hay barn, brand on gate

### Tests
- ~40 new tests

---

## Asset summary

| Category | Count | Backend | Cost |
|---|---|---|---|
| Horse portraits (existing) | 90 | PixelLab | $0 (done) |
| Hand portraits | 15 | PixelLab | $0 |
| Rival portraits | 12 | PixelLab | $0 |
| Heir portraits | 12 | PixelLab | $0 |
| Brand surface sprites | 10 | PixelLab | $0 |
| Scene compositions | 12 | PixelLab | $0 |
| Rival banner sprites | 4 | PixelLab | $0 |
| **PixelLab total** | **155 images** | | **$0** (uses ~75/2000 calls, well within free tier) |
| Hero shots | 4 | gpt-image-2 (Codex) | ~$0.20 |
| **Grand total** | **159 images** | | **~$0.20** |

**Test count after all four phases:** 715 (current) + 190 (new) = **~905 passing**

---

## Build order

1. Phase 11 — Bunkhouse (PixelLab: 15 hands + 6 scenes; tests ~50)
2. Phase 12 — Rivals (PixelLab: 12 rivals + 9 scenes + 4 banners; tests ~55)
3. Phase 13 — Heir (PixelLab: 12 heirs + 3 scenes; tests ~45)
4. Phase 14 — Brand (PixelLab: 10 surfaces + 3 scenes; gpt-image-2: 4 hero shots; tests ~40)

Each phase compiles, tests, generates assets, and commits independently. Asset generation runs in the background while code is being written.

---

## Decision points (for Anduril)

1. **Visual identity: hybrid (pixel art + 4 hero shots) recommended. Approve?**
2. **Re-auth Codex for gpt-image-2 hero shots? ($0.20 spend, requires re-auth via `codex` + `hermes auth`)**
3. **Build order: 11 → 12 → 13 → 14. Approve?**

---

*Plan stored: 2026-06-18, this conversation. Updated as the build progresses.*
