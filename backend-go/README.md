# Tasks API — Go (Gin) + SQLite

Reference implementation of **`docs/api-spec.json`**: same HTTP contract and default database as **`backend-ts`** (Node on port **3000**), so you can compare or swap implementations during development.

| | **backend-go** (this service) | **backend-ts** |
|--|-------------------------------|----------------|
| Default port | **3001** | **3000** |
| SQLite driver | [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) (pure Go, **no CGO**) | better-sqlite3 |
| Swagger UI assets | CDN (`swagger-ui-dist@5.11.0`) | Same-origin `swagger-ui-dist` npm package |

Cross-language details: **`docs/BACKEND_SHARED_CONTRACT.md`**.

## Requirements

- **Go 1.21+**
- Run from a working directory from which the monorepo root can be found by walking **upward** until **`docs/sqlite/schema.sql`** exists (e.g. `cd backend-go` from the repo clone).

## Data storage

- **SQLite path** (see **`docs/BACKEND_SHARED_CONTRACT.md`**):
  1. **`SQLITE_PATH`** (highest priority)
  2. **`config/backend.yaml`** → `database.path` (relative to **`backend-go/`**; default **`../store/app.sqlite`** → repo **`store/app.sqlite`**)
  3. Fallback: **`store/app.sqlite`** under monorepo root
- **Canonical DDL:** **`docs/sqlite/schema.sql`** (repo root) — executed on startup (idempotent `CREATE IF NOT EXISTS` + `schema_migrations`). Line comments are stripped before splitting statements so semicolons inside comments do not break parsing.
- **WAL** and **foreign_keys** are enabled via the SQLite connection string.

## Configuration files

| File | Purpose |
|------|---------|
| **`config/backend.yaml`** | **`server`**, **`cors`**, and **`database.path`** — **no secrets** (same file for HTTP + SQLite path) |

**Secrets** (JWT, etc.) are **not** in YAML. Use environment variables (see below). You can copy **`.env.example`** to **`.env`** and `export` values in your shell; Go does not load `.env` automatically unless you use a tool such as `godotenv`.

**`PORT`** overrides `server.port` when set (bound in **`config.Load()`**).

## Run & build

```bash
cd backend-go
go mod tidy
go run .
```

```bash
# Optional
make run    # go run main.go
make build  # outputs bin/backend-go
```

Pure-Go build (no C toolchain):

```bash
CGO_ENABLED=0 go build -o bin/backend-go .
```

From the **repository root** (if you add a script):

```bash
npm run dev:api-go
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| **`PORT`** | Listen port (overrides **`config/backend.yaml`** `server.port`; default **3001**) |
| **`SQLITE_PATH`** | Absolute or relative path to the SQLite file |
| **`AUTH_JWT_SECRET`** | HS256 secret for user session JWTs (`typ: user`, `sub` = username). Same name as **`backend-ts`** if you want tokens to work on both servers. |
| **`API_JWT_SECRET`** | Fallback if **`AUTH_JWT_SECRET`** is unset |
| **`STATIC_DIR`** | Optional directory for a built SPA; otherwise **`../frontend-dist`**, **`../frontend/dist`**, or none |

If **`AUTH_JWT_SECRET`** and **`API_JWT_SECRET`** are both unset, a **dev-only default** is used (see log line on startup).

## HTTP surface

Base path: **`/api`**.

| Area | Notes |
|------|--------|
| **Tasks** | `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:taskId` |
| **Blockchain Demo** | `GET/POST/DELETE /api/blockchain/transfer-history` — transfer log in shared SQLite (`chainId` + `wallet` query params; POST body `items[]`) |
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login` → `{ token, username }` |
| **Health** | `GET /api/health` → `ok`, `service`, `storage: sqlite`, `database` path |
| **OpenAPI** | `GET /api/openapi.json` — merges **`docs/api-spec.json`** with **Servers**: Node **:3000** and Go **:3001** for the current hostname |
| **Swagger** | `GET /api/docs` — **Try it out**; pick **Servers** to hit **3000** or **3001** |

## Auth (same rules as **backend-ts**)

- **All** methods on **`/api/tasks`** (including GET list and GET by id) require **`Authorization: Bearer <token>`** from register/login (HS256, claim **`typ: user`**, subject = username). Tasks are filtered by the resolved **`users.id`**.
- In Swagger: use **Authorize** after **Register** or **Login** before any task request.

## Project layout

| Path | Role |
|------|------|
| **`main.go`** | `config.Load`, `svc.NewServiceContext`, router, graceful shutdown |
| **`config/`** | Viper load: **`backend.yaml`**, **`const.go`**, **`config.go`** — **`RepoRoot`** (monorepo) + **`PackageRoot`** (`backend-go/`) |
| **`internal/svc/`** | **`sqlite.go`** — open DB, apply schema; **`context.go`** — lifecycle |
| **`internal/dao/`** | Raw SQL for **users** and **tasks** |
| **`internal/service/auth/`** | Register / login (bcrypt cost 10), JWT signing |
| **`internal/service/tasks/`** | List (pagination), create, get, patch, delete |
| **`internal/router/route.go`** | Gin engine, CORS, routes, static / SPA fallback |
| **`internal/router/handler/`** | **`auth/`**, **`tasks/`**, **`openapi/`** (spec + Swagger HTML) |
| **`internal/router/middleware/`** | **`tasks_auth.go`** (JWT + user id for `/api/tasks`), **`mutation.go`** (legacy / unused by default router), **`error.go`** |
| **`internal/staticdir/`** | Resolve **`STATIC_DIR`** / default frontend build dirs |
| **`pkg/reporoot/`** | Find monorepo root via **`docs/sqlite/schema.sql`** |
| **`pkg/sqlitepath/`** | Resolve DB path from env + **`config/backend.yaml`** |
| **`pkg/userjwt/`** | Sign / verify user JWTs compatible with **backend-ts** |

Module path: **`task/backend-go`**.

## CORS

Responses include **`Access-Control-Allow-Credentials: true`**, expanded allow-headers (incl. **`Authorization`**, **`Accept`**), and a long preflight **`Access-Control-Max-Age`**. When **`cors.origins`** contains **`"`*`"`** or the list is empty, any **`Origin`** is allowed (**`AllowOriginFunc`**). Otherwise **`AllowOrigins`** is set from the list.

Set **`CORS_ORIGINS`** in the environment (comma-separated, overrides YAML) for a quick allowlist, e.g. **`http://localhost:5173`** for a Vite dev server talking directly to this API.

## Coexistence with **backend-ts**

- Default **`database.path`** points at the **same** **`store/app.sqlite`** as Node when both use repo defaults.
- **Do not** run both servers **writing** to the same SQLite file at the same time; stop one backend or set different **`SQLITE_PATH`** values for local experiments.

## See also

- **`docs/api-spec.json`** — OpenAPI contract  
- **`docs/SWAGGER.md`** — Swagger / codegen notes  
- **`docs/BACKEND_SHARED_CONTRACT.md`** — shared DB, schema, and config semantics  
