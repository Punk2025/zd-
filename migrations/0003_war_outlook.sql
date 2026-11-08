CREATE TABLE IF NOT EXISTS war_outlook (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  trajectory TEXT NOT NULL,
  trajectory_score INTEGER NOT NULL,
  summary_zh TEXT NOT NULL,
  dubai_risk INTEGER NOT NULL,
  dubai_note TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_war_outlook_created ON war_outlook(created_at DESC);
