import { jwtVerify } from 'jose';
import { getAuthJwtSecretBytes } from '../authSecret.mjs';

/**
 * Requires a valid user JWT on **all** methods (including GET) for `/api/tasks`.
 * Sets `req.auth = { mode: 'user', username, userId }` using `userStore.getIdByUsername(sub)`.
 * OPTIONS is passed through for CORS.
 *
 * @param {{ getIdByUsername: (username: string) => number | undefined }} userStore
 */
export function createRequireUserForTasksMiddleware(userStore) {
  const key = getAuthJwtSecretBytes();

  return function tasksAuth(req, res, next) {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Sign in required — send Authorization: Bearer <token> to access tasks',
        code: 'UNAUTHORIZED',
        status: 401,
      });
    }
    const token = h.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        message: 'Sign in required — send Authorization: Bearer <token> to access tasks',
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
        const userId = userStore.getIdByUsername(payload.sub);
        if (userId == null) {
          return res.status(401).json({
            message: 'Session expired or invalid. Please sign in again.',
            code: 'UNAUTHORIZED',
            status: 401,
          });
        }
        req.auth = { mode: 'user', username: payload.sub, userId, payload };
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
