import { ApiError } from '../api/openapi/core/ApiError';

/** Keep in sync with `AuthContext` session storage. */
export const TASKS_AUTH_TOKEN_KEY = 'tasks_auth_token';

export class AuthRequiredError extends Error {
  override readonly name = 'AuthRequiredError';
  readonly code = 'AUTH_REQUIRED';

  constructor(message = 'Please sign in to continue.') {
    super(message);
  }
}

/** True if the OpenAPI client will send a Bearer token (session or `VITE_API_TOKEN`). */
export function hasWritableApiToken(): boolean {
  if (typeof window === 'undefined') return true;
  const session = window.localStorage.getItem(TASKS_AUTH_TOKEN_KEY)?.trim();
  if (session) return true;
  return Boolean(import.meta.env.VITE_API_TOKEN?.trim());
}

export function ensureWritableApiToken(): void {
  if (!hasWritableApiToken()) {
    throw new AuthRequiredError();
  }
}

export function isAuthRequiredError(e: unknown): e is AuthRequiredError {
  return e instanceof AuthRequiredError;
}

export function isUnauthorizedApiError(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 401;
}

export type WriteAuthNotifyActions = {
  toastInfo: (msg: string) => void;
  openLoginModal: () => void;
  logout: () => void;
};

/**
 * Handle missing credentials or 401 from write APIs: toast, optional session clear, open login.
 * @returns true if handled (caller should usually `reset()` the mutation)
 */
export function notifyWriteAuthIssue(error: unknown, actions: WriteAuthNotifyActions): boolean {
  if (isAuthRequiredError(error)) {
    actions.toastInfo(error.message);
    actions.openLoginModal();
    return true;
  }
  if (isUnauthorizedApiError(error)) {
    const body = error.body;
    const msg =
      body && typeof body === 'object' && 'message' in body && typeof (body as { message?: unknown }).message === 'string'
        ? String((body as { message: string }).message)
        : 'Session expired or invalid. Please sign in again.';
    actions.toastInfo(msg);
    actions.logout();
    actions.openLoginModal();
    return true;
  }
  return false;
}
