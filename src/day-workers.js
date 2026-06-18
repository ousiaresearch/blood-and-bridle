// Blood & Bridle — day-worker system.
//
// The country corner is abstract until you can see who's showing up
// at the bunkhouse. The day-workers are the *recurring outside labor*
// — the kid, the old timer, the woman, the drifter. They are not
// hands (they are not committed) but they are not strangers (they
// are not unknown). They are the community the country corner
// measures.
//
// McMurtry: the Hat Creek outfit could not have run without the
// drifters and the kid who lied about his age. The day-workers are
// the people the country corner is *for*.
//
// Pure module. No DOM. No localStorage.

import { HAND_STATUS } from './labor.js';

// Four recurring day-workers. Each has a country-gate (minimum
// country corner for them to be in the roster) and a backstory
// that deepens the country. The kid is always in the roster; the
// drifter requires a high-trust country to show up.
export const DAY_WORKER_DEFS = Object.freeze([
  {
    id: 'the-kid',
    name: 'Tucker Briggs',
    age: 17,
    role: 'Summer help',
    skillLevel: 2,
    skills: { riding: 3, fencing: 2, showing: 1, breeding: 1, medical: 1, coltStarting: 1, deals: 1, bookkeeping: 1 },
    hourlyRate: 18,
    maxHoursPerWeek: 40,
    availabilityGate: 0,           // always in roster
    backstory: 'Seventeen. Says he is nineteen. Knows more than he lets on. Comes for the summer, leaves for the rest.',
    special: 'kid',
  },
  {
    id: 'the-old-timer',
    name: 'Harlan Two-Crow',
    age: 67,
    role: 'Handyman',
    skillLevel: 4,
    skills: { riding: 5, fencing: 5, showing: 3, breeding: 3, medical: 3, coltStarting: 3, deals: 4, bookkeeping: 2 },
    hourlyRate: 32,
    maxHoursPerWeek: 20,           // half-days
    availabilityGate: 25,          // shows up at 25% country
    backstory: 'Mended every fence on the place at least twice. Comes when called, leaves when paid.',
    special: 'old_timer',
  },
  {
    id: 'the-woman',
    name: 'June Calloway',
    age: 38,
    role: 'Hand',
    skillLevel: 3,
    skills: { riding: 5, fencing: 4, showing: 4, breeding: 4, medical: 2, coltStarting: 4, deals: 2, bookkeeping: 3 },
    hourlyRate: 28,
    maxHoursPerWeek: 32,
    availabilityGate: 40,
    backstory: 'Shows up every spring. Never says where she winters. Reads horses better than most hands.',
    special: 'woman',
  },
  {
    id: 'the-drifter',
    name: 'Cole Harkness',
    age: 44,
    role: 'Hand',
    skillLevel: 3,
    skills: { riding: 4, fencing: 4, showing: 2, breeding: 2, medical: 1, coltStarting: 2, deals: 3, bookkeeping: 1 },
    hourlyRate: 30,
    maxHoursPerWeek: 40,
    availabilityGate: 55,
    backstory: 'Shows up when the money is right, leaves when it is not. Reliable but mercenary.',
    special: 'drifter',
  },
]);

// Tasks a day-worker can do. Limited set — day-workers are not
// hands and cannot do skilled work.
export const DAY_WORKER_TASKS = Object.freeze({
  mendFence:         { hours: 6,  minSkill: 'fencing', minLevel: 3, label: 'Mend a stretch of fence' },
  paintBarn:         { hours: 8,  minSkill: null,      minLevel: 0, label: 'Paint the barn' },
  cleanStalls:       { hours: 4,  minSkill: null,      minLevel: 0, label: 'Clean the stalls' },
  holdHorse:         { hours: 2,  minSkill: 'riding',  minLevel: 3, label: 'Hold a horse for the vet' },
  generalRanchWork:  { hours: 4,  minSkill: null,      minLevel: 0, label: 'General ranch work' },
});

export const DAY_WORKER_TASK_NAMES = Object.freeze(Object.keys(DAY_WORKER_TASKS));

// Build initial day-workers array. All start with availableThisSeason
// = false; the season tick rolls availability.
export function createInitialDayWorkers() {
  return DAY_WORKER_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    age: d.age,
    role: d.role,
    skillLevel: d.skillLevel,
    skills: { ...d.skills },
    hourlyRate: d.hourlyRate,
    maxHoursPerWeek: d.maxHoursPerWeek,
    hoursThisWeek: 0,
    availabilityGate: d.availabilityGate,
    backstory: d.backstory,
    special: d.special,
    availableThisSeason: false,
    seasonsWorked: 0,
    promoted: false,
  }));
}

// Find a day-worker by id. Throws if not found.
export function findDayWorker(dayWorkers, id) {
  const dw = dayWorkers.find((d) => d.id === id);
  if (!dw) throw new Error(`Day-worker not found: ${id}`);
  return dw;
}

// Filter to day-workers whose availability gate is met by the country
// corner. Doesn't roll dice — just the static gate check.
export function dayWorkersInRoster(dayWorkers, countryCorner) {
  return dayWorkers.filter((d) => !d.promoted && d.availabilityGate <= countryCorner);
}

// Roll per-day-worker availability for the season. Each day-worker
// in the roster has a per-season probability of showing up, scaled
// by the country corner.
//
// countryCorner: 0-100
// availabilityFn: function (country) → 0-1 probability (from reputation.js)
export function rollDayWorkerAvailability(dayWorkers, countryCorner, availabilityFn, randomFn = Math.random) {
  const prob = availabilityFn ? availabilityFn(countryCorner) : 0.6;
  return dayWorkers.map((d) => {
    if (d.promoted) return d;
    if (d.availabilityGate > countryCorner) {
      return { ...d, availableThisSeason: false };
    }
    return { ...d, availableThisSeason: randomFn() < prob };
  });
}

// Check if a day-worker can do a task. Returns { ok, reason }.
export function canDayWorkerDoTask(dayWorker, taskName) {
  if (dayWorker.promoted) {
    return { ok: false, reason: `${dayWorker.name} has been promoted to the hand roster.` };
  }
  if (!dayWorker.availableThisSeason) {
    return { ok: false, reason: `${dayWorker.name} is not available this season.` };
  }
  if (!DAY_WORKER_TASK_NAMES.includes(taskName)) {
    return { ok: false, reason: `Day-workers cannot do ${taskName} (skilled work).` };
  }
  const task = DAY_WORKER_TASKS[taskName];
  if (task.minSkill) {
    const level = dayWorker.skills[task.minSkill] ?? 0;
    if (level < task.minLevel) {
      return { ok: false, reason: `${dayWorker.name} lacks the ${task.minSkill} (${level} < ${task.minLevel}).` };
    }
  }
  return { ok: true };
}

// Hire a day-worker for a task. Consumes hours from the day-worker's
// weekly budget. Returns the new day-workers array.
export function hireDayWorker(dayWorkers, dayWorkerId, taskName) {
  const idx = dayWorkers.findIndex((d) => d.id === dayWorkerId);
  if (idx < 0) throw new Error(`Day-worker not found: ${dayWorkerId}`);
  const dw = dayWorkers[idx];
  const can = canDayWorkerDoTask(dw, taskName);
  if (!can.ok) throw new Error(can.reason);
  const task = DAY_WORKER_TASKS[taskName];
  if (!task) throw new Error(`Unknown day-worker task: ${taskName}`);
  if (dw.hoursThisWeek + task.hours > dw.maxHoursPerWeek) {
    const remaining = dw.maxHoursPerWeek - dw.hoursThisWeek;
    throw new Error(`${dw.name} has only ${remaining} hours left this week.`);
  }
  const next = [...dayWorkers];
  next[idx] = { ...dw, hoursThisWeek: dw.hoursThisWeek + task.hours };
  return next;
}

// Cost (in cash) to hire a day-worker for a task.
export function dayWorkerCost(dayWorker, taskName) {
  const task = DAY_WORKER_TASKS[taskName];
  if (!task) return 0;
  return Math.round(task.hours * dayWorker.hourlyRate);
}

// Reset weekly hours. Called on week boundary / season tick.
export function resetDayWorkerHours(dayWorkers) {
  return dayWorkers.map((d) => ({ ...d, hoursThisWeek: 0 }));
}

// Tick season counter for day-workers who showed up this season.
// Returns the updated day-workers array.
export function tickDayWorkerSeasons(dayWorkers) {
  return dayWorkers.map((d) =>
    d.promoted ? d : d.availableThisSeason ? { ...d, seasonsWorked: d.seasonsWorked + 1 } : d
  );
}

// Check if a day-worker can be promoted. Requirements:
// - Not already promoted
// - 3+ seasons worked
// - Country corner 50+
// - Has a hand-vacancy on the roster
export function canPromoteDayWorker(dayWorker, countryCorner, hasVacancy) {
  if (dayWorker.promoted) return { ok: false, reason: `${dayWorker.name} is already promoted.` };
  if (dayWorker.seasonsWorked < 3) {
    return { ok: false, reason: `${dayWorker.name} needs ${3 - dayWorker.seasonsWorked} more season(s) on the place.` };
  }
  if (countryCorner < 50) {
    return { ok: false, reason: 'Country corner is too low. The community has to trust you first.' };
  }
  if (!hasVacancy) {
    return { ok: false, reason: 'No vacancy on the hand roster. Let one go before promoting another.' };
  }
  return { ok: true };
}

// Promote a day-worker to a hand. Returns:
//   { dayWorkers, hands, log }
//
// The day-worker is moved from the day-workers roster to the hands
// roster. Their skills become a hand's skills, their hourly rate
// becomes a monthly wage (hourly * 40 * 4 * 0.7), and a log line
// records the commitment. The country corner gains +5.
export function promoteDayWorker(dayWorkers, dayWorkerId, hands) {
  const idx = dayWorkers.findIndex((d) => d.id === dayWorkerId);
  if (idx < 0) throw new Error(`Day-worker not found: ${dayWorkerId}`);
  const dw = dayWorkers[idx];
  if (dw.promoted) throw new Error(`${dw.name} is already promoted.`);

  const primarySkill = Object.entries(dw.skills).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'fencing';
  const newHand = {
    id: dw.id,
    name: dw.name,
    role: 'Promoted from day-help',
    hoursPerWeek: 40,
    hoursThisWeek: 0,
    skills: { ...dw.skills },
    primarySkill,
    primarySkillLevel: dw.skills[primarySkill] ?? 3,
    wage: Math.round(dw.hourlyRate * 40 * 4 * 0.7),
    morale: 70,
    status: HAND_STATUS.WORKING,
    injury: null,
    perCall: false,
    backstory: `${dw.backstory} Promoted to the hand roster after ${dw.seasonsWorked} seasons on the place.`,
  };

  const nextDayWorkers = [...dayWorkers];
  nextDayWorkers[idx] = { ...dw, promoted: true };
  return {
    dayWorkers: nextDayWorkers,
    hands: [...hands, newHand],
    log: `${dw.name} signed on. The bunkhouse got a new name on the board.`,
  };
}

// Find the best day-worker for a given task in the current roster.
// Returns the day-worker with the highest relevant skill, or null.
export function bestDayWorkerFor(dayWorkers, taskName) {
  const task = DAY_WORKER_TASKS[taskName];
  if (!task) return null;
  const eligible = dayWorkers.filter((d) => !d.promoted && d.availableThisSeason);
  if (eligible.length === 0) return null;
  if (!task.minSkill) {
    // No skill needed; pick the one with the most hours available
    return eligible.sort((a, b) => (b.maxHoursPerWeek - b.hoursThisWeek) - (a.maxHoursPerWeek - a.hoursThisWeek))[0];
  }
  return eligible.sort((a, b) => (b.skills[task.minSkill] ?? 0) - (a.skills[task.minSkill] ?? 0))[0];
}
