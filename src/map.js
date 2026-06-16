// Land map. 4x4 grid. Parcels can be adjacent. Upgrades cost money but
// raise forage and water retention.

export const MAP_SIZE = 4;

export function buildMap(seedParcels) {
  const grid = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(null));
  // Initial parcels in fixed positions.
  const initial = {
    'west-meadow': { x: 0, y: 1 },
    'cedar-draw':  { x: 1, y: 2 },
    'home-place':  { x: 1, y: 1 },
  };
  for (const parcel of seedParcels) {
    const pos = initial[parcel.id] ?? { x: 0, y: 0 };
    grid[pos.y][pos.x] = parcel;
  }
  return grid;
}

export function neighbors(map, x, y) {
  const out = [];
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) continue;
    if (map[ny][nx]) out.push(map[ny][nx]);
  }
  return out;
}

export const AVAILABLE_PARCELS = [
  { id: 'north-bench', name: 'North Bench', x: 2, y: 0, price: 28000, baseForage: 60, baseWater: 70, threat: 'Remote access' },
  { id: 'south-creek', name: 'South Creek', x: 1, y: 3, price: 32000, baseForage: 70, baseWater: 88, threat: 'Spring flooding' },
  { id: 'far-rim',    name: 'Far Rim',     x: 3, y: 2, price: 41000, baseForage: 55, baseWater: 50, threat: 'Wildlife pressure' },
];

export function findParcel(game, parcelId) {
  return game.parcels.find((p) => p.id === parcelId);
}
