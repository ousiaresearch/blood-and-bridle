// Authored event library. Events fire when their state-driven gate returns true.
// State is checked against the live game + NPC memory at season boundaries.

import { getSeason, getYear, isSeasonBoundary } from './seasons.js';
import { NPCS } from './npcs.js';

export const EVENTS = [
  {
    id: 'dev-second-offer',
    title: 'Reyes returns with paperwork',
    // McCarthy inversion: straight quotes stripped. The line reads as
    // voice, not as transcription.
    body: 'Last offer, neighbor. I do not enjoy doing this the other way.',
    severity: 'major',
    gate: (game) =>
      (NPCS['dev-coleman'].memory.refused ?? 0) >= 1 &&
      getSeason(game) === 'Fall' &&
      getYear(game) >= 1 &&
      !(game.firedEvents ?? []).includes('dev-second-offer'),
    options: [
      { label: 'Sign over the west meadow', effect: { cash: 50000, legacy: -25, developerPressure: -100, soldParcel: 'west-meadow' } },
      { label: 'Refuse again', effect: { developerPressure: 30, legacy: 8, firedEvent: 'dev-second-offer-refused' } },
    ],
  },
  {
    id: 'cordell-trade-offer',
    title: 'Cordell Hask at the fence',
    body: 'You ever want a fresh stallion for one season, I got a King Fritz colt I can lend. Trade for hay through winter.',
    severity: 'minor',
    gate: (game) =>
      (NPCS['ranch-cordell'].memory.helped ?? 0) >= 1 &&
      getSeason(game) === 'Fall' &&
      !(game.firedEvents ?? []).includes('cordell-trade-offer'),
    options: [
      { label: 'Accept the loan', effect: { cash: -800, legacy: 4, firedEvent: 'cordell-loan-accepted' } },
      { label: 'Decline politely', effect: { firedEvent: 'cordell-loan-declined' } },
    ],
  },
  {
    id: 'banker-warning',
    title: 'Letter from Ortega',
    body: 'Cash on hand is now below three months of operating cost. We need to talk about a line of credit, not an extension.',
    severity: 'major',
    gate: (game) =>
      game.cash < 2400 &&
      getSeason(game) === 'Summer' &&
      !(game.firedEvents ?? []).includes('banker-warning'),
    options: [
      { label: 'Accept the line of credit', effect: { cash: 8000, developerPressure: 12, firedEvent: 'banker-line-accepted' } },
      { label: 'Refuse and sell a horse', effect: { legacy: -8, firedEvent: 'banker-refused' } },
    ],
  },
  {
    id: 'vet-second-opinion',
    title: 'Dr. Voss calls after hours',
    body: 'I looked at the colt\'s x-rays again. The lesion is worse than I told you. You should know before the sale.',
    severity: 'minor',
    gate: (game) =>
      (NPCS['vet-voss'].memory.consulted ?? 0) >= 2 &&
      game.horses.some((h) => h.injured) &&
      getSeason(game) === 'Spring',
    options: [
      { label: 'Pull the horse from the sale', effect: { legacy: 6, firedEvent: 'vet-pulled-horse' } },
      { label: 'Sell anyway', effect: { cash: 2000, legacy: -10, firedEvent: 'vet-sold-anyway' } },
    ],
  },
  {
    id: 'sister-asks',
    title: 'Elena at the kitchen table',
    body: 'I can come help for a season. The kids would love it. But I need to know this place is going to be here when I arrive.',
    severity: 'major',
    gate: (game) =>
      game.legacy >= 60 &&
      (NPCS['sister-elena'].memory.asked ?? 0) === 0 &&
      getSeason(game) === 'Spring' &&
      getYear(game) >= 1,
    options: [
      { label: 'Ask her to come', effect: { legacy: 10, firedEvent: 'sister-arrives-summer', staffJoined: 'elena' } },
      { label: 'Tell her to wait', effect: { firedEvent: 'sister-waiting' } },
    ],
  },
  {
    id: 'callahan-purchases-buyer',
    title: 'A Callahan truck at the sale barn',
    body: 'Your mare is in our ring. I would not get your hopes up.',
    severity: 'minor',
    gate: (game) =>
      (NPCS['rival-callahan'].memory.outbid ?? 0) >= 1 &&
      getSeason(game) === 'Fall',
    options: [
      { label: 'Bid anyway', effect: { cash: -5000, legacy: 5, firedEvent: 'callahan-bid-anyway' } },
      { label: 'Let them have it', effect: { firedEvent: 'callahan-let-go' } },
    ],
  },
];

// Decide which event (if any) fires at this season boundary.
export function tickEvents(game) {
  if (!isSeasonBoundary(game)) return { ...game, pendingEvent: null };
  const fired = game.firedEvents ?? [];

  for (const event of EVENTS) {
    if (fired.includes(event.id)) continue;
    if (event.gate(game)) {
      return { ...game, pendingEvent: event };
    }
  }

  return { ...game, pendingEvent: null };
}

export function resolveEvent(game, optionIndex) {
  const event = game.pendingEvent;
  if (!event) return game;
  const option = event.options[optionIndex];
  if (!option) return game;

  const next = { ...game, pendingEvent: null, firedEvents: [...(game.firedEvents ?? []), event.id] };
  const effect = option.effect ?? {};

  for (const [key, value] of Object.entries(effect)) {
    if (key === 'cash') next.cash = (next.cash ?? 0) + value;
    else if (key === 'legacy') next.legacy = Math.max(0, Math.min(100, (next.legacy ?? 0) + value));
    else if (key === 'developerPressure') next.developerPressure = Math.max(0, Math.min(100, (next.developerPressure ?? 0) + value));
    else if (key === 'soldParcel') next.parcels = next.parcels.filter((p) => p.id !== value);
    else if (key === 'staffJoined' && !next.staff.find((s) => s.id === value)) {
      next.staff = [
        ...next.staff,
        { id: value, name: 'Elena', role: 'Family hand', skill: 7, loyalty: 80, note: 'Will not quit, but will tell you when you are wrong.' },
      ];
    } else if (key === 'firedEvent' && !next.firedEvents.includes(value)) {
      next.firedEvents.push(value);
    } else {
      next[key] = value;
    }
  }

  next.log = [`${event.title}: chose "${option.label}".`, ...(next.log ?? [])].slice(0, 20);
  return next;
}
