import { getActiveCrisis, getAvailableActions, scoreGame } from './game.js';

export function formatMoney(amount) {
  const absolute = Math.abs(amount).toLocaleString();
  return amount < 0 ? `-$${absolute}` : `$${absolute}`;
}

export function describeHorse(horse) {
  const injury = horse.injured ? ' · INJURED' : '';
  return `${horse.name} · ${horse.role} · Training ${horse.training} · Bond ${horse.bond} · Health ${horse.health} · Stress ${horse.stress} · Value ${formatMoney(horse.value)}${injury}`;
}

export function getRanchVerdict(game) {
  if (game.cash >= 45000 && game.legacy >= 75 && game.reputation >= 60) {
    return 'Defensible legacy: not safe, never safe, but strong enough to tell the suits no.';
  }

  if (game.cash < 5000 || game.legacy < 25) {
    return 'Bleeding out: every choice now is triage, and triage has no romance.';
  }

  if (game.developerPressure >= 80) {
    return 'Under siege: the resort money has found leverage, and leverage learns fast.';
  }

  return 'Vulnerable legacy: the ranch still has a pulse, but the bank can hear it falter.';
}

export function buildDashboardModel(game) {
  const crisis = getActiveCrisis(game);

  return {
    title: 'Blood & Bridle',
    subtitle: 'A 30-day horse ranch legacy simulator MVP',
    crisisTitle: crisis.title,
    crisisDescription: crisis.description,
    verdict: getRanchVerdict(game),
    score: scoreGame(game),
    metrics: [
      { label: 'Day', value: `${game.day}/${game.maxDay}` },
      { label: 'Cash', value: formatMoney(game.cash) },
      { label: 'Legacy', value: `${game.legacy}` },
      { label: 'Reputation', value: `${game.reputation}` },
      { label: 'Developer Pressure', value: `${game.developerPressure}` },
    ],
    horses: game.horses.map((horse) => ({
      id: horse.id,
      name: horse.name,
      role: horse.role,
      bloodline: horse.bloodline,
      temperament: horse.temperament,
      training: horse.training,
      bond: horse.bond,
      health: horse.health,
      stress: horse.stress,
      value: formatMoney(horse.value),
      injured: horse.injured,
      description: describeHorse(horse),
    })),
    staff: game.staff.map((person) => `${person.name} · ${person.role} · Loyalty ${person.loyalty}`),
    parcels: game.parcels.map((parcel) => `${parcel.name} · Forage ${parcel.forage} · Water ${parcel.water} · Threat: ${parcel.threat}`),
    actions: getAvailableActions(game),
    log: game.log,
  };
}
