import { CHAIN_ID } from './config';

const TX_EXPLORER_BASE: Partial<Record<number, string>> = {
  137: 'https://polygonscan.com',
};

/** Block explorer URL for a transaction hash, or `null` if unknown chain. */
export function transactionExplorerUrl(txHash: string): string | null {
  const base = TX_EXPLORER_BASE[CHAIN_ID];
  if (!base) return null;
  return `${base}/tx/${txHash}`;
}
