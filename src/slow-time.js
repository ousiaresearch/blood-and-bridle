// Blood & Bridle — the slow time (Phase 9).
//
// The off-season. The long winter. The Sunday. The bunkhouse scene.
// The ride out for no reason. The moment after the funeral.
//
// These are the moments when nothing happens and the player is just
// there. The moments that make the rest mean something.
//
// Sheridan silences. McMurtry fragments. The game is the spaces
// between the action.
//
// Pure module. No DOM. No localStorage.

// Types of slow moments
export const SLOW_MOMENTS = Object.freeze({
  OFF_SEASON: 'off_season',
  SUNDAY: 'sunday',
  BUNKHOUSE: 'bunkhouse',
  RIDE_OUT: 'ride_out',
  AFTER_FUNERAL: 'after_funeral',
  AFTER_SALE: 'after_sale',
  WINTER_EVENING: 'winter_evening',
  MORNING_BREAKFAST: 'morning_breakfast',
});

// Slow moment library. Each moment has a McCarthy-style fragment.
export const SLOW_MOMENT_LIBRARY = Object.freeze([
  {
    type: SLOW_MOMENTS.OFF_SEASON,
    seasons: ['Winter'],
    fragment: 'The off-season. The horses are in the barn. The hands are in the bunkhouse. The radio is still broken. Mae is reading a paperback. The coffee is hot.',
  },
  {
    type: SLOW_MOMENTS.SUNDAY,
    seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
    fragment: 'Sunday. The hands went to town. The bunkhouse is empty. The coffee is still on. The radio is still broken. The place is quiet enough to hear the snowmelt.',
  },
  {
    type: SLOW_MOMENTS.BUNKHOUSE,
    seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
    fragment: 'Bunkhouse scene. Eli is fixing the door. Mae is sharpening a knife. Reyes is asleep in the chair. Elena is reading the ledger. The coffee is hot enough to scald.',
  },
  {
    type: SLOW_MOMENTS.RIDE_OUT,
    seasons: ['Spring', 'Summer', 'Fall'],
    fragment: 'You ride out for no reason. The fence is good. The mares are in the south pasture. The sun is on your face. There is no reason to be out here except to be out here.',
  },
  {
    type: SLOW_MOMENTS.AFTER_FUNERAL,
    seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
    fragment: 'The funeral is over. The hands went home. The grave is fresh. The coffee is on the stove. Mae is still in her good clothes. The radio is still broken.',
  },
  {
    type: SLOW_MOMENTS.AFTER_SALE,
    seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
    fragment: 'The truck took the horse at dawn. The stall is empty. The hands fed the others without talking. The books are cleaner. The barn sounds wrong.',
  },
  {
    type: SLOW_MOMENTS.WINTER_EVENING,
    seasons: ['Winter'],
    fragment: 'Winter evening. The sun went down at four. The hands are at the table. The radio is broken. Mae is reading. Eli is sleeping. The coffee is the third pot.',
  },
  {
    type: SLOW_MOMENTS.MORNING_BREAKFAST,
    seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
    fragment: 'Morning. The hands come in from the barn. The coffee is poured. The eggs are on the table. Nobody says much. The radio is on but no one is listening.',
  },
]);

// Pick a slow moment for the current season. Returns null if no
// appropriate moment is in the library.
export function pickSlowMoment(season, recentEvents = []) {
  const candidates = SLOW_MOMENT_LIBRARY.filter((m) => m.seasons.includes(season));
  if (candidates.length === 0) return null;
  // If there was a recent funeral, prefer that moment
  if (recentEvents.includes('funeral')) {
    const afterFuneral = candidates.find((m) => m.type === SLOW_MOMENTS.AFTER_FUNERAL);
    if (afterFuneral) return afterFuneral;
  }
  // If there was a recent sale, prefer that moment
  if (recentEvents.includes('sale')) {
    const afterSale = candidates.find((m) => m.type === SLOW_MOMENTS.AFTER_SALE);
    if (afterSale) return afterSale;
  }
  // Random selection from candidates
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Build the slow-time view: the bunkhouse desk, the Sunday morning,
// the ride out. Returns the fragment and the type.
export function buildSlowTimeView(season, recentEvents = []) {
  const moment = pickSlowMoment(season, recentEvents);
  if (!moment) {
    return {
      type: null,
      fragment: null,
      available: false,
    };
  }
  return {
    type: moment.type,
    fragment: moment.fragment,
    label: momentLabel(moment.type),
    available: true,
  };
}

// Human-readable label for a moment type.
function momentLabel(type) {
  const labels = {
    off_season: 'Off-Season',
    sunday: 'Sunday',
    bunkhouse: 'Bunkhouse',
    ride_out: 'The Ride Out',
    after_funeral: 'After the Funeral',
    after_sale: 'After the Sale',
    winter_evening: 'Winter Evening',
    morning_breakfast: 'Morning',
  };
  return labels[type] ?? type;
}

// Check if a moment should fire this season. Used by the season tick
// to determine if a slow moment should appear in the log.
export function shouldFireSlowMoment(season, daysSinceLastMoment, day) {
  // Slow moments fire every ~30 days, but only on certain seasons
  if (season === 'Winter') {
    return daysSinceLastMoment >= 14;  // winter is slow, fire more often
  }
  if (season === 'Summer') {
    return daysSinceLastMoment >= 45;  // summer is busy, fire less
  }
  return daysSinceLastMoment >= 30;
}

// Get the full library of slow moments (for the renderer).
export function getSlowMomentLibrary() {
  return [...SLOW_MOMENT_LIBRARY];
}