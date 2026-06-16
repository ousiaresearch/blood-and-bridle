// Ranch upgrades. Permanent infrastructure that compounds.
// Each upgrade has 3 levels. Higher = stronger effect.

export const UPGRADES = {
  arena: {
    id: 'arena',
    label: 'Training arena',
    icon: '◊',
    description: 'Better footing and footing quality means more training progress per session.',
    effect: 'Adds +1.5 per level to horse score in shows and +1 to training gains.',
    levels: [
      { cost: 4000, trainingBonus: 1,  showBonus: 1.5, label: 'Open-air ring' },
      { cost: 7500, trainingBonus: 2,  showBonus: 3.0, label: 'Covered arena' },
      { cost: 12000, trainingBonus: 3, showBonus: 4.5, label: 'Championship arena' },
    ],
  },
  vet_clinic: {
    id: 'vet_clinic',
    label: 'Veterinary clinic',
    icon: '✚',
    description: 'On-site vet care. Voss preventive care is cheaper. Vet calls are 25% off per level.',
    effect: 'Voss preventive care: $300 base, -$100 per level. Vet call: $2600 base, -25% per level.',
    levels: [
      { cost: 5000,  vetCost: 2600, preventiveCost: 300, label: 'Stocked first-aid kit' },
      { cost: 9000,  vetCost: 1950, preventiveCost: 200, label: 'On-site clinic' },
      { cost: 15000, vetCost: 1300, preventiveCost: 100, label: 'Surgical suite' },
    ],
  },
  breeding_shed: {
    id: 'breeding_shed',
    label: 'Breeding shed',
    icon: '◐',
    description: 'A purpose-built foaling barn reduces foal mortality and improves the odds of a strong trait inheritance.',
    effect: 'Foals start with +5 health per level. Trait mutation window narrows by 5% per level.',
    levels: [
      { cost: 3500,  foalHealthBonus: 5,  mutationNarrowing: 0.05, label: 'Sturdy foaling stall' },
      { cost: 6500,  foalHealthBonus: 10, mutationNarrowing: 0.10, label: 'Mare-and-foal suite' },
      { cost: 10000, foalHealthBonus: 15, mutationNarrowing: 0.15, label: 'Stud-farm operation' },
    ],
  },
  hay_barn: {
    id: 'hay_barn',
    label: 'Hay barn',
    icon: '▥',
    description: 'Larger hay storage means a permanent feed cost reduction, year-round.',
    effect: 'Daily feed cost is reduced by 8% per level (compounds with Eli deals).',
    levels: [
      { cost: 3000, feedDiscount: 0.08, label: 'Standard barn' },
      { cost: 5500, feedDiscount: 0.16, label: 'Insulated barn' },
      { cost: 8500, feedDiscount: 0.24, label: 'Climate-controlled silo' },
    ],
  },
};

export const MAX_LEVEL = 3;

export function getUpgradeCost(upgradeId, currentLevel) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return null;
  if (currentLevel >= MAX_LEVEL) return null;
  return upgrade.levels[currentLevel]?.cost ?? null;
}

export function getUpgradeLabel(upgradeId, level) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade || level === 0) return 'Not built';
  return upgrade.levels[level - 1]?.label ?? 'Not built';
}

export function getUpgradeEffect(upgradeId, level) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade || level === 0) return null;
  return upgrade.levels[level - 1] ?? null;
}

export function canAffordUpgrade(game, upgradeId) {
  const current = game.ranchUpgrades?.[upgradeId] ?? 0;
  if (current >= MAX_LEVEL) return { ok: false, reason: 'Already at max level.' };
  const cost = getUpgradeCost(upgradeId, current);
  if (game.cash < cost) return { ok: false, reason: `Need $${cost.toLocaleString()}.` };
  return { ok: true };
}

export function applyUpgrade(game, upgradeId) {
  const check = canAffordUpgrade(game, upgradeId);
  if (!check.ok) throw new Error(check.reason);
  const current = game.ranchUpgrades[upgradeId] ?? 0;
  const cost = getUpgradeCost(upgradeId, current);
  const label = UPGRADES[upgradeId].levels[current].label;
  return {
    ...game,
    cash: game.cash - cost,
    ranchUpgrades: { ...game.ranchUpgrades, [upgradeId]: current + 1 },
    log: [`Upgraded ${UPGRADES[upgradeId].label} to ${label} ($${cost.toLocaleString()}).`, ...game.log].slice(0, 20),
  };
}

// Aggregate effect of all upgrades for a given purpose.
export function getRanchEffects(game) {
  const up = game.ranchUpgrades ?? {};
  const arena = getUpgradeEffect('arena', up.arena ?? 0);
  const vet = getUpgradeEffect('vet_clinic', up.vet_clinic ?? 0);
  const breeding = getUpgradeEffect('breeding_shed', up.breeding_shed ?? 0);
  const hay = getUpgradeEffect('hay_barn', up.hay_barn ?? 0);
  return {
    showBonus: (up.arena ?? 0) * 1.5,
    trainingBonus: up.arena ?? 0,
    vetCost: vet?.vetCost ?? 2600,
    preventiveCost: vet?.preventiveCost ?? 300,
    foalHealthBonus: breeding?.foalHealthBonus ?? 0,
    feedDiscount: hay?.feedDiscount ?? 0,
  };
}
