CREATE TABLE IF NOT EXISTS bots (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  telegram_id INTEGER,
  webhook_secret TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  bot_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  title TEXT,
  username TEXT,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  enabled INTEGER NOT NULL DEFAULT 1,
  bound_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(bot_id, chat_id),
  FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_channels_bot ON channels(bot_id);
CREATE INDEX IF NOT EXISTS idx_channels_enabled ON channels(enabled, status);

CREATE TABLE IF NOT EXISTS panel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
