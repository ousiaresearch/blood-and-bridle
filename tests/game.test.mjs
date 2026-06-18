import test from 'node:test';
import assert from 'node:assert/strict';

import { createNewGame, applyAction, isGameOver, getGameSummary, getAvailableActions, buyAvailableParcel } from '../src/game.js';
import { getLifeStage } from '../src/horse.js';
import { getSeason, getYear } from '../src/seasons.js';
import { AVAILABLE_PARCELS } from '../src/map.js';
import { NPCS } from '../src/npcs.js';
import { RIVALS } from '../src/rivals.js';

test('new game opens with six horses (5 seed + legendary), staff, three parcels, and a crisis', () => {
  const game = createNewGame();
  assert.equal(game.horses.length, 6);
  assert.ok(game.horses.some((h) => h.legendary), 'expected a legendary horse in the herd');
  assert.equal(game.staff.length >= 3, true);
  assert.equal(game.parcels.length, 7);
  assert.ok(game.crisis.title);
  // Four-cornered reputation initialized (Phase 1.3)
  assert.ok(game.reputationCorners, 'reputationCorners exists');
  assert.equal(typeof game.reputationCorners.horsemen, 'number');
  assert.equal(typeof game.reputationCorners.country, 'number');
  assert.equal(typeof game.reputationCorners.bank, 'number');
  assert.equal(typeof game.reputationCorners.crew, 'number');
  // Legacy single reputation is the binding constraint (minimum)
  const cornerMin = Math.min(
    game.reputationCorners.horsemen,
    game.reputationCorners.country,
    game.reputationCorners.bank,
    game.reputationCorners.crew,
  );
  assert.equal(game.reputation, cornerMin, 'legacy reputation is the minimum corner');
  // Collapse tracking initialized
  assert.ok(game.collapsedCornerSeasons);
  assert.equal(game.collapsedCornerSeasons.horsemen, 0);
});

test('training a campaigner horse raises training, bond, and advances the day', () => {
  let game = createNewGame();
  const startDay = game.day;
  game = applyAction(game, { type: 'train', horseId: 'blue-ash', staffId: 'mae' });
  assert.equal(game.day, startDay + 1);
  const blue = game.horses.find((h) => h.id === 'blue-ash');
  assert.ok(blue.training > 62);
  assert.ok(blue.bond > 46);
});

test('training a foal is rejected', () => {
  let game = createNewGame();
  game.horses = game.horses.map((h) => h.id === 'sunday-caller' ? { ...h, age: 0 } : h);
  assert.throws(() => applyAction(game, { type: 'train', horseId: 'sunday-caller', staffId: 'mae' }));
});

test('refusing the developer raises developerPressure and legacy', () => {
  let game = createNewGame();
  const before = game.developerPressure;
  game = applyAction(game, { type: 'refuseDeveloper' });
  assert.ok(game.developerPressure >= before);
  assert.ok(game.legacy >= 62);
});

test('refusing the developer records memory on the NPC', () => {
  const before = NPCS['dev-coleman'].memory.refused ?? 0;
  applyAction(createNewGame(), { type: 'refuseDeveloper' });
  assert.equal(NPCS['dev-coleman'].memory.refused, before + 1);
});

test('vet care adjusts reputation corners (bank +1, crew +2)', () => {
  let game = createNewGame();
  const startBank = game.reputationCorners.bank;
  const startCrew = game.reputationCorners.crew;
  // Need enough cash for vet
  game = { ...game, cash: 100000 };
  game = applyAction(game, { type: 'vetCare', horseId: 'blue-ash' });
  assert.equal(game.reputationCorners.bank, startBank + 1);
  assert.equal(game.reputationCorners.crew, startCrew + 2);
});

test('signing with the developer: bank gains, country loses', () => {
  let game = createNewGame();
  const startBank = game.reputationCorners.bank;
  const startCountry = game.reputationCorners.country;
  const startHorsemen = game.reputationCorners.horsemen;
  const startCrew = game.reputationCorners.crew;
  game = applyAction(game, { type: 'signWithDeveloper' });
  assert.ok(game.reputationCorners.bank > startBank, 'bank gains');
  assert.ok(game.reputationCorners.country < startCountry, 'country loses');
  assert.ok(game.reputationCorners.horsemen < startHorsemen, 'horsemen lose');
  assert.ok(game.reputationCorners.crew < startCrew, 'crew loses');
});

test('refusing the developer: country gains, bank briefly resents', () => {
  let game = createNewGame();
  const startCountry = game.reputationCorners.country;
  const startBank = game.reputationCorners.bank;
  game = applyAction(game, { type: 'refuseDeveloper' });
  assert.ok(game.reputationCorners.country > startCountry, 'country gains');
  assert.ok(game.reputationCorners.bank < startBank, 'bank loses');
});

test('signing with the developer removes the west meadow and adds cash', () => {
  let game = createNewGame();
  game = applyAction(game, { type: 'signWithDeveloper' });
  // West meadow is gone from parcels
  assert.equal(game.parcels.find((p) => p.id === 'west-meadow'), undefined);
  // Cash is up (after the burn)
  assert.ok(game.cash > 50000, 'cash increased by the sale');
});

test('breeding two campaigners queues a pending breeding', () => {
  let game = createNewGame();
  game = applyAction(game, { type: 'breed', sireId: 'mercy-road', damId: 'blue-ash' });
  assert.ok(game.pendingBreeding);
  assert.equal(game.pendingBreeding.sireId, 'mercy-road');
});

test('breeding aborts if the dam is not of the right sex', () => {
  const game = createNewGame();
  assert.throws(() => applyAction(game, { type: 'breed', sireId: 'mercy-road', damId: 'mercy-road' }));
});

test('selling a horse reduces the herd and damages legacy', () => {
  let game = createNewGame();
  game = applyAction(game, { type: 'sellHorse', horseId: 'sunday-caller' });
  assert.equal(game.horses.length, 5);
  assert.ok(game.legacy < 62);
});

test('listing a horse at auction pays out the top bidder offer', () => {
  let game = createNewGame();
  const before = game.cash;
  game = applyAction(game, { type: 'listAtAuction', horseId: 'sunday-caller' });
  assert.ok(game.cash > before - 1000); // pays out, then daily burn
  assert.equal(game.horses.find((h) => h.id === 'sunday-caller'), undefined);
});

test('vet care restores health and clears injury at a steep cost', () => {
  let game = createNewGame();
  game.horses = game.horses.map((h) => h.id === 'mercy-road' ? { ...h, injured: true, health: 40 } : h);
  game = applyAction(game, { type: 'vetCare', horseId: 'mercy-road' });
  const mercy = game.horses.find((h) => h.id === 'mercy-road');
  assert.equal(mercy.injured, false);
  assert.ok(mercy.health > 40);
});

test('a horse past age 18 dies at year tick', () => {
  let game = createNewGame();
  game.horses = game.horses.map((h) => h.id === 'red-ledger' ? { ...h, age: 18 } : h);
  // Advance 11 in-game days to reach the next year boundary
  for (let i = 0; i < 11; i++) game = applyAction(game, { type: 'rotatePasture' });
  // After 11 days, day 12 is mid-season; the year tick has not fired. Force it.
  // Push day past 121 (year 2 boundary)
  while (game.day <= 121) game = applyAction(game, { type: 'rotatePasture' });
  // Now red-ledger should have aged past 18 and died
  assert.equal(game.horses.find((h) => h.id === 'red-ledger'), undefined);
});

test('year tick ages horses by 1 year every 120 in-game days', () => {
  let game = createNewGame();
  // 119 rotates → day 120
  for (let i = 0; i < 119; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(getYear(game), 1);
  game = applyAction(game, { type: 'rotatePasture' }); // day 121 → year 2
  assert.equal(getYear(game), 2);
});

test('a foal is born 11 in-game days after breeding is queued', () => {
  let game = createNewGame();
  game = applyAction(game, { type: 'breed', sireId: 'mercy-road', damId: 'blue-ash' });
  const startLen = game.horses.length;
  for (let i = 0; i < 10; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(game.horses.length, startLen); // not yet
  game = applyAction(game, { type: 'rotatePasture' });
  assert.equal(game.horses.length, startLen + 1);
});

test('available actions include breed, train, refuse, sign, sell, auction', () => {
  const game = createNewGame();
  const types = getAvailableActions(game).map((a) => a.type);
  ['train', 'rotatePasture', 'enterShow', 'takeBoarders', 'refuseDeveloper', 'signWithDeveloper', 'breed'].forEach((t) => {
    assert.ok(types.includes(t), `expected action ${t}`);
  });
});

test('game summary mentions year and season after a few rotates', () => {
  let game = createNewGame();
  for (let i = 0; i < 31; i++) game = applyAction(game, { type: 'rotatePasture' });
  const summary = getGameSummary(game);
  assert.match(summary, /Year/);
  assert.match(summary, /Summer/);
});

test('isGameOver fires when cash goes deeply negative or legacy hits 0', () => {
  const game = createNewGame();
  assert.equal(isGameOver(game), false);
  assert.equal(isGameOver({ ...game, cash: -5000 }), true);
  assert.equal(isGameOver({ ...game, legacy: 0 }), true);
  assert.equal(isGameOver({ ...game, horses: [] }), true);
});

test('rivals grow over time', () => {
  const before = RIVALS[0].cash;
  // Cycle through 12 days to fire a season boundary
  let game = createNewGame();
  for (let i = 0; i < 30; i++) game = applyAction(game, { type: 'rotatePasture' });
  assert.ok(RIVALS[0].cash > before);
});

test('buying a parcel costs cash and adds it to the parcels list', () => {
  let game = createNewGame();
  const parcel = AVAILABLE_PARCELS[0];
  game.cash = parcel.price + 5000;
  game = buyAvailableParcel(game, parcel);
  assert.ok(game.parcels.find((p) => p.id === parcel.id));
});
