// Blood & Bridle — main game engine.
//
// Pure simulation. No DOM. No localStorage. Every action is a pure function
// from (game, action) -> game. State is never mutated; new state is returned.

import { tickYear, getLifeStage, isTrainable, canCompete, clamp, seedTraits, ROLE_POOL, BLOODLINE_POOL, TEMPERAMENT_POOL, INHERITABLE_TRAITS, TRAIT_KEYS, moodFor } from './horse.js';
import { getSeason, getYear, getDayOfSeason, isSeasonBoundary, isYearBoundary, DAYS_PER_SEASON, getSeasonalCostMultiplier } from './seasons.js';
import { tickEvents, resolveEvent } from './events.js';
import { queueBreeding, deliverFoals } from './breeding.js';
import { runAuction } from './auction.js';
import { tickRivals, RIVALS } from './rivals.js';
import { rollDisaster } from './weather.js';
import { checkEnding, scoreGame } from './endings.js';
import { NPCS, recordNpcMemory, adjustRelationship, adjustPatience, STAFF, maeAdvancedTraining, eliFindHayDeal, vossPreventiveCare } from './npcs.js';
import { runShowdown, canEnterShow, getShowOnDay } from './shows.js';
import { applyUpgrade, canAffordUpgrade, getRanchEffects, getUpgradeLabel } from './upgrades.js';
import { generateContractOffer, acceptContract, declineContract, tickContracts } from './contracts.js';
import { TUTORIAL_STEPS, getCurrentTutorialStep, markStepComplete, dismissTutorial } from './tutorial.js';

const DAILY_BURN_BASE = 800;
const TRAINING_COST = 20;
const VET_COST = 2600;
const SHOW_WINNINGS = 6000;
const MAX_DAY = 30 * 5; // 5 years

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function pickName(pool, used, sex) {
  const prefix = sex === 'male' ? 'His' : 'Her';
  for (const n of pool) {
    if (!used.has(n)) {
      used.add(n);
      return n;
    }
  }
  return `${prefix} ${Math.floor(Math.random() * 1000)}`;
}

function createHorse({ id, name, sex, age, role, bloodline, temperament, training, bond, health, stress, value, injured = false, breed = 'quarter_horse' }) {
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

export function createNewGame() {
  const usedNames = new Set();
  const seed = [
    { id: 'blue-ash',     sex: 'female', age: 6,  role: 'Reining mare',  bloodline: 'Cedar King x Ashfall Lady',  temperament: 'Storm-nervous, handler-loyal, explosive in the turn', training: 62, bond: 46, health: 84, stress: 22, value: 38000, breed: 'quarter_horse' },
    { id: 'mercy-road',   sex: 'male',   age: 9,  role: 'Ranch gelding', bloodline: 'Old Quarter working line',  temperament: 'Steady, forgiving, suspicious of strangers',         training: 74, bond: 68, health: 71, stress: 18, value: 22000, breed: 'quarter_horse' },
    { id: 'juniper-smoke',sex: 'female', age: 3,  role: 'Prospect filly',bloodline: 'Smoke Signal x Juniper Belle',temperament: 'Curious, clever, too smart for sloppy hands',         training: 31, bond: 28, health: 93, stress: 30, value: 14000, breed: 'quarter_horse' },
    { id: 'red-ledger',   sex: 'female', age: 11, role: 'Broodmare',     bloodline: 'Ledger Creek foundation mare',temperament: 'Dominant, protective, throws calm foals',              training: 55, bond: 52, health: 66, stress: 24, value: 26000, breed: 'quarter_horse' },
    { id: 'sunday-caller',sex: 'male',   age: 2,  role: 'Unstarted colt',bloodline: 'Caller ID x Sunday Chapel',  temperament: 'Hot, brilliant, not yet convinced humans matter',     training: 18, bond: 14, health: 88, stress: 37, value: 9000,  breed: 'quarter_horse' },
  ];

  const horses = seed.map((s) => {
    const name = s.id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    return createHorse({ ...s, name });
  });

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
      description: 'A resort group wants the west parcel. The bank wants proof this place can still earn.',
    },
    horses,
    staff: [
      { id: 'mae', name: 'Mae Calder', role: 'Head trainer', skill: 9, loyalty: 77, note: 'Can make a horse brave, but will not forgive cruelty.' },
      { id: 'eli', name: 'Eli Rusk', role: 'Ranch hand', skill: 6, loyalty: 58, note: 'Knows every fence line and every debt rumor.' },
      { id: 'dr-voss', name: 'Dr. Voss', role: 'Veterinarian', skill: 8, loyalty: 63, note: 'Expensive, honest, worth it when legs are at stake.' },
    ],
    parcels: [
      { id: 'west-meadow', name: 'West Meadow', x: 0, y: 1, forage: 58, water: 71, threat: 'Resort parcel offer' },
      { id: 'cedar-draw',  name: 'Cedar Draw',  x: 1, y: 2, forage: 63, water: 48, threat: 'Drought line creeping east' },
      { id: 'home-place',  name: 'Home Place',  x: 1, y: 1, forage: 70, water: 70, threat: '—' },
    ],
    ranchUpgrades: {
      arena: 0,
      vet_clinic: 0,
      breeding_shed: 0,
      hay_barn: 0,
    },
    hayDealDaysLeft: 0,
    pendingBreeding: null,
    pendingEvent: null,
    firedEvents: [],
    contracts: [],
    milestones: [],
    lastShowResult: null,
    tutorial: {
      day: 1,
      currentStep: 'train',
      completedSteps: [],
    },
    log: [
      'The bank gave you thirty days. The resort buyer gave you a smile that did not reach his eyes.',
    ],
  };
}

function findHorse(game, id) {
  const h = game.horses.find((x) => x.id === id);
  if (!h) throw new Error(`Unknown horse: ${id}`);
  return h;
}
function findStaff(game, id) {
  const s = game.staff.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown staff: ${id}`);
  return s;
}

function dailyUpkeep(game, entry) {
  const season = getSeason(game);
  const mult = getSeasonalCostMultiplier(season);
  const hayDealActive = (game.hayDealDaysLeft ?? 0) > 0;
  const effects = getRanchEffects(game);
  const baseMult = 1 - (effects.feedDiscount ?? 0);
  const feedMult = hayDealActive ? baseMult * 0.7 : baseMult;
  const burn = Math.round(DAILY_BURN_BASE * mult * feedMult);

  const next = {
    ...game,
    day: game.day + 1,
    cash: game.cash - burn,
    hayDealDaysLeft: Math.max(0, (game.hayDealDaysLeft ?? 0) - 1),
    horses: game.horses.map((h) => ({
      ...h,
      stress: clamp(h.stress + (season === 'Winter' ? 1 : 0)),
      health: clamp(h.health - (h.stress > 75 ? 1 : 0)),
    })),
    parcels: game.parcels.map((p) => ({ ...p, forage: clamp(p.forage - (season === 'Summer' ? 1 : 0)) })),
    log: [entry, ...game.log].slice(0, 20),
  };

  return next;
}

function maybeFireSeasonal(game) {
  let g = { ...game };
  // Auto-complete the "free" tutorial step on day 10
  if (g.day >= 10) g = markStepComplete(g, 'free');
  // Year tick on year boundary
  if (isYearBoundary(g)) {
    const { horses, log } = tickYear(g.horses);
    g = { ...g, horses, log: [...log, ...g.log].slice(0, 20) };
  }
  // Season boundary: rivals, disasters, events, contracts
  if (isSeasonBoundary(g)) {
    g = tickRivals(g);
    const { game: g2 } = rollDisaster(g);
    g = g2;
    g = tickEvents(g);
    // Contract offer: every 30 days (which aligns with season boundaries)
    const offer = generateContractOffer(g);
    if (offer) {
      g = { ...g, contracts: [...(g.contracts ?? []), offer] };
    }
  }
  // Tick active contracts every day for payouts and completions
  const { game: g3, payouts, completed } = tickContracts(g);
  g = g3;
  if (completed.length > 0) {
    const completionLog = completed.map((id) => `Contract ${id} completed.`).join(' ');
    g = { ...g, log: [completionLog, ...g.log].slice(0, 20) };
  }
  // Foal delivery: checked every tick (any day can be a due day)
  const { game: g4 } = deliverFoals(g);
  g = g4;
  return g;
}

export function applyAction(game, action) {
  let working = clone(game);

  switch (action.type) {
    case 'train': {
      const horse = findHorse(working, action.horseId);
      const staff = findStaff(working, action.staffId ?? 'mae');
      if (!isTrainable(horse)) {
        const stage = getLifeStage(horse);
        throw new Error(`${horse.name} is too ${stage?.id === 'foal' || stage?.id === 'weanling' ? 'young' : 'old'} to train (${stage?.label}).`);
      }
      const skillBonus = Math.max(3, Math.round(staff.skill / 2));
      working.cash -= TRAINING_COST;
      working.horses = working.horses.map((h) => h.id === horse.id
        ? { ...h, training: clamp(h.training + skillBonus + 1), bond: clamp(h.bond + 6), stress: clamp(h.stress + 3) }
        : h);
      working = markStepComplete(working, 'train');
      working = dailyUpkeep(working, `${staff.name} worked ${horse.name} in the dust-lit arena.`);
      break;
    }
    case 'rotatePasture': {
      working.horses = working.horses.map((h) => ({ ...h, stress: clamp(h.stress - 13) }));
      working.parcels = working.parcels.map((p) => ({ ...p, forage: clamp(p.forage + 9) }));
      working = markStepComplete(working, 'rotate');
      working = dailyUpkeep(working, 'Rotated the herd through fresh pasture.');
      break;
    }
    case 'vetCare': {
      const horse = findHorse(working, action.horseId);
      if (working.cash < VET_COST) throw new Error('Not enough cash for vet care.');
      working.cash -= VET_COST;
      working.reputation = clamp(working.reputation + 3);
      working.horses = working.horses.map((h) => h.id === horse.id
        ? { ...h, injured: false, health: clamp(h.health + 28), stress: clamp(h.stress - 8) }
        : h);
      recordNpcMemory(working, 'vet-voss', 'billed');
      adjustRelationship('vet-voss', 2);
      working = dailyUpkeep(working, `Dr. Voss treated ${horse.name}.`);
      break;
    }
    case 'sellHorse': {
      const horse = findHorse(working, action.horseId);
      if (working.horses.length <= 1) throw new Error('You cannot sell the last horse and still call this a horse ranch.');
      working.cash += horse.value;
      working.legacy = clamp(working.legacy - 12);
      working.staff = working.staff.map((s) => ({ ...s, loyalty: clamp(s.loyalty - (s.id === 'mae' ? 12 : 6)) }));
      working.horses = working.horses.filter((h) => h.id !== horse.id);
      working = dailyUpkeep(working, `Sold ${horse.name}. The books look cleaner. The barn sounds wrong.`);
      break;
    }
    case 'enterShow': {
      const horse = findHorse(working, action.horseId);
      if (!canCompete(horse)) throw new Error(`${horse.name} is not old enough to compete.`);
      // If a scheduled show exists today, use it. Otherwise, treat as a generic invitational.
      const scheduled = getShowOnDay(working, working.day);
      const show = scheduled ?? {
        id: 'invitational-' + working.day,
        title: 'Open invitational',
        category: 'reining',
        entryFee: 200,
        prizePool: 4000,
        prestige: 1,
      };
      const entry = canEnterShow(horse, show);
      if (!entry.ok) throw new Error(entry.reason);
      if (working.cash < show.entryFee) throw new Error(`Entry fee is $${show.entryFee}.`);
      working.cash -= show.entryFee;
      const result = runShowdown(horse, show, working.ranchUpgrades ?? {});
      working.cash += result.payout;
      working.reputation = Math.max(0, Math.min(100, working.reputation + result.reputationDelta));
      working.legacy = Math.max(0, Math.min(100, working.legacy + result.legacyDelta));
      working.horses = working.horses.map((h) => h.id === horse.id
        ? { ...h, stress: Math.min(100, h.stress + 12), bond: Math.min(100, h.bond + (result.playerPlace === 1 ? 4 : 1)) }
        : h);
      working.lastShowResult = result;
      working = markStepComplete(working, 'show');
      working = dailyUpkeep(working, result.log);
      break;
    }
    case 'refuseDeveloper': {
      working.legacy = clamp(working.legacy + 9);
      working.developerPressure = clamp(working.developerPressure + 8);
      recordNpcMemory(working, 'dev-coleman', 'refused');
      adjustRelationship('dev-coleman', -8);
      adjustPatience('dev-coleman', -10);
      working = dailyUpkeep(working, 'Refused the resort parcel offer. The family table went quiet.');
      break;
    }
    case 'signWithDeveloper': {
      const parcel = working.parcels.find((p) => p.id === 'west-meadow');
      if (!parcel) throw new Error('West meadow is no longer in your hands.');
      working.cash += 50000;
      working.legacy = clamp(working.legacy - 25);
      working.developerPressure = 0;
      working.parcels = working.parcels.filter((p) => p.id !== 'west-meadow');
      working.crisis = { ...working.crisis, resolved: 'sold-to-developer' };
      recordNpcMemory(working, 'dev-coleman', 'signed');
      adjustRelationship('dev-coleman', 30);
      working = dailyUpkeep(working, 'Signed the west meadow over to Reyes. The bank is happy. The legacy is thinner.');
      break;
    }
    case 'takeBoarders': {
      working.cash += 2200;
      working.legacy = clamp(working.legacy - 3);
      working.horses = working.horses.map((h) => ({ ...h, stress: clamp(h.stress + 5) }));
      working = dailyUpkeep(working, 'Took three outside boarders for cash flow.');
      break;
    }
    case 'breed': {
      working = queueBreeding(working, action.sireId, action.damId);
      working = markStepComplete(working, 'breed');
      // breeding does not advance the day — the decision is set, then time catches up
      break;
    }
    case 'maeAdvancedTraining': {
      const horse = findHorse(working, action.horseId);
      if (!isTrainable(horse)) throw new Error(`${horse.name} is too young or old for advanced training.`);
      const stage = getLifeStage(horse);
      if (stage?.id !== 'campaigner') throw new Error(`Only campaigners can take advanced training. ${horse.name} is a ${stage?.label ?? 'unknown'}.`);
      working.cash -= 50;
      working.horses = working.horses.map((h) => h.id === horse.id ? maeAdvancedTraining(h) : h);
      working = dailyUpkeep(working, `Mae pushed ${horse.name} through an advanced session.`);
      break;
    }
    case 'eliFindHayDeal': {
      working.cash -= 200;
      working.hayDealDaysLeft = 30;
      working = dailyUpkeep(working, 'Eli found a hay deal. Feed costs are down for 30 days.');
      break;
    }
    case 'vossPreventiveCare': {
      if (working.cash < 300) throw new Error('Need $300 for preventive care.');
      working.cash -= 300;
      working.horses = vossPreventiveCare(working.horses);
      recordNpcMemory(working, 'vet-voss', 'consulted', 1);
      adjustRelationship('vet-voss', 4);
      working = dailyUpkeep(working, 'Dr. Voss walked every horse. Stress is down across the herd.');
      break;
    }
    case 'upgrade': {
      working = applyUpgrade(working, action.upgradeId);
      // Upgrades don't advance the day — they're a deliberate investment
      break;
    }
    case 'acceptContract': {
      working = acceptContract(working, action.contractId);
      working = dailyUpkeep(working, working.log[0] ?? 'Contract accepted.');
      break;
    }
    case 'declineContract': {
      working = declineContract(working, action.contractId);
      working = dailyUpkeep(working, working.log[0] ?? 'Contract declined.');
      break;
    }
    case 'resolveEvent': {
      working = resolveEvent(working, action.optionIndex);
      working = dailyUpkeep(working, working.log[0] ?? 'Decision logged.');
      break;
    }
    case 'listAtAuction': {
      const horse = findHorse(working, action.horseId);
      const result = runAuction(horse);
      working.cash += result.topBid.offer;
      working.legacy = clamp(working.legacy - 6);
      working.horses = working.horses.filter((h) => h.id !== horse.id);
      working.log = [`Sold ${horse.name} at auction to ${result.topBid.name} for $${result.topBid.offer.toLocaleString()}.`, ...working.log].slice(0, 20);
      working = dailyUpkeep(working, working.log[0]);
      break;
    }
    case 'buyParcel': {
      const parcel = working.parcels.find((p) => p.id === action.parcelId);
      // (parcel purchasing handled in map.js — see buyAvailableParcel)
      working = dailyUpkeep(working, working.log[0] ?? 'Parcel decision recorded.');
      break;
    }
    case 'dismissTutorial': {
      working = dismissTutorial(working);
      break;
    }
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }

  return maybeFireSeasonal(working);
}

export function buyAvailableParcel(game, parcelDef) {
  if (game.cash < parcelDef.price) throw new Error(`Need $${parcelDef.price.toLocaleString()} to buy ${parcelDef.name}.`);
  if (game.parcels.find((p) => p.id === parcelDef.id)) throw new Error(`${parcelDef.name} already owned.`);
  return {
    ...game,
    cash: game.cash - parcelDef.price,
    parcels: [
      ...game.parcels,
      { id: parcelDef.id, name: parcelDef.name, x: parcelDef.x, y: parcelDef.y, forage: parcelDef.baseForage, water: parcelDef.baseWater, threat: parcelDef.threat },
    ],
    log: [`Purchased ${parcelDef.name} for $${parcelDef.price.toLocaleString()}.`, ...game.log].slice(0, 20),
  };
}

export function getActiveCrisis(game) { return game.crisis; }

export function getAvailableActions(game) {
  const actions = [
    { type: 'train', label: 'Train a horse', requiresHorse: true, requiresStaff: true },
    { type: 'maeAdvancedTraining', label: "Mae's advanced session", requiresHorse: true, requiresStaff: false, requiresCampaigner: true },
    { type: 'vossPreventiveCare', label: "Voss: herd preventive care", requiresHorse: false, requiresStaff: false },
    { type: 'eliFindHayDeal', label: "Eli: find hay deal", requiresHorse: false, requiresStaff: false },
    { type: 'upgrade', label: 'Build / upgrade ranch', requiresHorse: false, requiresStaff: false, isUpgrade: true },
    { type: 'rotatePasture', label: 'Rotate pasture' },
    { type: 'enterShow', label: 'Enter a show', requiresHorse: true },
    { type: 'takeBoarders', label: 'Take outside boarders' },
    { type: 'refuseDeveloper', label: 'Refuse the developer' },
    { type: 'signWithDeveloper', label: 'Sign over the west meadow' },
    { type: 'breed', label: 'Queue breeding', requiresTwoHorses: true },
  ];
  if (game.pendingBreeding) actions.push({ type: 'breedInfo', label: `Foal due: ${game.pendingBreeding.sireName} × ${game.pendingBreeding.damName}` });
  if (game.cash >= VET_COST) actions.push({ type: 'vetCare', label: 'Call the vet', requiresHorse: true });
  if (game.horses.length > 1) actions.push({ type: 'sellHorse', label: 'Sell a horse (private)', requiresHorse: true, danger: true });
  if (game.horses.length > 0) actions.push({ type: 'listAtAuction', label: 'List at auction', requiresHorse: true, danger: true });
  return actions;
}

export function getGameSummary(game) {
  return `Year ${getYear(game)} ${getSeason(game)} · Day ${getDayOfSeason(game)}/${DAYS_PER_SEASON} · Cash $${game.cash.toLocaleString()} · Legacy ${game.legacy} · Rep ${game.reputation} · Dev Pressure ${game.developerPressure}`;
}

export function isGameOver(game) {
  return game.day > game.maxDay || game.cash < -1000 || game.legacy <= 0 || game.horses.length === 0;
}

export { scoreGame, checkEnding, getYear, getSeason, getDayOfSeason };
