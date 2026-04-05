/**
 * Loads `config/blockchain.yaml` (bundled at build time via Vite `?raw`).
 * Reads `pollingIntervalMs` / `confirmationTimeoutMs` under `transactionReceipt` (line-based; keep keys unique in the file).
 */
import blockchainYaml from '../../config/blockchain.yaml?raw';

function positiveInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function readKeyMs(raw: string, key: string): number | undefined {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*(\\d+)\\s*(?:#.*)?$`, 'm');
  const m = raw.match(re);
  if (!m) return undefined;
  return Number.parseInt(m[1], 10);
}

function load(): { pollingIntervalMs: number; confirmationTimeoutMs: number } {
  try {
    const pollingIntervalMs = readKeyMs(blockchainYaml, 'pollingIntervalMs');
    const confirmationTimeoutMs = readKeyMs(blockchainYaml, 'confirmationTimeoutMs');
    return {
      pollingIntervalMs: positiveInt(pollingIntervalMs, 2000, 500, 60_000),
      confirmationTimeoutMs: positiveInt(confirmationTimeoutMs, 90_000, 5000, 600_000),
    };
  } catch (e) {
    console.warn('[blockchainUiConfig] Failed to read config/blockchain.yaml, using defaults.', e);
    return {
      pollingIntervalMs: 2000,
      confirmationTimeoutMs: 90_000,
    };
  }
}

export const blockchainUiConfig = load();
