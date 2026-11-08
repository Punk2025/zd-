-- Seen articles + delivery state
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  title_original TEXT NOT NULL,
  title_zh TEXT,
  summary_zh TEXT,
  urgency INTEGER,
  relevant INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_sent ON articles(sent, created_at);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
