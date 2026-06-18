// Blood & Bridle — breeding cycle (Phase 6 deepening).
//
// The breeding cycle. Mares take in spring, foals born in spring.
// Pregnant mares don't ride, don't show, cost feed for two.
// Stallions need their own paddock, their own handler, their own
// risks. Geldings are the cultural gate — every real horseman has
// an opinion. The old horse ages out: retire, put down, or keep going.
//
// Pure module. No DOM. No localStorage.

import { createInitialAffinity, createInitialMemory, generateQuirks } from './horse-mind.js';

export const BREEDING_SEASONS = Object.freeze(['Spring']);
export const GESTATION_DAYS = 340;  // ~11 months
export const FOALING_SEASON_DAYS = 30;  // foals born in first 30 days of spring

// Breeding states for a mare
export const MARE_STATE = Object.freeze({
  OPEN: 'open',                  // ready to breed
  BRED: 'bred',                  // bred, waiting
  PREGNANT: 'pregnant',          // confirmed pregnant
  FOALED: 'foaled',              // delivered foal
  NURSING: 'nursing',            // with foal at side
  RETIRED: 'retired',            // too old
});

// Stallion states
export const STALLION_STATE = Object.freeze({
  ACTIVE: 'active',
  RETIRED: 'retired',
  GELDED: 'gelded',
});

// Pregnancy status for the game state.
export function createPregnancy(sireId, damId, conceptionDay) {
  return {
    sireId,
    damId,
    conceptionDay,
    dueDay: conceptionDay + GESTATION_DAYS,
    state: MARE_STATE.BRED,
  };
}

// Advance pregnancies: convert BRED to PREGNANT after confirmation,
// PREGNANT to FOALED when due day arrives.
export function advancePregnancies(pregnancies, day) {
  return pregnancies.map((p) => {
    if (p.state === MARE_STATE.BRED && day >= p.conceptionDay + 30) {
      return { ...p, state: MARE_STATE.PREGNANT };
    }
    if (p.state === MARE_STATE.PREGNANT && day >= p.dueDay) {
      return { ...p, state: MARE_STATE.FOALED, foaledDay: day };
    }
    return p;
  });
}

// Compute the cost of a pregnant mare (extra feed).
export function pregnancyCost(pregnancies) {
  return pregnancies.filter((p) => p.state === MARE_STATE.PREGNANT || p.state === MARE_STATE.NURSING).length * 200;
}

// Is the mare pregnant and unable to ride?
export function isMareUnavailable(pregnancies, mareId) {
  return pregnancies.some(
    (p) => p.damId === mareId && (p.state === MARE_STATE.PREGNANT || p.state === MARE_STATE.NURSING),
  );
}

// Stallion availability: is the stallion able to breed?
export function canStallionBreed(stallion, pregnancies, day) {
  if (!stallion) return false;
  if (stallion.stallionState === STALLION_STATE.GELDED) return false;
  if (stallion.stallionState === STALLION_STATE.RETIRED) return false;
  // Stallions have a limit: max 12 breedings per year
  const yearBreedings = pregnancies.filter((p) => p.sireId === stallion.id).length;
  return yearBreedings < 12;
}

// Gelding decision: returns the consequences of gelding a colt.
export function geldColt(horse) {
  return {
    ...horse,
    stallionState: STALLION_STATE.GELDED,
    role: 'ranch gelding',
    bond: (horse.bond ?? 50) + 8,
    training: (horse.training ?? 50) + 5,
    // Geldings are typically calmer
    quirks: (horse.quirks ?? []).filter((q) => q !== 'herd_bound'),
    logLine: `${horse.name} was gelded. The hands said it was time.`,
  };
}

// Old horse decision: returns the consequence of each option.
export function oldHorseDecision(horse) {
  if ((horse.age ?? 0) < 15) return null;  // not yet old
  return {
    retire: {
      label: 'Retire the old horse',
      effect: 'horse stays on the place, no more work',
      legacy: 3,
      reputationEffect: { crew: 2 },
      logLine: `${horse.name} retired to the back pasture. The hands feed them every morning.`,
    },
    putDown: {
      label: 'Put the old horse down',
      effect: 'horse dies, clean end',
      legacy: -2,
      reputationEffect: { crew: -3 },
      logLine: `${horse.name} was put down in the pasture. Mae did not come to supper.`,
    },
    keepGoing: {
      label: 'Keep the old horse working',
      effect: 'horse continues but risks breakdown',
      breakdownChance: 0.3,
      legacy: 0,
      reputationEffect: { crew: -1 },
      logLine: `${horse.name} is slower this year. The work is harder.`,
    },
  };
}

// Generate a foal from a pregnancy. Returns a new horse object.
export function generateFoal(pregnancy, parents, day, randomFn = Math.random) {
  const sire = parents.find((h) => h.id === pregnancy.sireId);
  const dam = parents.find((h) => h.id === pregnancy.damId);
  const breed = sire?.breed ?? dam?.breed ?? 'quarter_horse';
  const sex = randomFn() < 0.5 ? 'male' : 'female';
  const traits = inheritTraits(sire, dam, randomFn);

  return {
    id: `foal-${pregnancy.sireId}-${pregnancy.damId}-${day}`,
    name: pickFoalName(sire, dam, sex),
    sex,
    age: 0,
    breed,
    role: sex === 'male' ? 'colt' : 'filly',
    training: 0,
    bond: 5,
    health: 90,
    stress: 15,
    value: 4000 + traits.length * 500,
    parents: { sire: pregnancy.sireId, dam: pregnancy.damId },
    temperament: traits.join(', ') || 'steady',
    bloodline: `${sire?.bloodline?.split(' ')[0] ?? 'Foundation'} x ${dam?.bloodline?.split(' ')[0] ?? 'Foundation'}`,
    affinity: createInitialAffinity(),
    memory: createInitialMemory(),
    quirks: generateQuirks(randomFn),
    bornDay: day,
  };
}

// Inherit 1-2 traits from parents.
function inheritTraits(sire, dam, randomFn) {
  const traits = [];
  if (sire?.temperament && randomFn() < 0.5) {
    traits.push(sire.temperament.split(',')[0].trim());
  }
  if (dam?.temperament && randomFn() < 0.5) {
    traits.push(dam.temperament.split(',')[0].trim());
  }
  return traits.slice(0, 2);
}

// Pick a foal name based on parents.
function pickFoalName(sire, dam, sex) {
  const prefix = sex === 'male' ? 'His' : 'Her';
  if (sire?.bloodline && dam?.bloodline) {
    return `${prefix} ${sire.bloodline.split(' ')[0]} ${dam.bloodline.split(' ')[0]}`;
  }
  return `${prefix} ${Math.floor(Math.random() * 1000)}`;
}

// Get the broodmare cost for the season (extra feed for pregnant/nursing mares).
export function broodmareSeasonCost(pregnancies, season) {
  if (season !== 'Spring' && season !== 'Summer') return 0;
  const activeCount = pregnancies.filter(
    (p) => p.state === MARE_STATE.PREGNANT || p.state === MARE_STATE.NURSING,
  ).length;
  return activeCount * 200;
}