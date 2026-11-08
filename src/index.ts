import { analyzeArticle } from "./ai";
import { clearSessionCookie, createSessionCookie, isAuthed, timingSafeEqual } from "./auth";
import {
  cleanupOld,
  existingIds,
  insertPending,
  markAnalyzed,
  markSent,
  recentSent,
} from "./db";
import { passesKeywordFilter } from "./keywords";
import { renderPanelHtml } from "./panel";
import { fetchSourceItems, type RssItem } from "./rss";
import { SOURCES } from "./sources";
import {
  addEvent,
  deleteBot,
  deleteChannel,
  getBot,
  getBotByToken,
  getBotByWebhookSecret,
  getChannel,
  insertBot,
  listActiveTargets,
  listBots,
  listChannels,
  listEvents,
  setBotEnabled,
  setChannelEnabled,
  upsertChannel,
} from "./store";
import {
  deleteWebhook,
  formatAlert,
  getChat,
  getChatMember,
  getMe,
  isAdminStatus,
  normalizeChatId,
  sendTelegramMessage,
  setWebhook,
} from "./telegram";
import { generateWarOutlook, latestOutlook } from "./outlook";
import { handleTelegramUpdate } from "./webhook";

export type Env = {
  AI: Ai;
  DB: D1Database;
  PANEL_PASSWORD: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  CRON_SECRET?: string;
  AI_MODEL: string;
  MAX_ITEMS_PER_RUN: string;
  MAX_AGE_HOURS: string;
  MIN_URGENCY: string;
};

type RunStats = {
  fetched: number;
  newItems: number;
  analyzed: number;
  relevant: number;
  sent: number;
  targets: number;
  errors: string[];
};

function num(envValue: string | undefined, fallback: number): number {
  const n = Number(envValue);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

async function resolveTargets(env: Env) {
  const fromDb = await listActiveTargets(env.DB);
  if (fromDb.length) return fromDb;

  // Optional legacy secrets fallback
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    return [
      {
        token: env.TELEGRAM_BOT_TOKEN,
        chat_id: env.TELEGRAM_CHAT_ID,
        title: "legacy-secret",
        bot_username: null,
      },
    ];
  }
  return [];
}

async function runPipeline(env: Env): Promise<RunStats> {
  const stats: RunStats = {
    fetched: 0,
    newItems: 0,
    analyzed: 0,
    relevant: 0,
    sent: 0,
    targets: 0,
    errors: [],
  };

  const targets = await resolveTargets(env);
  stats.targets = targets.length;
  if (!targets.length) {
    throw new Error("还没有可推送的频道：请在控制面板添加机器人并绑定频道");
  }

  const maxAgeHours = num(env.MAX_AGE_HOURS, 24);
  const maxItems = num(env.MAX_ITEMS_PER_RUN, 12);
  const minUrgency = num(env.MIN_URGENCY, 5);
  const model = env.AI_MODEL || "@cf/qwen/qwen3-30b-a3b-fp8";

  const collected: RssItem[] = [];
  for (const source of SOURCES) {
    const items = await fetchSourceItems(source, maxAgeHours);
    collected.push(...items);
  }
  stats.fetched = collected.length;

  const filtered = collected.filter((item) => passesKeywordFilter(item.title, item.summary));
  const done = await existingIds(
    env.DB,
    filtered.map((i) => i.id),
  );
  const fresh = filtered.filter((i) => !done.has(i.id)).slice(0, maxItems);
  stats.newItems = fresh.length;

  for (const item of fresh) {
    await insertPending(env.DB, {
      id: item.id,
      url: item.url,
      source: item.sourceName,
      title_original: item.title,
      published_at: item.publishedAt,
    });

    try {
      const verdict = await analyzeArticle(env.AI, model, item.title, item.summary);
      await markAnalyzed(env.DB, item.id, verdict);
      stats.analyzed += 1;

      if (!verdict.relevant || verdict.urgency < minUrgency) continue;

      stats.relevant += 1;
      const text = formatAlert({
        titleZh: verdict.title_zh || item.title,
        summaryZh: verdict.summary_zh || "（无摘要）",
        urgency: verdict.urgency,
        sourceName: item.sourceName,
        url: item.url,
        publishedAt: item.publishedAt,
      });

      let delivered = 0;
      for (const t of targets) {
        try {
          await sendTelegramMessage(t.token, t.chat_id, text);
          delivered += 1;
        } catch (err) {
          stats.errors.push(
            `${item.id}@${t.chat_id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      if (delivered > 0) {
        await markSent(env.DB, item.id);
        stats.sent += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      stats.errors.push(`${item.id}: ${msg}`);
      console.error(JSON.stringify({ event: "item_failed", id: item.id, error: msg }));
    }
  }

  await cleanupOld(env.DB, 14);
  console.log(JSON.stringify({ event: "pipeline_done", ...stats }));
  return stats;
}

async function requirePanel(request: Request, env: Env): Promise<Response | null> {
  if (await isAuthed(request, env.PANEL_PASSWORD)) return null;
  return json({ error: "未登录" }, { status: 401 });
}

async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  const secure = publicOrigin(request).startsWith("https://");

  if (path === "/api/login" && request.method === "POST") {
    if (!env.PANEL_PASSWORD) {
      return json({ error: "请先设置 PANEL_PASSWORD secret" }, { status: 500 });
    }
    const body = (await request.json().catch(() => ({}))) as { password?: string };
    const password = (body.password || "").trim();
    const expected = env.PANEL_PASSWORD.trim();
    if (!password || !timingSafeEqual(password, expected)) {
      return json({ error: "密码错误" }, { status: 401 });
    }
    return json(
      { ok: true },
      { headers: { "set-cookie": await createSessionCookie(env.PANEL_PASSWORD, secure) } },
    );
  }

  if (path === "/api/logout" && request.method === "POST") {
    return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(secure) } });
  }

  const denied = await requirePanel(request, env);
  if (denied && path !== "/api/login") return denied;

  if (path === "/api/status" && request.method === "GET") {
    const [bots, channels, events, recent, targets, outlook] = await Promise.all([
      listBots(env.DB),
      listChannels(env.DB),
      listEvents(env.DB, 20),
      recentSent(env.DB, 20),
      listActiveTargets(env.DB),
      latestOutlook(env.DB),
    ]);
    return json({
      ok: true,
      bots: bots.map((b) => ({
        id: b.id,
        username: b.username,
        first_name: b.first_name,
        enabled: !!b.enabled,
        created_at: b.created_at,
      })),
      channels,
      events,
      recentSent: recent.length,
      activeTargets: targets.length,
      outlook,
    });
  }

  if (path === "/api/outlook" && request.method === "GET") {
    const outlook = await latestOutlook(env.DB);
    return json({ ok: true, outlook });
  }

  if (path === "/api/outlook/analyze" && request.method === "POST") {
    const outlook = await generateWarOutlook(env.AI, env.DB, env.AI_MODEL);
    await addEvent(
      env.DB,
      "outlook",
      `战争沙盘已更新：${outlook.trajectory} ${outlook.trajectory_score}/10，迪拜风险 ${outlook.dubai_risk}/10`,
    );
    return json({ ok: true, outlook });
  }

  if (path === "/api/bots" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { token?: string };
    const token = (body.token || "").trim();
    if (!token || !token.includes(":")) {
      return json({ error: "Token 格式不正确" }, { status: 400 });
    }
    const existing = await getBotByToken(env.DB, token);
    if (existing) return json({ error: "该机器人已添加" }, { status: 409 });

    const me = await getMe(token);
    const id = newId();
    const webhookSecret = crypto.randomUUID().replace(/-/g, "");
    const origin = publicOrigin(request);
    const hookUrl = `${origin}/tg/webhook/${webhookSecret}`;

    await setWebhook(token, hookUrl, webhookSecret);
    await insertBot(env.DB, {
      id,
      token,
      username: me.username || null,
      first_name: me.first_name || null,
      telegram_id: me.id,
      webhook_secret: webhookSecret,
    });
    await addEvent(env.DB, "bot", `已添加机器人 @${me.username || me.id}，Webhook 已就绪`);
    return json({ ok: true, bot: { id, username: me.username } });
  }

  const botMatch = path.match(/^\/api\/bots\/([^/]+)$/);
  if (botMatch) {
    const botId = botMatch[1]!;
    if (request.method === "DELETE") {
      const bot = await getBot(env.DB, botId);
      if (!bot) return json({ error: "机器人不存在" }, { status: 404 });
      try {
        await deleteWebhook(bot.token);
      } catch {
        // ignore
      }
      await deleteBot(env.DB, botId);
      await addEvent(env.DB, "bot", `已删除机器人 @${bot.username || botId}`);
      return json({ ok: true });
    }
    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
      await setBotEnabled(env.DB, botId, !!body.enabled);
      return json({ ok: true });
    }
  }

  if (path === "/api/channels/bind" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { bot_id?: string; chat?: string };
    const bot = body.bot_id ? await getBot(env.DB, body.bot_id) : null;
    if (!bot) return json({ error: "请选择机器人" }, { status: 400 });
    const chatRef = normalizeChatId(body.chat || "");
    if (!chatRef) return json({ error: "请填写频道 @username 或 ID" }, { status: 400 });

    const chat = await getChat(bot.token, chatRef);
    if (chat.type !== "channel" && chat.type !== "supergroup") {
      return json({ error: "目标不是频道/超级群" }, { status: 400 });
    }
    if (!bot.telegram_id) return json({ error: "机器人信息不完整，请删除后重加" }, { status: 400 });

    const member = await getChatMember(bot.token, String(chat.id), bot.telegram_id);
    const status = isAdminStatus(member.status) ? "bound" : "pending";
    await upsertChannel(env.DB, {
      id: newId(),
      bot_id: bot.id,
      chat_id: String(chat.id),
      title: chat.title || null,
      username: chat.username || null,
      type: chat.type,
      status,
    });

    if (status !== "bound") {
      await addEvent(
        env.DB,
        "pending",
        `频道「${chat.title || chat.id}」已记录，但机器人还不是管理员，请勾选「发布消息」`,
      );
      return json({
        ok: true,
        status,
        warning: "机器人尚未成为管理员，暂不会推送。设为管理员后会自动变为已绑定。",
      });
    }

    await addEvent(env.DB, "bind", `手动绑定频道「${chat.title || chat.id}」成功`);
    return json({ ok: true, status });
  }

  const chMatch = path.match(/^\/api\/channels\/([^/]+)(?:\/(test))?$/);
  if (chMatch) {
    const channelId = chMatch[1]!;
    const action = chMatch[2];
    const channel = await getChannel(env.DB, channelId);
    if (!channel) return json({ error: "频道不存在" }, { status: 404 });

    if (request.method === "DELETE") {
      await deleteChannel(env.DB, channelId);
      return json({ ok: true });
    }
    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
      await setChannelEnabled(env.DB, channelId, !!body.enabled);
      return json({ ok: true });
    }
    if (request.method === "POST" && action === "test") {
      const bot = await getBot(env.DB, channel.bot_id);
      if (!bot) return json({ error: "机器人不存在" }, { status: 404 });
      await sendTelegramMessage(
        bot.token,
        channel.chat_id,
        [
          "✅ <b>绑定测试成功</b>",
          "",
          "地缘新闻机器人已可以往本频道发消息。",
          `频道: ${channel.title || channel.chat_id}`,
        ].join("\n"),
      );
      return json({ ok: true });
    }
  }

  if (path === "/api/run" && request.method === "POST") {
    const stats = await runPipeline(env);
    return json({ ok: true, stats });
  }

  return json({ error: "Not found" }, { status: 404 });
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        try {
          await runPipeline(env);
        } catch (err) {
          console.error(
            JSON.stringify({
              event: "scheduled_failed",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }

        try {
          const last = await latestOutlook(env.DB);
          const ageMs = last ? Date.now() - Date.parse(last.created_at) : Number.POSITIVE_INFINITY;
          // Refresh sand-table about every 2 hours
          if (!Number.isFinite(ageMs) || ageMs > 2 * 3600_000) {
            await generateWarOutlook(env.AI, env.DB, env.AI_MODEL);
          }
        } catch (err) {
          console.error(
            JSON.stringify({
              event: "outlook_scheduled_failed",
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      })(),
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health") {
      return json({ ok: true, service: "geo-news-bot" });
    }

    // Telegram webhook (no panel auth; validated by per-bot secret)
    const hookMatch = path.match(/^\/tg\/webhook\/([^/]+)$/);
    if (hookMatch && request.method === "POST") {
      const secret = hookMatch[1]!;
      const bot = await getBotByWebhookSecret(env.DB, secret);
      if (!bot || !bot.enabled) return new Response("ok");

      const headerSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
      if (headerSecret && !timingSafeEqual(headerSecret, bot.webhook_secret)) {
        return new Response("forbidden", { status: 403 });
      }

      const update = await request.json().catch(() => null);
      if (update) {
        await handleTelegramUpdate(env.DB, bot, update as never);
      }
      return new Response("ok");
    }

    if (path.startsWith("/api/")) {
      try {
        return await handleApi(request, env, path);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: "api_error", path, error: message }));
        return json({ error: message }, { status: 500 });
      }
    }

    // Legacy manual run with CRON_SECRET
    if (path === "/run" && (request.method === "POST" || request.method === "GET")) {
      const secret = request.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
      if (!env.CRON_SECRET || !timingSafeEqual(secret, env.CRON_SECRET)) {
        return new Response("Unauthorized", { status: 401 });
      }
      const stats = await runPipeline(env);
      return json({ ok: true, stats });
    }

    if (path === "/" || path === "/panel") {
      return new Response(renderPanelHtml(publicOrigin(request)), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
