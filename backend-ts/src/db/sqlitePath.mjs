import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** `backend-ts/` (this package root). */
const packageRoot = path.join(__dirname, '..', '..');
/** Monorepo root — sibling of `backend-ts`; holds `docs/`, `store/`. */
export const repoRoot = path.join(packageRoot, '..');

const CONFIG_IN_PACKAGE = path.join(packageRoot, 'config', 'backend.yaml');
const SCHEMA_RELATIVE = path.join('docs', 'sqlite', 'schema.sql');

const DEFAULT_DB_RELATIVE = path.join('store', 'app.sqlite');

/**
 * Read `database.path` from `backend-ts/config/backend.yaml`. No YAML dependency — scalar `path` under `database:` only.
 * @returns {string | null} path as written in YAML (often relative to package root), or null if unset / unreadable
 */
export function readDatabasePathFromPackageConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_IN_PACKAGE, 'utf8');
    return parseDatabasePathYaml(raw);
  } catch {
    return null;
  }
}

/**
 * @param {string} content full `backend.yaml` text
 * @returns {string | null}
 */
export function parseDatabasePathYaml(content) {
  const lines = content.split(/\r?\n/);
  let inDatabase = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (/^database:\s*(#.*)?$/.test(trimmed)) {
      inDatabase = true;
      continue;
    }
    if (inDatabase) {
      if (/^\S/.test(line)) break;
      const quoted = trimmed.match(/^path:\s*["'](.+)["']\s*(?:#.*)?$/);
      if (quoted) return quoted[1].trim();
      const plain = trimmed.match(/^path:\s*([^\s#]+)/);
      if (plain) return plain[1].trim();
    }
  }
  return null;
}

/**
 * Absolute path to the SQLite file.
 * Precedence: **`SQLITE_PATH`** env → **`backend-ts/config/backend.yaml`** `database.path` (relative to `backend-ts/`) → `../store/app.sqlite` from package via default under repo root.
 */
export function resolveSqlitePath() {
  const fromEnv = process.env.SQLITE_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  const fromYaml = readDatabasePathFromPackageConfig();
  if (fromYaml) return path.resolve(packageRoot, fromYaml);
  return path.resolve(repoRoot, DEFAULT_DB_RELATIVE);
}

/**
 * Load canonical DDL from `docs/sqlite/schema.sql` at monorepo root (single source of truth for Node + Go).
 */
export function loadCanonicalSchemaSql() {
  const schemaPath = path.join(repoRoot, SCHEMA_RELATIVE);
  if (!fs.existsSync(schemaPath)) {
    throw new Error(
      `[sqlite] Missing schema file: ${schemaPath}. Restore docs/sqlite/schema.sql (see docs/BACKEND_SHARED_CONTRACT.md).`
    );
  }
  return fs.readFileSync(schemaPath, 'utf8');
}
