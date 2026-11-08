export type AiVerdict = {
  relevant: boolean;
  urgency: number;
  title_zh: string;
  summary_zh: string;
};

const SYSTEM = `你是地缘政治情报分析助手，专注美国、伊朗、迪拜/阿联酋及相关战争升级风险。

任务：阅读新闻标题与摘要，判断是否相关并输出简体中文。

相关主题：
- 美伊军事行动、导弹/无人机、基地打击、航母/海军、核设施
- 官方发言（白宫、国务院、五角大楼、伊朗领导层、IRGC、阿联酋/迪拜官方）
- 海湾安全、空域/港口关闭、撤离、霍尔木兹海峡、迪拜/阿联酋受波及
- 战争/升级/降级信号；伊朗战争对选举/政治的影响也可标为相关

不相关：体育、娱乐、纯国内琐事。

只输出一行合法 JSON，禁止 markdown，禁止思考过程：
{"relevant":true,"urgency":7,"title_zh":"...","summary_zh":"..."}

规则：
- urgency 1-10：5=值得关注，7=突发军事/官方强硬表态，9-10=大规模打击迹象
- title_zh、summary_zh 必须是简体中文；summary_zh 用 2-3 句
- relevant=false 时 title_zh/summary_zh 可为 ""，urgency<=3`;

export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|.*?\|>/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`no_json_object: ${cleaned.slice(0, 180)}`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalize(raw: unknown, fallbackTitle: string): AiVerdict {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const relevant = Boolean(obj.relevant);
  const urgency = Math.max(
    1,
    Math.min(10, Number(obj.urgency) || (relevant ? 5 : 1)),
  );
  return {
    relevant,
    urgency,
    title_zh: String(obj.title_zh || (relevant ? fallbackTitle : "")).slice(0, 200),
    summary_zh: String(obj.summary_zh || "").slice(0, 800),
  };
}

export function pickText(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  const r = result as Record<string, unknown>;

  if (typeof r.response === "string") return r.response;
  if (typeof r.text === "string") return r.text;

  const nested = r.result;
  if (typeof nested === "string") return nested;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    if (typeof n.response === "string") return n.response;
  }

  const choices = r.choices;
  if (Array.isArray(choices) && choices[0]) {
    const c0 = choices[0] as Record<string, unknown>;
    const msg = c0.message as Record<string, unknown> | undefined;
    if (typeof msg?.content === "string") return msg.content;
    if (typeof c0.text === "string") return c0.text;
  }

  // Some models return { output_text: "..." }
  if (typeof r.output_text === "string") return r.output_text;

  return "";
}

type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

const MODEL_CANDIDATES = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/openai/gpt-oss-20b",
  "@cf/qwen/qwen3-30b-a3b-fp8",
];

async function runOnce(
  ai: AiBinding,
  model: string,
  title: string,
  summary: string,
): Promise<AiVerdict> {
  const user = `标题: ${title.slice(0, 300)}\n摘要: ${summary.slice(0, 800)}\n\n只输出 JSON。`;

  const result = await ai.run(model, {
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.1,
    max_tokens: 1200,
  });

  const text = pickText(result).trim();
  if (!text) {
    throw new Error(`empty_ai_response model=${model} raw=${JSON.stringify(result).slice(0, 240)}`);
  }
  return normalize(extractJson(text), title);
}

/** Keyword fallback so we still push when AI is down. */
export function keywordFallback(title: string, summary: string): AiVerdict {
  const text = `${title}\n${summary}`.toLowerCase();
  const hot = ["strike", "missile", "war", "attack", "nuclear", "irgc", "centcom", "evacuation"];
  const urgency = hot.some((k) => text.includes(k)) ? 7 : 5;
  return {
    relevant: true,
    urgency,
    title_zh: title.slice(0, 180),
    summary_zh: `（AI 暂不可用，原文摘要）${(summary || title).slice(0, 400)}`,
  };
}

export async function analyzeArticle(
  ai: AiBinding,
  preferredModel: string,
  title: string,
  summary: string,
): Promise<AiVerdict> {
  const models = [preferredModel, ...MODEL_CANDIDATES.filter((m) => m !== preferredModel)];
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await runOnce(ai, model, title, summary);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.error(JSON.stringify({ event: "ai_all_failed", errors }));
  // Last resort: still deliver keyword-matched items
  return keywordFallback(title, summary);
}
