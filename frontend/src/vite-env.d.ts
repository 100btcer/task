/// <reference types="vite/client" />

declare module '*.yaml?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  /** Tasks API base; `/api` = Vite → backend-ts (see vite.config.ts). */
  readonly VITE_API_BASE_URL?: string;
  /** Override proxy target only (default http://127.0.0.1:3000). */
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_API_TOKEN?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_CONTRACT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
