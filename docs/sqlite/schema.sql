-- Canonical SQLite schema for this monorepo (tasks, users, blockchain demo transfer log).
-- backend-ts and backend-go apply this file on startup; both MUST use the same DDL
-- against the same file so both implementations share one database.
-- Bump schema_migrations when you add new .sql steps (see docs/BACKEND_SHARED_CONTRACT.md).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- idx_tasks_user_created: created in code after migrateTasksUserId (legacy DBs may lack user_id until then).
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at);

-- Blockchain Demo: transfer history (synced from the SPA; keyed by demo chain + connected wallet).
CREATE TABLE IF NOT EXISTS blockchain_transfer_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_human TEXT NOT NULL,
  amount_raw TEXT NOT NULL,
  symbol TEXT NOT NULL,
  asset TEXT NOT NULL CHECK (asset IN ('native', 'erc20')),
  status TEXT NOT NULL CHECK (status IN ('success', 'reverted', 'failed')),
  block_number TEXT,
  timestamp_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (chain_id, wallet_address, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_bth_wallet_chain ON blockchain_transfer_history (wallet_address, chain_id, timestamp_ms DESC);

-- Initial migration marker (idempotent with INSERT OR IGNORE).
INSERT OR IGNORE INTO schema_migrations (version) VALUES (1);
INSERT OR IGNORE INTO schema_migrations (version) VALUES (2);
