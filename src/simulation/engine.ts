import type {
  Action,
  ContourStroke,
  ShareState,
  Snapshot,
  World,
} from '../types/world.ts';
import { generateHeightfield } from '../terrain/heightfield.ts';
import { TICK_YEARS, SEA_LEVEL, WORLD_VERSION, CELL_KM } from './constants.ts';
import {
  computeMoisture,
  computePrecipitation,
  computeSunlight,
  computeTemperature,
} from './climate.ts';
import { classifyBiomes, growVegetation } from './ecology.ts';
import { erodeTerrain } from './erosion.ts';
import { updateFauna } from './fauna.ts';
import { queueEffect, resolvePending, trackEvents } from './events.ts';
import { computeStats } from './metrics.ts';
import { computeFloodRisk, updateSettlements } from './settlement.ts';
import { applyTool } from './tools.ts';
import { computeHydrology, computeWaterDistance, riverThreshold } from './water.ts';

export function createWorld(size = 192, seed = 1): World {
  const n = size * size;
  return {
    version: WORLD_VERSION,
    size,
    cellSize: CELL_KM,
    seed,
    time: 0,
    tick: 0,
    height: new Float32Array(n),
    water: new Float32Array(n),
    lake: new Float32Array(n),
    sediment: new Float32Array(n),
    moisture: new Float32Array(n),
    temperature: new Float32Array(n),
    precip: new Float32Array(n),
    sunlight: new Float32Array(n),
    vegetation: new Float32Array(n),
    herb: new Float32Array(n),
    pred: new Float32Array(n),
    biome: new Uint8Array(n),
    settlement: new Uint8Array(n),
    population: new Float32Array(n),
    road: new Float32Array(n),
    farm: new Uint8Array(n),
    dam: new Float32Array(n),
    risk: new Float32Array(n),
    waterDist: new Float32Array(n).fill(1e6),
    seaLevel: SEA_LEVEL,
    rainfall: 0,
    temperatureBias: 0,
    erosionRate: 1,
    vegetationGrowthRate: 0.12,
    settlementGrowthRate: 1,
    strokes: [],
    actions: [],
    settlements: [],
    history: [],
    hydro: {
      filled: new Float32Array(n),
      receiver: new Int32Array(n).fill(-1),
      order: new Int32Array(n),
      ocean: new Uint8Array(n),
    },
    memo: {},
    pending: [],
  };
}

/** 等高線から地形を作り直す。時間・植生・集落は初期化されるが、降水量と気温の設定は引き継ぐ。 */
export function setStrokes(world: World, strokes: ContourStroke[]): void {
  const keepRain = world.rainfall;
  const keepTemp = world.temperatureBias;

  world.strokes = strokes.map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) }));
  world.height = generateHeightfield(world.strokes, { size: world.size, seed: world.seed });
  for (const key of [
    'water', 'lake', 'sediment', 'moisture', 'temperature', 'precip', 'sunlight',
    'vegetation', 'herb', 'pred', 'biome', 'settlement', 'population', 'road', 'farm', 'dam', 'risk',
  ] as const) {
    world[key].fill(0);
  }
  world.waterDist.fill(1e6);
  world.time = 0;
  world.tick = 0;
  world.actions = [];
  world.settlements = [];
  world.history = [];
  world.memo = {};
  world.pending = [];
  world.rainfall = 0;
  world.temperatureBias = 0;

  if (keepRain !== 0) applyAction(world, { t: 0, k: 'rain', x: 0, y: 0, r: 0, v: keepRain });
  if (keepTemp !== 0) applyAction(world, { t: 0, k: 'temp', x: 0, y: 0, r: 0, v: keepTemp });
  refresh(world);
}

function updateOcean(world: World): void {
  const { height, hydro, seaLevel } = world;
  for (let i = 0; i < height.length; i++) hydro.ocean[i] = height[i] < seaLevel ? 1 : 0;
}

/** 時間を進めずに、派生する量（水・気候・バイオーム）だけを最新にする。 */
export function refresh(world: World): void {
  updateOcean(world);
  computeTemperature(world);
  computePrecipitation(world);
  computeHydrology(world);
  computeWaterDistance(world);
  computeMoisture(world);
  computeSunlight(world);
  computeFloodRisk(world);
  classifyBiomes(world);
}

/** 1 tick（= TICK_YEARS 年）進める */
export function tick(world: World): void {
  refresh(world);
  if (world.rainfall > 0) erodeTerrain(world);
  growVegetation(world);
  updateFauna(world);
  updateSettlements(world);
  classifyBiomes(world);

  world.time += TICK_YEARS;
  world.tick += 1;

  if (world.tick % 2 === 0) {
    const stats = computeStats(world);
    trackEvents(world, stats);
    resolvePending(world, stats);
  }
}

export function stepTicks(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) tick(world);
}

/** 干渉を適用して記録する。記録は URL からの復元に使う。 */
export function applyAction(world: World, action: Omit<Action, 't'> & { t?: number }): void {
  const a: Action = { ...action, t: world.tick };
  // 同じ tick に同じ設定を何度も変えたときは、最後の値だけ残す
  const last = world.actions[world.actions.length - 1];
  if ((a.k === 'rain' || a.k === 'temp') && last && last.k === a.k && last.t === a.t) {
    world.actions[world.actions.length - 1] = a;
  } else if (world.actions.length < 400) {
    world.actions.push(a);
  }
  if (a.k !== 'rain' && a.k !== 'temp') queueEffect(world, a.k);
  applyTool(world, a);
  refresh(world);
}

export function snapshot(world: World): Snapshot {
  const stats = computeStats(world);
  return {
    size: world.size,
    time: world.time,
    tick: world.tick,
    seaLevel: world.seaLevel,
    rainfall: world.rainfall,
    temperatureBias: world.temperatureBias,
    height: world.height.slice(),
    water: world.water.slice(),
    lake: world.lake.slice(),
    sediment: world.sediment.slice(),
    moisture: world.moisture.slice(),
    temperature: world.temperature.slice(),
    precip: world.precip.slice(),
    sunlight: world.sunlight.slice(),
    vegetation: world.vegetation.slice(),
    herb: world.herb.slice(),
    pred: world.pred.slice(),
    biome: world.biome.slice(),
    settlement: world.settlement.slice(),
    population: world.population.slice(),
    road: world.road.slice(),
    farm: world.farm.slice(),
    risk: world.risk.slice(),
    riverThreshold: riverThreshold(world),
    stats,
    settlements: world.settlements.map((s) => ({ ...s })),
    events: world.history.slice(-80),
  };
}

export function exportState(world: World): ShareState {
  return {
    v: WORLD_VERSION,
    seed: world.seed,
    size: world.size,
    strokes: world.strokes,
    actions: world.actions,
    rainfall: world.rainfall,
    temperatureBias: world.temperatureBias,
    time: world.time,
  };
}

/** 共有された状態から、同じ世界を復元する（決定的なので、再生すれば一致する） */
export function restoreWorld(state: ShareState, onProgress?: (ratio: number) => void): World {
  const world = createWorld(state.size, state.seed);
  setStrokes(world, state.strokes);
  const targetTick = Math.round(state.time / TICK_YEARS);
  const actions = state.actions.slice().sort((a, b) => a.t - b.t);
  for (const a of actions) {
    while (world.tick < a.t) tick(world);
    applyAction(world, a);
    onProgress?.(world.tick / Math.max(1, targetTick));
  }
  while (world.tick < targetTick) {
    tick(world);
    if (world.tick % 5 === 0) onProgress?.(world.tick / Math.max(1, targetTick));
  }
  refresh(world);
  return world;
}
