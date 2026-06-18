// Blood & Bridle — Weather system (Phase 5 deepening).
//
// The hand of God mechanic. Weather is not random; it has types,
// timing, severity, and a climate cycle. Drought years are not the
// same as wet years. A late frost is not the same as a blue norther.
//
// Sheridan: "The land doesn't care about the player. The land
// remembers what the player did to it."
//
// Pure module. No DOM. No localStorage.

export const WEATHER_TYPES = Object.freeze({
  NORMAL: 'normal',
  DROUGHT: 'drought',
  WET_YEAR: 'wet_year',
  BLUE_NORTHER: 'blue_norther',
  LATE_FROST: 'late_frost',
  DRY_LIGHTNING: 'dry_lightning',
  EARLY_SPRING: 'early_spring',
  HARD_WINTER: 'hard_winter',
});

// Each weather type has a season and severity profile.
export const WEATHER_PROFILES = Object.freeze({
  normal: {
    severityMin: 0.8,
    severityMax: 1.2,
    seasons: ['Spring', 'Summer', 'Fall', 'Winter'],
    description: 'A normal year. The country is what it is.',
    legacyDelta: 0,
    parcelHazardMult: 1.0,
  },
  drought: {
    severityMin: 1.4,
    severityMax: 2.2,
    seasons: ['Summer', 'Fall'],
    description: 'A drought rolled in from the south. The grass is gone to the root.',
    legacyDelta: -3,
    parcelHazardMult: 1.6,
  },
  wet_year: {
    severityMin: 1.0,
    severityMax: 1.4,
    seasons: ['Spring', 'Summer'],
    description: 'A wet year. The creek has not stopped rising.',
    legacyDelta: 0,
    parcelHazardMult: 1.3,
  },
  blue_norther: {
    severityMin: 1.3,
    severityMax: 1.8,
    seasons: ['Fall', 'Winter'],
    description: 'A blue norther came down from Canada. The horses are in the barn.',
    legacyDelta: -2,
    parcelHazardMult: 1.4,
  },
  late_frost: {
    severityMin: 1.0,
    severityMax: 1.2,
    seasons: ['Spring'],
    description: 'A late frost in May. The foals that just came are gone.',
    legacyDelta: -5,
    parcelHazardMult: 1.2,
  },
  dry_lightning: {
    severityMin: 1.0,
    severityMax: 1.3,
    seasons: ['Summer', 'Fall'],
    description: 'Dry lightning. No rain. Just strikes.',
    legacyDelta: -4,
    parcelHazardMult: 1.5,
  },
  early_spring: {
    severityMin: 0.8,
    severityMax: 1.0,
    seasons: ['Spring'],
    description: 'An early spring. The mares are foaling ahead of schedule.',
    legacyDelta: 1,
    parcelHazardMult: 0.9,
  },
  hard_winter: {
    severityMin: 1.5,
    severityMax: 2.0,
    seasons: ['Winter'],
    description: 'A hard winter. The hay lasts half what it should.',
    legacyDelta: -3,
    parcelHazardMult: 1.5,
  },
});

// Climate cycle: each year rolls for the year's weather profile.
// Most years are normal; one in four is a hardship; one in ten is
// generational. The cycle is biased: hard winters and droughts are
// the most common hardships.
export function rollYearWeather(year, randomFn = Math.random) {
  const roll = randomFn();
  if (roll < 0.10) return WEATHER_TYPES.DROUGHT;
  if (roll < 0.20) return WEATHER_TYPES.HARD_WINTER;
  if (roll < 0.30) return WEATHER_TYPES.BLUE_NORTHER;
  if (roll < 0.40) return WEATHER_TYPES.WET_YEAR;
  if (roll < 0.45) return WEATHER_TYPES.LATE_FROST;
  if (roll < 0.50) return WEATHER_TYPES.DRY_LIGHTNING;
  if (roll < 0.52) return WEATHER_TYPES.EARLY_SPRING;
  return WEATHER_TYPES.NORMAL;
}

// Get the severity multiplier for the year (used by parcel hazards,
// feed costs, and disaster rolls).
export function rollSeverity(weatherType, randomFn = Math.random) {
  const profile = WEATHER_PROFILES[weatherType] ?? WEATHER_PROFILES.normal;
  const range = profile.severityMax - profile.severityMin;
  return profile.severityMin + randomFn() * range;
}

// Build the full weather state for a year: type + severity + timing.
// Returns: { type, severity, description, legacyDelta, parcelHazardMult }
export function generateYearWeather(year, randomFn = Math.random) {
  const type = rollYearWeather(year, randomFn);
  const severity = rollSeverity(type, randomFn);
  const profile = WEATHER_PROFILES[type];
  return {
    type,
    severity,
    description: profile.description,
    legacyDelta: profile.legacyDelta,
    parcelHazardMult: profile.parcelHazardMult,
    year,
  };
}

// Initialize the weather state at game start.
export function createInitialWeather() {
  return {
    currentYear: 1,
    currentType: WEATHER_TYPES.NORMAL,
    currentSeverity: 1.0,
    yearLog: [],  // history of past years
  };
}

// Tick weather at year boundary. Returns new weather state.
export function tickWeather(weather, year, randomFn = Math.random) {
  const next = generateYearWeather(year, randomFn);
  return {
    ...weather,
    currentYear: year,
    currentType: next.type,
    currentSeverity: next.severity,
    yearLog: [...(weather.yearLog ?? []), next].slice(-10),
  };
}

// McCarthy-style weather narrative for the current year.
export function weatherNarrative(weather) {
  const profile = WEATHER_PROFILES[weather.currentType] ?? WEATHER_PROFILES.normal;
  const intensity = weather.currentSeverity < 1.0 ? 'soft'
    : weather.currentSeverity < 1.3 ? 'firm'
    : weather.currentSeverity < 1.7 ? 'hard'
    : 'generational';
  return `${intensity.charAt(0).toUpperCase() + intensity.slice(1)} year. ${profile.description}`;
}

// Check if the weather is severe enough to trigger crisis detections.
// Used by crisis.js to amplify certain triggers.
export function isSevereWeather(weather) {
  return weather.currentSeverity >= 1.3;
}