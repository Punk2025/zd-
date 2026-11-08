import { extractJson, pickText } from "./ai";
import {
  ATTACK_TARGET_IDS,
  GEO_NODES,
  MARKET_ASSETS,
  type AttackPrediction,
  type MarketBias,
  type MarketView,
  type NodeRisk,
  type WarOutlook,
} from "./geo";

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

const SYSTEM = `你是中东地缘与宏观交叉分析官。根据近期新闻，同时给出：
1) 美伊冲突走向；2) 伊朗攻击周边可能性（迪拜必评）；3) 对经济/股市/加密货币的影响与多空倾向。

这是开源情报与宏观情景判断，不是投资建议，不是确定性预言。信息不足时保守并写明不确定。

只输出合法 JSON，禁止 markdown，禁止思考过程：
{
  "trajectory": "escalating|stable|deescalating",
  "trajectory_score": 1-10,
  "summary_zh": "120-220字中文总览",
  "dubai_risk": 1-10,
  "dubai_note": "迪拜被波及说明",
  "dubai_attack_probability": 1-10,
  "dubai_attack_note": "伊朗攻击迪拜可能性说明",
  "attack_predictions": [
    {"id":"dubai","probability":4,"mode":"missile/drone|proxy|cyber|blockade|coercion|unlikely","horizon":"near|mid","why":"..."}
  ],
  "market_summary_zh": "80-140字：本轮冲突对风险资产/避险资产总判断",
  "market_views": [
    {"id":"oil","impact":8,"bias":"long|short|neutral","confidence":6,"why":"中文原因"}
  ],
  "scenarios": ["情景1","情景2","情景3"],
  "watchpoints": ["观察点1","观察点2"],
  "nodes": [{"id":"dubai","risk":6,"why":"..."}]
}

规则：
- attack_predictions 必须包含: dubai, uae, abu_dhabi, saudi, bahrain, qatar, israel, iraq, us_5th_fleet, hormuz
- market_views 必须包含: oil, gold, usd, us_equity, defense, airline, gulf_equity, dubai_property, btc, eth, crypto_beta
- bias: long=偏多, short=偏空, neutral=观望/震荡
- impact=受地缘影响强度1-10；confidence=对该多空判断的把握1-10
- 紧张升级时通常：油/金偏多、航空偏空、加密常作风险资产偏空（除非资金避险叙事极强）
- 全部说明用简体中文`;

function clamp(n: number, lo = 1, hi = 10): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function asTrajectory(v: unknown): WarOutlook["trajectory"] {
  const s = String(v || "");
  if (s === "escalating" || s === "deescalating" || s === "stable") return s;
  return "stable";
}

function asHorizon(v: unknown): "near" | "mid" {
  return String(v) === "mid" ? "mid" : "near";
}

function asBias(v: unknown): MarketBias {
  const s = String(v || "").toLowerCase();
  if (s === "long" || s === "short" || s === "neutral") return s;
  if (s.includes("多")) return "long";
  if (s.includes("空")) return "short";
  return "neutral";
}

export async function saveOutlook(db: D1Database, outlook: WarOutlook): Promise<void> {
  await db
    .prepare(
      `INSERT INTO war_outlook
       (id, created_at, trajectory, trajectory_score, summary_zh, dubai_risk, dubai_note, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      outlook.id,
      outlook.created_at,
      outlook.trajectory,
      outlook.trajectory_score,
      outlook.summary_zh,
      outlook.dubai_risk,
      outlook.dubai_note,
      JSON.stringify(outlook),
    )
    .run();

  await db
    .prepare(
      `DELETE FROM war_outlook WHERE id NOT IN (
         SELECT id FROM war_outlook ORDER BY created_at DESC LIMIT 30
       )`,
    )
    .run();
}

export async function latestOutlook(db: D1Database): Promise<WarOutlook | null> {
  const row = await db
    .prepare(`SELECT payload_json FROM war_outlook ORDER BY created_at DESC LIMIT 1`)
    .first<{ payload_json: string }>();
  if (!row?.payload_json) return null;
  try {
    return JSON.parse(row.payload_json) as WarOutlook;
  } catch {
    return null;
  }
}

async function recentArticleBriefs(db: D1Database, limit = 18): Promise<string[]> {
  const rows = await db
    .prepare(
      `SELECT title_zh, summary_zh, title_original, source, urgency, published_at
       FROM articles
       WHERE relevant = 1 OR urgency IS NOT NULL
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{
      title_zh: string | null;
      summary_zh: string | null;
      title_original: string;
      source: string;
      urgency: number | null;
      published_at: string | null;
    }>();

  return (rows.results ?? []).map((a, i) => {
    const title = a.title_zh || a.title_original;
    const sum = a.summary_zh || "";
    return `${i + 1}. [${a.source}] u=${a.urgency ?? "?"} ${title} | ${sum}`.slice(0, 280);
  });
}

function mergeNodes(rawNodes: unknown): NodeRisk[] {
  const byId = new Map<string, { risk: number; why: string }>();
  if (Array.isArray(rawNodes)) {
    for (const n of rawNodes) {
      if (!n || typeof n !== "object") continue;
      const o = n as Record<string, unknown>;
      const id = String(o.id || "");
      if (!GEO_NODES.some((g) => g.id === id)) continue;
      byId.set(id, {
        risk: clamp(Number(o.risk) || 3),
        why: String(o.why || "暂无细则").slice(0, 200),
      });
    }
  }

  return GEO_NODES.map((g) => {
    const hit = byId.get(g.id);
    return {
      id: g.id,
      name: g.name,
      name_en: g.name_en,
      kind: g.kind,
      lat: g.lat,
      lon: g.lon,
      focus: g.focus,
      risk: hit?.risk ?? (g.focus ? 5 : 3),
      why: hit?.why ?? (g.focus ? "信息不足，按海湾敏感节点给中性评估" : "未显著提及"),
    };
  });
}

function mergeAttackPredictions(raw: unknown): AttackPrediction[] {
  const byId = new Map<string, { probability: number; mode: string; horizon: "near" | "mid"; why: string }>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = String(o.id || "");
      if (!(ATTACK_TARGET_IDS as readonly string[]).includes(id)) continue;
      byId.set(id, {
        probability: clamp(Number(o.probability) || 3),
        mode: String(o.mode || "unlikely").slice(0, 40),
        horizon: asHorizon(o.horizon),
        why: String(o.why || "信息不足").slice(0, 220),
      });
    }
  }

  return ATTACK_TARGET_IDS.map((id) => {
    const meta = GEO_NODES.find((g) => g.id === id)!;
    const hit = byId.get(id);
    return {
      id,
      name: meta.name,
      name_en: meta.name_en,
      probability: hit?.probability ?? (id === "dubai" || id === "uae" ? 4 : 3),
      mode: hit?.mode ?? "unlikely",
      horizon: hit?.horizon ?? "near",
      why: hit?.why ?? "暂无足够公开信息，按保守基线评估",
    };
  }).sort((a, b) => b.probability - a.probability);
}

function mergeMarketViews(raw: unknown): MarketView[] {
  const byId = new Map<
    string,
    { impact: number; bias: MarketBias; confidence: number; why: string }
  >();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = String(o.id || "");
      if (!MARKET_ASSETS.some((a) => a.id === id)) continue;
      byId.set(id, {
        impact: clamp(Number(o.impact) || 4),
        bias: asBias(o.bias),
        confidence: clamp(Number(o.confidence) || 4),
        why: String(o.why || "信息不足").slice(0, 220),
      });
    }
  }

  return MARKET_ASSETS.map((a) => {
    const hit = byId.get(a.id);
    const defaults: Record<string, { impact: number; bias: MarketBias }> = {
      oil: { impact: 7, bias: "long" },
      gold: { impact: 6, bias: "long" },
      usd: { impact: 5, bias: "neutral" },
      us_equity: { impact: 5, bias: "short" },
      defense: { impact: 6, bias: "long" },
      airline: { impact: 6, bias: "short" },
      gulf_equity: { impact: 6, bias: "short" },
      dubai_property: { impact: 5, bias: "short" },
      btc: { impact: 5, bias: "short" },
      eth: { impact: 5, bias: "short" },
      crypto_beta: { impact: 6, bias: "short" },
    };
    const d = defaults[a.id] || { impact: 4, bias: "neutral" as MarketBias };
    return {
      id: a.id,
      name: a.name,
      name_en: a.name_en,
      impact: hit?.impact ?? d.impact,
      bias: hit?.bias ?? d.bias,
      confidence: hit?.confidence ?? 4,
      why: hit?.why ?? "按海湾冲突经验基线：避险偏多、风险资产偏谨慎",
    };
  }).sort((x, y) => y.impact - x.impact);
}

function normalizeOutlook(raw: unknown, basedOn: number): WarOutlook {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const nodes = mergeNodes(o.nodes);
  const attack_predictions = mergeAttackPredictions(o.attack_predictions);
  const market_views = mergeMarketViews(o.market_views);
  const dubai = nodes.find((n) => n.id === "dubai");
  const dubaiAttack = attack_predictions.find((a) => a.id === "dubai");
  const scenarios = Array.isArray(o.scenarios)
    ? o.scenarios.map((s) => String(s).slice(0, 160)).slice(0, 5)
    : [];
  const watchpoints = Array.isArray(o.watchpoints)
    ? o.watchpoints.map((s) => String(s).slice(0, 120)).slice(0, 6)
    : [];

  const dubai_attack_probability = clamp(
    Number(o.dubai_attack_probability) || dubaiAttack?.probability || 4,
  );

  return {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    created_at: new Date().toISOString(),
    trajectory: asTrajectory(o.trajectory),
    trajectory_score: clamp(Number(o.trajectory_score) || 5),
    summary_zh: String(o.summary_zh || "暂无法形成可靠走向判断。").slice(0, 600),
    dubai_risk: clamp(Number(o.dubai_risk) || dubai?.risk || 5),
    dubai_note: String(o.dubai_note || dubai?.why || "待补充迪拜影响评估").slice(0, 300),
    dubai_attack_probability,
    dubai_attack_note: String(
      o.dubai_attack_note || dubaiAttack?.why || "待补充伊朗攻击迪拜可能性评估",
    ).slice(0, 320),
    attack_predictions,
    market_summary_zh: String(
      o.market_summary_zh ||
        "地缘紧张通常利好原油与黄金，压制航空与部分风险资产；加密货币多随风险偏好波动。",
    ).slice(0, 400),
    market_views,
    scenarios: scenarios.length ? scenarios : ["继续观察美伊官方表态与海峡通行情况"],
    watchpoints: watchpoints.length
      ? watchpoints
      : ["霍尔木兹通行", "海湾空域", "油价/金价", "迪拜航运保险", "BTC风险偏好"],
    nodes,
    based_on: basedOn,
  };
}

const MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/openai/gpt-oss-20b",
  "@cf/qwen/qwen3-30b-a3b-fp8",
];

export async function generateWarOutlook(
  ai: AiBinding,
  db: D1Database,
  preferredModel?: string,
): Promise<WarOutlook> {
  const briefs = await recentArticleBriefs(db, 18);
  const nodeList = GEO_NODES.map((n) => `${n.id}:${n.name}`).join(", ");
  const attackList = ATTACK_TARGET_IDS.join(", ");
  const marketList = MARKET_ASSETS.map((a) => `${a.id}:${a.name}`).join(", ");
  const user = [
    `可评估节点 id: ${nodeList}`,
    `攻击可能性目标 id（必评）: ${attackList}`,
    `市场资产 id（必评）: ${marketList}`,
    `近期新闻（${briefs.length}条）:`,
    briefs.length
      ? briefs.join("\n")
      : "（暂无相关新闻，请给保守中性评估，并给出伊朗攻击迪拜可能性与市场多空）",
    "",
    "请输出 JSON：含攻击可能性 + 经济/股市/加密货币影响程度与多空（long/short/neutral）。",
  ].join("\n");

  const models = preferredModel
    ? [preferredModel, ...MODELS.filter((m) => m !== preferredModel)]
    : MODELS;

  let lastErr = "ai_failed";
  for (const model of models) {
    try {
      const result = await ai.run(model, {
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 2800,
      });
      const text = pickText(result).trim();
      if (!text) throw new Error(`empty from ${model}`);
      const outlook = normalizeOutlook(extractJson(text), briefs.length);
      await saveOutlook(db, outlook);
      return outlook;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ event: "outlook_model_failed", model, error: lastErr }));
    }
  }

  const fallback = normalizeOutlook(
    {
      trajectory: "stable",
      trajectory_score: 5,
      summary_zh:
        "AI 分析暂时失败，已加载中性沙盘基线。请稍后点击「重新分析」。迪拜攻击可能性按保守基线展示。",
      dubai_risk: 5,
      dubai_note: "基线关注：霍尔木兹通行、空域与航运保险。",
      dubai_attack_probability: 3,
      dubai_attack_note: "公开信息不足，暂看不到伊朗即将直接打击迪拜的高置信度信号。",
      attack_predictions: ATTACK_TARGET_IDS.map((id) => ({
        id,
        probability: id === "israel" || id === "hormuz" ? 5 : id === "dubai" ? 3 : 3,
        mode: "unlikely",
        horizon: "near",
        why: "回退基线",
      })),
      market_summary_zh: "回退基线：油金偏多，航空与高风险加密偏谨慎，仅供情景参考。",
      market_views: [],
      scenarios: ["紧张持续但可控", "局部袭击推高航运风险", "外交降温"],
      watchpoints: ["霍尔木兹", "美军海湾基地", "伊朗官方表态", "油价"],
      nodes: GEO_NODES.map((n) => ({
        id: n.id,
        risk: n.focus ? 5 : n.id === "hormuz" || n.id === "iran" ? 6 : 3,
        why: "回退基线",
      })),
    },
    briefs.length,
  );
  fallback.summary_zh += `（错误: ${lastErr.slice(0, 80)}）`;
  await saveOutlook(db, fallback);
  return fallback;
}
