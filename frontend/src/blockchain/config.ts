/**
 * Blockchain config – set chain and contract in .env (VITE_CHAIN_ID, VITE_CONTRACT_ADDRESS).
 */

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 137);
export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as `0x${string}`;

/** Supported out of the box for network switch / explorer links; extend for local nodes. */
export const SUPPORTED_CHAINS = [137] as const;

export function getExpectedChainLabel(): string {
  switch (CHAIN_ID) {
    case 137:
      return 'Polygon';
    default:
      return `Chain ${CHAIN_ID}`;
  }
}

/** Ticker for the chain’s native gas token (UI labels when `useBalance` has not loaded yet). */
export function getNativeCurrencySymbol(): string {
  switch (CHAIN_ID) {
    case 137:
      return 'POL';
    default:
      return 'Native';
  }
}
