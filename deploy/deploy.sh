#!/usr/bin/env bash
# ==============================================================================
# deploy.sh: Pull-based deployment script for pre-launch backend
# Run on the target host VM (e.g. Oracle free-tier VM)
#
# Design:
# - VM has no inbound SSH exposure from GitHub Actions.
# - Pull-based deployment: pulls pre-built image from GHCR, updates containers.
# - Manually or cron-triggered; no auto-deploy without explicit operator run.
# - Creates manual backup before migrations.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.prod.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

# Ensure environment file exists
if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: Environment file ${ENV_FILE} not found."
  echo "Create ${ENV_FILE} with required secrets before deploying."
  exit 1
fi

echo "==> Loading environment from ${ENV_FILE}..."
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# Image tag default to latest if not specified
export API_IMAGE="${API_IMAGE:-ghcr.io/mehdawimohamed/pre-launch-api:main}"

echo "==> Pulling target images (${API_IMAGE})..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull

echo "==> Starting database service..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d postgres

echo "==> Waiting for PostgreSQL to become healthy..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres sh -c \
  'until pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-crowdfunding}"; do echo "Waiting for postgres..."; sleep 2; done'

# Note: Once migrations are added in Phase 1 (Step 1.2), backup & migrate run here:
# BACKUP_DIR="${SCRIPT_DIR}/backups"
# mkdir -p "${BACKUP_DIR}"
# echo "==> Taking pre-migration pg_dump backup..."
# docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" > "${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).sql"

echo "==> Updating api and cloudflared services..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d --remove-orphans api cloudflared

echo "==> Checking deployment health status..."
sleep 5
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps

echo "==> Pruning dangling images..."
docker image prune -f

echo "==> Deployment completed successfully."

