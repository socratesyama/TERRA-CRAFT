import type { ReactNode } from 'react';

type Props = {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (v: number) => void;
  hint?: ReactNode;
};

/** ラベル・現在値・スライダーを 1 まとまりにした入力 */
export function Field({ label, value, min, max, step, current, onChange, hint }: Props) {
  return (
    <label className="field">
      <span className="field-row">
        <span>{label}</span>
        <output>{value}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}
