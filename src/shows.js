// Showdown system — the ranch's purpose for training.
// Four shows per year, one per season. Each show has a category, entry fee,
// prize pool, and prestige. Player enters one horse. Score is computed
// against a generated field of regional competitors.

import { getSeason, getDayOfYear, DAYS_PER_SEASON, isSeasonBoundary, isYearBoundary } from './seasons.js';
import { canCompete, isTrainable, getLifeStage } from './horse.js';

// One show per season, on day 14 of each 30-day season block.
const SHOW_DAY = 14;

// Show categories. Each one matches a horse role archetype.
export const SHOW_CATEGORIES = {
  reining:      { label: 'Reining',          matches: ['Reining mare', 'Reining gelding', 'Reining prospect'] },
  cutting:      { label: 'Cutting',          matches: ['Cutting prospect', 'Cutting mare', 'Cutting gelding'] },
  ranch_horse:  { label: 'Working ranch horse', matches: ['Ranch gelding', 'Working cowhorse', 'Rope horse', 'Ranch horse'] },
  futurity:     { label: 'Futurity',         matches: ['2-year-old', 'Yearling'] },
  trail:        { label: 'Trail class',      matches: ['Trail horse', 'Ranch gelding'] },
  roping:       { label: 'Team roping',      matches: ['Rope horse', 'Ranch gelding', 'Working cowhorse'] },
};

export const SHOWS = [
  // Year 1
  { id: 'spring-classic-1',    year: 1, season: 'Spring', day: SHOW_DAY, category: 'reining',     entryFee: 200,  prizePool: 4000,  prestige: 1, title: 'Cedar Valley Spring Classic' },
  { id: 'summer-circuit-1',    year: 1, season: 'Summer', day: SHOW_DAY, category: 'ranch_horse', entryFee: 150,  prizePool: 2500,  prestige: 1, title: 'Pine Ridge Summer Working Class' },
  { id: 'fall-futurity-1',     year: 1, season: 'Fall',   day: SHOW_DAY, category: 'futurity',    entryFee: 300,  prizePool: 5000,  prestige: 2, title: 'North Country Futurity' },
  { id: 'winter-bred-1',       year: 1, season: 'Winter', day: SHOW_DAY, category: 'reining',     entryFee: 250,  prizePool: 3500,  prestige: 1, title: 'Iron Pine Winter Bred' },
  // Year 2
  { id: 'spring-classic-2',    year: 2, season: 'Spring', day: SHOW_DAY, category: 'cutting',     entryFee: 350,  prizePool: 6000,  prestige: 2, title: 'Sage Creek Cutting' },
  { id: 'summer-circuit-2',    year: 2, season: 'Summer', day: SHOW_DAY, category: 'roping',      entryFee: 200,  prizePool: 3500,  prestige: 1, title: 'Highline Team Roping' },
  { id: 'fall-futurity-2',     year: 2, season: 'Fall',   day: SHOW_DAY, category: 'futurity',    entryFee: 400,  prizePool: 7500,  prestige: 2, title: 'Black Mesa Futurity' },
  { id: 'winter-bred-2',       year: 2, season: 'Winter', day: SHOW_DAY, category: 'ranch_horse', entryFee: 300,  prizePool: 4500,  prestige: 1, title: 'Cold River Working Class' },
  // Year 3
  { id: 'spring-classic-3',    year: 3, season: 'Spring', day: SHOW_DAY, category: 'reining',     entryFee: 500,  prizePool: 9000,  prestige: 2, title: 'Big Sky Reining Derby' },
  { id: 'summer-circuit-3',    year: 3, season: 'Summer', day: SHOW_DAY, category: 'cutting',     entryFee: 450,  prizePool: 8000,  prestige: 2, title: 'Skogstad Summer Cutting' },
  { id: 'fall-futurity-3',     year: 3, season: 'Fall',   day: SHOW_DAY, category: 'futurity',    entryFee: 600,  prizePool: 12000, prestige: 3, title: 'National Futurity' },
  { id: 'winter-bred-3',       year: 3, season: 'Winter', day: SHOW_DAY, category: 'reining',     entryFee: 550,  prizePool: 10000, prestige: 3, title: 'Midwinter Reining Cup' },
  // Year 4
  { id: 'spring-classic-4',    year: 4, season: 'Spring', day: SHOW_DAY, category: 'roping',      entryFee: 700,  prizePool: 14000, prestige: 3, title: 'Open Range Roping Classic' },
  { id: 'summer-circuit-4',    year: 4, season: 'Summer', day: SHOW_DAY, category: 'ranch_horse', entryFee: 600,  prizePool: 11000, prestige: 2, title: 'Range Rider Championship' },
  { id: 'fall-futurity-4',     year: 4, season: 'Fall',   day: SHOW_DAY, category: 'futurity',    entryFee: 800,  prizePool: 18000, prestige: 3, title: 'All-Nations Futurity' },
  { id: 'winter-bred-4',       year: 4, season: 'Winter', day: SHOW_DAY, category: 'cutting',     entryFee: 750,  prizePool: 15000, prestige: 3, title: 'New Year Cutting' },
  // Year 5
  { id: 'spring-classic-5',    year: 5, season: 'Spring', day: SHOW_DAY, category: 'reining',     entryFee: 1000, prizePool: 25000, prestige: 3, title: 'Founders Cup Reining' },
  { id: 'summer-circuit-5',    year: 5, season: 'Summer', day: SHOW_DAY, category: 'ranch_horse', entryFee: 800,  prizePool: 20000, prestige: 3, title: 'Legacy Working Class' },
  { id: 'fall-futurity-5',     year: 5, season: 'Fall',   day: SHOW_DAY, category: 'futurity',    entryFee: 1200, prizePool: 35000, prestige: 3, title: 'Dynasty Futurity' },
  { id: 'winter-bred-5',       year: 5, season: 'Winter', day: SHOW_DAY, category: 'reining',     entryFee: 900,  prizePool: 22000, prestige: 3, title: 'Champions Cup' },
];

// Convert (year, season, day) into absolute in-game day.
export function showDay(game, year, season, day) {
  const seasonIndex = ['Spring', 'Summer', 'Fall', 'Winter'].indexOf(season);
  return (year - 1) * 120 + seasonIndex * 30 + day;
}

// Get the upcoming show (the next one in the calendar the player hasn't seen).
export function getUpcomingShow(game) {
  for (const show of SHOWS) {
    if (showDay(game, show.year, show.season, show.day) >= game.day) {
      return show;
    }
  }
  return null;
}

// All shows from year 1 through current year, with results if past.
export function getShowCalendar(game) {
  const currentAbsolute = game.day;
  return SHOWS.map((show) => {
    const absDay = showDay(game, show.year, show.season, show.day);
    const status = absDay < currentAbsolute ? 'past' : absDay === currentAbsolute ? 'today' : 'upcoming';
    return { ...show, absoluteDay: absDay, status };
  });
}

// Get the show scheduled for a specific in-game day, if any.
export function getShowOnDay(game, day) {
  for (const show of SHOWS) {
    if (showDay(game, show.year, show.season, show.day) === day) {
      return show;
    }
  }
  return null;
}

// Category match score: how well does this horse fit this category?
// 1.0 = perfect match, 0.0 = wrong category entirely.
export function categoryMatch(horse, category) {
  const cat = SHOW_CATEGORIES[category];
  if (!cat) return 0;
  if (cat.matches.includes(horse.role)) return 1.0;
  // Soft match: campaigners in reining/ranch_horse get partial credit.
  if (category === 'ranch_horse' || category === 'roping' || category === 'trail') return 0.5;
  return 0;
}

// Score a horse for a show. Higher = better chance to win.
// training is the primary driver; bond and health contribute; stress is a tax;
// category match is a multiplier; prestige affects base difficulty.
export function scoreHorse(horse, show, ranchUpgrades = {}) {
  if (!canCompete(horse)) return 0;
  const baseScore =
    horse.training * 1.2 +
    horse.bond * 0.4 +
    horse.health * 0.5 -
    horse.stress * 0.6;
  const arena = (ranchUpgrades.arena ?? 0);
  const arenaBonus = arena * 1.5;
  if (show.category === 'futurity') return Math.round(baseScore * 0.85 + arenaBonus);
  const catMatch = categoryMatch(horse, show.category);
  if (catMatch === 0) return Math.round(baseScore * 0.4 + arenaBonus);
  return Math.round((baseScore + arenaBonus) * catMatch);
}

// Generate the competitor field. Prestige scales difficulty.
// Returns an array of { name, score } sorted by score descending.
export function generateField(show, ranchUpgrades = {}, rng = Math.random) {
  const baseRange = 90 + show.prestige * 10;
  const fieldSize = 4 + show.prestige;
  const arena = ranchUpgrades.arena ?? 0;
  const NAMES = ['Cordell Hask', 'Callahan Ranch', 'Skogstad', 'Mesa Vista', 'Pine Ridge', 'Lone Star', 'Cedar Bluff', 'Black Mesa', 'Highline', 'Iron Pine'];
  const field = [];
  for (let i = 0; i < fieldSize; i++) {
    const score = Math.round((baseRange + rng() * 60) + arena * 0.5);
    field.push({ name: NAMES[i % NAMES.length], score });
  }
  return field.sort((a, b) => b.score - a.score);
}

// Run a showdown. Returns { playerScore, playerPlace, field, payout, reputationDelta, legacyDelta, log }.
export function runShowdown(horse, show, ranchUpgrades = {}, rng = Math.random) {
  const playerScore = scoreHorse(horse, show, ranchUpgrades);
  const field = generateField(show, ranchUpgrades, rng);
  const allScores = [...field.map((c) => c.score), playerScore].sort((a, b) => b - a);
  const playerPlace = allScores.indexOf(playerScore) + 1;
  const totalEntries = allScores.length;
  const topThird = Math.ceil(totalEntries / 3);
  const midThird = Math.ceil((2 * totalEntries) / 3);

  let payout = 0;
  let reputationDelta = 0;
  let legacyDelta = 0;
  let result = 'also-ran';

  if (playerPlace === 1) {
    payout = show.prizePool;
    reputationDelta = 14 + show.prestige * 4;
    legacyDelta = 4 + show.prestige;
    result = 'champion';
  } else if (playerPlace <= topThird) {
    payout = Math.round(show.prizePool * 0.4);
    reputationDelta = 8 + show.prestige * 2;
    legacyDelta = 2;
    result = 'placed';
  } else if (playerPlace <= midThird) {
    reputationDelta = 2;
    result = 'mid-pack';
  } else {
    reputationDelta = -3;
    legacyDelta = -1;
    result = 'also-ran';
  }

  return {
    playerScore,
    playerPlace,
    field,
    payout,
    reputationDelta,
    legacyDelta,
    result,
    show,
    horseName: horse.name,
    log: `${horse.name} placed #${playerPlace} of ${totalEntries} at ${show.title}. ${result === 'champion' ? 'Champion.' : result === 'placed' ? 'In the money.' : result === 'mid-pack' ? 'Middle of the pack.' : 'A long day.'}`,
  };
}

// Can this horse enter this show? (Stage and category.)
export function canEnterShow(horse, show) {
  if (!canCompete(horse)) return { ok: false, reason: `${horse.name} is not old enough to compete.` };
  // Futurity is age-based, not role-based.
  if (show.category === 'futurity') {
    const stage = getLifeStage(horse);
    if (!stage || stage.min < 2 || stage.max > 3) {
      return { ok: false, reason: `${horse.name} (age ${horse.age}) is not a futurity age.` };
    }
    return { ok: true };
  }
  if (categoryMatch(horse, show.category) === 0) return { ok: false, reason: `${horse.name} (${horse.role}) is not a fit for ${SHOW_CATEGORIES[show.category]?.label ?? show.category}.` };
  if (horse.stress > 80) return { ok: false, reason: `${horse.name} is too stressed to compete right now.` };
  return { ok: true };
}

// Premium: shows marked as 'prestige 3' or higher award reputation that
// compounds into regional standing and unlocks other events.
export function getShowPrestigeLabel(prestige) {
  if (prestige >= 3) return 'Major';
  if (prestige === 2) return 'Regional';
  return 'Local';
}
