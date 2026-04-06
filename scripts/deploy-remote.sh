#!/usr/bin/env bash
# Runs on the server: invoked by deploy.sh over SSH, or run manually with DEPLOY_PATH set.
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is not set}"

TS_DIR="${DEPLOY_PATH}/backend-ts"
GO_DIR="${DEPLOY_PATH}/backend-go"
FRONTEND_DIR="${DEPLOY_PATH}/frontend"
LEGACY_TS_DIR="${DEPLOY_PATH}/api-server"
FRONTEND_DIST_DIR="${DEPLOY_PATH}/frontend-dist"
STORE_DIR="${DEPLOY_PATH}/store"

if [[ ! -d "$TS_DIR" ]]; then
  echo "error: missing $TS_DIR — run deploy from your laptop first."
  exit 1
fi

if [[ ! -d "$GO_DIR" ]]; then
  echo "error: missing $GO_DIR — run deploy from your laptop first."
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "error: missing $FRONTEND_DIR — run deploy from your laptop first."
  exit 1
fi

mkdir -p "$STORE_DIR" "$FRONTEND_DIST_DIR"

if [[ ! -f "$TS_DIR/.env" ]]; then
  if [[ -f "$LEGACY_TS_DIR/.env" ]]; then
    cp "$LEGACY_TS_DIR/.env" "$TS_DIR/.env"
    echo "[remote] copied legacy api-server/.env -> backend-ts/.env"
  elif [[ -f "$TS_DIR/.env.example" ]]; then
    cp "$TS_DIR/.env.example" "$TS_DIR/.env"
    echo "[remote] created backend-ts/.env from .env.example"
  else
    echo "[remote] warning: $TS_DIR/.env is missing and no fallback was found"
  fi
fi

echo "[remote] npm ci --omit=dev (backend-ts)"
cd "$TS_DIR"
npm ci --omit=dev

echo "[remote] npm ci (frontend)"
cd "$FRONTEND_DIR"
npm ci

echo "[remote] go mod download + build (backend-go)"
cd "$GO_DIR"
/usr/local/go/bin/go mod download
CGO_ENABLED=0 /usr/local/go/bin/go build -o bin/backend-go .

TS_PORT=3000
AUTH_SECRET=""
API_SECRET=""

if [[ -f "$TS_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$TS_DIR/.env"
  set +a
  TS_PORT="${PORT:-3000}"
  AUTH_SECRET="${AUTH_JWT_SECRET:-${API_JWT_SECRET:-}}"
  API_SECRET="${API_JWT_SECRET:-}"
fi

GO_PORT="${BACKEND_GO_PORT:-3001}"
# Same file as Node (backend-ts): ${DEPLOY_PATH}/store/app.sqlite — override with BACKEND_GO_SQLITE_PATH if needed.
GO_SQLITE_PATH="${BACKEND_GO_SQLITE_PATH:-${STORE_DIR}/app.sqlite}"
GO_STATIC_DIR="${BACKEND_GO_STATIC_DIR:-${FRONTEND_DIST_DIR}}"

if command -v pm2 >/dev/null 2>&1; then
  echo "[remote] pm2 replace task-api -> $TS_DIR/server.mjs"
  if pm2 describe task-api >/dev/null 2>&1; then
    pm2 delete task-api
  fi
  pm2 start server.mjs --name task-api --cwd "$TS_DIR" --interpreter node --update-env

  echo "[remote] pm2 replace/start task-api-go -> $GO_DIR/bin/backend-go"
  if pm2 describe task-api-go >/dev/null 2>&1; then
    pm2 delete task-api-go
  fi
  if [[ -n "$AUTH_SECRET" && -n "$API_SECRET" ]]; then
    env PORT="$GO_PORT" SQLITE_PATH="$GO_SQLITE_PATH" STATIC_DIR="$GO_STATIC_DIR" AUTH_JWT_SECRET="$AUTH_SECRET" API_JWT_SECRET="$API_SECRET" \
      pm2 start "$GO_DIR/bin/backend-go" --name task-api-go --cwd "$GO_DIR" --interpreter none --update-env
  elif [[ -n "$AUTH_SECRET" ]]; then
    env PORT="$GO_PORT" SQLITE_PATH="$GO_SQLITE_PATH" STATIC_DIR="$GO_STATIC_DIR" AUTH_JWT_SECRET="$AUTH_SECRET" \
      pm2 start "$GO_DIR/bin/backend-go" --name task-api-go --cwd "$GO_DIR" --interpreter none --update-env
  else
    env PORT="$GO_PORT" SQLITE_PATH="$GO_SQLITE_PATH" STATIC_DIR="$GO_STATIC_DIR" \
      pm2 start "$GO_DIR/bin/backend-go" --name task-api-go --cwd "$GO_DIR" --interpreter none --update-env
  fi

  echo "[remote] pm2 replace/start task-frontend -> vite preview"
  if pm2 describe task-frontend >/dev/null 2>&1; then
    pm2 delete task-frontend
  fi
  pm2 start npm --name task-frontend --cwd "$FRONTEND_DIR" -- run preview -- --host 0.0.0.0 --port 5173

  pm2 save
  echo "[remote] health checks"
  curl -I -sS http://127.0.0.1:5173/ | sed -n '1,20p'
  printf '\n---\n'
  curl -I -sS http://127.0.0.1:5173/api/docs | sed -n '1,20p'
  printf '\n---\n'
  curl -sS "http://127.0.0.1:${TS_PORT}/api/health"
  printf '\n---\n'
  curl -sS "http://127.0.0.1:${GO_PORT}/api/health"
  echo "[remote] done. Check: pm2 logs task-api / task-api-go / task-frontend"
else
  echo "[remote] pm2 not installed. Run: npm i -g pm2 then redeploy."
  echo "[remote] Manual fallback:"
  echo "  cd $TS_DIR && node server.mjs"
  echo "  cd $GO_DIR && PORT=$GO_PORT SQLITE_PATH=$GO_SQLITE_PATH STATIC_DIR=$GO_STATIC_DIR ./bin/backend-go"
fi
