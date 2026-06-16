import test from 'node:test';
import assert from 'node:assert/strict';

import { getLifeStage, isTrainable, canCompete, tickYear, makeFoal, inheritTraits, seedTraits, INHERITABLE_TRAITS, LIFE_STAGES } from '../src/horse.js';

test('foals and weanlings cannot be trained', () => {
  const foal = { age: 0, traits: seedTraits() };
  const weanling = { age: 1, traits: seedTraits() };
  assert.equal(isTrainable(foal), false);
  assert.equal(isTrainable(weanling), false);
});

test('yearlings can be light-trained but cannot compete', () => {
  const y = { age: 2, traits: seedTraits() };
  assert.equal(isTrainable(y), 'light');
  assert.equal(canCompete(y), false);
});

test('campaigners train and compete fully', () => {
  const c = { age: 7, traits: seedTraits() };
  assert.equal(isTrainable(c), true);
  assert.equal(canCompete(c), true);
});

test('retirees cannot train or compete', () => {
  const r = { age: 14, traits: seedTraits() };
  assert.equal(isTrainable(r), false);
  assert.equal(canCompete(r), false);
});

test('horses past 18 die on age tick', () => {
  const old = { id: 'ancient', name: 'Ancient', age: 18, stress: 10, health: 60, traits: seedTraits() };
  const { horses, log } = tickYear([old]);
  assert.equal(horses.length, 0);
  assert.match(log[0], /Ancient died/);
});

test('retirement log line appears at age 13', () => {
  const horse = { id: 'a', name: 'Atlas', age: 12, stress: 10, health: 60, traits: seedTraits() };
  const { horses, log } = tickYear([horse]);
  assert.equal(horses[0].age, 13);
  assert.match(log[0], /Atlas retired/);
});

test('foal traits average parents with bounded mutation', () => {
  const sire = { traits: { gait_quality: 100, temperament_stability: 100, bone_density: 100, heart: 100, conformation: 100 } };
  const dam  = { traits: { gait_quality: 0,   temperament_stability: 0,   bone_density: 0,   heart: 0,   conformation: 0   } };
  // Use deterministic rng that returns 0.5 (no mutation)
  const foal = inheritTraits(sire, dam, () => 0.5);
  for (const key of Object.keys(INHERITABLE_TRAITS)) {
    assert.equal(foal[key], 50, `expected ${key}=50, got ${foal[key]}`);
  }
});

test('stress above 80 erodes health during year tick', () => {
  const horse = { id: 's', name: 'Stressed', age: 6, stress: 85, health: 70, traits: seedTraits() };
  const { horses } = tickYear([horse]);
  assert.ok(horses[0].health < 70);
});

test('life stage map covers all ages 0..18', () => {
  for (let age = 0; age <= 18; age++) {
    const stage = getLifeStage({ age });
    assert.ok(stage, `age ${age} should have a stage`);
  }
  assert.equal(getLifeStage({ age: 19 }), null);
  assert.equal(getLifeStage({ age: 25 }), null);
});

test('makeFoal records both parents and 0 age', () => {
  const sire = { id: 's', traits: seedTraits(), name: 'Sire' };
  const dam  = { id: 'd', traits: seedTraits(), name: 'Dam'  };
  const foal = makeFoal({ name: 'Test Foal', sex: 'female', sire, dam, bloodline: 'X' });
  assert.equal(foal.age, 0);
  assert.deepEqual(foal.parents, ['s', 'd']);
  assert.equal(foal.sex, 'female');
});
