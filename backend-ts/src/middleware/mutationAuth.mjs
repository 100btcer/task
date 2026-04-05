import { jwtVerify } from 'jose';
import { getAuthJwtSecretBytes } from '../authSecret.mjs';

/**
 * Legacy helper: GET/HEAD/OPTIONS anonymous; other methods require user JWT.
 * **Production app** mounts {@link createRequireUserForTasksMiddleware} on `/api/tasks` instead; this middleware is not used on the default server.
 */
export function createMutationAuthMiddleware() {
  const key = getAuthJwtSecretBytes();

  return function mutationAuth(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      req.auth = { mode: 'anonymous' };
      return next();
    }

    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Sign in required — send Authorization: Bearer <token> for write operations',
        code: 'UNAUTHORIZED',
        status: 401,
      });
    }
    const token = h.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        message: 'Sign in required — send Authorization: Bearer <token> for write operations',
        code: 'UNAUTHORIZED',
        status: 401,
      });
    }

    jwtVerify(token, key, { algorithms: ['HS256'] })
      .then(({ payload }) => {
        if (payload.typ !== 'user' || typeof payload.sub !== 'string') {
          return res.status(401).json({
            message: 'Session expired or invalid. Please sign in again.',
            code: 'UNAUTHORIZED',
            status: 401,
          });
        }
        req.auth = { mode: 'user', username: payload.sub, payload };
        next();
      })
      .catch(() => {
        res.status(401).json({
          message: 'Session expired or invalid. Please sign in again.',
          code: 'UNAUTHORIZED',
          status: 401,
        });
      });
  };
}
