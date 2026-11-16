import { useUi } from '../state/uiStore.ts';
import { LAYERS, layerLegend } from '../terrain/colors.ts';

export function LayerPanel() {
  const layer = useUi((s) => s.layer);
  const showContours = useUi((s) => s.showContours);
  const showSettlements = useUi((s) => s.showSettlements);
  const showFauna = useUi((s) => s.showFauna);
  const set = useUi((s) => s.set);
  const active = LAYERS.find((l) => l.id === layer)!;
  const legend = layerLegend(layer);

  return (
    <section aria-label="レイヤー">
      <h2>見え方</h2>
      <div className="chips" role="radiogroup" aria-label="レイヤー">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            role="radio"
            aria-checked={layer === l.id}
            className="btn chip"
            onClick={() => set({ layer: l.id })}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="note">{active.note}</p>
      <ul className="legend">
        {legend.map((l) => (
          <li key={l.label}>
            <span className="swatch" style={{ background: l.color }} />
            {l.label}
          </li>
        ))}
      </ul>
      <div className="checks">
        <label>
          <input type="checkbox" checked={showContours} onChange={(e) => set({ showContours: e.target.checked })} />
          描いた等高線
        </label>
        <label>
          <input type="checkbox" checked={showSettlements} onChange={(e) => set({ showSettlements: e.target.checked })} />
          集落と道路
        </label>
        <label>
          <input type="checkbox" checked={showFauna} onChange={(e) => set({ showFauna: e.target.checked })} />
          動物の群れ
        </label>
      </div>
    </section>
  );
}
