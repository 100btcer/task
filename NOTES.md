# Design notes (technical test)

## API integration

- **Client**: [openapi-typescript-codegen](https://github.com/ferdikoomen/openapi-typescript-codegen) against **`docs/api-spec.json`**, wrapped by `src/api/client.ts` (`ApiClient` + env `BASE` / `TOKEN`). Keeps types aligned with the OpenAPI schema.
- **Data layer**: [TanStack Query](https://tanstack.com/query) for caching, loading/error states, and cache invalidation after mutations.
- **List pagination**: `PAGE_SIZE` + `page` state; `keepPreviousData` on the list query so changing pages keeps the previous page visible while `isFetching` shows a “Loading page…” banner; Previous/Next disabled while fetching.
- **Detail UX**: Explicit **Detail** button sets `selectedId`; the panel shows `GET /tasks/{id}` and a dedicated **Loading task detail…** block (with `Loading` + `aria-live`).
- **Delete**: Modal confirmation; **Confirm delete** shows **Deleting…**; success uses in-app toasts (`ToastProvider` + `useToast` in `App.tsx`).
- **Optimistic PATCH**: `usePatchTask` updates cached list rows and the open detail query immediately, rolls back on error, then `invalidateQueries` on settle. Toggle row shows **Updating…** only for that task.
- **Cancellation**: List/detail queries attach `AbortSignal` to the generated client’s `CancelablePromise.cancel()` when React Query aborts (unmount / refetch).
- **Retries**: Queries use `retry: 1` globally; mutations use `retry: 0` to avoid duplicate POST/PATCH (see `App.tsx`).
- **Backend**: Reference **`backend-ts/`** (Express + SQLite) implements the same contract for local development and Postman checks.

## Blockchain

- **Stack**: [wagmi](https://wagmi.sh) v2 + [RainbowKit](https://www.rainbowkit.com/) (`ConnectButton`, wallet picker modal, built-in network switching) on top of [viem](https://viem.sh). Config: **`src/blockchain/wagmiConfig.ts`** (`getDefaultConfig`), chain **Polygon PoS mainnet** (`polygon`); “expected” chain ID defaults to **137** via **`VITE_CHAIN_ID`** in **`config.ts`**.
- **Env**: `VITE_CHAIN_ID`, `VITE_CONTRACT_ADDRESS`, and **`VITE_WALLETCONNECT_PROJECT_ID`** (free from [Reown / WalletConnect Cloud](https://cloud.reown.com)) for WalletConnect and many mobile wallets. Injected wallets (e.g. MetaMask) work without it but the console warns if the ID is missing.
- **Contract hooks**: `useReadContract` (`balanceOf`), `useWriteContract` + `useWaitForTransactionReceipt` (`transfer`); explorer links via **`explorer.ts`** (Polygonscan). Extend **`chain.ts` / `wagmiConfig`** for Anvil or extra chains if you leave Polygon.

## Routing

- **`src/routes/paths.ts`** exports `ROUTES` so new pages only need updates in one place (router + nav + links).

## What we would improve with more time

- Automated tests (Vitest + MSW for API; wallet mocks for hooks).
- Runtime response validation (e.g. Zod) next to OpenAPI.
- Toasts for PATCH toggle (optional; optimistic UI already feels instant).
- Richer pagination (page numbers, URL sync); optional DB backups for `store/app.sqlite`.
- i18n if the product is multi-locale.
