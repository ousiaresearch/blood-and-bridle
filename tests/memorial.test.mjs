import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMemorial, renderMemorial, renderMemorialHall } from '../src/memorial.js';

const sampleHorse = {
  id: 'h1', name: 'Dusty', role: 'Ranch gelding',
  breed: 'quarter_horse', bloodline: 'Old line',
  temperament: 'Steady, forgiving, suspicious of strangers',
  age: 14, sex: 'male', stageId: 'retiree', stage: 'Retiree',
  training: 70, bond: 60, health: 50, stress: 20, value: 22000,
  injured: false,
  traits: { gait_quality: 60, temperament_stability: 70, bone_density: 65, heart: 80, conformation: 70 },
  parents: [], mood: 'calm',
};

const sampleGame = {
  day: 75, horses: [sampleHorse], legacy: 65,
  log: [
    'Dusty retired from the campaign at age 14.',
    'Dusty won the reining class at the county show.',
    'Dr. Voss treated Dusty for a leg strain.',
    'Dusty was foaled.',
  ],
};

test('buildMemorial returns a complete record for a death', () => {
  const m = buildMemorial(sampleHorse, { ...sampleGame, day: 120 }, { kind: 'death' });
  assert.equal(m.horseName, 'Dusty');
  assert.equal(m.kind, 'death');
  assert.equal(m.breedLabel, 'Quarter Horse');
  assert.equal(m.age, 14);
  assert.ok(m.epitaph.length > 0);
  assert.ok(m.keyMoments.length > 0);
  assert.equal(m.departedAt.year, 4); // day 120 = year 4
  assert.equal(m.departedAt.season, 'Winter');
  assert.equal(m.portraitMood, 'calm');
});

test('buildMemorial returns a complete record for a retirement', () => {
  const m = buildMemorial(sampleHorse, sampleGame, { kind: 'retirement' });
  assert.equal(m.kind, 'retirement');
  assert.match(m.epitaph, /earned the rest/);
});

test('buildMemorial returns a complete record for a sold horse', () => {
  const m = buildMemorial(sampleHorse, sampleGame, { kind: 'sold', circumstance: 'Sold for $22000.' });
  assert.equal(m.kind, 'sold');
  assert.match(m.circumstance, /Sold for/);
});

test('buildMemorial returns null for null horse', () => {
  assert.equal(buildMemorial(null, sampleGame), null);
});

test('buildMemorial key moments surface the right lines', () => {
  const m = buildMemorial(sampleHorse, sampleGame, { kind: 'retirement' });
  // Should pull the lines that mention Dusty. The most "moment-worthy" is the show win.
  const text = m.keyMoments.join(' ');
  assert.match(text, /Dusty/);
});

test('buildMemorial handles empty log gracefully', () => {
  const m = buildMemorial(sampleHorse, { ...sampleGame, log: [] }, { kind: 'death' });
  assert.equal(m.keyMoments.length, 0);
});

test('renderMemorial compact shows name and epitaph', () => {
  const m = buildMemorial(sampleHorse, sampleGame, { kind: 'death' });
  const html = renderMemorial(m, { compact: true });
  assert.match(html, /Dusty/);
  assert.match(html, /memorial--banner/);
  assert.match(html, /memorial-epitaph/);
  // Compact should NOT include the key moments list
  assert.doesNotMatch(html, /memorial-moments/);
});

test('renderMemorial hall-mode shows moments', () => {
  const m = buildMemorial(sampleHorse, sampleGame, { kind: 'retirement' });
  const html = renderMemorial(m, { compact: false });
  assert.match(html, /memorial--hall/);
  assert.match(html, /memorial-moments/);
});

test('renderMemorialHall sorts newest first and renders a header', () => {
  const a = buildMemorial(sampleHorse, { ...sampleGame, day: 30 }, { kind: 'death' });
  const b = buildMemorial(sampleHorse, { ...sampleGame, day: 60 }, { kind: 'retirement' });
  const c = buildMemorial(sampleHorse, { ...sampleGame, day: 90 }, { kind: 'sold' });
  const html = renderMemorialHall([a, b, c]);
  assert.match(html, /Memorial Hall/);
  // Verify ordering: c (day 90) should appear before a (day 30)
  const cIdx = html.indexOf('Sold at age 14');
  const aIdx = html.indexOf('Died at age 14');
  assert.ok(cIdx < aIdx, 'newest memorial should appear first');
});

test('renderMemorialHall returns empty string for no memorials', () => {
  assert.equal(renderMemorialHall([]), '');
  assert.equal(renderMemorialHall(null), '');
});

test('memorials integrate with game state — tickYear produces them', async () => {
  // Smoke test: simulate a year tick and check the game gains memorials.
  // We test the integration path through game.js.
  const { createNewGame, applyAction } = await import('../src/game.js');
  const game = createNewGame();
  assert.deepEqual(game.memorials, []);
  // Set one horse past natural death (age 19) and put the day right before
  // a year boundary (day 120 → applyAction advances to 121 which is a boundary).
  const working = {
    ...game,
    horses: game.horses.map((h, i) => i === 0 ? { ...h, age: 19 } : h),
    day: 120,
  };
  const result = applyAction(working, { type: 'train', horseId: working.horses[1].id, staffId: 'mae' });
  // Memorials should now contain one entry for the first horse
  assert.ok(result.memorials.length >= 1, 'expected at least one memorial after year tick');
  assert.equal(result.memorials[0].kind, 'death');
  // The first seed horse is "Blue Ash" (id blue-ash → name "Blue Ash")
  assert.equal(result.memorials[0].horseName, 'Blue Ash');
});

test('selling a horse produces a sold memorial', async () => {
  const { createNewGame, applyAction } = await import('../src/game.js');
  const game = createNewGame();
  // Make sure we have multiple horses (we do by default)
  assert.ok(game.horses.length > 1);
  // Select the second horse and sell it
  const horseToSell = game.horses[1];
  const result = applyAction(game, { type: 'sellHorse', horseId: horseToSell.id });
  assert.ok(result.memorials.length >= 1);
  const lastMemorial = result.memorials[result.memorials.length - 1];
  assert.equal(lastMemorial.kind, 'sold');
  // Horse name is preserved on the memorial
  assert.equal(lastMemorial.horseName, horseToSell.name);
  // Circumstance has the price (e.g. "Sold privately at age 9 for $22,000.")
  assert.match(lastMemorial.circumstance, /\$\d/);
});