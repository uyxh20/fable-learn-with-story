CREATE TABLE IF NOT EXISTS creations (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  idempotency TEXT NOT NULL,
  request_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  title TEXT,
  error TEXT,
  text_started INTEGER NOT NULL DEFAULT 0,
  image_started INTEGER NOT NULL DEFAULT 0,
  share_token TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner, idempotency)
);
CREATE INDEX IF NOT EXISTS creations_owner ON creations(owner, created_at);
CREATE INDEX IF NOT EXISTS creations_daily ON creations(created_at, ip_hash);
