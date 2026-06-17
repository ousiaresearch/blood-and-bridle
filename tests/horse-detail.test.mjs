import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom is only used for modal/horse-detail tests. The game tests use Node.
let dom;
beforeAll();

function beforeAll() {
  try {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  } catch {
    // jsdom missing — skip modal tests gracefully
  }
}

test('modal shows panel with provided content', { skip: !dom }, async () => {
  const { showModal, closeModal, isModalOpen } = await import('../src/modal.js');
  assert.equal(isModalOpen(), false);
  showModal('<p>hello</p>', { title: 'Test' });
  assert.equal(isModalOpen(), true);
  const panel = document.querySelector('.modal-panel');
  assert.ok(panel, 'panel exists');
  assert.equal(panel.querySelector('p').textContent, 'hello');
  closeModal();
  assert.equal(isModalOpen(), false);
});

test('modal close button closes the modal', { skip: !dom }, async () => {
  const { showModal, isModalOpen } = await import('../src/modal.js');
  showModal('<p>x</p>');
  const btn = document.querySelector('.modal-close');
  assert.ok(btn);
  btn.click();
  assert.equal(isModalOpen(), false);
});

test('modal escape key closes the modal', { skip: !dom }, async () => {
  const { showModal, isModalOpen } = await import('../src/modal.js');
  showModal('<p>x</p>');
  const ev = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
  document.dispatchEvent(ev);
  assert.equal(isModalOpen(), false);
});

test('modal sets aria-modal and aria-labelledby', { skip: !dom }, async () => {
  const { showModal, closeModal } = await import('../src/modal.js');
  showModal('<h2>Hello</h2>');
  const overlay = document.querySelector('.modal-overlay');
  assert.equal(overlay.getAttribute('role'), 'dialog');
  assert.equal(overlay.getAttribute('aria-modal'), 'true');
  const heading = overlay.querySelector('h2');
  assert.equal(overlay.getAttribute('aria-labelledby'), heading.id);
  closeModal();
});

test('modal title option auto-inserts a heading when content has none', { skip: !dom }, async () => {
  const { showModal, closeModal } = await import('../src/modal.js');
  showModal('<p>just a body</p>', { title: 'My Title' });
  const heading = document.querySelector('[data-modal-title]');
  assert.ok(heading, 'auto-inserted heading exists');
  assert.equal(heading.textContent, 'My Title');
  closeModal();
});

test('modal click on overlay closes, click on panel does not', { skip: !dom }, async () => {
  const { showModal, isModalOpen, closeModal } = await import('../src/modal.js');
  showModal('<p>x</p>');
  // Click on panel — should not close
  const panel = document.querySelector('.modal-panel');
  panel.click();
  assert.equal(isModalOpen(), true);
  // Click on overlay directly — should close
  const overlay = document.querySelector('.modal-overlay');
  overlay.click();
  assert.equal(isModalOpen(), false);
});

test('horse detail renders portrait, stats, traits, lineage, chronicle', { skip: !dom }, async () => {
  const { renderHorseDetail } = await import('../src/horse-detail.js');
  const horse = {
    id: 'test-1', name: 'Dusty', role: 'Ranch gelding',
    breed: 'quarter_horse', bloodline: 'Old line',
    temperament: 'Steady, forgiving, suspicious of strangers',
    age: 8, sex: 'male', stageId: 'campaigner', stage: 'Campaigner',
    training: 60, bond: 50, health: 70, stress: 30, value: 12000,
    injured: false, traits: { gait_quality: 70, temperament_stability: 60, bone_density: 50, heart: 80, conformation: 65 },
    parents: [], mood: 'calm',
  };
  const game = { day: 30, horses: [horse], log: ['Dusty was born.', 'Dusty trained today.'] };
  const html = renderHorseDetail(horse, game);
  assert.match(html, /Dusty/);
  assert.match(html, /Quarter Horse/);
  assert.match(html, /Training/);
  assert.match(html, /Stress/);
  assert.match(html, /Gait quality/);
  assert.match(html, /Heart/);
  assert.match(html, /Chronicle/);
  // Chronicle should mention at least the line with horse name
  assert.match(html, /Dusty was born/);
});

test('horse detail handles missing parents and empty chronicle', { skip: !dom }, async () => {
  const { renderHorseDetail } = await import('../src/horse-detail.js');
  const horse = {
    id: 'orphan-1', name: 'Orphan', role: 'Prospect filly', breed: 'quarter_horse',
    bloodline: '?', temperament: 'Curious', age: 1, sex: 'female',
    stageId: 'foal', stage: 'Foal', training: 0, bond: 0, health: 80, stress: 0,
    value: 1000, injured: false, traits: {}, parents: [], mood: 'calm',
  };
  const game = { day: 1, horses: [horse], log: [] };
  const html = renderHorseDetail(horse, game);
  assert.match(html, /Unknown/); // sire/dam unknown
  assert.match(html, /No moments on record/);
});

test('horse detail shows injury badge when injured', { skip: !dom }, async () => {
  const { renderHorseDetail } = await import('../src/horse-detail.js');
  const horse = {
    id: 'h', name: 'Hurt', role: 'Ranch gelding', breed: 'quarter_horse',
    bloodline: 'X', temperament: 'Quiet', age: 8, sex: 'male', stageId: 'campaigner', stage: 'Campaigner',
    training: 50, bond: 50, health: 50, stress: 50, value: 5000,
    injured: true, traits: {}, parents: [], mood: 'calm',
  };
  const game = { day: 30, horses: [horse], log: [] };
  const html = renderHorseDetail(horse, game);
  assert.match(html, /detail-badge--injured/);
});

test('horse detail data-mood reflects live mood (crisis → intense)', { skip: !dom }, async () => {
  const { renderHorseDetail } = await import('../src/horse-detail.js');
  const horse = {
    id: 'h', name: 'Sick', role: 'Ranch gelding', breed: 'quarter_horse',
    bloodline: 'X', temperament: 'Quiet, willing, asks little and gives much',
    age: 8, sex: 'male', stageId: 'campaigner', stage: 'Campaigner',
    training: 50, bond: 50, health: 25, stress: 30, // low health = intense
    value: 5000, injured: false, traits: {}, parents: [], mood: 'calm',
  };
  const game = { day: 30, horses: [horse], log: [] };
  const html = renderHorseDetail(horse, game);
  assert.match(html, /data-mood="intense"/);
});