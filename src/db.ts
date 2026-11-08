export type StoredArticle = {
  id: string;
  url: string;
  source: string;
  title_original: string;
  title_zh: string | null;
  summary_zh: string | null;
  urgency: number | null;
  relevant: number;
  sent: number;
  published_at: string | null;
};

/** IDs already successfully analyzed (urgency set). Failed inserts can be retried. */
export async function analyzedIds(db: D1Database, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db
    .prepare(
      `SELECT id FROM articles WHERE id IN (${placeholders}) AND urgency IS NOT NULL`,
    )
    .bind(...ids)
    .all<{ id: string }>();
  return new Set((rows.results ?? []).map((r) => r.id));
}

export async function existingIds(db: D1Database, ids: string[]): Promise<Set<string>> {
  return analyzedIds(db, ids);
}

export async function insertPending(
  db: D1Database,
  item: {
    id: string;
    url: string;
    source: string;
    title_original: string;
    published_at: string | null;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO articles (id, url, source, title_original, published_at, relevant, sent)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
    )
    .bind(item.id, item.url, item.source, item.title_original, item.published_at)
    .run();
}

export async function markAnalyzed(
  db: D1Database,
  id: string,
  verdict: {
    relevant: boolean;
    urgency: number;
    title_zh: string;
    summary_zh: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE articles
       SET relevant = ?, urgency = ?, title_zh = ?, summary_zh = ?
       WHERE id = ?`,
    )
    .bind(
      verdict.relevant ? 1 : 0,
      verdict.urgency,
      verdict.title_zh,
      verdict.summary_zh,
      id,
    )
    .run();
}

export async function markSent(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE articles SET sent = 1, sent_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();
}

export async function recentSent(
  db: D1Database,
  limit = 20,
): Promise<StoredArticle[]> {
  const rows = await db
    .prepare(
      `SELECT id, url, source, title_original, title_zh, summary_zh, urgency, relevant, sent, published_at
       FROM articles
       WHERE sent = 1
       ORDER BY sent_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<StoredArticle>();
  return rows.results ?? [];
}

export async function cleanupOld(db: D1Database, keepDays = 14): Promise<void> {
  await db
    .prepare(`DELETE FROM articles WHERE created_at < datetime('now', ?)`)
    .bind(`-${keepDays} days`)
    .run();
}
