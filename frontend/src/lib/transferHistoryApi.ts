/**
 * Sync Blockchain Demo transfer history to the shared Tasks API SQLite DB
 * (`GET|POST|DELETE /api/blockchain/transfer-history` on backend-ts / backend-go).
 */
import { getApiBaseUrl } from '../config/apiServer';
import type { Hash } from 'viem';

export type TransferHistorySyncRow = {
  hash: Hash;
  to: `0x${string}`;
  amountHuman: string;
  amountRaw: string;
  symbol: string;
  asset: 'erc20' | 'native';
  status: 'success' | 'reverted' | 'failed';
  blockNumber: bigint | null;
  timestamp: number;
};

function apiRoot(): string {
  return getApiBaseUrl().replace(/\/$/, '');
}

function itemToJson(r: TransferHistorySyncRow) {
  return {
    hash: r.hash,
    to: r.to,
    amountHuman: r.amountHuman,
    amountRaw: r.amountRaw,
    symbol: r.symbol,
    asset: r.asset,
    status: r.status,
    blockNumber: r.blockNumber != null ? r.blockNumber.toString() : null,
    timestamp: r.timestamp,
  };
}

function parseItems(data: unknown): TransferHistorySyncRow[] | null {
  if (!data || typeof data !== 'object' || !('items' in data)) return null;
  const items = (data as { items: unknown }).items;
  if (!Array.isArray(items)) return null;
  const out: TransferHistorySyncRow[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const hash = o.hash;
    const to = o.to;
    if (typeof hash !== 'string' || typeof to !== 'string') continue;
    const status =
      o.status === 'success' || o.status === 'reverted' || o.status === 'failed' ? o.status : 'failed';
    const asset = o.asset === 'native' ? 'native' : 'erc20';
    const bn = o.blockNumber;
    let blockNumber: bigint | null = null;
    if (bn != null && bn !== '') {
      if (typeof bn === 'string' && /^\d+$/.test(bn)) blockNumber = BigInt(bn);
      else if (typeof bn === 'number' && Number.isFinite(bn)) blockNumber = BigInt(Math.floor(bn));
    }
    const ts = typeof o.timestamp === 'number' ? o.timestamp : Number(o.timestamp);
    if (!Number.isFinite(ts)) continue;
    out.push({
      hash: hash as Hash,
      to: to as `0x${string}`,
      amountHuman: typeof o.amountHuman === 'string' ? o.amountHuman : '',
      amountRaw: typeof o.amountRaw === 'string' ? o.amountRaw : '',
      symbol: typeof o.symbol === 'string' ? o.symbol : '',
      asset,
      status,
      blockNumber,
      timestamp: ts,
    });
  }
  return out;
}

/** Returns null if the request failed (offline, 503, etc.). */
export async function fetchTransferHistoryFromApi(
  chainId: number,
  walletAddress: string,
  baseUrl: string = apiRoot(),
): Promise<TransferHistorySyncRow[] | null> {
  const qs = new URLSearchParams({
    chainId: String(chainId),
    wallet: walletAddress,
  });
  try {
    const res = await fetch(`${baseUrl}/blockchain/transfer-history?${qs}`);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseItems(json);
  } catch {
    return null;
  }
}

export async function appendTransferHistoryRemote(
  chainId: number,
  walletAddress: string,
  items: TransferHistorySyncRow[],
  baseUrl: string = apiRoot(),
): Promise<boolean> {
  if (items.length === 0) return true;
  try {
    const res = await fetch(`${baseUrl}/blockchain/transfer-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId,
        walletAddress: walletAddress.toLowerCase(),
        items: items.map(itemToJson),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearTransferHistoryRemote(
  chainId: number,
  walletAddress: string,
  baseUrl: string = apiRoot(),
): Promise<boolean> {
  const qs = new URLSearchParams({
    chainId: String(chainId),
    wallet: walletAddress,
  });
  try {
    const res = await fetch(`${baseUrl}/blockchain/transfer-history?${qs}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
