#!/usr/bin/env bash
# Cursor Cloud VMs have no Docker and cannot run docker compose (overlayfs fails inside
# the agent container). Native PostgreSQL matches the local DATABASE_URL contract.
set -euo pipefail

PG_VERSION="${PG_VERSION:-16}"
PG_CLUSTER="${PG_CLUSTER:-main}"

pg_ready() {
  PGPASSWORD=teqo psql -h localhost -U teqo -d teqo -c 'SELECT 1' >/dev/null 2>&1
}

detect_pg_version() {
  if [ -d "/etc/postgresql" ]; then
    ls /etc/postgresql/ 2>/dev/null | sort -nr | head -1
    return 0
  fi
  echo "${PG_VERSION}"
}

start_postgres() {
  if pg_ready; then
    return 0
  fi

  local version
  version="$(detect_pg_version)"

  if command -v pg_ctlcluster >/dev/null 2>&1 && [ -n "${version}" ]; then
    sudo pg_ctlcluster "${version}" "${PG_CLUSTER}" start 2>/dev/null || true
    sleep 2
    pg_ready && return 0
  fi

  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start "postgresql@${version}-${PG_CLUSTER}" 2>/dev/null || \
      sudo systemctl start postgresql 2>/dev/null || true
    sleep 2
    pg_ready && return 0
  fi

  echo "[ensure-postgres] ERROR: postgres is installed but not accepting connections" >&2
  exit 1
}

bootstrap_databases() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'teqo') THEN
    CREATE ROLE teqo WITH LOGIN PASSWORD 'teqo' CREATEDB;
  END IF;
END
$$;
SELECT 'CREATE DATABASE teqo OWNER teqo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'teqo')\gexec
SELECT 'CREATE DATABASE teqo_test OWNER teqo'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'teqo_test')\gexec
SQL
}

if command -v psql >/dev/null 2>&1 && [ -d "/etc/postgresql" ]; then
  start_postgres
  bootstrap_databases
  pg_ready
  echo "[ensure-postgres] OK (existing cluster)"
  exit 0
fi

echo "[ensure-postgres] installing postgresql-${PG_VERSION} (Ubuntu package; local dev uses PG 17 via Docker)..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"
start_postgres
bootstrap_databases
pg_ready
echo "[ensure-postgres] OK"
