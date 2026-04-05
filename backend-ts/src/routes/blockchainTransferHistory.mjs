import { Router } from 'express';

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const HASH_RE = /^0x[a-fA-F0-9]{64}$/;

function parseChainId(raw) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function normalizeWallet(w) {
  if (typeof w !== 'string') return null;
  const s = w.trim();
  if (!ADDR_RE.test(s)) return null;
  return s.toLowerCase();
}

/**
 * @param {object} o
 * @returns {boolean}
 */
function isValidItem(o) {
  if (!o || typeof o !== 'object') return false;
  if (typeof o.hash !== 'string' || !HASH_RE.test(o.hash)) return false;
  if (typeof o.to !== 'string' || !ADDR_RE.test(o.to)) return false;
  if (typeof o.amountHuman !== 'string') return false;
  if (typeof o.amountRaw !== 'string') return false;
  if (typeof o.symbol !== 'string' || !o.symbol.trim()) return false;
  if (o.asset !== 'native' && o.asset !== 'erc20') return false;
  if (o.status !== 'success' && o.status !== 'reverted' && o.status !== 'failed') return false;
  if (o.blockNumber != null && typeof o.blockNumber !== 'string') return false;
  const ts = Number(o.timestamp);
  if (!Number.isFinite(ts) || ts < 0) return false;
  return true;
}

/**
 * @param {ReturnType<import('../store/blockchainTransferHistorySqlite.mjs').createBlockchainTransferHistoryStore>} store
 */
export function createBlockchainTransferHistoryRouter(store) {
  const router = Router();

  router.get('/transfer-history', (req, res) => {
    const chainId = parseChainId(req.query.chainId);
    const wallet = normalizeWallet(req.query.wallet);
    if (chainId === null || !wallet) {
      return res.status(400).json({
        message: 'chainId (positive int) and wallet (0x + 40 hex) are required',
        code: 'VALIDATION',
        status: 400,
      });
    }
    try {
      const items = store.list(chainId, wallet);
      res.json({ items });
    } catch (e) {
      res.status(500).json({ message: e?.message ?? 'Internal error' });
    }
  });

  router.post('/transfer-history', (req, res) => {
    const body = req.body ?? {};
    const chainId = parseChainId(body.chainId);
    const wallet = normalizeWallet(body.walletAddress);
    const items = body.items;
    if (chainId === null || !wallet || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'chainId, walletAddress, and non-empty items[] are required',
        code: 'VALIDATION',
        status: 400,
      });
    }
    if (items.length > 200) {
      return res.status(400).json({ message: 'items[] max length 200', code: 'VALIDATION', status: 400 });
    }
    for (const it of items) {
      if (!isValidItem(it)) {
        return res.status(400).json({ message: 'invalid item in items[]', code: 'VALIDATION', status: 400 });
      }
    }
    try {
      const normalized = items.map((it) => ({
        hash: it.hash.toLowerCase(),
        to: it.to.toLowerCase(),
        amountHuman: it.amountHuman,
        amountRaw: it.amountRaw,
        symbol: it.symbol,
        asset: it.asset,
        status: it.status,
        blockNumber: it.blockNumber == null ? null : String(it.blockNumber),
        timestamp: Math.floor(Number(it.timestamp)),
      }));
      store.insertIgnoreBatch(chainId, wallet, normalized);
      res.status(201).json({ ok: true, inserted: normalized.length });
    } catch (e) {
      res.status(500).json({ message: e?.message ?? 'Internal error' });
    }
  });

  router.delete('/transfer-history', (req, res) => {
    const chainId = parseChainId(req.query.chainId);
    const wallet = normalizeWallet(req.query.wallet);
    if (chainId === null || !wallet) {
      return res.status(400).json({
        message: 'chainId and wallet query params are required',
        code: 'VALIDATION',
        status: 400,
      });
    }
    try {
      store.clear(chainId, wallet);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: e?.message ?? 'Internal error' });
    }
  });

  return router;
}
