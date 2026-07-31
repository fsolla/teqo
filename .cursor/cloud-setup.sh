#!/usr/bin/env bash
# Cursor Cloud environment setup: deps are installed by environment.json's
# `install`; this script brings up the local Postgres and builds the MINIMAL
# synthetic database (docs/AGENT-OPS.md — agents never see stage/prod URLs).
#
# Uses native PostgreSQL — Cursor Cloud VMs cannot run Docker (no daemon / overlayfs).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

bash "${SCRIPT_DIR}/ensure-postgres.sh"

if [ ! -f .env ]; then
  sed \
    -e 's/YOUR_SECRET_HERE/cursor-cloud-local-secret/' \
    -e 's/YOUR_BLOB_TOKEN_HERE/vercel_blob_rw_cloud01_localplaceholder01/' \
    .env.example > .env
  echo "[cloud-setup] wrote .env from .env.example (local-only values)"
fi

TEQO_URL='postgresql://teqo:teqo@localhost:5432/teqo'
TEQO_TEST_URL='postgresql://teqo:teqo@localhost:5432/teqo_test'

assert_migrated() {
  local db_url="$1"
  local label="$2"
  local count
  count="$(PGPASSWORD=teqo psql "${db_url}" -Atc 'SELECT COUNT(*) FROM payload_migrations' 2>/dev/null || echo 0)"
  if [ "${count}" -lt 1 ]; then
    echo "[cloud-setup] ERROR: ${label} has no payload_migrations after migrate (got '${count}')" >&2
    exit 1
  fi
  echo "[cloud-setup] ${label}: ${count} migrations applied"
}

# Dev database (teqo) and test database (teqo_test).
# Pin DATABASE_URL on both — do not rely on dotenv alone (JIT snapshots have
# seen a silent no-op migrate when the URL was only in a freshly written .env).
echo "[cloud-setup] migrating teqo..."
DATABASE_URL="${TEQO_URL}" pnpm migrate
assert_migrated "${TEQO_URL}" teqo
echo "[cloud-setup] migrating teqo_test..."
DATABASE_URL="${TEQO_TEST_URL}" pnpm migrate
assert_migrated "${TEQO_TEST_URL}" teqo_test

echo "[cloud-setup] seeding teqo..."
DATABASE_URL="${TEQO_URL}" pnpm db:seed:minimal
echo "[cloud-setup] seeding teqo_test..."
DATABASE_URL="${TEQO_TEST_URL}" pnpm db:seed:minimal

echo "[cloud-setup] OK — minimal database ready (dev + test)."
echo "[cloud-setup] gate:fast/gate:push need no DB; use pnpm push (not raw git push --no-verify)."
