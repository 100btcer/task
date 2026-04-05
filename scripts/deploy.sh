#!/usr/bin/env bash
# One-shot local deploy: build frontend, sync frontend/backend-ts/backend-go, then restart services remotely.
# Usage:
#   cp scripts/deploy.config.example scripts/deploy.config
#   Edit scripts/deploy.config
#   chmod +x scripts/deploy.sh scripts/deploy-remote.sh
#   ./scripts/deploy.sh
#
# Do not put passwords in the repo; use SSH public-key auth.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/deploy.config"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE"
  echo "Run: cp scripts/deploy.config.example scripts/deploy.config and fill in variables"
  exit 1
fi

# shellcheck source=deploy.config
source "$CONFIG_FILE"

: "${DEPLOY_HOST:?}"
: "${DEPLOY_USER:?}"
: "${DEPLOY_PATH:?}"

SSH_TARGET="${DEPLOY_USER}@${DEPLOY_HOST}"
SSH_OPTS=()
if [[ -n "${DEPLOY_SSH_KEY:-}" ]]; then
  SSH_OPTS+=( -i "${DEPLOY_SSH_KEY/#\~/$HOME}" )
fi

if ((${#SSH_OPTS[@]} > 0)); then
  RSYNC_RSH="ssh ${SSH_OPTS[*]}"
else
  RSYNC_RSH="ssh"
fi

echo "==> Test SSH: $SSH_TARGET"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '${DEPLOY_PATH}' '${DEPLOY_PATH}/store' '${DEPLOY_PATH}/frontend-dist' && echo ok"

echo "==> Build frontend (VITE_API_BASE_URL=/api for Nginx /api reverse proxy)"
cd "$REPO_ROOT/frontend"
VITE_API_BASE_URL=/api npm run build

echo "==> Sync docs (OpenAPI; backend-ts reads contract)"
rsync -avz --delete \
  -e "$RSYNC_RSH" \
  --exclude '.DS_Store' \
  "$REPO_ROOT/docs/" \
  "$SSH_TARGET:${DEPLOY_PATH}/docs/"

echo "==> Sync frontend source (excluding node_modules/dist/.env)"
rsync -avz --delete \
  -e "$RSYNC_RSH" \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  "$REPO_ROOT/frontend/" \
  "$SSH_TARGET:${DEPLOY_PATH}/frontend/"

echo "==> Sync backend-ts source (excluding node_modules/.env)"
rsync -avz --delete \
  -e "$RSYNC_RSH" \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  "$REPO_ROOT/backend-ts/" \
  "$SSH_TARGET:${DEPLOY_PATH}/backend-ts/"

echo "==> Sync backend-go source (excluding bin/.env)"
rsync -avz --delete \
  -e "$RSYNC_RSH" \
  --exclude 'bin' \
  --exclude '.env' \
  --exclude '.DS_Store' \
  "$REPO_ROOT/backend-go/" \
  "$SSH_TARGET:${DEPLOY_PATH}/backend-go/"

echo "==> Sync frontend static build -> ${DEPLOY_PATH}/frontend-dist"
rsync -avz --delete \
  -e "$RSYNC_RSH" \
  "$REPO_ROOT/frontend/dist/" \
  "$SSH_TARGET:${DEPLOY_PATH}/frontend-dist/"

echo "==> Remote: install/build backend-ts/backend-go and restart services"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "export DEPLOY_PATH='${DEPLOY_PATH}'; bash -s" <"$SCRIPT_DIR/deploy-remote.sh"

echo ""
echo "Done. Nginx root should point at ${DEPLOY_PATH}/frontend-dist and proxy /api/ to backend-ts (see scripts/nginx-task.example.conf)"
echo "Health checks:"
echo "  curl -s http://${DEPLOY_HOST}/api/health"
echo "  curl -s http://${DEPLOY_HOST}:3001/api/health"
