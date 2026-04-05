# Technical Test: API Integration & Blockchain

This repository implements **[TASK.md](./TASK.md)**: a React frontend with a **type-safe OpenAPI client**, a **Node.js reference API**, and **wagmi** + **RainbowKit** (connect modal, wallet list, network switch) for ERC-20 read & write via **viem**.

## Contents

| Item | Description |
|------|-------------|
| [TASK.md](./TASK.md) | Full requirements and acceptance criteria |
| [NOTES.md](./NOTES.md) | Design decisions and future improvements |
| **frontend/** | React + TypeScript app |
| **backend-ts/** | Express + SQLite API matching **`docs/api-spec.json`** (default port **3000**); DB path in **`backend-ts/config/backend.yaml`** |
| **backend-go/** | Gin + SQLite (pure Go **`modernc.org/sqlite`**) — same contract & DB; default port **3001** ([README](./backend-go/README.md)); config in **`backend-go/config/`** |
| **docs/** | [api-spec.json](./docs/api-spec.json), [sqlite/schema.sql](./docs/sqlite/schema.sql), [BACKEND_SHARED_CONTRACT.md](./docs/BACKEND_SHARED_CONTRACT.md), [SWAGGER.md](./docs/SWAGGER.md) |

## TASK.md checklist (implemented)

| Criterion | Where |
|-----------|--------|
| Type-safe client from OpenAPI | `frontend/src/api/openapi`, `client.ts`, `npm run api:codegen` |
| GET list + detail, POST, PATCH, DELETE | `useApi.ts`, **API Demo** page |
| Paginated list + loading on page change | `ApiDemo.tsx`, `keepPreviousData` in `useTasksList` |
| Optimistic PATCH + rollback | `usePatchTask` in `useApi.ts` (list + detail cache) |
| Loading / user-visible errors | React Query + `ErrorMessage` + in-app toasts (`ToastProvider`) |
| Env-configurable API URL & auth | `VITE_API_BASE_URL`; session JWT from UI; optional `VITE_API_TOKEN` |
| README + Postman / Swagger | This file + **Postman** section below |
| Wallet connect (RainbowKit modal), network switch | **Blockchain Demo** — `ConnectButton` + wagmi |
| Contract read + write + tx status | `useReadContract` / `useWriteContract`, receipt status + explorer link |
| Chain / contract documented | **Blockchain** section below |

## Install & run

### Order of operations

1. **One-time:** install dependencies and create `.env` files → run **`npm run bootstrap`** at the repo root (runs `npm install` in root, **frontend**, and **backend-ts**, then copies `frontend/.env.example` → `frontend/.env` and `backend-ts/.env.example` → `backend-ts/.env` if missing).
2. **Every dev session:** start **backend-ts** before (or together with) the frontend. The Vite dev server proxies **`/api`** to **`http://127.0.0.1:3000`** (see `frontend/.env` → `VITE_API_PROXY_TARGET`). If you open the app while the API is down, API Demo requests will fail until the API is listening. Tasks and users persist in **`store/app.sqlite`** by default (see **backend-ts** README).

### One-time setup (repo root)

```bash
npm run bootstrap
```

After pulling new changes, refresh dependencies if needed:

```bash
npm run install:all
# or only one side:
cd frontend && npm install
cd backend-ts && npm install
```

### Start **backend-ts** only

From the **repo root** (same as `package.json` scripts):

```bash
npm run dev:api
```

Or from **`backend-ts/`**:

```bash
cd backend-ts && npm start
```

- Listens on **`PORT`** in **`backend-ts/.env`** (default **3000**).
- **Tasks API**: `http://127.0.0.1:3000/api/tasks`
- **Swagger UI**: `http://127.0.0.1:3000/api/docs`

### Dev: API + frontend together

```bash
npm run dev
```

This runs **backend-ts** and **Vite** in parallel (`concurrently`). You do not need to start them manually in two terminals.

- **API**: `http://127.0.0.1:3000/api/tasks` (see `backend-ts/.env` → `PORT`)
- **Swagger UI** (when the API is running): `http://127.0.0.1:3000/api/docs`
- **App**: Vite (e.g. `http://localhost:5173`) — `VITE_API_BASE_URL=/api` is proxied to the API (see `frontend/vite.config.ts`)

### Run services separately (two terminals)

**Start the API first**, then the web app:

| Step | Command | Service |
|------|---------|---------|
| 1 | `npm run dev:api` | **backend-ts** on port 3000 (or `cd backend-ts && npm start`) |
| 2 | `npm run dev:web` | Vite only (`cd frontend && npm run dev` also works) |

## Postman & OpenAPI

1. **Browser docs**: With the API running, open **`http://127.0.0.1:3000/api/docs`** for Swagger UI (Try it out). Raw schema: **`http://127.0.0.1:3000/api/openapi.json`**. **GET** `/tasks` works without a token; **POST/PATCH/DELETE** need **Authorize** with a JWT from **`POST /auth/register`** or **`POST /auth/login`** (see **Authentication & permissions**).
2. Import **`docs/api-spec.json`** into Postman, or import **`docs/postman-collection.json`** for ready-made requests (set **`baseUrl`** to `http://127.0.0.1:3000/api` and **`taskId`** after creating a task). Call **Register** or **Login**, then set **Authorization → Bearer** for write requests. **`PATCH /tasks/:id`** uses a **partial** JSON body (`PatchTaskRequest`): send only fields to update — for example `{ "completed": true }` is enough to toggle status; the frontend does the same (status toggle sends only `completed`; edit form sends only changed `title` / `description`).
3. Set the environment **base URL** to **`http://127.0.0.1:3000/api`** (or your deployed host).
4. Align **`VITE_API_BASE_URL`** in `frontend/.env` with that base (local dev often uses **`/api`** + Vite proxy).

Regenerate the TS client after spec changes:

```bash
cd frontend && npm run api:codegen
```

## Environment

| File | Purpose |
|------|---------|
| `frontend/.env` | `VITE_API_BASE_URL`, `VITE_API_PROXY_TARGET`, optional `VITE_API_TOKEN`, chain, contract, `VITE_WALLETCONNECT_PROJECT_ID` |
| `backend-ts/.env` | `PORT`; **`SQLITE_PATH`** (optional; default `store/app.sqlite`); **`AUTH_JWT_SECRET`** (recommended) — see **Authentication** |

## Authentication & permissions

**Tasks API:** **All** `/api/tasks` operations (GET list, GET by id, POST, PATCH, DELETE) require a **user JWT** from **`POST /api/auth/register`** or **`POST /api/auth/login`** (`username` + `password`). Each task row is tied to **`users.id`**; list and detail only return the signed-in user’s tasks. Public without Bearer: **`/api/health`**, **`/api/openapi.json`**, **`/api/docs`**, **`/api/auth/*`**.

| Item | Notes |
|------|--------|
| **Signing secret** | **`AUTH_JWT_SECRET`** in `backend-ts/.env` (falls back to **`API_JWT_SECRET`** if unset; insecure default if neither is set). |
| **Frontend** | Header **Log in** opens a modal; session in `localStorage`. Optional **`VITE_API_TOKEN`** is overridden by the session token when present. |
| **Swagger / Postman** | Use **Register** or **Login**, copy **`token`**, then **Authorize** as Bearer for **every** task request (including GET). |

**Extending later:** refresh tokens, RS256 + JWKS, password reset. On **`/api/tasks`**, **`req.auth`** is **`{ mode: 'user', username, userId }`** after **`tasksAuth`** validates the JWT. Tests can replace middleware with **`createApp({ tasksAuthMiddleware })`**.

## Blockchain (TASK Part 2)

| Setting | Default (`.env.example`) | Notes |
|---------|---------------------------|--------|
| **Chain ID** | `137` (Polygon PoS mainnet) | Must match `wagmiConfig` (`frontend/src/blockchain/wagmiConfig.ts`) |
| **Contract** | Polygon USDT `0xc2132d05d31c914a87c6611c10748aeb04b58e8f` (demo reads + `transfer`) | Replace with your token; extend ABI in `frontend/src/blockchain/contract.ts` if needed |
| **WalletConnect** | `VITE_WALLETCONNECT_PROJECT_ID` | Free project at [Reown Cloud](https://cloud.reown.com) (RainbowKit / mobile wallets) |

**Testing on Polygon mainnet:**

- You need **POL** on Polygon PoS for gas (native token; e.g. withdraw from an exchange to Polygon, or bridge). Connect the wallet and switch to **Polygon** (chain ID **137**) when prompted.
- **Local node**: To use a fork or custom chain instead, see **Configure a new contract or chain** below (you still need to register the chain in code + MetaMask).

**How to test blockchain features in the app (UI):**

1. Run **`npm run dev`**, open the Vite URL (e.g. `http://localhost:5173`), go to **Blockchain Demo**.
2. Click **Connect** (RainbowKit), pick a wallet, and approve switching to **Polygon** (chain ID **137**) if prompted.
3. Check **read** results: token name, symbol, decimals, total supply, and your **balance** (non-zero only if this wallet holds the configured ERC-20 on that chain).
4. **Transfer**: enter a valid **`0x…` recipient** and an amount as a **decimal string** in token units (e.g. `0.01` for USDT-style 6 decimals); confirm in the wallet; watch tx status and the explorer link.
5. **Clear history** (with confirmation) removes the demo transfer list stored in the browser (**localStorage**) for the current wallet + chain + contract.

### Configure a new contract or chain (step by step)

All blockchain settings for the demo are under **`frontend/`**. Copy **`frontend/.env.example`** → **`frontend/.env`** if you do not have one yet. After any change to **`.env`**, stop and restart **`npm run dev`** (Vite reads env at startup).

#### A. Same chain (Polygon), only a different ERC-20 token

Use this when you stay on **Polygon PoS (chain ID 137)** and only want another token contract.

1. Open **`frontend/.env`**.
2. Keep **`VITE_CHAIN_ID=137`**.
3. Set **`VITE_CONTRACT_ADDRESS=`** to your token’s address (`0x` + 40 hex characters). You can copy it from [Polygonscan](https://polygonscan.com/) token page.
4. Save and restart the dev server.

The UI uses the **standard ERC-20 ABI** in **`frontend/src/blockchain/contract.ts`** (`name`, `symbol`, `decimals`, `totalSupply`, `balanceOf`, `transfer`). If your token is non-standard (e.g. missing `name`), you must adjust that ABI or the read calls in **`BlockchainDemo.tsx`**.

#### B. Switch to another network (e.g. Sepolia, Ethereum mainnet)

Right now **RainbowKit / wagmi only load Polygon** in code. Changing **only** `VITE_CHAIN_ID` in `.env` is **not enough** — the wallet must use a chain that is also listed in **`wagmiConfig.ts`**. Do the following (example: **Sepolia** testnet).

1. **`.env`**
   - `VITE_CHAIN_ID=11155111` (Sepolia; look up the correct ID for your target network).
   - `VITE_CONTRACT_ADDRESS=0x…` (an ERC-20 on that same network).

2. **`frontend/src/blockchain/wagmiConfig.ts`**
   - Import the chain from **`wagmi/chains`**, e.g. `import { sepolia } from 'wagmi/chains'`.
   - Set `const chains = [sepolia] as const` (or include several chains if you want a network picker).
   - Under **`transports`**, add an entry for that chain’s id, e.g. `[sepolia.id]: http()` (default public RPC). For a private or faster RPC, use `http('https://your-rpc-url')`.

3. **`frontend/src/blockchain/chain.ts`**
   - Make **`getViemChain()`** return the **same** `Chain` object (e.g. `return sepolia` imported from **`viem/chains`**). If you support multiple IDs, use a `switch` on **`CHAIN_ID`** from **`config.ts`**.

4. **`frontend/src/blockchain/explorer.ts`**
   - Add a row to **`TX_EXPLORER_BASE`** for your **`CHAIN_ID`** (e.g. Sepolia: `https://sepolia.etherscan.io`) so transaction links work.

5. **`frontend/src/blockchain/config.ts`**
   - Extend **`getExpectedChainLabel()`** with a `case` for your chain ID so the UI shows a clear name (e.g. `"Sepolia"`).
   - Update **`SUPPORTED_CHAINS`** to include the new id if you use it for checks elsewhere.

6. **Wallet (MetaMask or similar)**  
   Add the network if it is not built-in; **chain ID** and **RPC URL** must match what you configured.

7. Restart **`npm run dev`**.

#### C. Local chain (Anvil, Hardhat, etc.)

1. Start your node and note **chain ID** and **RPC URL** (e.g. Anvil default `http://127.0.0.1:8545`, chain id often `31337`).
2. Define a **custom chain** with `viem` / `wagmi` (see [wagmi custom chains](https://wagmi.sh/react/guides/custom-chains)) and add it to **`wagmiConfig.ts`** `chains` + `transports`, then wire **`getViemChain()`** and **`explorer.ts`** (you can use `null` explorer or a block explorer URL if you run one).
3. Deploy or use a test ERC-20; put its address in **`VITE_CONTRACT_ADDRESS`**.
4. Import a test account in MetaMask and connect to the local RPC.

#### Quick reference — files to touch

| Goal | `.env` | Code files (typical) |
|------|--------|----------------------|
| New token, still Polygon | `VITE_CONTRACT_ADDRESS` | Usually none (if ERC-20 is standard) |
| New public chain | `VITE_CHAIN_ID`, `VITE_CONTRACT_ADDRESS` | `wagmiConfig.ts`, `chain.ts`, `explorer.ts`, `config.ts` |
| Local / custom RPC | Same + optional RPC in code | Above + custom `Chain` in `wagmiConfig` |

## Production build

```bash
npm run build
```

Set **`VITE_API_BASE_URL`** to your real API origin (not `/api`) unless the app and API share the same host behind a reverse proxy.

## More documentation

- [frontend/README.md](./frontend/README.md) — scripts, structure
- [backend-ts/README.md](./backend-ts/README.md) — Express + SQLite layout
