# Swagger / OpenAPI

## Spec in this repo

- **`docs/api-spec.json`** — OpenAPI **3.0.3** for the **Tasks** API (`/api/tasks`, …) and **Blockchain Demo** persistence (`/api/blockchain/transfer-history`, public). Use it as the contract for Postman, client codegen, and the reference servers **`backend-ts/`** (port **3000**) and **`backend-go/`** (port **3001**). The spec lists both **`servers`**; **`GET /api/openapi.json`** on either backend injects the same hostname with ports **3000** and **3001** so Swagger UI can choose **Node** or **Go** under **Try it out**. (The spec stays on **3.0.x** so Swagger UI’s global **Servers** dropdown correctly drives **Try it out** after **Authorize**; OpenAPI **3.1** had a regression where per-operation servers did not inherit the global choice.)
- **`PATCH /tasks/{taskId}`** — request body is **`PatchTaskRequest`**: all of `title`, `description`, and `completed` are **optional**; include only fields you want to change (e.g. `{ "completed": true }`). See schema `example` in the spec and Swagger UI **Try it out**.

## Regenerate the frontend client

From `frontend/`:

```bash
npm run api:codegen
```

Then keep `src/api/client.ts` and `src/hooks/useApi.ts` aligned with the generated `DefaultService`.

## Postman

- Import **`docs/api-spec.json`** (OpenAPI) or **`docs/postman-collection.json`** (pre-built folder: list, create, get, patch, delete, health).
- **Base URL**: Node **`http://127.0.0.1:3000/api`**, Go **`http://127.0.0.1:3001/api`** (pick the server in Swagger **Servers** or in Postman environment).
- Match **`VITE_API_BASE_URL`** in `frontend/.env` to that base (dev often uses `/api` + Vite proxy; see `frontend/vite.config.ts`).
- If the API runs with **`API_BEARER_TOKEN`**, send **`Authorization: Bearer <token>`** on task routes (not required for **`GET /api/health`**).
