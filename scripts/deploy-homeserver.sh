#!/usr/bin/env bash
#
# Deploy teqo-1313 to the homeserver (OPS53).
#
# Runs ON the homeserver, piped by the CI deploy job:
#   ssh homeserver "bash -s -- <commit-sha>" < scripts/deploy-homeserver.sh
#
# Flow: HEAD guard (only the current main HEAD deploys) -> flock
# serialization -> workspace fetch at <sha> -> docker login (local registry)
# -> build of the runner + migrator stages (BuildKit secrets, compose
# network) -> push to localhost:5000 -> compose image-tag swap (with backup)
# -> migrate via the maintenance service (BEFORE the rollout) -> compose up
# -> healthcheck wait -> smoke. Any failure after the swap rolls back to the
# previous compose + image; failures before it leave the running site
# untouched and the job red.
#
# Environment defaults assume the homeserver layout: stack under
# $HOME/stack, repo cloned from the local Forgejo. Secrets are sourced from
# the chmod-600 env files and never echoed (no `set -x`, passwords only via
# --password-stdin / build secrets).

set -euo pipefail

SHA="${1:?usage: deploy-homeserver.sh <commit-sha>}"
TEQO_REPO_URL="${TEQO_REPO_URL:-http://localhost:3000/fsolla/teqo.git}"
STACK_DIR="${STACK_DIR:-$HOME/stack}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME/teqo-deploy}"
DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/teqo-1313-deploy.lock}"

say() { printf '[deploy] %s\n' "$*"; }

fatal() {
  trap - ERR
  say "FAILED: $*" >&2
  exit 1
}

# --- guards ------------------------------------------------------------

main_head="$(git ls-remote "$TEQO_REPO_URL" refs/heads/main | awk '{print $1}')"
if [ "$main_head" != "$SHA" ]; then
  say "stale run: main is $main_head, job deploys $SHA — skipping"
  exit 0
fi

exec 9>"$DEPLOY_LOCK"
flock -w 3600 9 || fatal "another deploy holds $DEPLOY_LOCK"

main_head="$(git ls-remote "$TEQO_REPO_URL" refs/heads/main | awk '{print $1}')"
if [ "$main_head" != "$SHA" ]; then
  say "stale run after lock: main is $main_head, job deploys $SHA — skipping"
  exit 0
fi

# --- secrets (sourced locally, never echoed) ----------------------------

set -a
. "$STACK_DIR/teqo-1313.env"
. "$STACK_DIR/.env"
set +a

: "${DATABASE_URL:?teqo-1313.env is missing DATABASE_URL}"
: "${PAYLOAD_SECRET:?teqo-1313.env is missing PAYLOAD_SECRET}"
: "${NEXT_PUBLIC_SITE_URL:?teqo-1313.env is missing NEXT_PUBLIC_SITE_URL}"
: "${REVALIDATE_SECRET:?teqo-1313.env is missing REVALIDATE_SECRET}"
: "${REGISTRY_USER:?stack/.env is missing REGISTRY_USER}"
: "${REGISTRY_PASSWORD:?stack/.env is missing REGISTRY_PASSWORD}"

# --- workspace at <sha> -------------------------------------------------

if [ ! -d "$WORKSPACE_DIR/.git" ]; then
  say "cloning $TEQO_REPO_URL into $WORKSPACE_DIR"
  git clone "$TEQO_REPO_URL" "$WORKSPACE_DIR"
else
  git -C "$WORKSPACE_DIR" fetch origin main
fi
git -C "$WORKSPACE_DIR" checkout --detach "$SHA" || fatal "checkout of $SHA failed"
say "workspace at $SHA"

# --- registry -----------------------------------------------------------

say "logging into local registry localhost:5000"
echo "$REGISTRY_PASSWORD" | docker login localhost:5000 --username "$REGISTRY_USER" --password-stdin >/dev/null

# --- build --------------------------------------------------------------

build_image() {
  local target="$1" image="$2"
  say "building $target ($image)"
  DOCKER_BUILDKIT=1 docker build \
    --network stack_default \
    --build-arg "NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL" \
    --secret "id=database_url,env=DATABASE_URL" \
    --secret "id=payload_secret,env=PAYLOAD_SECRET" \
    --target "$target" \
    -t "$image" .
}

cd "$WORKSPACE_DIR"
build_image runner "localhost:5000/teqo-1313:$SHA"
build_image migrator "localhost:5000/teqo-1313-migrator:$SHA"

say "pushing images to localhost:5000"
docker push "localhost:5000/teqo-1313:$SHA"
docker push "localhost:5000/teqo-1313-migrator:$SHA"

# The compose references bare `teqo-1313:<sha>` tags with pull_policy: never.
docker tag "localhost:5000/teqo-1313:$SHA" "teqo-1313:$SHA"
docker tag "localhost:5000/teqo-1313-migrator:$SHA" "teqo-1313-migrator:$SHA"

# --- compose swap (backup first; failures from here roll back) ----------

compose="$STACK_DIR/docker-compose.yml"
backup="$compose.pre-$SHA"
cp "$compose" "$backup"
sed -i -E \
  -e "s|image: teqo-1313-migrator:[0-9a-f]+|image: teqo-1313-migrator:$SHA|g" \
  -e "s|image: teqo-1313:[0-9a-f]+|image: teqo-1313:$SHA|g" \
  -e "s|org.opencontainers.image.revision: [0-9a-f]+|org.opencontainers.image.revision: $SHA|g" \
  "$compose"
grep -q "image: teqo-1313:$SHA" "$compose" || fatal "compose swap failed (runner image)"
grep -q "image: teqo-1313-migrator:$SHA" "$compose" || fatal "compose swap failed (migrator image)"

rollback() {
  trap - ERR
  say "FAILED: $* — restoring previous compose and image"
  cp "$backup" "$compose" 2>/dev/null || true
  ( cd "$STACK_DIR" && docker compose up -d teqo-1313 ) 2>/dev/null || true
  exit 1
}
trap 'rollback "unexpected failure"' ERR

# --- migrate (before the rollout) ---------------------------------------

cd "$STACK_DIR"
say "applying pending migrations (maintenance service teqo-1313-migrate)"
docker compose --profile maintenance run --rm teqo-1313-migrate || rollback "migrations failed"

# --- rollout ------------------------------------------------------------

say "rolling out teqo-1313"
docker compose up -d teqo-1313 || rollback "compose up failed"

say "waiting for the healthcheck to go healthy"
health="starting"
for _ in $(seq 1 30); do
  health="$(docker inspect -f '{{.State.Health.Status}}' teqo-1313 2>/dev/null || true)"
  [ "$health" = "healthy" ] && break
  [ "$health" = "unhealthy" ] && break
  sleep 10
done
[ "$health" = "healthy" ] || rollback "container not healthy after 300s (status: $health)"

# --- smoke --------------------------------------------------------------

base="http://localhost:1313"
smoke_fail() { rollback "smoke: $*"; }

curl -fsS -o /dev/null "$base/" || smoke_fail "GET /"
curl -fsS -o /dev/null "$base/campanha/login" || smoke_fail "GET /campanha/login"
curl -fsS -o /dev/null "$base/admin" || smoke_fail "GET /admin"
code="$(curl -s -o /dev/null -w '%{http_code}' "$base/campanha" || true)"
[ "$code" = "307" ] || smoke_fail "GET /campanha expected 307, got $code"
curl -fsS -o /dev/null -X POST "$base/campanha/webauthn/login-options" \
  -H 'Content-Type: application/json' -d '{}' || smoke_fail "POST webauthn login-options"
body="$(curl -fsS -X POST "$base/api/revalidate" -H "x-revalidate-secret: $REVALIDATE_SECRET" || true)"
echo "$body" | grep -q '"revalidated":true' || smoke_fail "POST /api/revalidate did not confirm"

say "deploy of $SHA complete: $(docker inspect -f '{{.Image}}' teqo-1313)"
