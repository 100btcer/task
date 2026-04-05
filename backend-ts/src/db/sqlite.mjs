import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { loadCanonicalSchemaSql, resolveSqlitePath } from './sqlitePath.mjs';

const require = createRequire(import.meta.url);

export {
  loadCanonicalSchemaSql,
  parseDatabasePathYaml,
  readDatabasePathFromPackageConfig,
  repoRoot,
  resolveSqlitePath,
} from './sqlitePath.mjs';

/**
 * Open DB, create parent dirs, apply `docs/sqlite/schema.sql`, enable WAL.
 * @returns {import('better-sqlite3').Database}
 */
export function openSqlite() {
  const Database = require('better-sqlite3');
  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(loadCanonicalSchemaSql());
  migrateTasksUserId(db);
  return db;
}

/**
 * Legacy DBs: add tasks.user_id, backfill to first user, drop orphan tasks.
 * Always ensures idx_tasks_user_created (cannot live in schema.sql exec before column exists on old files).
 * @param {import('better-sqlite3').Database} db
 */
export function migrateTasksUserId(db) {
  const cols = db.prepare(`PRAGMA table_info(tasks)`).all();
  if (!cols.some((c) => c.name === 'user_id')) {
    db.exec(`ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id)`);
    const first = db.prepare(`SELECT id FROM users ORDER BY id ASC LIMIT 1`).get();
    if (first) {
      db.prepare(`UPDATE tasks SET user_id = ? WHERE user_id IS NULL`).run(first.id);
    }
    db.prepare(`DELETE FROM tasks WHERE user_id IS NULL`).run();
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks (user_id, created_at)`);
}
