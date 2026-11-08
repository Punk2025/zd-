export type BotRow = {
  id: string;
  token: string;
  username: string | null;
  first_name: string | null;
  telegram_id: number | null;
  webhook_secret: string;
  enabled: number;
  created_at: string;
};

export type ChannelRow = {
  id: string;
  bot_id: string;
  chat_id: string;
  title: string | null;
  username: string | null;
  type: string | null;
  status: string;
  enabled: number;
  bound_at: string | null;
  created_at: string;
  bot_username?: string | null;
};

export async function listBots(db: D1Database): Promise<BotRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, token, username, first_name, telegram_id, webhook_secret, enabled, created_at
       FROM bots ORDER BY created_at DESC`,
    )
    .all<BotRow>();
  return rows.results ?? [];
}

export async function getBot(db: D1Database, id: string): Promise<BotRow | null> {
  return (
    (await db
      .prepare(
        `SELECT id, token, username, first_name, telegram_id, webhook_secret, enabled, created_at
         FROM bots WHERE id = ?`,
      )
      .bind(id)
      .first<BotRow>()) ?? null
  );
}

export async function getBotByToken(db: D1Database, token: string): Promise<BotRow | null> {
  return (
    (await db
      .prepare(
        `SELECT id, token, username, first_name, telegram_id, webhook_secret, enabled, created_at
         FROM bots WHERE token = ?`,
      )
      .bind(token)
      .first<BotRow>()) ?? null
  );
}

export async function getBotByWebhookSecret(
  db: D1Database,
  secret: string,
): Promise<BotRow | null> {
  return (
    (await db
      .prepare(
        `SELECT id, token, username, first_name, telegram_id, webhook_secret, enabled, created_at
         FROM bots WHERE webhook_secret = ?`,
      )
      .bind(secret)
      .first<BotRow>()) ?? null
  );
}

export async function insertBot(
  db: D1Database,
  bot: {
    id: string;
    token: string;
    username: string | null;
    first_name: string | null;
    telegram_id: number | null;
    webhook_secret: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO bots (id, token, username, first_name, telegram_id, webhook_secret, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(bot.id, bot.token, bot.username, bot.first_name, bot.telegram_id, bot.webhook_secret)
    .run();
}

export async function deleteBot(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM channels WHERE bot_id = ?`).bind(id).run();
  await db.prepare(`DELETE FROM bots WHERE id = ?`).bind(id).run();
}

export async function setBotEnabled(db: D1Database, id: string, enabled: boolean): Promise<void> {
  await db
    .prepare(`UPDATE bots SET enabled = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(enabled ? 1 : 0, id)
    .run();
}

export async function listChannels(db: D1Database): Promise<ChannelRow[]> {
  const rows = await db
    .prepare(
      `SELECT c.id, c.bot_id, c.chat_id, c.title, c.username, c.type, c.status, c.enabled,
              c.bound_at, c.created_at, b.username AS bot_username
       FROM channels c
       LEFT JOIN bots b ON b.id = c.bot_id
       ORDER BY c.created_at DESC`,
    )
    .all<ChannelRow>();
  return rows.results ?? [];
}

export async function listActiveTargets(
  db: D1Database,
): Promise<Array<{ token: string; chat_id: string; title: string | null; bot_username: string | null }>> {
  const rows = await db
    .prepare(
      `SELECT b.token, c.chat_id, c.title, b.username AS bot_username
       FROM channels c
       JOIN bots b ON b.id = c.bot_id
       WHERE c.enabled = 1 AND c.status = 'bound' AND b.enabled = 1`,
    )
    .all<{ token: string; chat_id: string; title: string | null; bot_username: string | null }>();
  return rows.results ?? [];
}

export async function upsertChannel(
  db: D1Database,
  channel: {
    id: string;
    bot_id: string;
    chat_id: string;
    title: string | null;
    username: string | null;
    type: string | null;
    status: "pending" | "bound" | "left";
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO channels (id, bot_id, chat_id, title, username, type, status, enabled, bound_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, CASE WHEN ? = 'bound' THEN datetime('now') ELSE NULL END)
       ON CONFLICT(bot_id, chat_id) DO UPDATE SET
         title = excluded.title,
         username = excluded.username,
         type = excluded.type,
         status = excluded.status,
         enabled = 1,
         bound_at = CASE WHEN excluded.status = 'bound' THEN datetime('now') ELSE channels.bound_at END,
         updated_at = datetime('now')`,
    )
    .bind(
      channel.id,
      channel.bot_id,
      channel.chat_id,
      channel.title,
      channel.username,
      channel.type,
      channel.status,
      channel.status,
    )
    .run();
}

export async function setChannelEnabled(
  db: D1Database,
  id: string,
  enabled: boolean,
): Promise<void> {
  await db
    .prepare(`UPDATE channels SET enabled = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(enabled ? 1 : 0, id)
    .run();
}

export async function deleteChannel(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM channels WHERE id = ?`).bind(id).run();
}

export async function getChannel(db: D1Database, id: string): Promise<ChannelRow | null> {
  return (
    (await db
      .prepare(
        `SELECT id, bot_id, chat_id, title, username, type, status, enabled, bound_at, created_at
         FROM channels WHERE id = ?`,
      )
      .bind(id)
      .first<ChannelRow>()) ?? null
  );
}

export async function addEvent(db: D1Database, kind: string, message: string): Promise<void> {
  await db
    .prepare(`INSERT INTO panel_events (kind, message) VALUES (?, ?)`)
    .bind(kind, message)
    .run();
  await db
    .prepare(
      `DELETE FROM panel_events WHERE id NOT IN (
         SELECT id FROM panel_events ORDER BY id DESC LIMIT 50
       )`,
    )
    .run();
}

export async function listEvents(db: D1Database, limit = 20) {
  const rows = await db
    .prepare(
      `SELECT id, kind, message, created_at FROM panel_events ORDER BY id DESC LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: number; kind: string; message: string; created_at: string }>();
  return rows.results ?? [];
}
