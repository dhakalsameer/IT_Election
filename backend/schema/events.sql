-- Persistent event store — centralized blockchain activity log
-- Safe to run repeatedly (all statements use IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS events (
  id           SERIAL PRIMARY KEY,
  event_name   TEXT NOT NULL,
  tx_hash      TEXT,
  block_number INTEGER,
  log_index    INTEGER,
  args         JSONB NOT NULL DEFAULT '{}',
  timestamp    INTEGER NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
