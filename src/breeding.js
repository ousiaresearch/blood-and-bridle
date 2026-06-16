// Breeding system. Two compatible horses are bred; 11 months later (in spring
// of the next year, in this 30-day-per-month compressed calendar) a foal is
// born with inherited traits and recorded parents.

import { getLifeStage, makeFoal } from './horse.js';

export const GESTATION_DAYS = 11; // 11 of the 30 in-game days = ~11 months

export function canBreed(sire, dam) {
  if (!sire || !dam) return { ok: false, reason: 'Missing horse.' };
  if (sire.id === dam.id) return { ok: false, reason: 'Cannot breed a horse to itself.' };
  if (sire.sex === dam.sex) return { ok: false, reason: 'Need one stallion and one mare.' };
  if (sire.age < 4 || sire.age > 12) return { ok: false, reason: `${sire.name} is past breeding age.` };
  if (dam.age < 4 || dam.age > 12) return { ok: false, reason: `${dam.name} is past breeding age.` };
  if (sire.injured || dam.injured) return { ok: false, reason: 'Cannot breed an injured horse.' };
  if (sire.stress > 80 || dam.stress > 80) return { ok: false, reason: 'Both horses need to be calmer first.' };
  return { ok: true };
}

export function queueBreeding(game, sireId, damId) {
  const sire = game.horses.find((h) => h.id === sireId);
  const dam = game.horses.find((h) => h.id === damId);
  const check = canBreed(sire, dam);
  if (!check.ok) throw new Error(check.reason);

  return {
    ...game,
    pendingBreeding: {
      sireId,
      damId,
      sireName: sire.name,
      damName: dam.name,
      dueDay: game.day + GESTATION_DAYS,
    },
    log: [`Queued breeding: ${sire.name} x ${dam.name}. Foal due in 11 months.`, ...game.log].slice(0, 20),
  };
}

// Check if any foal is due. Called at year tick.
export function deliverFoals(game) {
  if (!game.pendingBreeding) return { game, delivered: [] };

  const due = game.pendingBreeding.dueDay <= game.day;
  if (!due) return { game, delivered: [] };

  const sire = game.horses.find((h) => h.id === game.pendingBreeding.sireId);
  const dam = game.horses.find((h) => h.id === game.pendingBreeding.damId);
  if (!sire || !dam) {
    return {
      game: { ...game, pendingBreeding: null, log: ['Breeding aborted: parent no longer in the herd.', ...game.log].slice(0, 20) },
      delivered: [],
    };
  }

  const sex = Math.random() < 0.5 ? 'male' : 'female';
  const foalName = nameFoal(sex);
  const foal = makeFoal({
    name: foalName,
    sex,
    sire,
    dam,
    bloodline: `${sire.name} x ${dam.name}`,
  });

  return {
    game: {
      ...game,
      pendingBreeding: null,
      horses: [...game.horses, foal],
      log: [`${foal.name} arrived — a ${sex === 'male' ? 'colt' : 'filly'} by ${sire.name} out of ${dam.name}.`, ...game.log].slice(0, 20),
    },
    delivered: [foal],
  };
}

const COLT_NAMES = ['Iron Pine', 'Stormy Ledger', 'High Sage', 'Cardinal Boy', 'Red Echo', 'Cold Fire'];
const FILLY_NAMES = ['Tallulah', 'June Bug', 'Sundown Lass', 'Wild Mercy', 'Aspen Belle', 'Vermilion'];

export function nameFoal(sex) {
  const pool = sex === 'male' ? COLT_NAMES : FILLY_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
