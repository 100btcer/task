import { polygon, type Chain } from 'viem/chains';

/**
 * Viem `Chain` for Polygon PoS (matches `wagmiConfig` and default `VITE_CHAIN_ID=137`).
 */
export function getViemChain(): Chain {
  return polygon;
}
