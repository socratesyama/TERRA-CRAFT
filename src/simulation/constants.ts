export const WORLD_VERSION = 1;

/** 1 tick が表す年数 */
export const TICK_YEARS = 2;
export const SEA_LEVEL = 0.1;
/** 正規化標高 1.0 に対応するメートル */
export const MAX_ELEVATION = 2400;
/** 1 セルの一辺 [km] */
export const CELL_KM = 1.2;

export const EPS = 1e-5;
/** 川と見なす集水量の閾値（降水量 1000mm = 1 の単位で、集水セル数におおよそ一致） */
export const RIVER_FLOW = 40;
export const LAKE_MIN_DEPTH = 0.0015;
export const LAKE_MIN_INFLOW = 20;
/** 湖 1 セルを通過するたびに失われる流量の割合（蒸発・取水） */
export const LAKE_LOSS = 0.985;

export const SIZES = { low: 128, standard: 192, high: 256 } as const;

export const MAX_SETTLEMENTS = 40;
export const CITY_POP = 2500;
export const TOWN_POP = 600;
