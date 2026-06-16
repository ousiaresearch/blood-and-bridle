// Horse data model, life stages, and aging.
//
// A horse is not inventory. A horse is a life arc: born, raised, campaigned,
// bred, retired, and remembered. Time is the antagonist.

export const LIFE_STAGES = [
  { id: 'foal', min: 0, max: 0, label: 'Foal', trainable: false, can_compete: false },
  { id: 'weanling', min: 1, max: 1, label: 'Weanling', trainable: false, can_compete: false },
  { id: 'yearling', min: 2, max: 2, label: 'Yearling', trainable: 'light', can_compete: false },
  { id: 'two_year_old', min: 3, max: 3, label: '2-year-old', trainable: 'light', can_compete: 'futurity' },
  { id: 'campaigner', min: 4, max: 12, label: 'Campaigner', trainable: true, can_compete: true },
  { id: 'retiree', min: 13, max: 18, label: 'Retiree', trainable: false, can_compete: false },
];

// Inheritable traits. A foal's traits are mid-parent with mutation.
export const INHERITABLE_TRAITS = {
  gait_quality: { range: [0, 100], label: 'Gait quality' },
  temperament_stability: { range: [0, 100], label: 'Temperament' },
  bone_density: { range: [0, 100], label: 'Bone density' },
  heart: { range: [0, 100], label: 'Heart' },
  conformation: { range: [0, 100], label: 'Conformation' },
};

export const TRAIT_KEYS = Object.keys(INHERITABLE_TRAITS);

export const ROLE_POOL = [
  'Reining mare', 'Ranch gelding', 'Prospect filly', 'Broodmare', 'Unstarted colt',
  'Cutting prospect', 'Rope horse', 'Trail horse', 'Racehorse', 'Working cowhorse',
];

export const BLOODLINE_POOL = [
  'Cedar King x Ashfall Lady', 'Old Quarter working line', 'Smoke Signal x Juniper Belle',
  'Ledger Creek foundation mare', 'Caller ID x Sunday Chapel', 'Ironwood x Sage',
  'Pine Ridge foundation', 'Northfork x Echo', 'Black Mesa line', 'Aspen Hollow',
];

export const TEMPERAMENT_POOL = [
  'Storm-nervous, handler-loyal, explosive in the turn',
  'Steady, forgiving, suspicious of strangers',
  'Curious, clever, too smart for sloppy hands',
  'Dominant, protective, throws calm foals',
  'Hot, brilliant, not yet convinced humans matter',
  'Quiet, willing, asks little and gives much',
  'Bold, opinionated, the boss of every pasture',
  'Tender-hearted, prone to ulcers under stress',
  'Tough as wire, slow to trust, loyal once broken',
  'A thinker. Needs a job or invents one.',
];

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function getLifeStage(horse) {
  if (!horse || typeof horse.age !== 'number') return null;
  for (const stage of LIFE_STAGES) {
    if (horse.age >= stage.min && horse.age <= stage.max) return stage;
  }
  return null;
}

export function isDead(horse) {
  return !getLifeStage(horse);
}

export function isTrainable(horse) {
  const stage = getLifeStage(horse);
  return stage?.trainable ?? false;
}

export function canCompete(horse) {
  const stage = getLifeStage(horse);
  return stage?.can_compete === true;
}

// One year of age per 12 in-game days. Returns updated horse list,
// death log entries, and a flag indicating if any retired.
export function tickYear(horses, rng = Math.random) {
  const log = [];
  const survivors = [];

  for (const horse of horses) {
    const next = { ...horse, age: horse.age + 1 };
    const stage = getLifeStage(next);

    if (!stage) {
      log.push(`${horse.name} died at age ${next.age}. The barn is quieter for it.`);
      continue;
    }

    if (stage.id === 'retiree' && horse.age < 13) {
      log.push(`${horse.name} retired from the campaign at age ${next.age}.`);
    }

    // Stress above 80 erodes health every year. Health above 70 is fine.
    if (next.stress >= 80 && next.health > 0) {
      next.health = clamp(next.health - 4);
    }
    if (next.stress <= 30) {
      next.health = clamp(next.health + 2);
    }

    survivors.push(next);
  }

  return { horses: survivors, log };
}

export function makeFoal({ name, sex, sire, dam, bloodline, id }) {
  const traits = inheritTraits(sire, dam);
  return {
    id: id ?? `foal-${Math.random().toString(36).slice(2, 8)}`,
    name,
    sex,
    age: 0,
    role: sex === 'male' ? 'Unstarted colt' : 'Prospect filly',
    bloodline,
    temperament: TEMPERAMENT_POOL[Math.floor(Math.random() * TEMPERAMENT_POOL.length)],
    training: 5,
    bond: 18,
    health: 96,
    stress: 22,
    value: 4500,
    injured: false,
    parents: [sire.id, dam.id],
    traits,
    alive: true,
  };
}

export function inheritTraits(sire, dam, rng = Math.random) {
  const foal = {};
  for (const [trait, config] of Object.entries(INHERITABLE_TRAITS)) {
    const [min, max] = config.range;
    const mid = ((sire.traits?.[trait] ?? 50) + (dam.traits?.[trait] ?? 50)) / 2;
    const spread = (max - min) * 0.18; // mutation window
    foal[trait] = Math.round(clamp(mid + (rng() * spread * 2 - spread), min, max));
  }
  return foal;
}

export function seedTraits() {
  const traits = {};
  for (const [trait, config] of Object.entries(INHERITABLE_TRAITS)) {
    const [min, max] = config.range;
    traits[trait] = Math.round(min + Math.random() * (max - min));
  }
  return traits;
}
