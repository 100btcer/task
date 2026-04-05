# Frontend – API & Blockchain Technical Test

React + TypeScript frontend with API integration and blockchain (Web3) support.

## Easiest way to run (with API)

From the **repository root** (not only this folder):

```bash
npm run bootstrap
npm run dev
```

That starts **backend-ts** on port 3000 and Vite (e.g. 5173). `VITE_API_BASE_URL=/api` is proxied to the API — see `vite.config.ts`.

Design notes: repository **[NOTES.md](../NOTES.md)**.

## Run only this package

```bash
npm install
cp .env.example .env   # if you do not have .env yet
npm run dev
```

You must still run **`backend-ts`** separately (or point `.env` at another backend), or `/api-demo` will show a connection error.

## Structure

```
src/
  api/           # client.ts (env + ApiClient) and openapi/ (codegen output, DefaultService)
  blockchain/    # wagmiConfig (RainbowKit), chain, config, contract ABI, explorer
  components/    # Layout, ErrorMessage, Loading, ToastProvider, Spinner
  hooks/         # useApi
  pages/         # Home, ApiDemo, BlockchainDemo
  routes/        # paths.ts (ROUTES constants)
  types/         # Re-exports of generated schema types
```

## API

- **Base URL**: In local dev, `VITE_API_BASE_URL=/api` (Vite proxy → `http://localhost:3000`). For a remote API, use a full URL (and configure CORS on the server).
- **Auth**: Optional `VITE_API_TOKEN` — sent as `Authorization: Bearer …` (static secret or full JWT if the API uses `API_JWT_SECRET`; see repo `README.md` → *Authentication & permissions*).
- **Swagger / codegen**: See repo `docs/SWAGGER.md`. Regenerate with:
  ```bash
  npx openapi-typescript-codegen -i ../docs/api-spec.json -o ./src/api/openapi
  ```
- **Postman**: Repo **`docs/postman-collection.json`** or import OpenAPI from **`docs/api-spec.json`**; align base URL with `.env`.

## Blockchain

- **Wallet UI**: **RainbowKit** `ConnectButton` + **wagmi** (see `src/blockchain/wagmiConfig.ts`, providers in `App.tsx`).
- **Network**: **Polygon PoS mainnet** (chain ID **137**) by default; RainbowKit only lists Polygon in `wagmiConfig.ts`.
- **Env**: `VITE_CHAIN_ID` (default `137`), `VITE_CONTRACT_ADDRESS`, `VITE_WALLETCONNECT_PROJECT_ID` (Reown Cloud — see repo `README.md`). Copy **`.env.example`** to `.env` if needed.
- **Switching chain or token:** step-by-step guide is in the repo root **[README.md](../README.md)** → section *Configure a new contract or chain*.

## Scripts

- `npm run dev` / `npm start` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build (same `/api` proxy as dev if configured)
- `npm run api:codegen` — regenerate `src/api/openapi` from `../docs/api-spec.json`

## Implementation notes

- **Client**: openapi-typescript-codegen + axios; `apiClient` in `src/api/client.ts`; list/detail queries wire **AbortSignal** to the generated client for cancellation on unmount/refetch.
- **API Demo**: Pagination (`keepPreviousData` + page loading), **Detail** opens `GET /tasks/:id`, delete confirm modal + toasts via **`ToastProvider`** in `App.tsx`; **PATCH** uses optimistic cache updates in **`usePatchTask`**.
- **Data**: TanStack Query; `select` narrows OpenAPI unions to `Task` / `TaskListResponse`; mutations `retry: 0` (see `App.tsx`).
- **TypeScript**: `erasableSyntaxOnly` is false in `tsconfig.app.json` for generated class parameter properties.

Longer write-up: **[NOTES.md](../NOTES.md)**.
