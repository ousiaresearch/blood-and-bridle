# Blood & Bridle

A multi-year prestige neo-Western horse ranch legacy simulator.

## What it is

A 5-year horse ranch simulator where the horses are living characters, time
is the antagonist, and every decision compounds. Build bloodlines through
breeding, weather the developer's pressure, survive disasters, and either
build a dynasty or sell out.

## V2 Features (all 10 phases shipped)

1. **Horse life stages + aging + death** — Foals grow into weanlings, yearlings, campaigners, and retirees. They die at 18.
2. **Breeding + foal genetics** — Five inherited traits, mid-parent averaging with mutation, 11-month gestation, foal born in spring.
3. **Multi-year seasonal calendar** — 30 in-game days per season, 4 seasons per year, 5 years max. Winter burns cash, spring foals, summer shows, fall sales.
4. **NPC memory + scripted event chains** — Six NPCs with relationship and patience. Refusing the developer in spring returns a new offer in fall.
5. **Lineage tree view** — Click any horse, see parents, offspring, and inherited traits.
6. **Auction house** — Four personality-driven bidders compete on each listing. Top bid never exceeds budget.
7. **Rival ranches** — Callahan and Skogstad grow, buy, and pressure you.
8. **Weather + disasters** — Drought, fire, flood, blizzard, disease. Seasonal. Random.
9. **Land map + parcel market** — 4x4 grid, three parcels for sale, adjacency matters.
10. **Endings + scoring** — Dynasty, Sold Out, Bankrupt, Worn Out, Fire, Quiet Life. Final score on the ending screen.

## Run

```bash
cd /Users/johann/blood-and-bridle
npm test
npm start
```

Then open `http://localhost:4173`.

## Test coverage

```bash
npm test
```

```text
tests 90
pass 90
fail 0
```

Engine modules, all with unit tests:
- `src/horse.js` (life stages, traits, aging, foal)
- `src/seasons.js` (calendar)
- `src/breeding.js` (genetics, gestation, foaling)
- `src/npcs.js` (memory, relationships, patience)
- `src/events.js` (authored event library)
- `src/auction.js` (bidder profiles, scoring)
- `src/rivals.js` (regional competitors)
- `src/weather.js` (disasters, seasonal chance)
- `src/lineage.js` (family tree traversal)
- `src/map.js` (4x4 grid, parcel market)
- `src/endings.js` (six narrative endings, scoring rubric)
- `src/game.js` (engine orchestrator)

## Design Thesis

> The game gets good when time starts to matter — when the horse you bred
> last spring wins a class three years later, or doesn't, and the ranch
> has a memory of both.

## Architecture

- Pure simulation core, no DOM dependency
- All actions are pure functions: `applyAction(game, action) -> game`
- State is never mutated
- Engine modules are independently testable
- UI layer in `src/app.js` is a thin renderer over `buildDashboardModel`

## Play Flow

1. Open the page. Five horses, three parcels, $18,500, 30 days to prove the ranch.
2. Click any horse card to select it.
3. Choose a daily action from the right panel: train, rotate pasture, enter a show, take boarders, refuse the developer, sign over the west meadow, queue breeding, call the vet, sell, or list at auction.
4. Pick a stallion and a mare to queue a breeding. Foal arrives 11 in-game days later with parents and inherited traits.
5. As seasons change, disasters may fire, NPCs may show up with offers, rivals may grow.
6. Buy parcels from the land market. Watch your map and your bank balance.
7. Reach year 5, bankruptcy, or an ending screen for the verdict.
