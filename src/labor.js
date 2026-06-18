// Blood & Bridle — labor system.
//
// The hands are the ranch. Five of them: Mae (head trainer), Eli
// (generalist), Reyes (stallion handler), Elena (bookkeeper), Voss
// (vet, on call). Each has finite hours per week, a skills matrix,
// morale, and a status (working, injured, sick, gone).
//
// Tasks consume hours. The player's choice is *who* does *what* —
// Eli's time on the fence means he isn't starting the colt. The
// ratchet is the work, not the money.
//
// Pure module. No DOM. No localStorage.

export const HAND_STATUS = Object.freeze({
  WORKING: 'working',
  INJURED: 'injured',
  SICK: 'sick',
  GRIEVING: 'grieving',
  ON_LEAVE: 'on_leave',
  GONE: 'gone',
});

export const HANDS = Object.freeze([
  {
    id: 'mae',
    name: 'Mae Calder',
    role: 'Head trainer',
    hoursPerWeek: 40,
    skills: { riding: 9, coltStarting: 8, showing: 7, medical: 4, fencing: 3, breeding: 2 },
    primarySkill: 'riding',
    primarySkillLevel: 9,
    wage: 2400,
    initialMorale: 77,
    perCall: false,
    backstory: 'Three years on the place. Came from a reining barn in Texas. Carries the colts through.',
  },
  {
    id: 'eli',
    name: 'Eli Rusk',
    role: 'Ranch hand',
    hoursPerWeek: 40,
    skills: { riding: 6, coltStarting: 5, fencing: 8, medical: 5, showing: 4, breeding: 3, deals: 7 },
    primarySkill: 'fencing',
    primarySkillLevel: 8,
    wage: 1600,
    initialMorale: 58,
    perCall: false,
    backstory: 'Born on the next ranch over. Knows every fence line and every debt rumor.',
  },
  {
    id: 'reyes',
    name: 'Reyes Two Horses',
    role: 'Stallion handler',
    hoursPerWeek: 40,
    skills: { riding: 7, breeding: 9, coltStarting: 6, showing: 3, fencing: 4, medical: 2 },
    primarySkill: 'breeding',
    primarySkillLevel: 9,
    wage: 2000,
    initialMorale: 65,
    perCall: false,
    backstory: 'Came up from the reservation. Reads the stallions better than anyone on the place.',
  },
  {
    id: 'elena',
    name: 'Elena Marsh',
    role: 'Bookkeeper',
    hoursPerWeek: 40,
    skills: { riding: 3, bookkeeping: 9, medical: 3, fencing: 2, showing: 2, breeding: 2 },
    primarySkill: 'bookkeeping',
    primarySkillLevel: 9,
    wage: 1800,
    initialMorale: 60,
    perCall: false,
    backstory: 'Came out from the city two winters ago. Brought the spreadsheet. The hands tolerate it.',
  },
  {
    id: 'cordell-voss',
    name: 'Dr. Cordell Voss',
    role: 'Veterinarian',
    hoursPerWeek: 30,
    skills: { medical: 9, riding: 5, coltStarting: 3, showing: 2, fencing: 1, breeding: 4 },
    primarySkill: 'medical',
    primarySkillLevel: 9,
    wage: 0,
    initialMorale: 63,
    perCall: true,
    backstory: 'Has other clients. Comes when called. Expensive, honest, worth it when legs are at stake.',
  },
]);

// Hours consumed by each task. null means use the parcel's laborHours
// (only for improveParcel).
export const TASK_HOURS = Object.freeze({
  train: 4,
  maeAdvancedTraining: 6,
  eliFindHayDeal: 8,
  vossPreventiveCare: 4,
  rotatePasture: 8,
  enterShow: 12,
  breed: 2,
  vetCare: 4,
  sellHorse: 2,
  listAtAuction: 4,
  improveParcel: null,           // uses IMPROVEMENT_COSTS[improvement].laborHours
  startColt: 16,                 // colt-starting task (future)
  mendFence: 6,                  // light fence work
});

// Map task → required skill. If a task has no required skill, any
// working hand can do it. If a skill is required, the hand's level
// must meet or exceed MIN_SKILL[task] (or 5 by default).
export const TASK_SKILL = Object.freeze({
  train: 'riding',
  maeAdvancedTraining: 'coltStarting',
  eliFindHayDeal: 'deals',
  vossPreventiveCare: 'medical',
  rotatePasture: 'fencing',
  enterShow: 'showing',
  breed: 'breeding',
  vetCare: 'medical',
  sellHorse: 'riding',
  listAtAuction: 'riding',
  startColt: 'coltStarting',
  mendFence: 'fencing',
});

export const MIN_SKILL = Object.freeze({
  train: 5,
  maeAdvancedTraining: 7,
  eliFindHayDeal: 5,
  vossPreventiveCare: 7,
  rotatePasture: 5,
  enterShow: 4,
  breed: 6,
  vetCare: 7,
  sellHorse: 4,
  listAtAuction: 4,
  startColt: 7,
  mendFence: 5,
});

export function createInitialHands() {
  return HANDS.map((h) => ({
    id: h.id,
    name: h.name,
    role: h.role,
    hoursPerWeek: h.hoursPerWeek,
    hoursThisWeek: 0,
    skills: { ...h.skills },
    primarySkill: h.primarySkill,
    primarySkillLevel: h.primarySkillLevel,
    wage: h.wage,
    morale: h.initialMorale,
    status: HAND_STATUS.WORKING,
    injury: null,
    perCall: h.perCall ?? false,
    backstory: h.backstory ?? null,
  }));
}

// Find a hand by id. Throws if not found.
export function findHand(hands, id) {
  const h = hands.find((x) => x.id === id);
  if (!h) throw new Error(`Hand not found: ${id}`);
  return h;
}

// Check if a hand can do a task. Returns { ok, reason }.
export function canDoTask(hand, taskName) {
  if (hand.status === HAND_STATUS.GONE) {
    return { ok: false, reason: `${hand.name} is gone from the place.` };
  }
  if (hand.status === HAND_STATUS.INJURED) {
    return { ok: false, reason: `${hand.name} is injured (${hand.injury?.type ?? 'unknown'}).` };
  }
  if (hand.status === HAND_STATUS.SICK) {
    return { ok: false, reason: `${hand.name} is sick.` };
  }
  if (hand.status === HAND_STATUS.GRIEVING) {
    return { ok: false, reason: `${hand.name} is grieving.` };
  }
  if (hand.status === HAND_STATUS.ON_LEAVE) {
    return { ok: false, reason: `${hand.name} is on leave.` };
  }
  // Per-call hands only do per-call tasks.
  if (hand.perCall && !['vetCare', 'vossPreventiveCare'].includes(taskName)) {
    return { ok: false, reason: `${hand.name} is on retainer and does not do that work.` };
  }
  // Skill check.
  const skillKey = TASK_SKILL[taskName];
  if (skillKey) {
    const minLevel = MIN_SKILL[taskName] ?? 5;
    const level = hand.skills[skillKey] ?? 0;
    if (level < minLevel) {
      return { ok: false, reason: `${hand.name} lacks the ${skillKey} (${level} < ${minLevel}).` };
    }
  }
  return { ok: true };
}

// Get the hours a task consumes from a hand's week. For improveParcel
// the caller passes the parcel-specific laborHours.
export function taskHours(taskName, parcelLaborHours) {
  if (taskName === 'improveParcel') return parcelLaborHours ?? 0;
  return TASK_HOURS[taskName] ?? 0;
}

// Consume hours from a hand. Throws if hand is unavailable or hours
// insufficient.
export function consumeHandHours(hand, taskName, parcelLaborHours) {
  const can = canDoTask(hand, taskName);
  if (!can.ok) throw new Error(can.reason);
  const hours = taskHours(taskName, parcelLaborHours);
  if (hand.hoursThisWeek + hours > hand.hoursPerWeek) {
    const remaining = hand.hoursPerWeek - hand.hoursThisWeek;
    throw new Error(`${hand.name} has only ${remaining} hours left this week (needs ${hours}).`);
  }
  return {
    ...hand,
    hoursThisWeek: hand.hoursThisWeek + hours,
  };
}

// Reset weekly hours (called on week boundary / season tick).
export function resetWeeklyHours(hands) {
  return hands.map((h) => ({ ...h, hoursThisWeek: 0 }));
}

// Apply an injury to a hand. Returns new hand.
export function injureHand(hand, type, daysLeft, severity = 'moderate') {
  return {
    ...hand,
    status: HAND_STATUS.INJURED,
    injury: { type, daysLeft, severity },
    hoursThisWeek: 0,
  };
}

// Tick injury countdown. If days hit 0, hand returns to working.
export function tickHandInjuries(hands) {
  return hands.map((h) => {
    if (h.status !== HAND_STATUS.INJURED || !h.injury) return h;
    const newDaysLeft = h.injury.daysLeft - 1;
    if (newDaysLeft <= 0) {
      return { ...h, status: HAND_STATUS.WORKING, injury: null, hoursThisWeek: 0 };
    }
    return { ...h, injury: { ...h.injury, daysLeft: newDaysLeft } };
  });
}

// Adjust morale on a hand. Clamped 0-100.
export function adjustHandMorale(hand, delta) {
  return { ...hand, morale: Math.max(0, Math.min(100, hand.morale + delta)) };
}

// Apply morale delta to all hands. Useful for bunkhouse-wide events.
export function adjustHandsMorale(hands, delta) {
  return hands.map((h) => adjustHandMorale(h, delta));
}

// Total monthly wage cost (excluding per-call hands, which are billed
// per use). Returns the monthly total.
export function totalMonthlyWages(hands) {
  return hands
    .filter((h) => !h.perCall && h.status !== HAND_STATUS.GONE)
    .reduce((sum, h) => sum + h.wage, 0);
}

// Total available hours this week across all working hands.
export function totalAvailableHours(hands) {
  return hands
    .filter((h) => h.status === HAND_STATUS.WORKING)
    .reduce((sum, h) => sum + (h.hoursPerWeek - h.hoursThisWeek), 0);
}

// Roll for hand departures at season boundary. Lower crew corner
// + lower personal morale = higher departure chance. Per-call hands
// (Voss) don't "depart" — they just stop answering.
export function rollHandDepartures(hands, crewRisk) {
  return hands.map((h) => {
    if (h.status === HAND_STATUS.GONE) return h;
    if (h.perCall) return h;
    const personalRisk = h.morale < 20 ? 0.5 : h.morale < 40 ? 0.2 : h.morale < 60 ? 0.05 : 0.01;
    const departureRoll = Math.random();
    // Combined risk: max of personal and crew (a hand doesn't leave if
    // they personally want to stay; but if the ranch is failing AND
    // they have options, they go).
    const combinedRisk = Math.max(personalRisk, crewRisk * (1 - h.morale / 200));
    if (departureRoll < combinedRisk) {
      return { ...h, status: HAND_STATUS.GONE };
    }
    return h;
  });
}

// Working count: how many hands are actively working.
export function workingHandCount(hands) {
  return hands.filter((h) => h.status === HAND_STATUS.WORKING).length;
}

// Morale-weighted skill: when assigning a hand to a task, the higher
// the morale the more effort they put in. Used for skill-bonus math.
export function effectiveSkillLevel(hand, skillKey) {
  const base = hand.skills[skillKey] ?? 0;
  const moraleMod = hand.morale >= 70 ? 1.0 : hand.morale >= 40 ? 0.9 : 0.7;
  return Math.max(1, Math.round(base * moraleMod));
}
