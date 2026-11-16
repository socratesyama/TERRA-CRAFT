# アーキテクチャ

```
UI (React) ── Zustand ── SimClient ── Web Worker ── simulation/engine
                 │
                 └─ Snapshot (Float32Array の複製) ── TerraScene (Three.js)
```

- 世界は `size × size` の型付き配列。添字は `y * size + x`。
- エンジンは Worker の中で動き、UI には Snapshot だけを渡す。Worker が前の計算を終えてから次を頼むので、重い世界でも画面は固まらない。
- 地形の生成もシミュレーション Worker の中で行う（計画にあった `terrain.worker.ts` は分けていない）。
- `refresh` の順序: 海 → 気温 → 降水 → 水文 → 水までの距離 → 土壌水分 → 日照 → 洪水リスク → バイオーム。
- `tick` = `refresh` → 侵食 → 植生 → 動物 → 集落と経済 → バイオーム。1 tick は 2 年。
- 共有 URL は、等高線と干渉の記録を整数に詰め、deflate して base64url にしたもの（上限 8000 文字）。
