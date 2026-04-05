import { jwtVerify } from 'jose';

/**
 * JWT Bearer (HS256). Verified claims are on `req.auth.payload` for future roles / `sub` checks.
 *
 * Env: `API_JWT_SECRET` (required), optional `API_JWT_ISSUER`, `API_JWT_AUDIENCE`.
 */
export function createJwtBearerMiddleware() {
  const secret = process.env.API_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('createJwtBearerMiddleware: set API_JWT_SECRET');
  }
  const key = new TextEncoder().encode(secret);
  const issuer = process.env.API_JWT_ISSUER?.trim() || undefined;
  const audience = process.env.API_JWT_AUDIENCE?.trim() || undefined;

  return function jwtAuth(req, res, next) {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED', status: 401 });
    }
    const token = h.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED', status: 401 });
    }

    const verifyOpts = { algorithms: ['HS256'] };
    if (issuer) verifyOpts.issuer = issuer;
    if (audience) verifyOpts.audience = audience;

    jwtVerify(token, key, verifyOpts)
      .then(({ payload }) => {
        req.auth = { mode: 'jwt', payload };
        next();
      })
      .catch(() => {
        res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED', status: 401 });
      });
  };
}
