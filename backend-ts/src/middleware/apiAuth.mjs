import { createStaticBearerMiddleware } from './staticBearer.mjs';
import { createJwtBearerMiddleware } from './jwtBearer.mjs';

/**
 * Human-readable auth summary for startup logs (see `tasksAuth.mjs` for `/api/tasks` enforcement).
 */
export function describeApiAuthMode() {
  return 'user-jwt — all /api/tasks methods (including GET) need Bearer from /api/auth/login or /register';
}

/**
 * Single middleware mounted at `/api` before task routes.
 *
 * Precedence: **JWT** (`API_JWT_SECRET`) → **static Bearer** (`API_BEARER_TOKEN`) → **open** (no check).
 * Override in tests or custom servers: pass `createApp({ tasksAuthMiddleware: ... })`.
 */
export function createApiAuthMiddleware() {
  const jwtSecret = process.env.API_JWT_SECRET?.trim();
  const staticToken = process.env.API_BEARER_TOKEN?.trim();

  if (jwtSecret) {
    return createJwtBearerMiddleware();
  }
  if (staticToken) {
    return createStaticBearerMiddleware(staticToken);
  }
  return function openApi(req, _res, next) {
    req.auth = { mode: 'anonymous' };
    next();
  };
}
