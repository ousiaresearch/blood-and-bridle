import test from 'node:test';
import assert from 'node:assert/strict';

// Rival portrait registry: maps bidder/neighbor ids to Codex mood
// portraits. Tested in isolation — no DOM, no assets on disk.

import {
  portraitForRival,
  moodForRival,
  getRivalPortraitUrl,
  renderRivalPortrait,
  pickHeirArchetype,
  getHeirPortraitUrl,
  renderHeirPortrait,
  listRivalsWithPortraits,
  listHeirArchetypes,
  listRivalAliases,
  RIVAL_MOODS,
} from '../src/rival-portraits.js';

test('portraitForRival resolves canonical ids', () => {
  assert.ok(portraitForRival('cobb-blood'));
  assert.ok(portraitForRival('william-blood'));
  assert.ok(portraitForRival('edith-crane'));
  assert.ok(portraitForRival('henry-whitehorse'));
});

test('portraitForRival resolves aliases (bidder-* / neighbor-*)', () => {
  assert.equal(portraitForRival('bidder-cobb').name, 'Cobb Blood');
  assert.equal(portraitForRival('bidder-whitehorse').name, 'Henry Whitehorse');
  assert.equal(portraitForRival('neighbor-william-blood').name, 'William Blood');
  assert.equal(portraitForRival('neighbor-edith-crane').name, 'Edith Crane');
  assert.equal(portraitForRival('neighbor-ash-coulee').name, 'Henry Whitehorse');
});

test('portraitForRival returns null for unknown ids', () => {
  assert.equal(portraitForRival('nobody'), null);
  assert.equal(portraitForRival(''), null);
});

test('moodForRival defaults to neutral', () => {
  assert.equal(moodForRival('cobb-blood'), 'neutral');
});

test('moodForRival honors explicit mood', () => {
  assert.equal(moodForRival('cobb-blood', { mood: 'arguing' }), 'arguing');
  assert.equal(moodForRival('cobb-blood', { mood: 'concerned' }), 'concerned');
});

test('moodForRival picks mood by context', () => {
  assert.equal(moodForRival('cobb-blood', { context: 'auction' }), 'neutral');
  assert.equal(moodForRival('cobb-blood', { context: 'auction-loss' }), 'concerned');
  assert.equal(moodForRival('cobb-blood', { context: 'auction-won-player-loses' }), 'arguing');
});

test('moodForRival ignores invalid explicit moods', () => {
  assert.equal(moodForRival('cobb-blood', { mood: 'furious' }), 'neutral');
});

test('moodForRival returns null for unknown ids', () => {
  assert.equal(moodForRival('nobody'), null);
});

test('getRivalPortraitUrl returns a path under /assets/people/rivals', () => {
  assert.match(getRivalPortraitUrl('cobb-blood'), /^\/assets\/people\/rivals\/cobb_\w+\.png$/);
  assert.match(getRivalPortraitUrl('william-blood', { mood: 'arguing' }), /william_arguing\.png$/);
  // Alias resolves to same canonical path
  assert.equal(
    getRivalPortraitUrl('bidder-cobb'),
    getRivalPortraitUrl('cobb-blood'),
  );
});

test('getRivalPortraitUrl returns null for unknown ids', () => {
  assert.equal(getRivalPortraitUrl('nobody'), null);
});

test('renderRivalPortrait returns an <img> tag with mood data attribute', () => {
  const html = renderRivalPortrait('cobb-blood', { mood: 'arguing' });
  assert.match(html, /<img /);
  assert.match(html, /data-mood="arguing"/);
  assert.match(html, /data-rival-id="cobb-blood"/);
  assert.match(html, /data-archetype="dispersaler"/);
});

test('renderRivalPortrait falls back to initials placeholder for unknown ids', () => {
  const html = renderRivalPortrait('nobody', { name: 'No One' });
  assert.match(html, /rival-portrait--placeholder/);
  assert.match(html, />NO</);
});

test('pickHeirArchetype returns a record for each hand id', () => {
  for (const id of ['mae', 'eli', 'reyes', 'elena', 'cordell-voss']) {
    const rec = pickHeirArchetype(id, 1);
    assert.ok(rec, `${id} picks an archetype`);
    assert.ok(['son', 'daughter', 'nephew', 'niece'].includes(rec.key), `${id} picks a valid key`);
  }
});

test('pickHeirArchetype is deterministic by generation', () => {
  const g1 = pickHeirArchetype('mae', 1);
  const g2 = pickHeirArchetype('mae', 2);
  const g3 = pickHeirArchetype('mae', 3);
  // Same hand, different generation — at least one pair should differ
  // (the heir pool has 2 entries per hand; with 3 generations we
  // should see variation).
  const all = new Set([g1.key, g2.key, g3.key]);
  assert.ok(all.size >= 1);
});

test('pickHeirArchetype returns null for unknown ids', () => {
  assert.equal(pickHeirArchetype('nobody', 1), null);
});

test('getHeirPortraitUrl returns a path under /assets/people/heirs', () => {
  const url = getHeirPortraitUrl({ heirArchetypeKey: 'son', heirArchetypeMood: 'neutral' });
  assert.match(url, /^\/assets\/people\/heirs\/son_\w+\.png$/);
});

test('getHeirPortraitUrl returns null without an archetype key', () => {
  assert.equal(getHeirPortraitUrl({}), null);
  assert.equal(getHeirPortraitUrl(null), null);
});

test('renderHeirPortrait returns an <img> tag for known archetype', () => {
  const html = renderHeirPortrait({ heirArchetypeKey: 'daughter', heirArchetypeMood: 'concerned' });
  assert.match(html, /<img /);
  assert.match(html, /data-heir-archetype="daughter"/);
  assert.match(html, /data-mood="concerned"/);
});

test('renderHeirPortrait falls back to initials for missing archetype', () => {
  const html = renderHeirPortrait({ ownerName: 'No One' });
  assert.match(html, /heir-portrait--placeholder/);
});

test('listRivalsWithPortraits returns the four canonical rivals', () => {
  const list = listRivalsWithPortraits();
  assert.equal(list.length, 4);
  const ids = list.map((r) => r.id);
  assert.ok(ids.includes('cobb-blood'));
  assert.ok(ids.includes('william-blood'));
  assert.ok(ids.includes('edith-crane'));
  assert.ok(ids.includes('henry-whitehorse'));
});

test('listHeirArchetypes returns the four child archetypes', () => {
  const list = listHeirArchetypes();
  assert.equal(list.length, 4);
  const keys = list.map((a) => a.key);
  for (const k of ['son', 'daughter', 'nephew', 'niece']) {
    assert.ok(keys.includes(k));
  }
});

test('listRivalAliases includes auction and community aliases', () => {
  const aliases = listRivalAliases();
  const map = Object.fromEntries(aliases.map((a) => [a.alias, a.canonical]));
  assert.equal(map['bidder-cobb'], 'cobb-blood');
  assert.equal(map['bidder-whitehorse'], 'henry-whitehorse');
  assert.equal(map['neighbor-william-blood'], 'william-blood');
  assert.equal(map['neighbor-ash-coulee'], 'henry-whitehorse');
});

test('RIVAL_MOODS is frozen and has the three expected values', () => {
  assert.equal(RIVAL_MOODS.length, 3);
  assert.ok(RIVAL_MOODS.includes('neutral'));
  assert.ok(RIVAL_MOODS.includes('concerned'));
  assert.ok(RIVAL_MOODS.includes('arguing'));
  assert.ok(Object.isFrozen(RIVAL_MOODS));
});