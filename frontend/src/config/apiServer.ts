/**
 * Base URL for the Tasks REST API implemented by this repo’s `backend-ts` (Node/Express + SQLite, default port 3000).
 *
 * - **Dev (recommended):** `VITE_API_BASE_URL=/api` — browser calls same origin; Vite proxies `/api/*` → backend-ts (see `vite.config.ts`).
 * - **Direct:** `VITE_API_BASE_URL=http://127.0.0.1:3000/api` — backend-ts enables CORS.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  if (import.meta.env.DEV) return '/api';
  return '/api';
}
