# Shared backend contract (Node `backend-ts` ↔ Go `backend-go`)

This document is the **cross-language contract** so **Go (`backend-go`)** and **Node (`backend-ts`)** share the **same SQLite file by default**, the **same canonical schema**, and the **same HTTP shapes** from **`docs/api-spec.json`**.

Each backend keeps its **own** non-secret YAML under its package: **`backend-ts/config/backend.yaml`** and **`backend-go/config/backend.yaml`**. Both may define **`cors.origins`** (string list; **`"`*`"`** or an empty resolved list means allow any origin by reflecting the request **`Origin`**). Optional env **`CORS_ORIGINS`** (comma-separated) overrides the YAML list in **both** backends when set. **`backend-go`** also has **`server`** (port, mode) in YAML.

- **Go service:** `backend-go/` — default port **3001**, `modernc.org/sqlite` (pure Go, no CGO). See `backend-go/README.md`.
- **Node service:** `backend-ts/` — default port **3000**.

## 1. Configuration resolution order

| Priority | Source | Notes |
|----------|--------|--------|
| 1 (highest) | Environment variable **`SQLITE_PATH`** | Absolute or process-relative path to the SQLite file. Must be supported by Go. |
| 2 | **`backend-ts/config/backend.yaml`** or **`backend-go/config/backend.yaml`** → `database.path` | Default **`store/app.sqlite`** — **relative to the monorepo root** (same folder as `docs/`). Paths starting with **`../`** are relative to that **backend’s package directory** instead. |
| 3 | Default | **`store/app.sqlite`** under the **monorepo root** (same folder that contains `docs/` and `store/`). |

**Secrets** (JWT signing, optional static bearer, etc.) are **not** in those YAML files. Use environment variables (or process manager / k8s secrets): **`AUTH_JWT_SECRET`** / **`API_JWT_SECRET`** must match between backends if tokens should be interchangeable. Node reads **`backend-ts/.env`**; Go reads the process environment (optionally set from **`backend-go/.env`** via your shell or a loader).

Optional field **`api.defaultPort`** in **`backend-ts/config/backend.yaml`** is for humans and tooling only. **Node** uses **`PORT`** in `backend-ts/.env`; **Go** uses **`PORT`** (bound in `backend-go/config.Load`) or **`server.port`** in **`backend-go/config/backend.yaml`** (default **3001**).

**Monorepo root** (for `docs/`, `store/`, default DB path): Node resolves from the `backend-ts` package location; Go discovers by walking upward from the working directory until **`docs/sqlite/schema.sql`** exists.

## 2. Database file and concurrency

- Single SQLite file (default **`store/app.sqlite`** at repo root — both backends use the same `database.path` in their `backend.yaml`).
- **WAL** mode is enabled by both backends on open; do not run two writers on the same file at once.
- **Do not commit** `*.sqlite` (see repo `.gitignore`).

## 3. Schema source of truth

- **Canonical DDL:** `docs/sqlite/schema.sql`
- **Applied by:** `backend-ts/src/db/sqlite.mjs` and `backend-go/internal/svc/sqlite.go` on startup (after stripping full-line `--` comments so semicolons inside comments do not split statements).

**Migration table:** `schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT)`. Version **1** is recorded by `schema.sql`. Future changes should add **`002_*.sql`** (or similar) in `docs/sqlite/migrations/`, bump logic in both backends, and insert the new version — design this when the first breaking schema change is needed.

## 4. Table semantics (compatibility checklist for Go)

| Table | Purpose |
|-------|---------|
| `users` | `username` (unique, case-insensitive via `COLLATE NOCASE`), `password_hash` (bcrypt, same rounds as Node `auth` routes). |
| `tasks` | **`user_id`** (FK → `users.id`, NOT NULL), `title`, optional `description`, `completed` as **0/1**, `created_at` / `updated_at` as **ISO-8601 strings** (Node uses `new Date().toISOString()`). |
| `blockchain_transfer_history` | Blockchain Demo transfer log: **`chain_id`**, **`wallet_address`** (lowercased `0x` + 40 hex), **`tx_hash`**, `to_address`, amounts, `asset` (`native` \| `erc20`), `status`, optional `block_number` (decimal string), **`timestamp_ms`**. Unique on `(chain_id, wallet_address, tx_hash)`. Public REST: **`/api/blockchain/transfer-history`**. |

**List ordering:** for a given user, tasks sorted by `datetime(created_at) DESC`, then `id DESC` — match `taskStoreSqlite.mjs`.

**Legacy DBs:** both backends run a small migration after applying `schema.sql`: if `tasks.user_id` is missing, add the column, assign existing rows to the **first** user by id (if any), delete rows that still have NULL `user_id`, then ensure index `idx_tasks_user_created`.

## 5. HTTP and auth

- **OpenAPI:** `docs/api-spec.json` — Go must expose the same paths and response shapes.
- **Auth rules:** **`/api/tasks`** (all methods, including GET list and GET by id) requires **`Authorization: Bearer <JWT>`** from `POST /api/auth/login` or `POST /api/auth/register`. JWT `sub` is the normalized username; the server resolves it to **`users.id`** and scopes every task row to that id. Public without Bearer: `/api/health`, `/api/openapi.json`, `/api/docs`, `/api/auth/*`.

## 6. Repository layout reference

```text
<repo>/
  docs/
    sqlite/
      schema.sql          # canonical DDL
    api-spec.json
    BACKEND_SHARED_CONTRACT.md
  store/                  # default DB directory (gitignored *.sqlite)
  backend-ts/
    config/
      backend.yaml        # CORS origins, database.path (no secrets)
  backend-go/
    config/
      backend.yaml        # server, CORS, database.path (no secrets)
```

Keep each **`backend-*/config/backend.yaml`** `database.path` aligned with the **same file** if both backends should share one database; keep **`docs/sqlite/schema.sql`** authoritative for DDL.
