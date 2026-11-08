export type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

export type TgChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

type TgApiResult<T> = { ok: boolean; description?: string; result?: T };

async function tgApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json()) as TgApiResult<T>;
  if (!data.ok || data.result === undefined) {
    throw new Error(data.description || `${method}_failed`);
  }
  return data.result;
}

export async function getMe(token: string): Promise<TgUser> {
  return tgApi<TgUser>(token, "getMe");
}

export async function setWebhook(
  token: string,
  url: string,
  secretToken: string,
): Promise<boolean> {
  return tgApi<boolean>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["my_chat_member", "channel_post", "message"],
    drop_pending_updates: false,
  });
}

export async function deleteWebhook(token: string): Promise<boolean> {
  return tgApi<boolean>(token, "deleteWebhook", { drop_pending_updates: false });
}

export async function getChat(token: string, chatId: string): Promise<TgChat> {
  return tgApi<TgChat>(token, "getChat", { chat_id: chatId });
}

export async function getChatMember(
  token: string,
  chatId: string,
  userId: number,
): Promise<{ status: string }> {
  return tgApi<{ status: string }>(token, "getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
): Promise<void> {
  await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
}

/** Format RSS pubDate as Asia/Shanghai wall clock, e.g. 2026-11-05 15:30 */
export function formatPublishedAt(publishedAt: string | null | undefined): string {
  if (!publishedAt) return "未知";
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return publishedAt.slice(0, 32);

  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} (北京时间)`;
}

export function formatAlert(input: {
  titleZh: string;
  summaryZh: string;
  urgency: number;
  sourceName: string;
  url: string;
  publishedAt?: string | null;
}): string {
  const level =
    input.urgency >= 8 ? "🔴 高危" : input.urgency >= 6 ? "🟠 关注" : "🟡 动态";

  return [
    `${level} <b>${escapeHtml(input.titleZh)}</b>`,
    ``,
    escapeHtml(input.summaryZh),
    ``,
    `发布时间: ${escapeHtml(formatPublishedAt(input.publishedAt))}`,
    `紧迫度: ${input.urgency}/10`,
    `来源: ${escapeHtml(input.sourceName)}`,
    `<a href="${input.url}">原文链接</a>`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isAdminStatus(status: string): boolean {
  return status === "administrator" || status === "creator";
}

export function normalizeChatId(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.startsWith("@")) return raw;
  if (/^-?\d+$/.test(raw)) return raw;
  return `@${raw.replace(/^https?:\/\/t\.me\//i, "").replace(/^\//, "")}`;
}
