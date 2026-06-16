# Blood & Bridle V2 — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to execute this plan phase by phase. Each phase ends with a vertical slice that is playable, testable, and demoable.

## Goal

Turn the 30-day prototype into a **multi-year, multi-generation horse ranch legacy simulator** where time, breeding, and relationship memory are the spine.

## Design Thesis

> The game gets good when time starts to matter — when the horse you bred last spring wins a class three years later, or doesn't, and the ranch has a memory of both.

## Architecture

- **Pure simulation core** in `src/` with no DOM dependency, fully unit-tested
- **Event-sourced state**: actions produce new game state, never mutate
- **NPC memory** as a first-class data structure (`npcMemory: { npcId: { trust, history, owed } }`)
- **Seasonal tick** is the new daily tick. A "day" still exists inside a season.
- **Authored event library** with state-driven gating (not procedural)
- **View models** in `src/ui.js` stay thin; the engine owns all rules

## Tech Stack

- Vanilla ES modules (no build step)
- Node `node:test` for the simulation
- Static `python3 -m http.server` for browser play
- No frameworks. No bundler. The MVP proves this works.

---

## Phase Ladder

| Phase | Slice | Why this order | Tests added | Playable demo |
|-------|-------|---------------|-------------|---------------|
| **1** | Horse life stages + aging + death | Attachment requires loss | 6–8 | Watch a horse grow up and retire |
| **2** | Breeding + foal genetics | Turns inventory into family | 8–10 | Two horses mate, foal inherits traits |
| **3** | Multi-year seasonal calendar | Time as antagonist | 5–7 | Play through one full year |
| **4** | NPC memory + scripted event chains | Yellowstone drama | 8–10 | Refuse a developer, see consequences two seasons later |
| **5** | Lineage tree view | Visible payoff of breeding | 4–5 | Click a horse, see its parents/offspring |
| **6** | Auction / buyer system | Real marketplace | 6–8 | Sell a horse to a personality-driven bidder |
| **7** | Rival ranches + regional pressure | Politics as antagonist | 5–7 | A rival outbids you at auction |
| **8** | Weather + disasters | Nature as antagonist | 5–7 | Drought forces pasture decisions |
| **9** | Land map with parcel adjacency | Geography as gameplay | 4–6 | Buy a new parcel, change access |
| **10** | Endings + scoring rubric | A way for the game to end | 4–5 | Reach day 365, see the verdict |

Target: **~60 tests, 10 phases, ~8 focused work sessions.**

---

## Phase 1 — Horse Life Stages + Aging + Death

**Slice:** Horses are born young, mature into campaigners, retire, and die. Time is no longer paused.

**Why first:** Every other feature assumes horses can age. Breeding, training outcomes, NPC dialogue, endings — all of it depends on a horse having a life arc. Without this, the rest is decoration.

**Files:**
- Modify: `src/game.js` (add age/tick advancement, retirement, death)
- Modify: `tests/game.test.mjs` (add life-stage tests)
- Modify: `src/ui.js` (add life-stage badge to horse cards)
- Modify: `src/styles.css` (badge styling)
- Create: `src/horse.js` (extract horse data model)

**Step 1: Define life stages**

```js
// src/horse.js
export const LIFE_STAGES = {
  FOAL: { min: 0, max: 0, label: 'Foal', trainable: false, can_compete: false },
  WEANLING: { min: 1, max: 1, label: 'Weanling', trainable: false, can_compete: false },
  YEARLING: { min: 2, max: 2, label: 'Yearling', trainable: 'light', can_compete: false },
  TWO_YEAR_OLD: { min: 3, max: 3, label: '2-year-old', trainable: 'light', can_compete: 'futurity' },
  CAMPAIGNER: { min: 4, max: 12, label: 'Campaigner', trainable: true, can_compete: true },
  RETIREE: { min: 13, max: 18, label: 'Retiree', trainable: false, can_compete: false },
};

export function getLifeStage(horse) {
  for (const stage of Object.values(LIFE_STAGES)) {
    if (horse.age >= stage.min && horse.age <= stage.max) return stage;
  }
  return null; // dead
}
```

**Step 2: Write failing tests**

```js
test('horse ages one year per 12 in-game days', () => {
  let game = createNewGame();
  for (let i = 0; i < 12; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(game.horses[0].age, 7);
  assert.equal(getLifeStage(game.horses[0]).label, 'Campaigner');
});

test('training a foal is blocked', () => {
  const foal = { ...createNewGame().horses[0], age: 0 };
  const game = { ...createNewGame(), horses: [foal] };
  assert.throws(() => applyAction(game, { type: 'train', horseId: foal.id, staffId: 'mae' }));
});

test('a campaigner past age 12 retires automatically at year tick', () => {
  let game = { ...createNewGame(), horses: [{ ...createNewGame().horses[0], age: 12 }] };
  game = applyAction(game, { type: 'rotatePasture' }); // advance 12 days → next year
  for (let i = 0; i < 11; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(getLifeStage(game.horses[0]).label, 'Retiree');
});

test('a horse past 18 dies and is removed with a logged event', () => {
  const old = { ...createNewGame().horses[0], id: 'old-horse', name: 'Old Timer', age: 18 };
  let game = { ...createNewGame(), horses: [old] };
  for (let i = 0; i < 12; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(game.horses.find(h => h.id === 'old-horse'), undefined);
  assert.match(game.log[0], /Old Timer/);
  assert.match(game.log[0], /died/);
});
```

**Step 3: Year tick in `applyAction`**

Modify `dailyUpkeep` to count days; every 12 days, increment each horse's `age` by 1 and check for retirement/death.

**Step 4: Block training by life stage**

```js
case 'train': {
  const stage = getLifeStage(horse);
  if (!stage.trainable) throw new Error(`${horse.name} is too young to train (${stage.label}).`);
  // ... existing logic
}
```

**Step 5: Update UI**

Horse card gets a small badge:

```html
<span class="life-stage life-stage--campaigner">Campaigner · age 6</span>
```

**Verification:**
- `npm test` → 19+ passing
- Browser: train a horse, advance 12 days, see it tick from age 6 to 7
- Browser: try to train a foal → see error message in log

**Demo:** Start a game. Watch Blue Ash age from 6 to 7 over 12 in-game days. Read the death event for an elderly horse.

---

## Phase 2 — Breeding + Foal Genetics

**Slice:** Two compatible horses can be bred. A foal is born, inherits traits, ages, and joins the roster.

**Why second:** This is the spine of the legacy promise. Once a foal can be born from your best mare and your chosen stallion, the game becomes *generative* — you can lose and still have built something that lives in the next generation.

**Files:**
- Create: `src/breeding.js` (genetics, foaling, trait inheritance)
- Modify: `src/game.js` (add `breed`, `foal` actions)
- Modify: `src/horse.js` (add `parents`, `inheritedTraits` fields)
- Modify: `tests/game.test.mjs` (breeding tests)
- Create: `tests/breeding.test.mjs` (genetic inheritance tests)

**Step 1: Define inheritable traits**

```js
export const INHERITABLE_TRAITS = {
  gait_quality: { range: [0, 100], weight: 0.5 },
  temperament_stability: { range: [0, 100], weight: 0.3 },
  bone_density: { range: [0, 100], weight: 0.4 },
  heart: { range: [0, 100], weight: 0.2 }, // grit, will to compete
  conformation: { range: [0, 100], weight: 0.6 },
};
```

**Step 2: Foal trait inheritance**

```js
export function inheritTraits(sire, dam) {
  const foal = {};
  for (const [trait, config] of Object.entries(INHERITABLE_TRAITS)) {
    const [min, max] = config.range;
    const mid = (sire[trait] + dam[trait]) / 2;
    const spread = (max - min) * 0.25; // mutation window
    foal[trait] = Math.round(clamp(mid + (Math.random() * spread * 2 - spread), min, max));
  }
  return foal;
}
```

**Step 3: New actions**

```js
// breed action
case 'breed': {
  const sire = findHorse(game, action.sireId);
  const dam = findHorse(game, action.damId);
  if (sire.id === dam.id) throw new Error('Cannot breed a horse to itself.');
  if (getLifeStage(sire).label !== 'Campaigner' || getLifeStage(dam).label !== 'Campaigner') {
    throw new Error('Both horses must be campaigners to breed.');
  }
  // ... 11-month gestation, foal arrives at age 0
}

// newFoal action (fired by seasonal tick)
case 'newFoal': {
  // adds a new horse with inherited traits, parents recorded
}
```

**Step 4: Tests**

```js
test('foal inherits mid-parent traits with mutation', () => {
  const sire = { gait_quality: 80, temperament_stability: 70 };
  const dam = { gait_quality: 60, temperament_stability: 50 };
  const foal = inheritTraits(sire, dam);
  assert.equal(foal.gait_quality >= 56 && foal.gait_quality <= 84, true);
});

test('breeding requires both horses to be campaigners', () => {
  const foal = { ...createNewGame().horses[0], age: 0 };
  const game = { ...createNewGame(), horses: [createNewGame().horses[0], foal] };
  assert.throws(() => applyAction(game, { type: 'breed', sireId: 'blue-ash', damId: 'juniper-smoke' }));
});

test('foal arrives 11 months after breeding with parents recorded', () => {
  let game = applyAction(createNewGame(), { type: 'breed', sireId: 'blue-ash', damId: 'mercy-road' });
  for (let i = 0; i < 11; i++) {
    for (let j = 0; j < 30; j++) game = applyAction(game, { type: 'rotatePasture' });
  }
  const foal = game.horses.find(h => h.parents?.includes('blue-ash'));
  assert.ok(foal);
  assert.equal(foal.age, 0);
});
```

**Verification:**
- `npm test` → 27+ passing
- Browser: breed Blue Ash × Mercy Road, advance a year, see foal born with parents listed

**Demo:** Two horses mate. A foal is born. The foal's trait numbers are visibly between the parents'. The mare gets a real 11-month gestation clock.

---

## Phase 3 — Multi-Year Seasonal Calendar

**Slice:** Time is structured. Spring brings foals. Summer brings shows. Fall brings weaning and sales. Winter brings breeding decisions and weather stress.

**Why third:** Seasons are the rhythm that organizes all other decisions. Training intensity makes more sense in summer. Vet bills cluster in spring. The game becomes annual, not daily.

**Files:**
- Create: `src/seasons.js` (calendar, season-triggered events)
- Modify: `src/game.js` (track `year`, `season`, `dayOfSeason`)
- Modify: `src/breeding.js` (foaling tied to spring)
- Modify: tests

**Step 1: Calendar model**

```js
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const DAYS_PER_SEASON = 30;

export function getSeason(game) {
  return SEASONS[Math.floor((game.day - 1) / DAYS_PER_SEASON) % 4];
}

export function getYear(game) {
  return Math.floor((game.day - 1) / (DAYS_PER_SEASON * 4)) + 1;
}
```

**Step 2: Seasonal hooks**

```js
// in applyAction
if (getSeason(game) === 'Spring' && pendingFoal) {
  // trigger foaling
}
if (getSeason(game) === 'Summer') {
  // show circuit opens, boarder demand rises
}
if (getSeason(game) === 'Fall') {
  // weaning, yearling sale window
}
if (getSeason(game) === 'Winter') {
  // feed cost rises, hay harvest decision
}
```

**Step 3: Tests**

```js
test('day 1 is spring of year 1', () => {
  assert.equal(getSeason(createNewGame()), 'Spring');
  assert.equal(getYear(createNewGame()), 1);
});

test('day 91 begins winter of year 1', () => {
  let game = createNewGame();
  for (let i = 0; i < 90; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(getSeason(game), 'Winter');
});

test('winter increases daily feed cost', () => {
  let spring = createNewGame();
  let winter = createNewGame();
  for (let i = 0; i < 90; i++) winter = applyAction(winter, { type: 'rotatePasture' });
  assert.ok(winter.cash < spring.cash);
});
```

**Verification:**
- `npm test` → 32+ passing
- Browser: play through a full year, see season labels and seasonal cost shifts

**Demo:** A full year of the ranch. Spring foals arrive. Summer shows pay out. Fall weaning stress. Winter feed costs bite.

---

## Phase 4 — NPC Memory + Scripted Event Chains

**Slice:** Refusing the developer in spring is remembered in fall. Helping a neighbor pays off in winter. NPCs have personality, memory, and consequence pathways.

**Why fourth:** This is what turns the game from a simulation into a story. Without NPC memory, every event is random. With it, the player starts to feel seen.

**Files:**
- Create: `src/npcs.js` (NPC data: developer, neighbors, vet, banker, family)
- Create: `src/events.js` (event library + state-driven gating)
- Modify: `src/game.js` (add `npcMemory`, fire events on tick)
- Modify: tests

**Step 1: NPC model**

```js
export const NPCS = {
  'dev-coleman': {
    name: 'Coleman Reyes',
    role: 'Resort developer',
    memory: { refused: 0, delayed: 0, courted: 0 },
    thresholds: { patience: 100 },
    voice: 'corporate, polite, threatening',
  },
  'ranch-cordell': {
    name: 'Cordell Hask',
    role: 'Neighboring rancher',
    memory: { helped: 0, ignored: 0, fought: 0 },
    voice: 'old country, wary, honest',
  },
  // ...
};
```

**Step 2: Event library**

```js
export const EVENTS = [
  {
    id: 'dev-second-offer',
    title: 'Reyes returns with paperwork',
    gate: (game) => game.npcMemory['dev-coleman']?.refused >= 1 && getSeason(game) === 'Fall',
    body: '"Last offer, neighbor. I do not enjoy doing this the other way."',
    options: [
      { label: 'Sign', effect: { cash: 50000, legacy: -25 } },
      { label: 'Refuse again', effect: { developerPressure: 30 } },
    ],
  },
  // ...
];
```

**Step 3: Fire events at season change**

```js
// in seasonal tick
for (const event of EVENTS) {
  if (event.gate(game) && !game.firedEvents.includes(event.id)) {
    game.pendingEvent = event;
    game.firedEvents.push(event.id);
  }
}
```

**Step 4: Tests**

```js
test('refusing the developer twice raises developerPressure', () => {
  let game = createNewGame();
  game = applyAction(game, { type: 'refuseDeveloper' });
  game = advanceToSeason(game, 'Fall');
  game = applyAction(game, { type: 'refuseDeveloperAgain' });
  assert.ok(game.developerPressure > 60);
});

test('helping a neighbor in spring unlocks a fall trade offer', () => {
  let game = createNewGame();
  game = applyAction(game, { type: 'helpNeighbor' });
  game = advanceToSeason(game, 'Fall');
  assert.ok(game.pendingEvent?.id === 'cordell-trade-offer');
});
```

**Verification:**
- `npm test` → 40+ passing
- Browser: refuse developer, advance to fall, see Coleman return with new offer

**Demo:** Your decisions compound. Refusing in spring is remembered in fall. Helping a neighbor unlocks a breeding trade.

---

## Phase 5 — Lineage Tree View

**Slice:** Click any horse, see its parents, offspring, and trait inheritance path.

**Files:**
- Create: `src/lineage.js` (lineage traversal)
- Modify: `src/ui.js` (add lineage panel)
- Modify: `src/app.js` (modal/panel for selected horse details)
- Modify: `src/styles.css`
- Modify: tests

**Verification:**
- `npm test` → 44+ passing
- Browser: click on a foal born in Phase 2, see its parents and inherited traits

---

## Phase 6 — Auction / Buyer System

**Slice:** Personality-driven bidders compete at auction. The right horse finds the right buyer for the right price. Or doesn't.

**Files:**
- Create: `src/auction.js` (bidder profiles, bidding logic)
- Modify: `src/game.js` (add `enterAuction` action)
- Modify: tests

**Verification:**
- `npm test` → 50+ passing
- Browser: list a horse at auction, watch three bidders with different budgets and tastes compete

---

## Phase 7 — Rival Ranches + Regional Pressure

**Slice:** Two named rival ranches exist. They buy horses, breed, show, and pressure you. The "regional reputation" system tracks how you're seen.

**Files:**
- Create: `src/rivals.js`
- Modify: `src/game.js`
- Modify: tests

**Verification:**
- `npm test` → 55+ passing
- Browser: lose an auction to a rival, see their roster grow

---

## Phase 8 — Weather + Disasters

**Slice:** Drought, fire, flood, disease outbreak, blizzard. Random and seasonal. Consequences are economic and emotional.

**Files:**
- Create: `src/weather.js`
- Modify: `src/game.js`
- Modify: tests

**Verification:**
- `npm test` → 60+ passing
- Browser: drought hits, forage crashes, decision tree opens

---

## Phase 9 — Land Map with Parcel Adjacency

**Slice:** Parcels are placed on a 4x4 grid. Buying a new parcel changes access. Upgrades to existing parcels are visible.

**Files:**
- Create: `src/map.js`
- Modify: `src/ui.js`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: tests

**Verification:**
- `npm test` → 64+ passing
- Browser: see the map, click to buy, see adjacency effects

---

## Phase 10 — Endings + Scoring Rubric

**Slice:** When the player stops (year 5, bankruptcy, or choice), they see an ending. Each ending has a narrative and a score.

**Files:**
- Create: `src/endings.js`
- Modify: `src/game.js` (final score, ending screen)
- Modify: `src/app.js` (ending modal)
- Modify: `src/styles.css`
- Modify: tests

**Endings:**

- **Dynasty** — Third generation alive, regional reputation strong, debt-free.
- **Sold out** — Sold to developer, legacy 0.
- **Worn out** — Personal legacy gone, ranch survives on staff alone.
- **Quiet life** — Modest ranch, no glory, no shame, just life.
- **Fire** — Lost the ranch to disaster.
- **Bankrupt** — Could not meet the next payment.

**Verification:**
- `npm test` → 68+ passing
- Browser: reach the ending screen, see the narrative verdict

---

## Recommended Starting Point

**Start with Phase 1.** It is the smallest vertical slice that proves the thesis. Once you can watch a horse age and die, every other phase has a foundation.

## What Success Looks Like

- A player opens the game, breeds two horses, advances 18 months, watches the foal grow up, and sells it at a yearling sale for more than its parents cost.
- A player refuses the developer in spring, gets an eviction notice in winter, and has to choose between selling the best mare or losing the west meadow.
- A player loses their oldest broodmare in a winter storm and reads the death event in the ledger, then keeps playing.

## What I Will NOT Add Without Your Direction

- Procedural narrative
- Voice acting / music
- 3D / 2D animated horses
- Multiplayer / online auctions
- Mobile-first responsive design
- Save export/import
