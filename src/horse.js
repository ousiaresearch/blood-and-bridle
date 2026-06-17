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

// Breeds. The id is the machine key; prefix is used in portrait filenames
// (qh_foal_calm.png); the description is fed to PixelLab as the visual cue.
// coat / build give the artist enough to draw a recognizable individual of
// the breed without spelling out every anatomical detail.
export const BREED_POOL = [
  {
    id: 'quarter_horse',
    prefix: 'qh',
    label: 'Quarter Horse',
    coat: 'bay, sorrel, or palomino coat, sometimes grullo or buckskin',
    build: 'compact, heavily muscled hindquarters, broad chest, kind eye, low-set hocks, the working cutting horse build',
    use: 'reining, cutting, working cowhorse, the foundation of the show',
  },
  {
    id: 'appaloosa',
    prefix: 'appy',
    label: 'Appaloosa',
    coat: 'chestnut with a spotted blanket over the rump, or leopard-spotted all over, with white sclera showing in the eye and mottled pink-and-black skin around the muzzle',
    build: 'medium frame, strong loin, the colorful wildcard of the Northwest ranges',
    use: 'show circuit and stock horse events, named for the Palouse country',
  },
  {
    id: 'paint_horse',
    prefix: 'paint',
    label: 'Paint Horse',
    coat: 'bold tobiano patches of dark and white (white crossing the back, dark legs), or overo pattern with a bald face',
    build: 'Quarter Horse build underneath the color, muscular, deep through the heart girth',
    use: 'western show, ranch work, the pinto stock horse',
  },
  {
    id: 'arabian',
    prefix: 'arab',
    label: 'Arabian',
    coat: 'grey, chestnut, or bay, fine coat, sometimes flaxen mane and tail',
    build: 'dished face, large dark expressive eyes, arched neck, high carried tail, fine bone, refined head',
    use: 'endurance, English pleasure, the oldest refined breed, the elegant counterpoint',
  },
  {
    id: 'thoroughbred',
    prefix: 'tb',
    label: 'Thoroughbred',
    coat: 'bay, chestnut, or dark brown, often with white socks and a star',
    build: 'long legs, deep chest, lean muscle, athletic frame, taller and leggier than a stock horse',
    use: 'racing, English show jumping, eventing, the runner',
  },
  {
    id: 'andalusian',
    prefix: 'andy',
    label: 'Andalusian',
    coat: 'predominantly grey, often dappled, occasionally bay or black, thick flowing mane and tail',
    build: 'baroque, powerful hindquarters, thick neck, broad chest, convex profile, the original war horse',
    use: 'dressage, classical horsemanship, the original blood of the bridle',
  },
];

// Stages. The 5 used by the portrait manifest (lifecycle snapshots).
// Weanling and yearling are visually similar, so we collapse to yearling.
export const PORTRAIT_STAGES = ['foal', 'yearling', 'prospect', 'campaigner', 'retiree'];

// Map the 10 temperaments to the 3 portrait moods. Picks a stable mood per
// horse based on personality, not transient state. This is the "soul" mood
// — a horse's portrait should match who they are, not their week.
const TEMPERAMENT_TO_MOOD = {
  'Storm-nervous, handler-loyal, explosive in the turn': 'intense',
  'Steady, forgiving, suspicious of strangers': 'calm',
  'Curious, clever, too smart for sloppy hands': 'calm',
  'Dominant, protective, throws calm foals': 'proud',
  'Hot, brilliant, not yet convinced humans matter': 'intense',
  'Quiet, willing, asks little and gives much': 'calm',
  'Bold, opinionated, the boss of every pasture': 'proud',
  'Tender-hearted, prone to ulcers under stress': 'calm',
  'Tough as wire, slow to trust, loyal once broken': 'intense',
  'A thinker. Needs a job or invents one.': 'proud',
};

export function moodFor(temperament) {
  return TEMPERAMENT_TO_MOOD[temperament] || 'calm';
}

// Live mood: the temperament mood is the horse's "soul" — who they are.
// Stress, health, and training pressure shift it transiently. A healthy
// horse with low stress shows their true mood; a sick, stressed horse
// reads as "intense" regardless of who they are. Training intensity above
// 80 lifts "calm" horses toward "proud" because they're working well.
// This is what makes a portrait feel like it's *about* the horse —
// you can see their week on their face.
export function liveMoodFor(horse) {
  if (!horse) return 'calm';
  const soul = moodFor(horse.temperament);
  const stress = typeof horse.stress === 'number' ? horse.stress : 50;
  const health = typeof horse.health === 'number' ? horse.health : 70;
  const training = typeof horse.training === 'number' ? horse.training : 20;

  // Crisis overrides everything. A sick or highly stressed horse reads intense.
  if (stress >= 70 || health <= 40) return 'intense';
  if (health <= 25) return 'intense'; // visibly failing

  // High training on a calm-tempered horse reads as pride — they're working well.
  if (soul === 'calm' && training >= 80) return 'proud';

  // Otherwise, the temperament soul shows through.
  return soul;
}

export function breedById(id) {
  return BREED_POOL.find((b) => b.id === id) || BREED_POOL[0];
}

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

// Pure factory for a new horse. Used by createNewGame() in game.js
// and by generateLegendaryHorse() in legendary.js.
//
// Horses are not inventory. They are lives: born, raised, campaigned,
// bred, retired, and remembered. Time is the antagonist.
export function createHorse({ id, name, sex, age, role, bloodline, temperament, training, bond, health, stress, value, injured = false, breed = 'quarter_horse' }) {
  return {
    id, name, sex, age, role, bloodline, temperament,
    breed,
    lifeStageId: getLifeStage({ age })?.id ?? 'dead',
    mood: moodFor(temperament),
    training, bond, health, stress, value, injured,
    traits: seedTraits(),
    parents: [],
    alive: true,
  };
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
    next.lifeStageId = stage?.id ?? 'dead';

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

export function makeFoal({ name, sex, sire, dam, bloodline, id, breed, rng = Math.random }) {
  const traits = inheritTraits(sire, dam, rng);
  // Breed: inherit from one parent at random. 5% mutation chance — rare,
  // but the stud book stays interesting across generations.
  if (!breed) {
    const pool = [sire.breed, dam.breed].filter(Boolean);
    breed = pool.length ? pool[Math.floor(rng() * pool.length)] : BREED_POOL[0].id;
    if (rng() < 0.05) {
      breed = BREED_POOL[Math.floor(rng() * BREED_POOL.length)].id;
    }
  }
  const temperament = TEMPERAMENT_POOL[Math.floor(rng() * TEMPERAMENT_POOL.length)];
  return {
    id: id ?? `foal-${Math.random().toString(36).slice(2, 8)}`,
    name,
    sex,
    age: 0,
    lifeStageId: 'foal',
    breed,
    role: sex === 'male' ? 'Unstarted colt' : 'Prospect filly',
    bloodline,
    temperament,
    mood: moodFor(temperament),
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
