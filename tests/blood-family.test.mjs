// Phase 10 — the dispersal. Tests for the Blood family tree, the
// Sheridan intro, the previousOwner field on parcels, the rival
// auction bidders, the rival community members, and the family
// mention lines in slow-time.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAMILY_NAME,
  PATRIARCH,
  BLOOD_CHILDREN,
  BLOOD_GRANDCHILDREN,
  PARCEL_DISPERSAL,
  ASH_COULEE,
  HENRY_WHITEHORSE,
  SHERIDAN_INTRO,
  FAMILY_MENTION_LINES,
  RIVALS,
} from '../src/blood-family.js';
import { createInitialParcels } from '../src/parcels.js';
import { BIDDERS, listBidder } from '../src/auction.js';
import { COMMUNITY_MEMBERS, availableCommunity } from '../src/community.js';
import { SLOW_MOMENT_LIBRARY, pickFamilyMentionLine, SLOW_MOMENTS } from '../src/slow-time.js';

describe('blood-family — family tree', () => {
  it('declares the family name', () => {
    assert.equal(FAMILY_NAME, 'Blood');
  });

  it('declares the patriarch (Wade Blood, dead)', () => {
    assert.equal(PATRIARCH.name, 'Wade Blood');
    assert.equal(PATRIARCH.died, 2022);
  });

  it('declares the three Blood children', () => {
    const names = BLOOD_CHILDREN.map((c) => c.name);
    assert.ok(names.includes('Bo Blood'), 'Bo Blood is the father');
    assert.ok(names.includes('William Blood'), 'William Blood is the uncle');
    assert.ok(names.includes('Edith Crane'), 'Edith Crane (née Blood) is the aunt');
  });

  it('the aunt carries her married name', () => {
    const edith = BLOOD_CHILDREN.find((c) => c.id === 'edith-blood-crane');
    assert.equal(edith.maidenName, 'Blood');
    assert.equal(edith.name, 'Edith Crane');
    assert.equal(edith.relation, 'aunt');
  });

  it('the cousin is a Blood, son of the uncle', () => {
    const cobb = BLOOD_GRANDCHILDREN.find((g) => g.id === 'cobb-blood');
    assert.equal(cobb.name, 'Cobb Blood');
    assert.equal(cobb.relation, 'cousin');
    assert.equal(cobb.status, 'owns-creek');
  });

  it('the father is estranged and the player is the heir', () => {
    const player = BLOOD_GRANDCHILDREN.find((g) => g.id === 'player');
    assert.equal(player.relation, 'heir');
    assert.equal(player.status, 'inherited');
    const bo = BLOOD_CHILDREN.find((c) => c.id === 'bo-blood');
    assert.equal(bo.status, 'estranged');
  });
});

describe('blood-family — the dispersal map', () => {
  it('maps all 7 parcels (6 working + west-meadow)', () => {
    const keys = Object.keys(PARCEL_DISPERSAL);
    assert.equal(keys.length, 7);
    assert.ok(keys.includes('home-place'));
    assert.ok(keys.includes('back-forty'));
    assert.ok(keys.includes('cedar-draw'));
    assert.ok(keys.includes('north-ridge'));
    assert.ok(keys.includes('show-grounds'));
    assert.ok(keys.includes('breeding-shed'));
    assert.ok(keys.includes('west-meadow'));
  });

  it('gives the player 2 parcels (home + back-forty)', () => {
    assert.equal(PARCEL_DISPERSAL['home-place'].currentOwner, 'You');
    assert.equal(PARCEL_DISPERSAL['back-forty'].currentOwner, 'You');
  });

  it('gives the family 3 parcels (creek, ridge, show-grounds)', () => {
    assert.equal(PARCEL_DISPERSAL['cedar-draw'].currentOwner, 'Cobb Blood');
    assert.equal(PARCEL_DISPERSAL['north-ridge'].currentOwner, 'Edith Crane');
    assert.equal(PARCEL_DISPERSAL['show-grounds'].currentOwner, 'William Blood');
  });

  it('gives the developer 1 parcel + 1 pending offer', () => {
    assert.equal(PARCEL_DISPERSAL['breeding-shed'].currentOwner, 'Blackwood Development');
    assert.match(PARCEL_DISPERSAL['west-meadow'].currentOwner, /Blackwood/);
  });

  it('each dispersal entry has a previousOwnerNote', () => {
    for (const parcel of Object.values(PARCEL_DISPERSAL)) {
      assert.ok(parcel.previousOwner, 'has previousOwner');
      assert.ok(parcel.previousOwnerNote, 'has previousOwnerNote');
    }
  });
});

describe('blood-family — Ash Coulee', () => {
  it('declares a fictional tribal nation', () => {
    assert.equal(ASH_COULEE.nationName, 'Ash Coulee Nation');
    assert.ok(ASH_COULEE.ranchName.includes('Ash Coulee'));
  });

  it('declares Henry Whitehorse as the recurring foreman', () => {
    assert.equal(HENRY_WHITEHORSE.name, 'Henry Whitehorse');
    assert.ok(HENRY_WHITEHORSE.role.toLowerCase().includes('ash coulee'));
  });

  it('does not name a real tribe or invoke treaty language', () => {
    const blob = JSON.stringify({ ASH_COULEE, HENRY_WHITEHORSE });
    assert.doesNotMatch(blob, /treaty/i);
    assert.doesNotMatch(blob, /reservation claim/i);
    assert.doesNotMatch(blob, /sovereignty/i);
  });
});

describe('blood-family — the Sheridan intro', () => {
  it('has 4 lines', () => {
    assert.equal(SHERIDAN_INTRO.lines.length, 4);
  });

  it('the first line is the grandfather\'s line', () => {
    assert.match(SHERIDAN_INTRO.lines[0], /He used to say/);
  });

  it('mentions the tax, the dispersal, and the inheritance', () => {
    const blob = SHERIDAN_INTRO.lines.join(' ');
    assert.match(blob, /tax/i);
    assert.match(blob, /bought back/i);
  });

  it('is first-person (Sheridan, not McCarthy)', () => {
    // McCarthy: third person, no speaker. Sheridan: first person, "I".
    const blob = SHERIDAN_INTRO.lines.join(' ');
    assert.match(blob, /\bI\b/);
  });

  it('has a 4-second duration', () => {
    assert.equal(SHERIDAN_INTRO.durationMs, 4000);
  });
});

describe('blood-family — the rivals list', () => {
  it('includes family, developer, and tribe', () => {
    const types = new Set(RIVALS.map((r) => r.type));
    assert.ok(types.has('family'), 'has family rivals');
    assert.ok(types.has('developer'), 'has developer rivals');
    assert.ok(types.has('tribe'), 'has tribe rivals');
  });

  it('family rivals are the three Blood relatives', () => {
    const family = RIVALS.filter((r) => r.type === 'family').map((r) => r.name);
    assert.ok(family.includes('William Blood'));
    assert.ok(family.includes('Cobb Blood'));
    assert.ok(family.includes('Edith Crane'));
  });
});

describe('parcels — previousOwner wiring', () => {
  it('populates previousOwner from the dispersal map', () => {
    const parcels = createInitialParcels(PARCEL_DISPERSAL);
    const home = parcels.find((p) => p.id === 'home-place');
    assert.equal(home.currentOwner, 'You');
    assert.equal(home.previousOwner, 'Blood & Bridle');
    const cedar = parcels.find((p) => p.id === 'cedar-draw');
    assert.equal(cedar.currentOwner, 'Cobb Blood');
  });

  it('backward-compatible: no dispersal still works', () => {
    const parcels = createInitialParcels();
    for (const p of parcels) {
      assert.ok(p.previousOwner, `${p.id} has a previousOwner`);
      assert.ok(p.currentOwner, `${p.id} has a currentOwner`);
    }
  });
});

describe('auction — rival bidders', () => {
  it('Cobb Blood is a bidder', () => {
    const cobb = BIDDERS.find((b) => b.id === 'bidder-cobb');
    assert.ok(cobb, 'Cobb Blood is in the bidder list');
    assert.equal(cobb.name, 'Cobb Blood');
    assert.equal(cobb.archetype, 'dispersaler');
  });

  it('Henry Whitehorse is a bidder', () => {
    const henry = BIDDERS.find((b) => b.id === 'bidder-whitehorse');
    assert.ok(henry, 'Henry Whitehorse is in the bidder list');
    assert.equal(henry.name, 'Henry Whitehorse');
    assert.equal(henry.archetype, 'working-ranch');
  });

  it('listBidder can find both rivals', () => {
    assert.equal(listBidder('bidder-cobb').name, 'Cobb Blood');
    assert.equal(listBidder('bidder-whitehorse').name, 'Henry Whitehorse');
  });
});

describe('community — rival neighbors', () => {
  it('William Blood is a community member', () => {
    const wm = COMMUNITY_MEMBERS.find((m) => m.id === 'neighbor-william-blood');
    assert.ok(wm);
    assert.equal(wm.family, true);
  });

  it('Edith Crane is a community member', () => {
    const edith = COMMUNITY_MEMBERS.find((m) => m.id === 'neighbor-edith-crane');
    assert.ok(edith);
    assert.equal(edith.family, true);
  });

  it('Henry Whitehorse is a community member (Ash Coulee)', () => {
    const henry = COMMUNITY_MEMBERS.find((m) => m.id === 'neighbor-ash-coulee');
    assert.ok(henry);
    assert.match(henry.role, /Ash Coulee/);
  });

  it('family members are always available (relationshipGate 0)', () => {
    const at50 = availableCommunity(50);
    const at0 = availableCommunity(0);
    assert.ok(at50.find((m) => m.id === 'neighbor-william-blood'));
    assert.ok(at0.find((m) => m.id === 'neighbor-william-blood'));
  });
});

describe('slow-time — family mentions', () => {
  it('has at least 2 family-mention moments in the library', () => {
    const familyMoments = SLOW_MOMENT_LIBRARY.filter((m) => m.familyMention);
    assert.ok(familyMoments.length >= 2, 'has at least 2 family-mention moments');
  });

  it('family-mention moments reference the family', () => {
    const familyMoments = SLOW_MOMENT_LIBRARY.filter((m) => m.familyMention);
    const blob = familyMoments.map((m) => m.fragment).join(' ');
    assert.match(blob, /Cobb|William|Edith/);
  });

  it('pickFamilyMentionLine returns a non-empty string', () => {
    const line = pickFamilyMentionLine();
    assert.ok(typeof line === 'string');
    assert.ok(line.length > 0);
  });

  it('pickFamilyMentionLine covers all entries over many calls', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      seen.add(pickFamilyMentionLine());
    }
    // Should hit most of the library.
    assert.ok(seen.size >= 3, `picks varied lines (got ${seen.size} unique)`);
  });

  it('family-mention lines reference real family names', () => {
    const blob = FAMILY_MENTION_LINES.join(' ');
    assert.match(blob, /Cobb/);
    assert.match(blob, /William/);
  });
});
