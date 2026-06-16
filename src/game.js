const DAILY_BURN = 800;
const TRAINING_COST = 20;
const VET_COST = 2600;
const SHOW_WINNINGS = 6000;
const MAX_DAY = 30;

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const clone = (value) => structuredClone(value);

export function createNewGame() {
  return {
    day: 1,
    maxDay: MAX_DAY,
    cash: 18500,
    legacy: 62,
    reputation: 38,
    developerPressure: 54,
    crisis: {
      id: 'prove-ranch',
      title: 'Thirty Days to Prove the Ranch',
      description: 'A resort group wants the west parcel. The bank wants proof this place can still earn. You have one month to show both of them the ranch is more than dirt with fences.',
    },
    horses: [
      {
        id: 'blue-ash',
        name: 'Blue Ash',
        age: 6,
        role: 'Reining mare',
        bloodline: 'Cedar King x Ashfall Lady',
        temperament: 'Storm-nervous, handler-loyal, explosive in the turn',
        training: 62,
        bond: 46,
        health: 84,
        stress: 22,
        value: 38000,
        injured: false,
      },
      {
        id: 'mercy-road',
        name: 'Mercy Road',
        age: 9,
        role: 'Ranch gelding',
        bloodline: 'Old Quarter working line',
        temperament: 'Steady, forgiving, suspicious of strangers',
        training: 74,
        bond: 68,
        health: 71,
        stress: 18,
        value: 22000,
        injured: false,
      },
      {
        id: 'juniper-smoke',
        name: 'Juniper Smoke',
        age: 3,
        role: 'Prospect filly',
        bloodline: 'Smoke Signal x Juniper Belle',
        temperament: 'Curious, clever, too smart for sloppy hands',
        training: 31,
        bond: 28,
        health: 93,
        stress: 30,
        value: 14000,
        injured: false,
      },
      {
        id: 'red-ledger',
        name: 'Red Ledger',
        age: 11,
        role: 'Broodmare',
        bloodline: 'Ledger Creek foundation mare',
        temperament: 'Dominant, protective, throws calm foals',
        training: 55,
        bond: 52,
        health: 66,
        stress: 24,
        value: 26000,
        injured: false,
      },
      {
        id: 'sunday-caller',
        name: 'Sunday Caller',
        age: 2,
        role: 'Unstarted colt',
        bloodline: 'Caller ID x Sunday Chapel',
        temperament: 'Hot, brilliant, not yet convinced humans matter',
        training: 18,
        bond: 14,
        health: 88,
        stress: 37,
        value: 9000,
        injured: false,
      },
    ],
    staff: [
      { id: 'mae', name: 'Mae Calder', role: 'Head trainer', skill: 9, loyalty: 77, note: 'Can make a horse brave, but will not forgive cruelty.' },
      { id: 'eli', name: 'Eli Rusk', role: 'Ranch hand', skill: 6, loyalty: 58, note: 'Knows every fence line and every debt rumor.' },
      { id: 'dr-voss', name: 'Dr. Voss', role: 'Veterinarian', skill: 8, loyalty: 63, note: 'Expensive, honest, worth it when legs are at stake.' },
    ],
    parcels: [
      { id: 'west-meadow', name: 'West Meadow', forage: 58, water: 71, threat: 'Resort parcel offer' },
      { id: 'cedar-draw', name: 'Cedar Draw', forage: 63, water: 48, threat: 'Drought line creeping east' },
    ],
    log: [
      'The bank gave you thirty days. The resort buyer gave you a smile that did not reach his eyes.',
    ],
  };
}

function dailyUpkeep(game, entry) {
  const next = {
    ...game,
    day: game.day + 1,
    cash: game.cash - DAILY_BURN,
    horses: game.horses.map((horse) => ({
      ...horse,
      stress: clamp(horse.stress + 1),
      health: clamp(horse.health - (horse.stress > 75 ? 2 : 0)),
    })),
    parcels: game.parcels.map((parcel) => ({ ...parcel, forage: clamp(parcel.forage - 1) })),
    staff: game.staff.map((person) => ({ ...person })),
    log: [entry, ...game.log].slice(0, 12),
  };

  return next;
}

function findHorse(game, horseId) {
  const horse = game.horses.find((candidate) => candidate.id === horseId);
  if (!horse) throw new Error(`Unknown horse: ${horseId}`);
  return horse;
}

function findStaff(game, staffId) {
  const staff = game.staff.find((candidate) => candidate.id === staffId);
  if (!staff) throw new Error(`Unknown staff: ${staffId}`);
  return staff;
}

export function applyAction(game, action) {
  const working = clone(game);

  switch (action.type) {
    case 'train': {
      const horse = findHorse(working, action.horseId);
      const staff = findStaff(working, action.staffId ?? 'mae');
      const skillBonus = Math.max(3, Math.round(staff.skill / 2));
      working.cash -= TRAINING_COST;
      working.horses = working.horses.map((candidate) => candidate.id === horse.id
        ? {
            ...candidate,
            training: clamp(candidate.training + skillBonus + 1),
            bond: clamp(candidate.bond + 6),
            stress: clamp(candidate.stress + 3),
          }
        : candidate);
      return dailyUpkeep(working, `${staff.name} worked ${horse.name} in the dust-lit arena. The horse gave a little more than yesterday.`);
    }

    case 'rotatePasture': {
      working.horses = working.horses.map((horse) => ({ ...horse, stress: clamp(horse.stress - 13) }));
      working.parcels = working.parcels.map((parcel) => ({ ...parcel, forage: clamp(parcel.forage + 9) }));
      return dailyUpkeep(working, 'Rotated the herd through fresh pasture and gave the land a day to breathe. No headlines. Necessary work.');
    }

    case 'vetCare': {
      const horse = findHorse(working, action.horseId);
      if (working.cash < VET_COST) throw new Error('Not enough cash for vet care.');
      working.cash -= VET_COST;
      working.reputation = clamp(working.reputation + 3);
      working.horses = working.horses.map((candidate) => candidate.id === horse.id
        ? { ...candidate, injured: false, health: clamp(candidate.health + 28), stress: clamp(candidate.stress - 8) }
        : candidate);
      return dailyUpkeep(working, `Dr. Voss treated ${horse.name}. Expensive, clean, and the right kind of mercy.`);
    }

    case 'sellHorse': {
      const horse = findHorse(working, action.horseId);
      if (working.horses.length <= 1) throw new Error('You cannot sell the last horse and still call this a horse ranch.');
      working.cash += horse.value;
      working.legacy = clamp(working.legacy - 12);
      working.staff = working.staff.map((person) => ({ ...person, loyalty: clamp(person.loyalty - (person.id === 'mae' ? 12 : 6)) }));
      working.horses = working.horses.filter((candidate) => candidate.id !== horse.id);
      return dailyUpkeep(working, `Sold ${horse.name}. The books look cleaner. The barn sounds wrong.`);
    }

    case 'enterShow': {
      const horse = findHorse(working, action.horseId);
      const readiness = horse.training + horse.bond + horse.health - horse.stress;
      if (readiness >= 230) {
        working.cash += SHOW_WINNINGS;
        working.reputation = clamp(working.reputation + 12);
        working.legacy = clamp(working.legacy + 3);
        working.horses = working.horses.map((candidate) => candidate.id === horse.id
          ? { ...candidate, stress: clamp(candidate.stress + 11), bond: clamp(candidate.bond + 2) }
          : candidate);
        return dailyUpkeep(working, `${horse.name} placed at the invitational. Not a miracle. Proof.`);
      }

      working.cash -= 1200;
      working.reputation = clamp(working.reputation - 4);
      working.horses = working.horses.map((candidate) => candidate.id === horse.id
        ? { ...candidate, stress: clamp(candidate.stress + 16), bond: clamp(candidate.bond + 1) }
        : candidate);
      return dailyUpkeep(working, `${horse.name} was not ready for the noise. The judge noticed. So did everyone else.`);
    }

    case 'refuseDeveloper': {
      working.legacy = clamp(working.legacy + 9);
      working.developerPressure = clamp(working.developerPressure + 8);
      return dailyUpkeep(working, 'Refused the resort parcel offer. The family table went quiet, but the west meadow stayed yours.');
    }

    case 'takeBoarders': {
      working.cash += 2200;
      working.legacy = clamp(working.legacy - 3);
      working.horses = working.horses.map((horse) => ({ ...horse, stress: clamp(horse.stress + 5) }));
      return dailyUpkeep(working, 'Took three outside boarders for cash flow. It helps. It also makes the place feel rented.');
    }

    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

export function getActiveCrisis(game) {
  return game.crisis;
}

export function getAvailableActions(game) {
  const actions = [
    { type: 'train', label: 'Train a horse', requiresHorse: true, requiresStaff: true },
    { type: 'rotatePasture', label: 'Rotate pasture' },
    { type: 'enterShow', label: 'Enter a show', requiresHorse: true },
    { type: 'takeBoarders', label: 'Take outside boarders' },
    { type: 'refuseDeveloper', label: 'Refuse the developer' },
  ];

  if (game.cash >= VET_COST) actions.push({ type: 'vetCare', label: 'Call the vet', requiresHorse: true });
  if (game.horses.length > 1) actions.push({ type: 'sellHorse', label: 'Sell a horse', requiresHorse: true, danger: true });

  return actions;
}

export function getGameSummary(game) {
  return `Day ${game.day}/${game.maxDay} · Cash $${game.cash.toLocaleString()} · Legacy ${game.legacy} · Reputation ${game.reputation} · Developer Pressure ${game.developerPressure}`;
}

export function isGameOver(game) {
  return game.day > game.maxDay || game.cash < 0 || game.legacy <= 0 || game.horses.length === 0;
}

export function scoreGame(game) {
  const horseValue = game.horses.reduce((sum, horse) => sum + horse.value, 0);
  return Math.round(game.cash + horseValue + game.legacy * 500 + game.reputation * 400 - game.developerPressure * 250);
}
