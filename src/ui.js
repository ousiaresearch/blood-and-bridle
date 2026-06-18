import { getActiveCrisis, getAvailableActions, scoreGame } from './game.js';
import { getLifeStage, INHERITABLE_TRAITS } from './horse.js';
import { getSeason, getYear, getDayOfSeason, DAYS_PER_SEASON } from './seasons.js';
import { buildLineageModel } from './lineage.js';
import { NPCS } from './npcs.js';
import { RIVALS } from './rivals.js';
import { AVAILABLE_PARCELS } from './map.js';
import { checkEnding } from './endings.js';
import { getShowCalendar, getUpcomingShow, showDay, SHOW_CATEGORIES, getShowPrestigeLabel } from './shows.js';
import { COMMUNITY_MEMBERS, availableCommunity, departedCommunity } from './community.js';

export function formatMoney(amount) {
  const absolute = Math.abs(amount).toLocaleString();
  return amount < 0 ? `-$${absolute}` : `$${absolute}`;
}

export function describeHorse(horse) {
  const stage = getLifeStage(horse);
  const injury = horse.injured ? ' · INJURED' : '';
  return `${horse.name} · ${horse.role} · ${stage?.label ?? '—'} (age ${horse.age}) · Training ${horse.training} · Bond ${horse.bond} · Health ${horse.health} · Stress ${horse.stress} · Value ${formatMoney(horse.value)}${injury}`;
}

export function describeTraits(horse) {
  if (!horse.traits) return 'No trait record';
  return Object.entries(INHERITABLE_TRAITS).map(([key, config]) => {
    const v = horse.traits[key] ?? 0;
    return `${config.label}: ${v}`;
  }).join(' · ');
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
  const ending = checkEnding(game);
  const upcoming = getUpcomingShow(game);
  const calendar = getShowCalendar(game);
  const showCalendar = calendar
    .filter((s) => s.status === 'today' || s.status === 'upcoming')
    .slice(0, 4)
    .map((s) => ({
      ...s,
      categoryLabel: SHOW_CATEGORIES[s.category]?.label ?? s.category,
      prestigeLabel: getShowPrestigeLabel(s.prestige),
      daysUntil: s.absoluteDay - game.day,
    }));

  return {
    title: 'Blood & Bridle',
    subtitle: 'A multi-year horse ranch legacy simulator',
    year: getYear(game),
    season: getSeason(game),
    dayOfSeason: getDayOfSeason(game),
    daysPerSeason: DAYS_PER_SEASON,
    crisisTitle: crisis.title,
    crisisDescription: crisis.description,
    verdict: ending ? `Ending unlocked: ${ending.label}` : getRanchVerdict(game),
    ending,
    upcomingShow: upcoming,
    showCalendar,
    score: scoreGame(game),
    pendingEvent: game.pendingEvent,
    pendingBreeding: game.pendingBreeding,
    lastShowResult: game.lastShowResult,
    metrics: [
      { label: 'Year', value: `${getYear(game)}` },
      { label: 'Season', value: getSeason(game) },
      { label: 'Day', value: `${getDayOfSeason(game)}/${DAYS_PER_SEASON}` },
      { label: 'Cash', value: formatMoney(game.cash) },
      { label: 'Legacy', value: `${game.legacy}` },
      { label: 'Reputation', value: `${game.reputation}` },
      { label: 'Developer Pressure', value: `${game.developerPressure}` },
    ],
    horses: game.horses.map((horse) => {
      const stage = getLifeStage(horse);
      return {
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
        age: horse.age,
        stage: stage?.label ?? '—',
        stageId: stage?.id ?? 'dead',
        sex: horse.sex,
        traits: horse.traits,
        parents: horse.parents,
        description: describeHorse(horse),
        traitsLine: describeTraits(horse),
      };
    }),
    staff: game.staff.map((person) => ({ ...person, line: `${person.name} · ${person.role} · Loyalty ${person.loyalty}` })),
    parcels: game.parcels.map((parcel) => ({ ...parcel, line: `${parcel.name} · Forage ${parcel.forage} · Water ${parcel.water} · Threat: ${parcel.threat}` })),
    availableParcels: AVAILABLE_PARCELS.filter((p) => !game.parcels.find((gp) => gp.id === p.id)),
    npcs: Object.values(NPCS).map((npc) => ({ ...npc, line: `${npc.name} · ${npc.role} · Relationship ${npc.relationship} · Patience ${npc.patience}` })),
    rivals: RIVALS.map((r) => ({ ...r, line: `${r.name} · Cash $${r.cash.toLocaleString()} · Reputation ${r.reputation} · Herd ${r.herd.length}` })),
    community: {
      available: availableCommunity(game.reputationCorners?.country ?? 0),
      departed: departedCommunity(game.reputationCorners?.country ?? 0),
    },
    actions: getAvailableActions(game),
    log: game.log,
    firedEvents: game.firedEvents ?? [],
  };
}

export { buildLineageModel };
