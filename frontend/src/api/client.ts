/**
 * OpenAPI client configured for this repo’s **backend-ts** (`/api/tasks`, …).
 * @see docs/api-spec.json (repo) / docs/SWAGGER.md
 */

import { ApiClient } from './openapi/ApiClient';
import { ApiError } from './openapi/core/ApiError';
import { getApiBaseUrl } from '../config/apiServer';
import { AuthRequiredError, TASKS_AUTH_TOKEN_KEY } from '../lib/apiWriteAuth';

const base = getApiBaseUrl();

function resolveBearerToken(): string | undefined {
  if (typeof window !== 'undefined') {
    const session = window.localStorage.getItem(TASKS_AUTH_TOKEN_KEY)?.trim();
    if (session) return session;
  }
  const env = import.meta.env.VITE_API_TOKEN?.trim();
  return env || undefined;
}

export const apiClient = new ApiClient({
  BASE: base,
  TOKEN: async () => resolveBearerToken() ?? '',
});

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AuthRequiredError) {
    return error.message;
  }
  if (error instanceof ApiError) {
    const body = error.body;
    if (body && typeof body === 'object' && 'message' in body) {
      const msg = (body as { message?: string }).message;
      if (typeof msg === 'string' && msg) return msg;
    }
    return error.message || `${error.status} ${error.statusText}`;
  }
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === 'ERR_NETWORK' || code === 'ECONNREFUSED') {
      return (
        'Cannot reach the Tasks API (backend-ts). In another terminal run: cd backend-ts && npm run setup && npm start ' +
        '(default port 3000). If you use the /api proxy, start both services from the repo root with npm run dev, ' +
        'or set VITE_API_BASE_URL to http://127.0.0.1:3000/api.'
      );
    }
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}
