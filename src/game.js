// Blood & Bridle — main game engine.
//
// Pure simulation. No DOM. No localStorage. Every action is a pure function
// from (game, action) -> game. State is never mutated; new state is returned.

import { tickYear, getLifeStage, isTrainable, canCompete, clamp, seedTraits, ROLE_POOL, BLOODLINE_POOL, TEMPERAMENT_POOL, INHERITABLE_TRAITS, TRAIT_KEYS, moodFor, createHorse } from './horse.js';
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
import { generateLegendaryHorse, findLegendary, maybeBondLegendary, applyLegendaryTrainingBonus, isLegendaryRidden, canSellLegendary } from './legendary.js';
import { TUTORIAL_STEPS, getCurrentTutorialStep, markStepComplete, dismissTutorial } from './tutorial.js';
import { buildMemorial } from './memorial.js';
import { DEFAULT_BRAND_ID } from './brand.js';
import { TERRAIN, PARCEL_STATE, createInitialParcels, addParcel as addParcelDef, applyParcelImprovement, tickParcelHazards, hazardDeathCircumstance, IMPROVEMENT_COSTS } from './parcels.js';
import { createInitialReputation, adjustCorners, recomputeOverallReputation, getCollapsedCorner, crewDepartureRisk, loanTerms } from './reputation.js';
import { createInitialHands, findHand, canDoTask, consumeHandHours, taskHours, resetWeeklyHours, tickHandInjuries, adjustHandsMorale, totalMonthlyWages, rollHandDepartures, workingHandCount, HAND_STATUS } from './labor.js';
import { createInitialDayWorkers, findDayWorker, rollDayWorkerAvailability, hireDayWorker, dayWorkerCost, resetDayWorkerHours, tickDayWorkerSeasons, canPromoteDayWorker, promoteDayWorker, bestDayWorkerFor, DAY_WORKER_TASKS, DAY_WORKER_TASK_NAMES } from './day-workers.js';
import { dayWorkerAvailability } from './reputation.js';
import { createInitialLedger, addExpense, addIncome, tickSeasonalEconomy, createLoan, repayLoan, totalLoanDebt, isInsolvent, insolvencyWarning, EXPENSE_CATEGORIES, INCOME_CATEGORIES, horsePriceMultiplier } from './economy.js';
import { createMoralState, skipObligation, recordSkip, tickMoralConsequences, skippedSavings, skipWarning, MORAL_CATEGORIES } from './moral.js';
import { CRISIS_TYPES, detectCrisisTriggers, pickCrisisToFire, resolveCrisis } from './crisis.js';
import { applyHeirTransition } from './heir.js';
import { createInitialWeather, tickWeather, weatherNarrative, WEATHER_TYPES } from './weather-system.js';
import { BUYER_DEFS, findBuyer, marketOffer, marketSentiment, dispersalSale } from './market.js';
import { COMMUNITY_MEMBERS, availableCommunity, departedCommunity, communityNarrative, SERVICE_COSTS, COMMUNITY_EVENTS, eventsForMonth } from './community.js';
import { createPlayer, agePlayer, injurePlayer, tickPlayerInjury, canPlayerContinue, describePlayerBody, PLAYER_STARTING_AGE } from './player.js';
import { HAND_BACKSTORIES, handSilence, seasonSilence, hasSharedStory, markStoryShared } from './hand-stories.js';
import { createInitialPersonalLife, marry, haveChild, ageChildren, ageParents, detectPersonalMilestones, describePersonalLife, PARTNER_TEMPLATES } from './personal.js';

const DAILY_BURN_BASE = 800;
const TRAINING_COST = 20;
const VET_COST = 2600;
const SHOW_WINNINGS = 6000;
const MAX_DAY = 30 * 5; // 5 years

function clone(v) { return JSON.parse(JSON.stringify(v)); }

// Apply corner adjustments and recompute the legacy single `reputation`
// field. Pure helper used by every action that touches reputation.
function withCornerAdjust(game, deltas) {
  const newCorners = adjustCorners(game.reputationCorners, deltas);
  return {
    ...game,
    reputationCorners: newCorners,
    reputation: recomputeOverallReputation(newCorners),
  };
}

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

// Pure factory moved to horse.js (createHorse) — see import above.

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

  // The legendary horse. Generated once per save. Cannot be ridden
  // until legendaryUnlockedDay. McMurtry's Hell Bitch archetype.
  const legendary = generateLegendaryHorse(Math.random, 1);

  return {
    day: 1,
    maxDay: MAX_DAY,
    cash: 18500,
    legacy: 62,
    // The single `reputation` field is the binding-constraint reading:
    // it is the minimum of the four corners. Callers should adjust
    // corners via adjustCorners and recompute via recomputeOverallReputation.
    reputation: 38,
    // The four-cornered reputation. Phase 1.3.
    reputationCorners: createInitialReputation(),
    collapsedCornerSeasons: { horsemen: 0, country: 0, bank: 0, crew: 0 },
    developerPressure: 54,
    crisis: {
      id: 'prove-ranch',
      title: 'Thirty Days to Prove the Ranch',
      description: 'A resort group wants the west parcel. The bank wants proof this place can still earn.',
    },
    horses: [...horses, legendary],
    // Ranch profile — the brand is unified with the wordmark.
    // Sheridan: wordmark and brand are the same glyph.
    ownerName: '',
    ownerPronouns: '',
    ranchName: '',
    ranchBrand: DEFAULT_BRAND_ID,
    foundedDay: 1,
    legendaryUnlockedDay: legendary.legendary.unlockedDay,
    // Legacy `staff` field — the original 3-hand view. Kept for
    // backward compat with existing actions and tests. The new
    // 5-hand system lives in `hands` below.
    staff: [
      { id: 'mae', name: 'Mae Calder', role: 'Head trainer', skill: 9, loyalty: 77, note: 'Can make a horse brave, but will not forgive cruelty.' },
      { id: 'eli', name: 'Eli Rusk', role: 'Ranch hand', skill: 6, loyalty: 58, note: 'Knows every fence line and every debt rumor.' },
      { id: 'dr-voss', name: 'Dr. Voss', role: 'Veterinarian', skill: 8, loyalty: 63, note: 'Expensive, honest, worth it when legs are at stake.' },
    ],
    // Five hands: Mae, Eli, Reyes, Elena, Voss. Full schema with
    // skills matrix, hours per week, morale, status, injury, backstory.
    hands: createInitialHands(),
    // Day-workers: the country corner made tangible. 4 recurring
    // outside laborers whose availability scales with the country
    // corner. Promotion to hand is the growth moment.
    dayWorkers: createInitialDayWorkers(),
    // Economy ledger: every expense and income tracked. Phase 2.
    ledger: createInitialLedger(),
    // Loans: outstanding bank debt. Empty by default.
    loans: [],
    // Insolvency counter: increments each season cash is below -$1000.
    // Resets when cash recovers. 3 seasons = bankruptcy.
    insolventSeasons: 0,
    // Optional insurance coverage.
    insuranceEnabled: false,
    // Stallion for stud fee income (set when a stallion is bonded).
    stallionId: null,
    stallionBonded: false,
    // The moral economy: skipped obligations and their delayed
    // consequences. Phase 3.
    moralState: createMoralState(),
    foreclosurePending: false,
    // Weather system: type + severity + history. Phase 5.
    weather: createInitialWeather(),
    // Cattlemen's association membership
    cattlemenMember: false,
    // The player: aging body. Phase 7.
    player: createPlayer(),
    // Personal life: partner, children, parents. Phase 7.
    personalLife: createInitialPersonalLife(),
    // Pregnancy tracking: array of pregnancy objects.
    pregnancies: [],
    // Seven parcels: 6 working parcels + west-meadow, which the developer
    // wants to buy. West-meadow is a regular parcel the player owns; the
    // developer's offer is on the table but unsigned.
    parcels: createInitialParcels().concat([
      {
        id: 'west-meadow',
        name: 'West Meadow',
        x: 0, y: 1,
        acres: 240,
        forage: 58,
        water: 71,
        threat: 'Resort parcel offer',
        terrain: TERRAIN.PASTURE,
        state: PARCEL_STATE.DEFAULT,
        improvement: null,
        hazard: 'drought',
        feedCapacity: 8,
        riskModifier: 0.9,
        leased: false,
        offLimits: false,
        monthlyFee: 0,
        developerOffer: 50000,
      },
    ]),
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
    memorials: [],
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
  // Tick hand injuries daily (countdown to recovery)
  if (g.hands) g = { ...g, hands: tickHandInjuries(g.hands) };
  // Tick player injury daily (countdown to recovery)
  if (g.player) g = { ...g, player: tickPlayerInjury(g.player) };
  // Tick weather at year boundary
    if (g.weather && isYearBoundary(g)) {
      const year = Math.floor((g.day - 1) / 120) + 1;
      g = { ...g, weather: tickWeather(g.weather, year) };
      const narrative = weatherNarrative(g.weather);
      g = { ...g, log: [`Year ${year}: ${narrative}`, ...g.log].slice(0, 20) };
    }
  // Year tick on year boundary
  if (isYearBoundary(g)) {
    // Snapshot the herd before the tick so we can detect who left
    // and build memorials for them.
    const prevIds = new Set(g.horses.map((h) => h.id));
    const { horses, log } = tickYear(g.horses);
    const newIds = new Set(horses.map((h) => h.id));

    // Horses that were in the herd but no longer are: build memorials
    // for natural deaths and retirements. Sold horses are handled in
    // their own action and are already recorded in their own log line.
    const newMemorials = [...(g.memorials ?? [])];
    for (const h of g.horses) {
      if (!newIds.has(h.id)) {
        // Heuristic: if the log line about them starts with "retired",
        // it's a retirement. Otherwise a death.
        const line = (log.find((l) => l.includes(h.name)) ?? '').toLowerCase();
        const kind = line.includes('retired') ? 'retirement' : 'death';
        const memorial = buildMemorial(h, { ...g, horses }, { kind });
        if (memorial) newMemorials.push(memorial);
      }
    }
    // Also detect retirements of horses still in the herd (they retire
    // in place, the log line reads "X retired from the campaign").
    for (const h of horses) {
      if (!prevIds.has(h.id)) continue; // newly born, skip
      const line = (log.find((l) => l.includes(h.name)) ?? '').toLowerCase();
      if (line.includes('retired from the campaign')) {
        const memorial = buildMemorial(h, { ...g, horses }, { kind: 'retirement' });
        if (memorial) newMemorials.push(memorial);
      }
    }

    g = { ...g, horses, log: [...log, ...g.log].slice(0, 20), memorials: newMemorials.slice(-20) };
  }
  // Season boundary: rivals, disasters, parcel hazards, events, contracts
  if (isSeasonBoundary(g)) {
    g = tickRivals(g);
    const { disaster, game: g2 } = rollDisaster(g);
    g = g2;
    // Parcel hazards: per-parcel terrain-driven. Weather severity is
    // amplified when a global disaster of the same flavor fires
    // (drought year, hard winter, etc.). Herd losses build memorials.
    const weatherSeverity = disaster
      ? (disaster.id === 'drought' ? 1.6 : disaster.id === 'flood' ? 1.4 : disaster.id === 'blizzard' ? 1.5 : 1.2)
      : 1.0;
    const season = getSeason(g);
    const hazardResult = tickParcelHazards(g.parcels, g.horses, season, weatherSeverity);
    g = { ...g, parcels: hazardResult.parcels };
    // Apply cash cost
    if (hazardResult.parcelCost > 0) {
      g = { ...g, cash: g.cash - hazardResult.parcelCost };
      g = {
        ...g,
        ledger: addExpense(g.ledger, {
          category: EXPENSE_CATEGORIES.HAZARD,
          amount: hazardResult.parcelCost,
          season: getSeason(g),
          day: g.day,
          note: 'Parcel hazard cleanup',
        }),
      };
    }
    // Apply injuries (health drop) — non-cumulative: injured horses
    // get health -15 if not already injured.
    if (hazardResult.injured.length > 0) {
      const injuredIds = new Set(hazardResult.injured.map((h) => h.id));
      g = {
        ...g,
        horses: g.horses.map((h) => injuredIds.has(h.id)
          ? { ...h, injured: true, health: clamp(h.health - 15) }
          : h),
      };
    }
    // Apply deaths: build memorials, remove from herd.
    if (hazardResult.killed.length > 0) {
      const killedIds = new Set(hazardResult.killed.map((h) => h.id));
      const newMemorials = [...(g.memorials ?? [])];
      for (const h of g.horses) {
        if (killedIds.has(h.id)) {
          const memorial = buildMemorial(h, g, { kind: 'death', circumstance: hazardDeathCircumstance(h, g) });
          if (memorial) newMemorials.push(memorial);
        }
      }
      g = {
        ...g,
        horses: g.horses.filter((h) => !killedIds.has(h.id)),
        memorials: newMemorials.slice(-20),
        legacy: clamp(g.legacy - 4),
      };
    }
    // Push log lines from parcel hazards and herd losses
    if (hazardResult.parcelHazardLog.length > 0) {
      g = { ...g, log: [...hazardResult.parcelHazardLog, ...g.log].slice(0, 20) };
    }
    // Corner collapse tracking: when a corner hits 0, increment the
    // season counter. After 3 consecutive seasons at 0, the corner
    // is collapsed (Phase 4.2 will surface the ending variant).
    const corners = g.reputationCorners;
    const newCollapsedSeasons = { ...(g.collapsedCornerSeasons ?? {}) };
    for (const corner of ['horsemen', 'country', 'bank', 'crew']) {
      if ((corners?.[corner] ?? 0) <= 0) {
        newCollapsedSeasons[corner] = (newCollapsedSeasons[corner] ?? 0) + 1;
      } else {
        newCollapsedSeasons[corner] = 0;
      }
    }
    g = { ...g, collapsedCornerSeasons: newCollapsedSeasons };
    // Seasonal economy tick: every season boundary, the ranch's
    // scheduled expenses and income fire. Feed, wages, farrier,
    // property tax, equipment, hay harvest, stud fees, grazing lease.
    // weatherSeverity is amplified when a global disaster fires.
    const econResult = tickSeasonalEconomy({ ...g, ledger: g.ledger }, weatherSeverity);
    g = {
      ...g,
      cash: g.cash + econResult.cashDelta,
      ledger: econResult.ledger,
      loans: econResult.loans,
      insolventSeasons: econResult.insolventSeasons,
    };
    if (econResult.logLines.length > 0) {
      g = { ...g, log: [...econResult.logLines, ...g.log].slice(0, 20) };
    }
    // Moral consequences: every season, the skipped obligations fire
    // their delayed effects. Foot rot, hand departures, foreclosure.
    if (g.moralState && g.moralState.skips.length > 0) {
      const moralResult = tickMoralConsequences(g.moralState, g);
      g = { ...g, moralState: moralResult.moralState };
      if (moralResult.horseEffects.length > 0) {
        for (const eff of moralResult.horseEffects) {
          if (eff.remove) {
            // Horse died from skipped vet
            const horse = g.horses.find((h) => h.id === eff.horseId);
            if (horse) {
              const memorial = buildMemorial(horse, g, { kind: 'death', circumstance: 'The vet should have been called.' });
              g = {
                ...g,
                horses: g.horses.filter((h) => h.id !== eff.horseId),
                memorials: [...(g.memorials ?? []), memorial].slice(-20),
                legacy: clamp(g.legacy - 4),
              };
            }
          } else {
            // Horse injured
            g = {
              ...g,
              horses: g.horses.map((h) => h.id === eff.horseId
                ? { ...h, health: clamp(h.health + (eff.healthDelta ?? 0)), stress: clamp(h.stress + (eff.stressDelta ?? 0)) }
                : h),
            };
          }
        }
      }
      if (moralResult.handEffects.length > 0) {
        for (const eff of moralResult.handEffects) {
          if (eff.type === 'departure') {
            g = {
              ...g,
              hands: g.hands.map((h) => h.id === eff.handId ? { ...h, status: HAND_STATUS.GONE } : h),
            };
          }
        }
      }
      if (Object.keys(moralResult.cornerAdjustments).length > 0) {
        g = withCornerAdjust(g, moralResult.cornerAdjustments);
      }
      if (moralResult.logLines.length > 0) {
        g = { ...g, log: [...moralResult.logLines, ...g.log].slice(0, 20) };
      }
    }
    // Crisis detection: every season, check if conditions are met
    // for a crisis to fire. The player gets to choose.
    if (!g.pendingCrisis && Math.random() < 0.15) {
      const triggers = detectCrisisTriggers(g);
      const crisis = pickCrisisToFire(triggers, g.day);
      if (crisis) {
        g = { ...g, pendingCrisis: crisis };
      }
    }
    // Day-worker availability: the country corner decides who shows up.
    // Each day-worker in the static roster (gate met) rolls for whether
    // they're available this season. Seasons worked increments for
    // those who showed up.
    if (g.dayWorkers) {
      const countryCorner = g.reputationCorners?.country ?? 50;
      const rolled = rollDayWorkerAvailability(g.dayWorkers, countryCorner, dayWorkerAvailability);
      const ticked = tickDayWorkerSeasons(rolled);
      g = { ...g, dayWorkers: ticked };
      // Log: who's here this season
      const here = ticked.filter((d) => d.availableThisSeason).map((d) => d.name);
      const missing = ticked.filter((d) => !d.promoted && !d.availableThisSeason && d.availabilityGate <= countryCorner).map((d) => d.name);
      const inRoster = ticked.filter((d) => !d.promoted && d.availabilityGate <= countryCorner).length;
      const inPasture = ticked.filter((d) => !d.promoted && d.availabilityGate > countryCorner).length;
      const logLines = [];
      if (here.length > 0) logLines.push(`Day-help on the place: ${here.join(', ')}.`);
      if (missing.length > 0) logLines.push(`No sign of ${missing.join(' or ')} this season.`);
      if (inPasture > 0 && countryCorner < 30) {
        logLines.push(`The country is shut. No one new will come.`);
      }
      if (logLines.length > 0) {
        g = { ...g, log: [...logLines, ...g.log].slice(0, 20) };
      }
    }
    // Hand departures: each season, roll for hands leaving based on
    // crew corner and individual morale. A collapsed crew corner is
    // a guaranteed departure.
    if (g.hands) {
      const crewCorner = g.reputationCorners?.crew ?? 50;
      const crewRisk = crewDepartureRisk(crewCorner);
      const beforeHands = g.hands.filter((h) => h.status === HAND_STATUS.WORKING).length;
      const afterHands = rollHandDepartures(g.hands, crewRisk);
      const lostHands = beforeHands - afterHands.filter((h) => h.status === HAND_STATUS.WORKING).length;
      if (lostHands > 0) {
        const lostNames = afterHands
          .filter((h) => h.status === HAND_STATUS.GONE && g.hands.find((x) => x.id === h.id)?.status === HAND_STATUS.WORKING)
          .map((h) => h.name)
          .join(' and ');
        g = {
          ...g,
          hands: afterHands,
          log: [`${lostNames} walked off the place. The bunkhouse is short.`, ...g.log].slice(0, 20),
        };
      } else {
        g = { ...g, hands: afterHands };
      }
    }
    // Reset weekly hours at season boundary (rough alignment)
    if (g.hands) g = { ...g, hands: resetWeeklyHours(g.hands) };
    if (g.dayWorkers) g = { ...g, dayWorkers: resetDayWorkerHours(g.dayWorkers) };
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
      const staffId = action.staffId ?? 'mae';
      const staff = findStaff(working, staffId);
      if (!isTrainable(horse)) {
        const stage = getLifeStage(horse);
        throw new Error(`${horse.name} is too ${stage?.id === 'foal' || stage?.id === 'weanling' ? 'young' : 'old'} to train (${stage?.label}).`);
      }
      // Legendary gate: the picturebook horse cannot be ridden before unlock day.
      if (!isLegendaryRidden(working, horse)) {
        throw new Error(`${horse.name} will not be ridden before day ${horse.legendary.unlockedDay}. She decides.`);
      }
      // Labor-hours: the selected hand must be available, able, and
      // have hours left this week. (Phase 1.4)
      if (working.hands) {
        const hand = findHand(working.hands, staffId);
        const can = canDoTask(hand, 'train');
        if (!can.ok) throw new Error(can.reason);
        working.hands = working.hands.map((h) => h.id === staffId ? consumeHandHours(h, 'train') : h);
      }
      const skillBonus = Math.max(3, Math.round(staff.skill / 2));
      working.cash -= TRAINING_COST;
      working.horses = working.horses.map((h) => {
        if (h.id !== horse.id) return h;
        const bonded = maybeBondLegendary(h);
        const trained = applyLegendaryTrainingBonus(bonded);
        return {
          ...trained,
          training: clamp(trained.training + skillBonus + 1),
          bond: clamp(trained.bond + 6),
          stress: clamp(trained.stress + 3),
        };
      });
      working = markStepComplete(working, 'train');
      working = dailyUpkeep(working, `${staff.name} worked ${horse.name} in the dust-lit arena.`);
      break;
    }
    case 'rotatePasture': {
      working.horses = working.horses.map((h) => ({ ...h, stress: clamp(h.stress - 13) }));
      working.parcels = working.parcels.map((p) => ({ ...p, forage: clamp(p.forage + 9) }));
      if (working.hands) {
        // Rotation: try each working hand in turn (highest fencing first).
        // First hand with hours available takes the work. If none, the
        // rotation still happens — the labor system soft-fails.
        const candidates = [...working.hands]
          .filter((h) => h.status === HAND_STATUS.WORKING && (h.skills?.fencing ?? 0) >= 5)
          .sort((a, b) => (b.skills?.fencing ?? 0) - (a.skills?.fencing ?? 0));
        for (const c of candidates) {
          if (c.hoursThisWeek + 8 <= c.hoursPerWeek) {
            working.hands = working.hands.map((h) => h.id === c.id ? consumeHandHours(h, 'rotatePasture') : h);
            break;
          }
        }
      }
      working = markStepComplete(working, 'rotate');
      working = dailyUpkeep(working, 'Rotated the herd through fresh pasture.');
      break;
    }
    case 'vetCare': {
      const horse = findHorse(working, action.horseId);
      if (working.cash < VET_COST) throw new Error('Not enough cash for vet care.');
      if (working.hands) {
        const hand = findHand(working.hands, 'cordell-voss');
        const can = canDoTask(hand, 'vetCare');
        if (!can.ok) throw new Error(can.reason);
        working.hands = working.hands.map((h) => h.id === 'cordell-voss' ? consumeHandHours(h, 'vetCare') : h);
      }
      working.cash -= VET_COST;
      working = withCornerAdjust(working, { bank: 1, crew: 2 }); // paid the vet, hands see you care
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
      // Legendary gate: the picturebook horse cannot be sold before bonded.
      const legCheck = canSellLegendary(working, horse);
      if (!legCheck.ok) throw new Error(legCheck.reason);
      // Apply horsemen-corner price multiplier
      const horsemenCorner = working.reputationCorners?.horsemen ?? 50;
      const priceMult = horsePriceMultiplier(horsemenCorner);
      const salePrice = Math.round(horse.value * priceMult);
      working.cash += salePrice;
      working.ledger = addIncome(working.ledger, {
        category: INCOME_CATEGORIES.HORSE_SALE,
        amount: salePrice,
        season: getSeason(working),
        day: working.day,
        note: `Sold ${horse.name} privately (${Math.round(priceMult * 100)}% of value)`,
      });
      working.legacy = clamp(working.legacy - 12);
      // Selling a horse reads as a defeat. Horsemen notice, the crew
      // feels it, the country hears. The bank is briefly happy.
      working = withCornerAdjust(working, { horsemen: -2, crew: -4, bank: 1 });
      working.staff = working.staff.map((s) => ({ ...s, loyalty: clamp(s.loyalty - (s.id === 'mae' ? 12 : 6)) }));
      const memorial = buildMemorial(horse, working, { kind: 'sold', circumstance: `Sold privately at age ${horse.age} for $${salePrice.toLocaleString()}.` });
      working.horses = working.horses.filter((h) => h.id !== horse.id);
      working.memorials = [...(working.memorials ?? []), memorial].slice(-20);
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
      // Show result feeds the horsemen corner primarily; the crew gets
      // a small bump from proving the horse on the circuit.
      const horsemenDelta = result.reputationDelta ?? 0;
      working = withCornerAdjust(working, { horsemen: horsemenDelta, crew: horsemenDelta > 0 ? 1 : -1 });
      working.legacy = Math.max(0, Math.min(100, working.legacy + result.legacyDelta));
      // Log the entry fee and prize to the ledger.
      working.ledger = addExpense(working.ledger, {
        category: EXPENSE_CATEGORIES.OTHER,
        amount: show.entryFee,
        season: getSeason(working),
        day: working.day,
        note: `Entry fee: ${show.title}`,
      });
      if (result.payout > 0) {
        working.ledger = addIncome(working.ledger, {
          category: INCOME_CATEGORIES.SHOW_WINNINGS,
          amount: result.payout,
          season: getSeason(working),
          day: working.day,
          note: `Show prize: ${show.title}`,
        });
      }
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
      // Refusing the developer is a country-and-horsemen play. The
      // bank briefly resents the foregone cash.
      working = withCornerAdjust(working, { country: 4, horsemen: 1, bank: -1 });
      recordNpcMemory(working, 'dev-coleman', 'refused');
      adjustRelationship('dev-coleman', -8);
      adjustPatience('dev-coleman', -10);
      working = dailyUpkeep(working, 'Refused the resort parcel offer. The family table went quiet.');
      break;
    }
    case 'signWithDeveloper': {
      const parcel = working.parcels.find((p) => p.id === 'west-meadow');
      if (!parcel) throw new Error('West meadow is no longer in your hands.');
      const salePrice = 50000;
      working.cash += salePrice;
      working.ledger = addIncome(working.ledger, {
        category: INCOME_CATEGORIES.DEVELOPER_SALE,
        amount: salePrice,
        season: getSeason(working),
        day: working.day,
        note: 'Sold west meadow to the developer',
      });
      working.legacy = clamp(working.legacy - 25);
      working.developerPressure = 0;
      working.parcels = working.parcels.filter((p) => p.id !== 'west-meadow');
      working.crisis = { ...working.crisis, resolved: 'sold-to-developer' };
      // The bank loves the cash. The country, the horsemen, and the
      // crew all lose a little. This is the high-cash, low-reputation
      // play. Sheridan: the moment the ranch stops being a ranch.
      working = withCornerAdjust(working, { bank: 8, country: -10, horsemen: -4, crew: -3 });
      recordNpcMemory(working, 'dev-coleman', 'signed');
      adjustRelationship('dev-coleman', 30);
      working = dailyUpkeep(working, 'Signed the west meadow over to Reyes. The bank is happy. The legacy is thinner.');
      break;
    }
    case 'takeBoarders': {
      working.cash += 2200;
      working.legacy = clamp(working.legacy - 3);
      working.horses = working.horses.map((h) => ({ ...h, stress: clamp(h.stress + 5) }));
      working.ledger = addIncome(working.ledger, {
        category: INCOME_CATEGORIES.BOARDING,
        amount: 2200,
        season: getSeason(working),
        day: working.day,
        note: 'Took three outside boarders',
      });
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
      if (working.hands) {
        const hand = findHand(working.hands, 'mae');
        const can = canDoTask(hand, 'maeAdvancedTraining');
        if (!can.ok) throw new Error(can.reason);
        working.hands = working.hands.map((h) => h.id === 'mae' ? consumeHandHours(h, 'maeAdvancedTraining') : h);
      }
      working.cash -= 50;
      working.horses = working.horses.map((h) => h.id === horse.id ? maeAdvancedTraining(h) : h);
      working = dailyUpkeep(working, `Mae pushed ${horse.name} through an advanced session.`);
      break;
    }
    case 'eliFindHayDeal': {
      if (working.hands) {
        const hand = findHand(working.hands, 'eli');
        const can = canDoTask(hand, 'eliFindHayDeal');
        if (!can.ok) throw new Error(can.reason);
        working.hands = working.hands.map((h) => h.id === 'eli' ? consumeHandHours(h, 'eliFindHayDeal') : h);
      }
      working.cash -= 200;
      working.hayDealDaysLeft = 30;
      working = dailyUpkeep(working, 'Eli found a hay deal. Feed costs are down for 30 days.');
      break;
    }
    case 'vossPreventiveCare': {
      if (working.cash < 300) throw new Error('Need $300 for preventive care.');
      if (working.hands) {
        const hand = findHand(working.hands, 'cordell-voss');
        const can = canDoTask(hand, 'vossPreventiveCare');
        if (!can.ok) throw new Error(can.reason);
        working.hands = working.hands.map((h) => h.id === 'cordell-voss' ? consumeHandHours(h, 'vossPreventiveCare') : h);
      }
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
      working.ledger = addIncome(working.ledger, {
        category: INCOME_CATEGORIES.AUCTION_SALE,
        amount: result.topBid.offer,
        season: getSeason(working),
        day: working.day,
        note: `Sold ${horse.name} at auction to ${result.topBid.name}`,
      });
      const memorial = buildMemorial(horse, working, { kind: 'auctioned', circumstance: `Sold at auction to ${result.topBid.name} for $${result.topBid.offer.toLocaleString()}.` });
      working.horses = working.horses.filter((h) => h.id !== horse.id);
      working.memorials = [...(working.memorials ?? []), memorial].slice(-20);
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
    case 'hireDayWorker': {
      const { dayWorkerId, task } = action;
      const dw = findDayWorker(working.dayWorkers, dayWorkerId);
      const cost = dayWorkerCost(dw, task);
      if (working.cash < cost) throw new Error(`Need $${cost} to hire ${dw.name} for ${task}.`);
      working.cash -= cost;
      working.dayWorkers = hireDayWorker(working.dayWorkers, dayWorkerId, task);
      working = withCornerAdjust(working, { country: 1 }); // hiring locals helps the country
      working = dailyUpkeep(working, `${dw.name} worked ${DAY_WORKER_TASKS[task].label.toLowerCase()} for $${cost}.`);
      break;
    }
    case 'promoteDayWorker': {
      const { dayWorkerId } = action;
      const dw = findDayWorker(working.dayWorkers, dayWorkerId);
      const countryCorner = working.reputationCorners?.country ?? 0;
      // Vacancy = at most 5 working hands (the original 5 minus any GONE)
      const workingHandCount2 = working.hands.filter((h) => h.status === HAND_STATUS.WORKING).length;
      const hasVacancy = workingHandCount2 < 5;
      const check = canPromoteDayWorker(dw, countryCorner, hasVacancy);
      if (!check.ok) throw new Error(check.reason);
      const result = promoteDayWorker(working.dayWorkers, dayWorkerId, working.hands);
      working.dayWorkers = result.dayWorkers;
      working.hands = result.hands;
      working = withCornerAdjust(working, { country: 5 }); // commitment to the place
      working = dailyUpkeep(working, result.log);
      break;
    }
    case 'bankLoan': {
      const { amount } = action;
      const bankCorner = working.reputationCorners?.bank ?? 0;
      const terms = loanTerms(bankCorner);
      if (!terms.available) throw new Error('The bank will not lend to you.');
      const outstanding = totalLoanDebt(working.loans);
      if (outstanding + amount > terms.maxLoan) {
        throw new Error(`The bank will only lend $${(terms.maxLoan - outstanding).toLocaleString()} more.`);
      }
      const newLoan = createLoan(amount, terms.interestRate, 90, working.day); // 90-day term
      working.loans = [...(working.loans ?? []), newLoan];
      working.cash += amount;
      working.ledger = addIncome(working.ledger, {
        category: INCOME_CATEGORIES.LOAN_DISBURSEMENT,
        amount,
        season: getSeason(working),
        day: working.day,
        note: `Bank loan at ${(terms.interestRate * 100).toFixed(1)}% APR`,
      });
      // Bank corner gains from borrowing (you trust them with their money)
      working = withCornerAdjust(working, { bank: 2 });
      working = dailyUpkeep(working, `Borrowed $${amount.toLocaleString()} from the bank at ${(terms.interestRate * 100).toFixed(1)}% APR.`);
      break;
    }
    case 'repayLoan': {
      const { loanId, amount } = action;
      const loanIdx = working.loans.findIndex((l) => l.id === loanId);
      if (loanIdx < 0) throw new Error(`Loan not found: ${loanId}`);
      const loan = working.loans[loanIdx];
      if (amount > working.cash) throw new Error(`Need $${amount.toLocaleString()} to repay.`);
      const { loan: newLoan, amountToPrincipal } = repayLoan(loan, amount);
      working.loans = working.loans.map((l, i) => i === loanIdx ? newLoan : l);
      working.cash -= amountToPrincipal;
      working.ledger = addExpense(working.ledger, {
        category: EXPENSE_CATEGORIES.LOAN_FEE,
        amount: amountToPrincipal,
        season: getSeason(working),
        day: working.day,
        note: `Loan repayment`,
      });
      // Bank corner gains from repaying
      working = withCornerAdjust(working, { bank: 1 });
      working = dailyUpkeep(working, `Repaid $${amountToPrincipal.toLocaleString()} on the loan.`);
      break;
    }
    case 'toggleInsurance': {
      working.insuranceEnabled = !working.insuranceEnabled;
      working = dailyUpkeep(working, working.insuranceEnabled
        ? 'Bought insurance from the county agent. The premium is due quarterly.'
        : 'Let the insurance lapse. The risk is yours now.');
      break;
    }
    case 'resolveCrisis': {
      if (!working.pendingCrisis) throw new Error('No crisis to resolve.');
      const result = resolveCrisis(working.pendingCrisis, action.optionIndex, working);
      working = result.game;
      working = withCornerAdjust(working, result.cornerDeltas ?? {});
      working.pendingCrisis = null;
      working.log = [result.log, ...working.log].slice(0, 20);
      working = dailyUpkeep(working, working.log[0]);
      break;
    }
    case 'dismissCrisis': {
      working.pendingCrisis = null;
      working = dailyUpkeep(working, 'Dismissed the crisis without action.');
      break;
    }
    case 'transitionToHeir': {
      working = applyHeirTransition(working);
      working = dailyUpkeep(working, working.log[0] ?? 'Transitioned to the heir.');
      break;
    }
    case 'skipObligation': {
      const { category, horseId } = action;
      const skip = skipObligation(working, category, horseId);
      working.cash += skip.savings;
      working.moralState = recordSkip(working.moralState, {
        ...skip,
        category,
        day: working.day,
        season: getSeason(working),
      });
      // The skip has immediate reputation consequences too.
      working = withCornerAdjust(working, skip.consequence.reputationEffect ?? {});
      working.ledger = addIncome(working.ledger, {
        category: 'skipped_obligation',
        amount: skip.savings,
        season: getSeason(working),
        day: working.day,
        note: `Skipped: ${skip.consequence.label}`,
      });
      working = dailyUpkeep(working, `${skip.consequence.logLine} Saved $${skip.savings.toLocaleString()}.`);
      break;
    }
    case 'improveParcel': {
      const { parcelId, improvement } = action;
      const newParcels = applyParcelImprovement(working.parcels, parcelId, improvement, working.cash);
      const def = IMPROVEMENT_COSTS[improvement];
      working.parcels = newParcels;
      working.cash -= def.cash;
      // Labor-hours: improvements consume the worker-hours defined in
      // the IMPROVEMENT_COSTS table. Eli is the default for fence /
      // clearing work; for drainage / irrigation, whoever has the
      // higher combined skill is selected.
      if (working.hands) {
        const laborHours = def.laborHours;
        // Find the best hand for this terrain's improvement
        const bestHand = working.hands
          .filter((h) => h.status === HAND_STATUS.WORKING)
          .sort((a, b) => (b.skills?.fencing ?? 0) - (a.skills?.fencing ?? 0))[0];
        if (bestHand && bestHand.hoursThisWeek + laborHours <= bestHand.hoursPerWeek) {
          working.hands = working.hands.map((h) => h.id === bestHand.id ? consumeHandHours(h, 'improveParcel', laborHours) : h);
        }
      }
      // Land improvements are a country play. The neighbors see you
      // mending fences. The bank sees the spend. The crew is steady.
      working = withCornerAdjust(working, { country: 3, bank: -1, crew: 1 });
      working = dailyUpkeep(working, `${def.label}. The land remembers.`);
      break;
    }
    case 'dismissTutorial': {
      working = dismissTutorial(working);
      break;
    }
    case 'updateRanchProfile': {
      const p = action.profile ?? {};
      working = {
        ...working,
        ownerName: typeof p.ownerName === 'string' ? p.ownerName.slice(0, 48) : working.ownerName,
        ownerPronouns: typeof p.ownerPronouns === 'string' ? p.ownerPronouns.slice(0, 32) : working.ownerPronouns,
        ranchName: typeof p.ranchName === 'string' ? p.ranchName.slice(0, 48) : working.ranchName,
        ranchBrand: typeof p.ranchBrand === 'string' ? p.ranchBrand : working.ranchBrand,
      };
      working = dailyUpkeep(working, `Stamped the brand at the gate. ${working.ranchName || 'The ranch'} rides under a new mark.`);
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
    parcels: addParcelDef(game.parcels, parcelDef),
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
  if (isInsolvent(game)) return true;
  return game.day > game.maxDay || game.cash < -1000 || game.legacy <= 0 || game.horses.length === 0;
}

export { scoreGame, checkEnding, getYear, getSeason, getDayOfSeason };
