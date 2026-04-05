import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..');
const CONFIG_PATH = path.join(packageRoot, 'config', 'backend.yaml');

/**
 * Parse `cors.origins` string list from backend.yaml (indent-based; no full YAML parser).
 * @param {string} content
 * @returns {string[] | null}
 */
export function parseCorsOriginsYaml(content) {
  const lines = content.split(/\r?\n/);
  let phase = 0; // 0 = seek cors, 1 = seek origins, 2 = list items
  /** @type {string[]} */
  const origins = [];
  let originsKeyIndent = -1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const indent = line.match(/^(\s*)/)[1].length;

    if (phase === 0) {
      if (/^cors:\s*(#.*)?$/.test(trimmed)) phase = 1;
      continue;
    }

    if (phase === 1) {
      if (indent === 0) break;
      if (/^origins:\s*(#.*)?$/.test(trimmed)) {
        phase = 2;
        originsKeyIndent = indent;
        continue;
      }
      continue;
    }

    if (phase === 2) {
      if (indent <= originsKeyIndent && !trimmed.startsWith('-')) break;
      const quoted = trimmed.match(/^-\s*["'](.+)["']\s*(?:#.*)?$/);
      if (quoted) {
        origins.push(quoted[1]);
        continue;
      }
      const plain = trimmed.match(/^-\s*([^\s#]+)\s*(?:#.*)?$/);
      if (plain) origins.push(plain[1]);
    }
  }

  return origins.length ? origins : null;
}

/**
 * Precedence: **`CORS_ORIGINS`** (comma-separated) → **`backend-ts/config/backend.yaml`** `cors.origins` → `["*"]`.
 * @returns {string[]}
 */
export function resolveCorsOrigins() {
  const env = process.env.CORS_ORIGINS?.trim();
  if (env) {
    return env.split(',').map((s) => s.trim()).filter(Boolean);
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const fromYaml = parseCorsOriginsYaml(raw);
    if (fromYaml?.length) return fromYaml;
  } catch {
    /* use default */
  }
  return ['*'];
}

const ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const ALLOW_HEADERS = [
  'Origin',
  'Content-Type',
  'Content-Length',
  'Authorization',
  'Accept',
  'Accept-Language',
  'X-Requested-With',
  'X-Forwarded-Proto',
  'X-Forwarded-Host',
];

/**
 * Express `cors` options aligned with **backend-go** (credentials, preflight headers, maxAge).
 * @param {string[]} origins resolved allowlist; `*` or empty list means reflect any `Origin`.
 */
export function buildCorsOptions(origins) {
  const allowAll =
    origins.length === 0 || origins.some((o) => String(o).trim() === '*');

  return {
    origin: allowAll
      ? true
      : (origin, cb) => {
          if (!origin) return cb(null, true);
          return cb(null, origins.includes(origin));
        },
    credentials: true,
    methods: ALLOW_METHODS,
    allowedHeaders: ALLOW_HEADERS,
    exposedHeaders: ['Content-Length'],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  };
}
