/**
 * Shared static Bearer token (demo / internal gateways). Sets `req.auth` for downstream RBAC hooks.
 *
 * @param {string} expectedToken raw token without "Bearer " prefix
 */
export function createStaticBearerMiddleware(expectedToken) {
  if (!expectedToken) {
    return (_req, _res, next) => next();
  }
  return (req, res, next) => {
    const h = req.headers.authorization;
    if (h === `Bearer ${expectedToken}`) {
      req.auth = { mode: 'static-bearer' };
      return next();
    }
    return res.status(401).json({ message: 'Unauthorized', code: 'UNAUTHORIZED', status: 401 });
  };
}
