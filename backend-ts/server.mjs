/**
 * Tasks REST API — Node.js (Express) reference backend for the React frontend.
 * Contract: docs/api-spec.json (import into Postman / codegen).
 * Default persistence: SQLite at monorepo store/app.sqlite (shared with backend-go).
 */

import 'dotenv/config';
import { createApp } from './src/app.mjs';
import { describeApiAuthMode } from './src/middleware/apiAuth.mjs';
import { resolveSqlitePath } from './src/db/sqlitePath.mjs';

const PORT = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(PORT, () => {
  console.log(`Tasks API (Node/Express) → http://127.0.0.1:${PORT}/api/tasks`);
  console.log(`SQLite: ${resolveSqlitePath()}  (SQLITE_PATH → backend-ts/config/backend.yaml → store/app.sqlite)`);
  console.log(`Swagger UI: http://127.0.0.1:${PORT}/api/docs  |  OpenAPI JSON: /api/openapi.json`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
  console.log(`Auth: ${describeApiAuthMode()}`);
});
