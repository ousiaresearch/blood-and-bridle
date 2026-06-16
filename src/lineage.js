// Lineage tree. Build a graph from a horse's parents and offspring.

export function getParents(horse) {
  if (!horse?.parents) return [];
  return horse.parents.map((id) => id);
}

export function getOffspring(game, horseId) {
  return game.horses.filter((h) => h.parents?.includes(horseId));
}

export function getAncestors(game, horseId, depth = 3) {
  const horse = game.horses.find((h) => h.id === horseId);
  if (!horse?.parents) return [];
  const ancestors = [];
  function walk(id, d) {
    if (d <= 0) return;
    const h = game.horses.find((c) => c.id === id);
    if (!h?.parents) return;
    for (const pid of h.parents) {
      ancestors.push({ id: pid, depth: d });
      walk(pid, d - 1);
    }
  }
  for (const pid of horse.parents) {
    ancestors.push({ id: pid, depth });
    walk(pid, depth - 1);
  }
  return ancestors;
}

export function buildLineageModel(game, horseId) {
  const horse = game.horses.find((h) => h.id === horseId);
  if (!horse) return null;
  const findName = (id) => game.horses.find((h) => h.id === id)?.name ?? id;
  const parents = (horse.parents ?? []).map((id) => ({ id, name: findName(id) }));
  const offspring = getOffspring(game, horseId).map((h) => ({ id: h.id, name: h.name, age: h.age, value: h.value }));
  return { horse, parents, offspring };
}
