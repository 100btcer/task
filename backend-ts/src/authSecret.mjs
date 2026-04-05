import { TextEncoder } from 'node:util';

let cachedKey;
let warnedInsecure;

/**
 * HS256 key for login/register session JWTs (`typ: user` claim).
 * Prefer `AUTH_JWT_SECRET`; falls back to `API_JWT_SECRET` for convenience.
 */
export function getAuthJwtSecretBytes() {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_JWT_SECRET?.trim() || process.env.API_JWT_SECRET?.trim();
  if (!secret && !warnedInsecure) {
    warnedInsecure = true;
    console.warn(
      '[backend-ts] AUTH_JWT_SECRET (or API_JWT_SECRET) unset — using insecure dev default for user JWTs'
    );
  }
  cachedKey = new TextEncoder().encode(secret || 'dev-user-auth-secret-change-me');
  return cachedKey;
}
