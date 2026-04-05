import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { polygon } from 'wagmi/chains';

/**
 * Networks shown in RainbowKit. `VITE_CHAIN_ID` in `config.ts` must match this chain for reads/writes.
 */
const chains = [polygon] as const;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

if (!projectId?.trim()) {
  console.warn(
    '[RainbowKit] Set VITE_WALLETCONNECT_PROJECT_ID in .env (free at https://cloud.reown.com) for WalletConnect and mobile wallets.'
  );
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Technical test — API & blockchain',
  projectId: projectId?.trim() || '00000000000000000000000000000000',
  chains: [...chains],
  transports: {
    [polygon.id]: http(),
  },
  ssr: false,
});
