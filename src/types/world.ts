export type Vec2 = { x: number; y: number };

/** バイオーム ID（enum を使わず const オブジェクトで表す） */
export const Biome = {
  Ocean: 0,
  Lake: 1,
  River: 2,
  Wetland: 3,
  Coast: 4,
  Desert: 5,
  Grassland: 6,
  Forest: 7,
  Mountain: 8,
  Alpine: 9,
  Snow: 10,
} as const;
export type BiomeId = (typeof Biome)[keyof typeof Biome];

/** 等高線。points は 0〜1 に正規化した座標なのでグリッド解像度に依存しない */
export type ContourStroke = {
  id: string;
  points: Vec2[];
  /** 0〜1 の正規化標高 */
  elevation: number;
  /** 0〜1 に正規化した太さ（マップ幅に対する割合） */
  width: number;
};

export type ActionKind =
  | 'cut' // 山削り
  | 'raise' // 盛り土
  | 'clear' // 伐採
  | 'plant' // 植林
  | 'dam' // ダム
  | 'reclaim' // 埋め立て
  | 'rain' // 降水量の変更
  | 'temp'; // 気温の変更

/** ユーザーの干渉。再生すれば同じ世界が復元できる */
export type Action = {
  /** 適用時の tick 番号 */
  t: number;
  k: ActionKind;
  /** 0〜1 の正規化座標 */
  x: number;
  y: number;
  /** 半径（セル数） */
  r: number;
  v?: number;
};

export type EventKind =
  | 'river'
  | 'lake'
  | 'forest'
  | 'desert'
  | 'settlement'
  | 'city'
  | 'flood'
  | 'abandon'
  | 'erosion'
  | 'action'
  | 'chain';

export type WorldEvent = {
  year: number;
  kind: EventKind;
  message: string;
  /** 因果の連鎖（「山を削った → 勾配が変わった → …」） */
  chain?: string[];
};

export type Settlement = {
  x: number;
  y: number;
  pop: number;
  founded: number;
  /** 1: 村 2: 町 3: 都市 */
  level: 1 | 2 | 3;
  /** 経済規模（人口 × 生産性） */
  gdp: number;
  /** 海に面した港かどうか */
  port: boolean;
  /** 市場アクセス（他の集落の経済規模を輸送費で割り引いた合計） */
  market: number;
};

export type Stats = {
  forest: number;
  grass: number;
  desert: number;
  water: number;
  meanElevation: number;
  maxElevation: number;
  riverKm: number;
  lakes: number;
  population: number;
  settlements: number;
  cities: number;
  temperature: number;
  precipitation: number;
  farmland: number;
  herbivores: number;
  predators: number;
  gdp: number;
  trade: number;
};

export type Hydro = {
  /** 窪地を埋めた後の水面高さ */
  filled: Float32Array;
  /** 水の流れ先（-1 は排水口：海または地図端） */
  receiver: Int32Array;
  /** 下流から上流への処理順（受け手が必ず先に現れる） */
  order: Int32Array;
  /** 海マスク */
  ocean: Uint8Array;
};

export type World = {
  version: number;
  size: number;
  cellSize: number;
  seed: number;
  /** 年 */
  time: number;
  /** tick 番号 */
  tick: number;

  height: Float32Array;
  /** 河川の流量（集水量） */
  water: Float32Array;
  /** 湖の水深 */
  lake: Float32Array;
  sediment: Float32Array;
  moisture: Float32Array;
  /** 気温 [°C] */
  temperature: Float32Array;
  /** 年間降水量 [mm] */
  precip: Float32Array;
  sunlight: Float32Array;
  vegetation: Float32Array;
  /** 草食動物の密度 [頭/km²] */
  herb: Float32Array;
  /** 捕食者の密度 [頭/km²] */
  pred: Float32Array;
  biome: Uint8Array;
  settlement: Uint8Array;
  population: Float32Array;
  road: Float32Array;
  farm: Uint8Array;
  /** ダムによる水面のかさ上げ */
  dam: Float32Array;
  /** 洪水リスク 0〜1 */
  risk: Float32Array;
  /** 最寄りの水域までの距離 [セル] */
  waterDist: Float32Array;

  seaLevel: number;
  rainfall: number;
  temperatureBias: number;
  erosionRate: number;
  vegetationGrowthRate: number;
  settlementGrowthRate: number;

  strokes: ContourStroke[];
  actions: Action[];
  settlements: Settlement[];
  history: WorldEvent[];
  hydro: Hydro;
  /** 内部のイベント管理用メモ */
  memo: Record<string, number>;
  pending: PendingEffect[];
};

export type PendingEffect = {
  t0: number;
  kind: ActionKind;
  label: string;
  before: Stats;
};

/** UI に渡すスナップショット（読み取り専用の配列コピー） */
export type Snapshot = {
  size: number;
  time: number;
  tick: number;
  seaLevel: number;
  rainfall: number;
  temperatureBias: number;
  height: Float32Array;
  water: Float32Array;
  lake: Float32Array;
  sediment: Float32Array;
  moisture: Float32Array;
  temperature: Float32Array;
  precip: Float32Array;
  sunlight: Float32Array;
  vegetation: Float32Array;
  herb: Float32Array;
  pred: Float32Array;
  biome: Uint8Array;
  settlement: Uint8Array;
  population: Float32Array;
  road: Float32Array;
  farm: Uint8Array;
  risk: Float32Array;
  riverThreshold: number;
  stats: Stats;
  settlements: Settlement[];
  events: WorldEvent[];
};

export type ShareState = {
  v: number;
  seed: number;
  size: number;
  strokes: ContourStroke[];
  actions: Action[];
  rainfall: number;
  temperatureBias: number;
  time: number;
};
