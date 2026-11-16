import type { Stats, World } from '../types/world.ts';
import { Biome } from '../types/world.ts';
import { CELL_KM, MAX_ELEVATION } from './constants.ts';
import { riverThreshold } from './water.ts';

/** 平地度 0〜1（周囲との高低差が小さいほど 1） */
export function localFlatness(height: Float32Array, x: number, y: number, size: number): number {
  const i = y * size + x;
  let m = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const d = Math.abs(height[i] - height[ny * size + nx]);
      if (d > m) m = d;
    }
  }
  return Math.max(0, 1 - m / 0.03);
}

export function countLakes(world: World): number {
  const { size, lake } = world;
  const seen = new Uint8Array(lake.length);
  const stack: number[] = [];
  let count = 0;
  for (let s = 0; s < lake.length; s++) {
    if (lake[s] <= 0 || seen[s]) continue;
    count++;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % size;
      const y = (i - x) / size;
      if (x > 0 && lake[i - 1] > 0 && !seen[i - 1]) (seen[i - 1] = 1), stack.push(i - 1);
      if (x < size - 1 && lake[i + 1] > 0 && !seen[i + 1]) (seen[i + 1] = 1), stack.push(i + 1);
      if (y > 0 && lake[i - size] > 0 && !seen[i - size]) (seen[i - size] = 1), stack.push(i - size);
      if (y < size - 1 && lake[i + size] > 0 && !seen[i + size]) (seen[i + size] = 1), stack.push(i + size);
    }
  }
  return count;
}

/** セル単位の計算から集計した統計。「それっぽい値」ではなく実際の数え上げ。 */
export function computeStats(world: World): Stats {
  const { size, height, biome, temperature, precip, population, settlement, farm } = world;
  const n = size * size;
  const thr = riverThreshold(world);
  let forest = 0;
  let grass = 0;
  let desert = 0;
  let water = 0;
  let river = 0;
  let elevSum = 0;
  let elevMax = 0;
  let landCount = 0;
  let tempSum = 0;
  let precipSum = 0;
  let pop = 0;
  let towns = 0;
  let cities = 0;
  let farmCells = 0;
  let herb = 0;
  let pred = 0;

  for (let i = 0; i < n; i++) {
    const b = biome[i];
    elevSum += height[i];
    if (height[i] > elevMax) elevMax = height[i];
    if (b === Biome.Ocean || b === Biome.Lake || b === Biome.River) water++;
    else {
      landCount++;
      tempSum += temperature[i];
      precipSum += precip[i];
    }
    if (b === Biome.River) river++;
    if (b === Biome.Forest) forest++;
    else if (b === Biome.Grassland) grass++;
    else if (b === Biome.Desert) desert++;
    if (farm[i]) farmCells++;
    herb += world.herb[i];
    pred += world.pred[i];
    pop += population[i];
    if (settlement[i] >= 1) towns++;
    if (settlement[i] === 3) cities++;
  }
  void thr;
  const pct = (v: number) => (v / n) * 100;
  return {
    forest: pct(forest),
    grass: pct(grass),
    desert: pct(desert),
    water: pct(water),
    meanElevation: (elevSum / n) * MAX_ELEVATION,
    maxElevation: elevMax * MAX_ELEVATION,
    riverKm: river * CELL_KM,
    lakes: countLakes(world),
    population: Math.round(pop),
    settlements: towns,
    cities,
    temperature: landCount ? tempSum / landCount : 0,
    precipitation: landCount ? precipSum / landCount : 0,
    farmland: pct(farmCells),
    herbivores: Math.round(herb * CELL_KM * CELL_KM),
    predators: Math.round(pred * CELL_KM * CELL_KM),
    gdp: Math.round(world.settlements.reduce((m, x) => m + x.gdp, 0)),
    trade: Math.round(world.memo.trade ?? 0),
  };
}
