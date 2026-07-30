#!/usr/bin/env bash
# Cursor Cloud environment setup: deps are installed by environment.json's
# `install`; this script brings up the local Postgres and builds the MINIMAL
# synthetic database (docs/AGENT-OPS.md — agents never see stage/prod URLs).
set -euo pipefail

sudo service docker start

if [ ! -f .env ]; then
  sed 's/YOUR_SECRET_HERE/cursor-cloud-local-secret/' .env.example > .env
  echo "[cloud-setup] wrote .env from .env.example (local-only values)"
fi

pnpm db:start

# Dev database (teqo) and test database (teqo_test) — compose creates both.
pnpm migrate
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm migrate

pnpm db:seed:minimal
DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo_test pnpm db:seed:minimal

echo "[cloud-setup] OK — minimal database ready (dev + test)."
