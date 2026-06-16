// NPC roster. Each NPC has memory, voice, and a patience/reputation axis.
// Memory is the spine of consequence: a refused offer in spring is
// remembered in fall.

export const STAFF = {
  mae: {
    id: 'mae',
    name: 'Mae Calder',
    role: 'Head trainer',
    skill: 9,
    loyalty: 77,
    note: 'Can make a horse brave, but will not forgive cruelty.',
    specialty: 'maeAdvancedTraining',
    specialtyLabel: 'Advanced training session',
    specialtyDescription: 'Push a campaigner past its plateau. +2 to all stats, +14 stress, +$50 cost.',
  },
  eli: {
    id: 'eli',
    name: 'Eli Rusk',
    role: 'Ranch hand',
    skill: 6,
    loyalty: 58,
    note: 'Knows every fence line and every debt rumor.',
    specialty: 'eliFindHayDeal',
    specialtyLabel: 'Find a hay deal',
    specialtyDescription: 'Buy cheap hay for the season. Reduces feed cost 30% for 30 days.',
  },
  'dr-voss': {
    id: 'dr-voss',
    name: 'Dr. Lena Voss',
    role: 'Veterinarian',
    skill: 8,
    loyalty: 63,
    note: 'Expensive, honest, worth it when legs are at stake.',
    specialty: 'vossPreventiveCare',
    specialtyLabel: 'Herd preventive care',
    specialtyDescription: 'Walk every horse. Lower stress and catch small injuries early. $300.',
  },
};

// Mae advanced training
export function maeAdvancedTraining(horse) {
  return {
    ...horse,
    training: Math.min(100, horse.training + 2),
    bond: Math.min(100, horse.bond + 2),
    health: Math.min(100, horse.health + 2),
    stress: Math.min(100, horse.stress + 14),
  };
}

// Eli find hay deal — flag carried in game state
export function eliFindHayDeal() {
  return { cost: 200, effect: 'hay_deal_30pct' };
}

// Voss preventive care
export function vossPreventiveCare(horses) {
  return horses.map((h) => {
    const newHealth = h.injured ? Math.min(100, h.health + 6) : Math.min(100, h.health + 1);
    return {
      ...h,
      stress: Math.max(0, h.stress - 8),
      health: newHealth,
      injured: false,
    };
  });
}

export function getStaffSpecialty(staffId) {
  return STAFF[staffId]?.specialty ?? null;
}

export const NPCS = {
  'dev-coleman': {
    id: 'dev-coleman',
    name: 'Coleman Reyes',
    role: 'Resort developer',
    archetype: 'capital',
    voice: 'corporate, polite, threatening',
    patience: 100,
    relationship: 0, // -100..100
    memory: { refused: 0, delayed: 0, courted: 0, signed: 0 },
    thresholds: { patience: 0 }, // 0 means done
  },
  'ranch-cordell': {
    id: 'ranch-cordell',
    name: 'Cordell Hask',
    role: 'Neighboring rancher',
    archetype: 'community',
    voice: 'old country, wary, honest',
    patience: 60,
    relationship: 18,
    memory: { helped: 0, ignored: 0, fought: 0, traded: 0 },
  },
  'banker-ortega': {
    id: 'banker-ortega',
    name: 'Yolanda Ortega',
    role: 'Bank officer',
    archetype: 'capital',
    voice: 'measured, fiduciary, not unkind',
    patience: 50,
    relationship: 0,
    memory: { lateOnLoan: 0, paidEarly: 0, refinanced: 0 },
  },
  'vet-voss': {
    id: 'vet-voss',
    name: 'Dr. Lena Voss',
    role: 'Veterinarian',
    archetype: 'expert',
    voice: 'clinical, gentle with horses, sharp with owners',
    patience: 70,
    relationship: 22,
    memory: { billed: 0, consulted: 0, ignored: 0 },
  },
  'sister-elena': {
    id: 'sister-elena',
    name: 'Elena',
    role: 'Sister',
    archetype: 'family',
    voice: 'sharp, loving, tired of carrying weight alone',
    patience: 40,
    relationship: 35,
    memory: { asked: 0, refusedHelp: 0, sharedBurden: 0 },
  },
  'rival-callahan': {
    id: 'rival-callahan',
    name: 'The Callahan Ranch',
    role: 'Regional rival',
    archetype: 'rival',
    voice: 'wry, well-heeled, not above poaching',
    patience: 80,
    relationship: -10,
    memory: { outbid: 0, lostTo: 0, allied: 0 },
  },
};

export function getNpc(npcId) {
  return NPCS[npcId];
}

export function recordNpcMemory(game, npcId, key, delta = 1) {
  const npc = NPCS[npcId];
  if (!npc) return game;
  npc.memory[key] = (npc.memory[key] ?? 0) + delta;
  return game;
}

export function adjustRelationship(npcId, delta) {
  const npc = NPCS[npcId];
  if (!npc) return;
  npc.relationship = Math.max(-100, Math.min(100, npc.relationship + delta));
}

export function adjustPatience(npcId, delta) {
  const npc = NPCS[npcId];
  if (!npc) return;
  npc.patience = Math.max(0, Math.min(100, npc.patience + delta));
}
