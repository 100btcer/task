import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import express from 'express';
import cors from 'cors';
import { buildCorsOptions, resolveCorsOrigins } from './corsConfig.mjs';
import { openSqlite, resolveSqlitePath } from './db/sqlite.mjs';
import { createSqliteTaskStore } from './store/taskStoreSqlite.mjs';
import { createSqliteUserStore } from './store/userStoreSqlite.mjs';
import { createTaskStore } from './store.mjs';
import { createUserStore } from './store/users.mjs';
import { createTasksRouter } from './routes/tasks.mjs';
import { createAuthRouter } from './routes/auth.mjs';
import { createRequireUserForTasksMiddleware } from './middleware/tasksAuth.mjs';
import { getSwaggerDocsHtml } from './swaggerDocsHtml.mjs';
import { createBlockchainTransferHistoryStore } from './store/blockchainTransferHistorySqlite.mjs';
import { createBlockchainTransferHistoryRouter } from './routes/blockchainTransferHistory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const swaggerUiDistRoot = require('swagger-ui-dist/absolute-path.js')();
const SWAGGER_UI_STATIC_MOUNT = '/api/docs/_dist';

function loadOpenApiSpec() {
  const specPath = path.join(__dirname, '../../docs/api-spec.json');
  const raw = fs.readFileSync(specPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Hostname for building server URLs (drops port from Host / X-Forwarded-Host).
 * @param {string} hostHeader e.g. `127.0.0.1:3000`, `[::1]:3000`
 */
function openApiHostname(hostHeader) {
  if (!hostHeader) return '127.0.0.1';
  const h = hostHeader.split(',')[0].trim();
  try {
    return new URL(`http://${h}`).hostname;
  } catch {
    const idx = h.lastIndexOf(':');
    if (idx > 0 && !/^\[/.test(h)) return h.slice(0, idx);
    return h;
  }
}

/**
 * Two backends: Node :3000 and Go :3001 — Swagger UI can switch "Try it out" target.
 * @param {import('express').Request} req
 */
function openApiServersForRequest(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  const proto = (forwardedProto?.split(',')[0]?.trim() || req.protocol || 'http').replace(/:$/, '');
  const forwardedHost = req.get('x-forwarded-host');
  const hostHeader =
    forwardedHost?.split(',')[0]?.trim() || req.get('host') || `127.0.0.1:${process.env.PORT || 3000}`;
  let hostname = openApiHostname(hostHeader);
  if (hostname.includes(':') && !hostname.startsWith('[')) {
    hostname = `[${hostname}]`;
  }
  return [
    { url: `${proto}://${hostname}:3000/api`, description: 'Node.js (backend-ts, port 3000)' },
    { url: `${proto}://${hostname}:3001/api`, description: 'Go (backend-go, port 3001)' },
  ];
}

function resolveStaticDir() {
  const configured = process.env.STATIC_DIR?.trim();
  const candidates = [
    configured ? path.resolve(configured) : null,
    path.resolve(__dirname, '../../frontend-dist'),
    path.resolve(__dirname, '../../frontend/dist'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) ?? null;
}

/**
 * @param {object} [options]
 * @param {object} [options.store] override task store (in-memory for tests)
 * @param {import('express').RequestHandler} [options.tasksAuthMiddleware] override `/api/tasks` auth (tests)
 * @param {ReturnType<import('./store/users.mjs').createUserStore>} [options.userStore] override user store
 */
export function createApp(options = {}) {
  const app = express();
  const useSqlite = !options.store && !options.userStore;

  /** @type {import('better-sqlite3').Database | null} */
  let db = null;
  let store;
  let userStore;

  if (useSqlite) {
    db = openSqlite();
    store = createSqliteTaskStore(db);
    userStore = createSqliteUserStore(db);
  } else {
    store = options.store ?? createTaskStore();
    userStore = options.userStore ?? createUserStore();
  }

  const openApiSpec = loadOpenApiSpec();
  const staticDir = resolveStaticDir();

  app.disable('x-powered-by');
  app.use(cors(buildCorsOptions(resolveCorsOrigins())));
  app.use(express.json());

  app.get('/api/health', (_req, res, next) => {
    try {
      if (db) {
        db.prepare('SELECT 1').get();
        res.json({
          ok: true,
          service: 'tasks-api',
          storage: 'sqlite',
          database: resolveSqlitePath(),
        });
      } else {
        res.json({ ok: true, service: 'tasks-api', storage: 'memory' });
      }
    } catch (e) {
      next(e);
    }
  });

  /** Public: same contract as `docs/api-spec.json` (no Bearer required). */
  app.get('/api/openapi.json', (req, res) => {
    res.json({ ...openApiSpec, servers: openApiServersForRequest(req) });
  });

  /** Public: Swagger UI static files (before Bearer so CSS/JS load without a token). */
  app.use(SWAGGER_UI_STATIC_MOUNT, express.static(swaggerUiDistRoot, { index: false }));

  const swaggerHtml = getSwaggerDocsHtml(SWAGGER_UI_STATIC_MOUNT);
  app.get(['/api/docs', '/api/docs/'], (_req, res) => {
    res.type('html').send(swaggerHtml);
  });

  app.use('/api/auth', createAuthRouter({ userStore }));
  const tasksAuth = options.tasksAuthMiddleware ?? createRequireUserForTasksMiddleware(userStore);
  app.use('/api/tasks', tasksAuth, createTasksRouter(store));

  if (db) {
    const bth = createBlockchainTransferHistoryStore(db);
    app.use('/api/blockchain', createBlockchainTransferHistoryRouter(bth));
  } else {
    app.use('/api/blockchain', (_req, res) => {
      res.status(503).json({
        message: 'Blockchain transfer history requires SQLite (default server with shared database)',
        code: 'STORAGE_UNAVAILABLE',
        status: 503,
      });
    });
  }

  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Not found', path: req.originalUrl });
  });

  if (staticDir) {
    app.use(express.static(staticDir, { index: false }));
    app.use((req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method)) return next();
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    console.error('[backend-ts]', err);
    res.status(500).json({ message: err?.message ?? 'Internal error' });
  });

  return app;
}
