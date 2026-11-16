import { useWorld } from '../state/worldStore.ts';
import type { Stats } from '../types/world.ts';
import { fmt } from './tools.ts';

type Row = { label: string; key: keyof Stats; unit?: string; digits?: number };

const GROUPS: ReadonlyArray<{ title: string; rows: Row[] }> = [
  {
    title: '地表',
    rows: [
      { label: '森林率', key: 'forest', unit: '%' },
      { label: '草原率', key: 'grass', unit: '%' },
      { label: '砂漠率', key: 'desert', unit: '%' },
      { label: '水域率', key: 'water', unit: '%' },
      { label: '農地率', key: 'farmland', unit: '%' },
    ],
  },
  {
    title: '地形と水',
    rows: [
      { label: '平均標高', key: 'meanElevation', unit: 'm' },
      { label: '最高標高', key: 'maxElevation', unit: 'm' },
      { label: '川の総延長', key: 'riverKm', unit: 'km' },
      { label: '湖の数', key: 'lakes' },
    ],
  },
  {
    title: '気候',
    rows: [
      { label: '平均気温', key: 'temperature', unit: '°C', digits: 1 },
      { label: '年間降水量', key: 'precipitation', unit: 'mm' },
    ],
  },
  {
    title: '動物',
    rows: [
      { label: '草食動物', key: 'herbivores', unit: '頭' },
      { label: '捕食者', key: 'predators', unit: '頭' },
    ],
  },
  {
    title: '人と経済',
    rows: [
      { label: '人口', key: 'population', unit: '人' },
      { label: '集落数', key: 'settlements' },
      { label: '都市数', key: 'cities' },
      { label: '経済規模', key: 'gdp' },
      { label: '交易量', key: 'trade' },
    ],
  },
];

/** 世界の状態。数値はセルごとの計算から集計していて、干渉する前との差も見せる。 */
export function StatsPanel() {
  const stats = useWorld((s) => s.snap?.stats);
  const baseline = useWorld((s) => s.baseline);
  if (!stats) return null;

  return (
    <section className="stats" aria-label="世界の状態">
      <h2>世界の状態</h2>
      {baseline ? <p className="note">右の差は、直前の干渉の前との比較</p> : null}
      {GROUPS.map((g) => (
        <dl key={g.title} className="group">
          <dt className="group-title">{g.title}</dt>
          {g.rows.map((r) => {
            const v = stats[r.key];
            const d = baseline ? v - baseline[r.key] : 0;
            const digits = r.digits ?? 0;
            const show = baseline && Math.abs(d) >= (digits ? 0.1 : 1);
            return (
              <div key={r.key} className="stat">
                <dt>{r.label}</dt>
                <dd>
                  <span className="num">
                    {fmt(v, digits)}
                    {r.unit ? <small>{r.unit}</small> : null}
                  </span>
                  {show ? (
                    <span className={d > 0 ? 'delta up' : 'delta down'}>
                      {d > 0 ? '+' : '−'}
                      {fmt(Math.abs(d), digits)}
                    </span>
                  ) : null}
                </dd>
              </div>
            );
          })}
        </dl>
      ))}
    </section>
  );
}
