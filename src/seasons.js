// Seasonal calendar. Time is structured: 30 in-game days per season, 4 seasons
// per year. Year tick fires at 12-day mark (every season boundary).

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const DAYS_PER_SEASON = 30;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

export function getDayOfYear(game) {
  return ((game.day - 1) % DAYS_PER_YEAR) + 1;
}

export function getSeason(game) {
  return SEASONS[Math.floor((game.day - 1) / DAYS_PER_SEASON) % SEASONS.length];
}

export function getYear(game) {
  return Math.floor((game.day - 1) / DAYS_PER_YEAR) + 1;
}

export function getDayOfSeason(game) {
  return ((game.day - 1) % DAYS_PER_SEASON) + 1;
}

export function isSeasonBoundary(game) {
  return game.day > 1 && ((game.day - 1) % DAYS_PER_SEASON) === 0;
}

export function isYearBoundary(game) {
  return game.day > 1 && ((game.day - 1) % DAYS_PER_YEAR) === 0;
}

// Daily upkeep multiplier by season. Winter is harsh; spring is forgiving.
export function getSeasonalCostMultiplier(season) {
  switch (season) {
    case 'Spring': return 0.95;
    case 'Summer': return 1.0;
    case 'Fall':   return 1.05;
    case 'Winter': return 1.35;
    default:       return 1.0;
  }
}

// Seasonal events that fire on the first day of a new season.
export function getSeasonalHooks(season) {
  switch (season) {
    case 'Spring': return ['foaling', 'vaccinations_due', 'pasture_recovery'];
    case 'Summer': return ['show_circuit_open', 'breeding_optimal'];
    case 'Fall':   return ['weaning_window', 'yearling_sale_open', 'hay_harvest'];
    case 'Winter': return ['feed_cost_spike', 'weather_disaster_window'];
    default:       return [];
  }
}
