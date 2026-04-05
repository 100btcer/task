import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { getAuthJwtSecretBytes } from '../authSecret.mjs';

const BCRYPT_ROUNDS = 10;
const USERNAME_RE = /^[a-z0-9_]{2,32}$/;

function normalizeUsername(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(s)) return null;
  return s;
}

function validatePassword(raw) {
  if (typeof raw !== 'string' || raw.length < 6 || raw.length > 128) {
    return null;
  }
  return raw;
}

/**
 * @param {object} opts
 * @param {ReturnType<import('../store/users.mjs').createUserStore>} opts.userStore
 */
export function createAuthRouter({ userStore }) {
  const router = Router();
  const key = getAuthJwtSecretBytes();

  async function signUserToken(username) {
    return new SignJWT({ typ: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(username)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(key);
  }

  router.post('/register', async (req, res, next) => {
    try {
      const username = normalizeUsername(req.body?.username);
      const password = validatePassword(req.body?.password);
      if (!username || !password) {
        return res.status(400).json({
          message:
            'username must be 2–32 chars (lowercase letters, digits, underscore); password 6–128 chars',
          code: 'VALIDATION',
          status: 400,
        });
      }
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const created = userStore.add(username, passwordHash);
      if (!created) {
        return res.status(409).json({ message: 'Username already taken', code: 'CONFLICT', status: 409 });
      }
      const token = await signUserToken(username);
      res.status(201).json({ token, username });
    } catch (e) {
      next(e);
    }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const username = normalizeUsername(req.body?.username);
      const password = validatePassword(req.body?.password);
      if (!username || !password) {
        return res.status(400).json({
          message: 'Invalid username or password',
          code: 'VALIDATION',
          status: 400,
        });
      }
      const row = userStore.get(username);
      if (!row) {
        return res.status(401).json({ message: 'Invalid username or password', code: 'UNAUTHORIZED', status: 401 });
      }
      const ok = await bcrypt.compare(password, row.passwordHash);
      if (!ok) {
        return res.status(401).json({ message: 'Invalid username or password', code: 'UNAUTHORIZED', status: 401 });
      }
      const token = await signUserToken(username);
      res.json({ token, username });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
