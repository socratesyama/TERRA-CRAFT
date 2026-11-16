import type { ActionKind, EventKind, Stats, World } from '../types/world.ts';
import { computeStats } from './metrics.ts';

export function pushEvent(world: World, kind: EventKind, message: string, chain?: string[]): void {
  world.history.push({ year: world.time, kind, message, chain });
  if (world.history.length > 240) world.history.shift();
}

const LABEL: Record<ActionKind, string> = {
  cut: '山を削った',
  raise: '盛り土をした',
  clear: '森を伐採した',
  plant: '植林した',
  dam: 'ダムを築いた',
  reclaim: '水域を埋め立てた',
  rain: '降水量を変えた',
  temp: '気温を変えた',
};

const MIDDLE: Record<ActionKind, string[]> = {
  cut: ['勾配が変わった', '水の流れが変わった'],
  raise: ['分水界が動いた', '水の流れが変わった'],
  clear: ['地表の保水力が下がった', '土砂が流れ出しやすくなった'],
  plant: ['地表の保水力が上がった', '侵食が抑えられた'],
  dam: ['川がせき止められた', '上流に水が溜まった'],
  reclaim: ['水系が変わった'],
  rain: ['水循環が変わった'],
  temp: ['蒸発と植生の適性が変わった'],
};

export function actionLabel(kind: ActionKind): string {
  return LABEL[kind];
}

export function queueEffect(world: World, kind: ActionKind): void {
  world.pending.push({
    t0: world.tick,
    kind,
    label: LABEL[kind],
    before: computeStats(world),
  });
  if (world.pending.length > 12) world.pending.shift();
}

const sign = (v: number) => (v >= 0 ? '+' : '−');

/** 干渉から数 tick 後に、何が起きたかを因果の連鎖として記録する */
export function resolvePending(world: World, now: Stats): void {
  if (world.pending.length === 0) return;
  const rest = [];
  for (const p of world.pending) {
    if (world.tick - p.t0 < 6) {
      rest.push(p);
      continue;
    }
    const b = p.before;
    const effects: string[] = [];
    const dRiver = now.riverKm - b.riverKm;
    if (Math.abs(dRiver) >= 3) effects.push(`川の延長 ${sign(dRiver)}${Math.abs(dRiver).toFixed(0)}km`);
    const dLake = now.lakes - b.lakes;
    if (dLake !== 0) effects.push(`湖 ${sign(dLake)}${Math.abs(dLake)}`);
    const dForest = now.forest - b.forest;
    if (Math.abs(dForest) >= 1) effects.push(`森林率 ${b.forest.toFixed(0)}% → ${now.forest.toFixed(0)}%`);
    const dDesert = now.desert - b.desert;
    if (Math.abs(dDesert) >= 1) effects.push(`砂漠率 ${b.desert.toFixed(0)}% → ${now.desert.toFixed(0)}%`);
    const dElev = now.meanElevation - b.meanElevation;
    if (Math.abs(dElev) >= 2) effects.push(`平均標高 ${sign(dElev)}${Math.abs(dElev).toFixed(0)}m`);
    if (b.population > 0) {
      const dPop = (now.population - b.population) / b.population;
      if (Math.abs(dPop) >= 0.05) effects.push(`人口 ${sign(dPop)}${Math.abs(dPop * 100).toFixed(0)}%`);
    }
    if (effects.length === 0) effects.push('大きな変化はまだ現れていない');
    const chain = [p.label, ...MIDDLE[p.kind], ...effects.slice(0, 3)];
    pushEvent(world, 'chain', chain.join(' → '), chain);
  }
  world.pending = rest;
}

/** 世界の状態の節目をイベントログに書き出す */
export function trackEvents(world: World, s: Stats): void {
  const m = world.memo;

  if (world.rainfall > 0 && s.riverKm > 0 && !m.riverSeen) {
    m.riverSeen = 1;
    pushEvent(world, 'river', '雨が降り、川が形成された');
  }
  const lastLakes = m.lakes ?? 0;
  if (s.lakes > lastLakes) {
    pushEvent(world, 'lake', s.lakes === 1 ? '低地に水が溜まり、湖ができた' : `湖が ${s.lakes} 個になった`);
  }
  m.lakes = s.lakes;

  const step = Math.floor(s.forest / 5);
  const lastStep = m.forestStep ?? 0;
  if (step > lastStep) {
    pushEvent(world, 'forest', `森林が拡大した（森林率 ${s.forest.toFixed(0)}%）`);
    m.forestStep = step;
  } else if (step <= lastStep - 2) {
    pushEvent(world, 'forest', `森林が減少した（森林率 ${s.forest.toFixed(0)}%）`);
    m.forestStep = step;
  }

  if (s.herbivores > 20 && !m.herbSeen) {
    m.herbSeen = 1;
    pushEvent(world, 'forest', '草地に草食動物の群れが定着した');
  }
  if (s.predators > 2 && !m.predSeen) {
    m.predSeen = 1;
    pushEvent(world, 'forest', '捕食者が現れ、食物連鎖が成立した');
  }
  m.herbPeak = Math.max(m.herbPeak ?? 0, s.herbivores);
  if (m.herbPeak > 200 && s.herbivores < m.herbPeak * 0.5 && !m.herbCrash) {
    m.herbCrash = 1;
    pushEvent(world, 'forest', '生息地が失われ、草食動物が半減した');
  }
  if (s.herbivores > (m.herbPeak ?? 0) * 0.8) m.herbCrash = 0;

  if (m.desertBase === undefined) m.desertBase = s.desert;
  if (s.desert >= m.desertBase + 4) {
    pushEvent(world, 'desert', `乾燥が進み、砂漠が広がった（砂漠率 ${s.desert.toFixed(0)}%）`);
    m.desertBase = s.desert;
  } else if (s.desert < m.desertBase - 6) {
    m.desertBase = s.desert;
  }
}
