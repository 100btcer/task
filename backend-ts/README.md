# Tasks API — Node.js (Express) + SQLite

Reference backend for the technical test: implements **`docs/api-spec.json`** (paths under **`/api`**).

## Data storage

- **SQLite** path resolution (see **`docs/BACKEND_SHARED_CONTRACT.md`**):
  1. **`SQLITE_PATH`** in `.env` (highest priority)
  2. **`backend-ts/config/backend.yaml`** → `database.path` (relative to **`backend-ts/`**)
  3. Default **`store/app.sqlite`** under the monorepo root
- **Canonical DDL:** **`docs/sqlite/schema.sql`** — applied on every startup (idempotent `CREATE IF NOT EXISTS` + `schema_migrations`).
- WAL mode is enabled. Parent directories for the DB file are created automatically.

## Run

```bash
npm run setup   # same as npm install (first time)
npm start
```

Full-repo setup (frontend + backend-ts + root `concurrently`) is **`npm run setup` from the repository root**, not from this folder.

- API: `http://127.0.0.1:3000/api/tasks` (default `PORT=3000`, override in `.env`)
- Health: `GET /api/health` — includes `storage: "sqlite"` and `database` path when using the default store
- **Auth**: `POST /api/auth/register`, `POST /api/auth/login` — return a **Bearer JWT** for write operations.
- **Swagger UI**: `http://127.0.0.1:3000/api/docs` — interactive docs (UI assets from **`swagger-ui-dist`** at **`/api/docs/_dist/*`**; spec from **`GET /api/openapi.json`**). **`GET /api/openapi.json`** sets **Servers** to this request’s host. Use **Authorize** with a token from **Register** or **Login** before **Try it out** on POST/PATCH/DELETE under `/tasks`.
- **OpenAPI JSON**: `GET /api/openapi.json` (same schema as `docs/api-spec.json` in the repo)

## CORS

Browser clients on another origin (e.g. Vite on **`:5173`** calling **`http://127.0.0.1:3000`**) get **`Access-Control-Allow-Credentials`**, **`Authorization`** on preflight, and a long **`Access-Control-Max-Age`**. Configure **`cors.origins`** in **`config/backend.yaml`** (default **`"`*`"`** = reflect any **`Origin`**) or set **`CORS_ORIGINS`** (comma-separated) in **`.env`**. Matches **backend-go** behavior; see **`docs/BACKEND_SHARED_CONTRACT.md`**.

## Layout

| Path | Role |
|------|------|
| `server.mjs` | Entry (loads `dotenv`, listens) |
| `src/app.mjs` | Express app: CORS, JSON, routes, errors |
| `src/corsConfig.mjs` | CORS allowlist (**`cors.origins`** in **`config/backend.yaml`** or **`CORS_ORIGINS`** env) — aligned with **backend-go** |
| `src/db/sqlite.mjs` | `resolveSqlitePath()`, `openSqlite()` — reads **`backend-ts/config/backend.yaml`**, runs **`docs/sqlite/schema.sql`** |
| `src/store/taskStoreSqlite.mjs` | Task CRUD (SQLite) |
| `src/store/userStoreSqlite.mjs` | Users (bcrypt hashes in SQLite) |
| `src/store.mjs` | In-memory tasks (optional; used only if you inject `createApp({ store })`) |
| `src/store/users.mjs` | In-memory users (optional; used with custom `userStore`) |
| `src/routes/auth.mjs` | `POST /register`, `POST /login` (mounted at `/api/auth`) |
| `src/routes/tasks.mjs` | `GET/POST /`, `GET/PATCH/DELETE /:taskId` (mounted at `/api/tasks`) |
| `src/routes/blockchainTransferHistory.mjs` | `GET/POST/DELETE /transfer-history` (mounted at `/api/blockchain`; SQLite only) |
| `src/store/blockchainTransferHistorySqlite.mjs` | Blockchain Demo transfer log persistence |
| `src/middleware/tasksAuth.mjs` | All methods on `/api/tasks` (including GET) require user JWT + DB user id |
| `src/middleware/mutationAuth.mjs` | Legacy helper (not mounted by default server) |
| `src/authSecret.mjs` | HS256 key for user session tokens (`AUTH_JWT_SECRET` / fallback) |
| `src/middleware/apiAuth.mjs` | Legacy helpers / `describeApiAuthMode()` for logs (not mounted by default) |

## Auth

- **All** routes under **`/api/tasks`** — require **`Authorization: Bearer <token>`** from **`POST /api/auth/register`** or **`POST /api/auth/login`** (HS256 JWT, claim `typ: user`, subject = username). The server resolves `sub` to **`users.id`** and scopes tasks to that user.
- **Public:** **`GET /api/health`**, **`GET /api/openapi.json`**, **`GET /api/docs`**, **`POST /api/auth/*`**.
- **Secret:** set **`AUTH_JWT_SECRET`** in `.env` for production. If unset, **`API_JWT_SECRET`** is reused; if both unset, a **dev-only default** is used (see startup warning).
- **Users** persist in SQLite (same file as tasks).

Override for tests: **`createApp({ store, userStore })`** uses in-memory stores and skips opening the default SQLite file. **`createApp({ tasksAuthMiddleware })`** replaces **`tasksAuth`** on **`/api/tasks`**.
