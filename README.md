# Blood & Bridle

A playable MVP of a prestige neo-Western horse ranch legacy simulator.

## Premise

You have thirty days to keep a strained horse ranch alive while a resort developer circles the west meadow and the bank watches the ledger. Horses are not inventory: each one has training, bond, health, stress, value, temperament, and emotional cost.

## MVP Features

- 30-day ranch scenario
- Named horse roster with bloodlines and temperament notes
- Staff loyalty, land parcels, developer pressure, cash, reputation, and legacy meters
- Daily decisions:
  - Train a horse
  - Rotate pasture
  - Call the vet
  - Enter a show
  - Take outside boarders
  - Refuse the developer
  - Sell a horse
- Deterministic simulation core with automated tests
- Browser-playable dashboard UI with local save/reset

## Run

```bash
cd /Users/johann/blood-and-bridle
npm test
npm start
```

Then open:

```text
http://localhost:4173
```

## Design Spine

The MVP is built around one question:

> Can the player become attached to individual horses and make painful economic decisions around them?

If that works, the next build should add breeding inheritance, event chains, NPC relationship history, and a richer seasonal map.
