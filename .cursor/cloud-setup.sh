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

# Dev database (teqo) and test database (teqo_test).
echo "[cloud-setup] migrating teqo..."
pnpm migrate
echo "[cloud-setup] migrating teqo_test..."
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate

echo "[cloud-setup] seeding teqo..."
pnpm db:seed:minimal
echo "[cloud-setup] seeding teqo_test..."
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm db:seed:minimal

echo "[cloud-setup] OK — minimal database ready (dev + test)."
echo "[cloud-setup] gate:fast/gate:push need no DB; use pnpm push (not raw git push --no-verify)."
