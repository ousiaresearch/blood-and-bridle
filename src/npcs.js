// NPC roster. Each NPC has memory, voice, and a patience/reputation axis.
// Memory is the spine of consequence: a refused offer in spring is
// remembered in fall.

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
