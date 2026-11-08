/** Fixed sand-table nodes for Middle East / Gulf war monitoring. */
export type GeoNode = {
  id: string;
  name: string;
  name_en: string;
  kind: "country" | "city" | "chokepoint" | "base";
  lat: number;
  lon: number;
  focus?: boolean;
};

export const GEO_NODES: GeoNode[] = [
  { id: "iran", name: "伊朗", name_en: "Iran", kind: "country", lat: 32.4, lon: 53.7 },
  { id: "tehran", name: "德黑兰", name_en: "Tehran", kind: "city", lat: 35.7, lon: 51.4 },
  { id: "dubai", name: "迪拜", name_en: "Dubai", kind: "city", lat: 25.2, lon: 55.27, focus: true },
  { id: "uae", name: "阿联酋", name_en: "UAE", kind: "country", lat: 23.4, lon: 53.8, focus: true },
  { id: "abu_dhabi", name: "阿布扎比", name_en: "Abu Dhabi", kind: "city", lat: 24.45, lon: 54.37, focus: true },
  { id: "saudi", name: "沙特", name_en: "Saudi Arabia", kind: "country", lat: 23.9, lon: 45.1 },
  { id: "qatar", name: "卡塔尔", name_en: "Qatar", kind: "country", lat: 25.3, lon: 51.2 },
  { id: "bahrain", name: "巴林", name_en: "Bahrain", kind: "country", lat: 26.0, lon: 50.5 },
  { id: "iraq", name: "伊拉克", name_en: "Iraq", kind: "country", lat: 33.2, lon: 44.4 },
  { id: "israel", name: "以色列", name_en: "Israel", kind: "country", lat: 31.5, lon: 34.9 },
  { id: "yemen", name: "也门/胡塞", name_en: "Yemen / Houthis", kind: "country", lat: 15.5, lon: 48.5 },
  { id: "hormuz", name: "霍尔木兹海峡", name_en: "Strait of Hormuz", kind: "chokepoint", lat: 26.5, lon: 56.5 },
  { id: "red_sea", name: "红海航道", name_en: "Red Sea Lane", kind: "chokepoint", lat: 20.0, lon: 38.5 },
  { id: "persian_gulf", name: "波斯湾", name_en: "Persian Gulf", kind: "chokepoint", lat: 26.0, lon: 52.0 },
  { id: "us_5th_fleet", name: "美军第五舰队", name_en: "US 5th Fleet", kind: "base", lat: 26.2, lon: 50.6 },
  { id: "us", name: "美国(决策)", name_en: "United States", kind: "country", lat: 38.9, lon: -77.0 },
];

export const GEO_LABELS: Record<string, { zh: string; en: string }> = Object.fromEntries(
  GEO_NODES.map((n) => [n.id, { zh: n.name, en: n.name_en }]),
);

export type NodeRisk = {
  id: string;
  name: string;
  name_en: string;
  risk: number;
  why: string;
  lat: number;
  lon: number;
  kind: string;
  focus?: boolean;
};

/** Predicted chance Iran (or Iran-aligned proxies) strike / coerce a neighbor. */
export type AttackPrediction = {
  id: string;
  name: string;
  name_en: string;
  /** 1-10 likelihood Iran directly or via proxies attacks / coerces this target in near term */
  probability: number;
  /** e.g. missile / drone / proxy / cyber / blockade / unlikely */
  mode: string;
  /** near: ~2 weeks, mid: ~1-3 months */
  horizon: "near" | "mid";
  why: string;
};

/** Geopolitical spillover → asset bias (not financial advice). */
export type MarketBias = "long" | "short" | "neutral";

export type MarketView = {
  id: string;
  name: string;
  name_en: string;
  /** How strongly this asset is affected by current ME tension, 1-10 */
  impact: number;
  bias: MarketBias;
  /** Confidence in the bias call, 1-10 */
  confidence: number;
  why: string;
};

export type WarOutlook = {
  id: string;
  created_at: string;
  trajectory: "escalating" | "stable" | "deescalating";
  trajectory_score: number;
  summary_zh: string;
  dubai_risk: number;
  dubai_note: string;
  /** Highlight: Iran → Dubai attack likelihood */
  dubai_attack_probability: number;
  dubai_attack_note: string;
  attack_predictions: AttackPrediction[];
  market_summary_zh: string;
  market_views: MarketView[];
  scenarios: string[];
  watchpoints: string[];
  nodes: NodeRisk[];
  based_on: number;
};

/** Targets we ask AI to score for Iran attack likelihood */
export const ATTACK_TARGET_IDS = [
  "dubai",
  "uae",
  "abu_dhabi",
  "saudi",
  "bahrain",
  "qatar",
  "israel",
  "iraq",
  "us_5th_fleet",
  "hormuz",
] as const;

export const MARKET_ASSETS: Array<{ id: string; name: string; name_en: string }> = [
  { id: "oil", name: "原油/能源", name_en: "Oil / Energy" },
  { id: "gold", name: "黄金", name_en: "Gold" },
  { id: "usd", name: "美元指数", name_en: "US Dollar" },
  { id: "us_equity", name: "美股大盘", name_en: "US Equities" },
  { id: "defense", name: "军工股", name_en: "Defense Stocks" },
  { id: "airline", name: "航空/旅游", name_en: "Airlines / Travel" },
  { id: "gulf_equity", name: "海湾股市", name_en: "Gulf Equities" },
  { id: "dubai_property", name: "迪拜地产/相关", name_en: "Dubai Property" },
  { id: "btc", name: "比特币", name_en: "Bitcoin" },
  { id: "eth", name: "以太坊", name_en: "Ethereum" },
  { id: "crypto_beta", name: "加密高风险币", name_en: "High-beta Crypto" },
];
