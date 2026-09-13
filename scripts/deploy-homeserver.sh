#!/usr/bin/env bash
#
# Deploy teqo-1313 (production) or teqo-staging to the homeserver (OPS53,
# parameterized by OPS103).
#
# OPS71: runs ON the homeserver via the GitHub self-hosted runner (deploy jobs
# of .github/workflows/deploy.yml):
#   bash scripts/deploy-homeserver.sh <commit-sha>
# (The Forgejo-era invocation `ssh homeserver "bash -s -- <sha>" < script`
# is gone — no SSH hop, no workstation involvement.)
#
# OPS103: one script, both environments — `TEQO_ENV=production` (default,
# byte-for-byte the pre-OPS103 behavior) and `TEQO_ENV=staging`. Each
# environment owns its container/service, env file, image repo, build-proxy
# port, smoke base and lock; the compose file, workspace and registry stay
# shared. An unknown TEQO_ENV fails closed before anything is touched.
#
# OPS102: a manual dispatch runs to the end with its SHA even if main advances
# during verify (the old stale-run guard belonged to the automatic era); the
# only early green is the idempotency guard, which proves the SHA is already
# running.
#
# Flow: flock serialization -> workspace fetch at <sha> -> docker login
# (local registry) -> build of the MIGRATOR stage (it never runs `next
# build`, so it builds even against the old schema) -> push of the migrator
# (registry-qualified tag — INF13: the ONLY ref the compose references) ->
# compose image-tag swap
# (with backup) -> migrate via the maintenance service
# (BEFORE the runner build — static generation reads the NEW schema, OPS66)
# -> build of the runner stage (BuildKit secrets, compose network) ->
# push -> compose up -> healthcheck wait -> smoke. Any failure after the
# swap rolls back to the previous compose + image; failures before it leave
# the running site untouched and the job red.
#
# Environment defaults assume the homeserver layout: stack under
# $HOME/stack, repo cloned from github.com/fsolla/teqo (public — no
# credentials; the pre-OPS71 clone pointed at the local Forgejo and is
# re-pointed idempotently below). Secrets are sourced from the chmod-600 env
# files and never echoed (no `set -x`, passwords only via --password-stdin /
# build secrets).

set -euo pipefail

SHA="${1:?usage: deploy-homeserver.sh <commit-sha>}"
TEQO_ENV="${TEQO_ENV:-production}"
TEQO_REPO_URL="${TEQO_REPO_URL:-https://github.com/fsolla/teqo.git}"
STACK_DIR="${STACK_DIR:-$HOME/stack}"
WORKSPACE_DIR="${WORKSPACE_DIR:-$HOME/teqo-deploy}"
TEQO_REGISTRY="${TEQO_REGISTRY:-localhost:5000}"
# ONE lock for both environments: the compose file, the workspace and the
# local registry are shared, so staging and production must never build or
# swap concurrently (the workflow's job-level concurrency serializes the
# runs; this lock also covers manual invocations on the host).
DEPLOY_LOCK="${DEPLOY_LOCK:-/tmp/teqo-deploy.lock}"

say() { printf '[deploy] %s\n' "$*"; }

fatal() {
  trap - ERR
  say "FAILED: $*" >&2
  exit 1
}

# --- environment map (OPS103) -------------------------------------------
# Production values are the pre-OPS103 literals: the canonical invocation
# `bash scripts/deploy-homeserver.sh <sha>` (no TEQO_ENV) behaves exactly as
# before. The workflow passes TEQO_ENV per deploy job. The DB name is NOT
# here — it lives inside each environment's env file. `readonly` keeps the
# env files (sourced below) from silently retargeting the deploy.

case "$TEQO_ENV" in
  production)
    TEQO_CONTAINER=teqo-1313
    TEQO_MIGRATE_SERVICE=teqo-1313-migrate
    TEQO_ENV_FILE="$STACK_DIR/teqo-1313.env"
    TEQO_IMAGE_REPO=teqo-1313
    TEQO_BUILD_PROXY=teqo-1313-build-proxy
    TEQO_BUILD_PROXY_PORT=5433
    TEQO_SMOKE_BASE=http://localhost:1313
    ;;
  staging)
    TEQO_CONTAINER=teqo-staging
    TEQO_MIGRATE_SERVICE=teqo-staging-migrate
    TEQO_ENV_FILE="$STACK_DIR/teqo-staging.env"
    TEQO_IMAGE_REPO=teqo-staging
    TEQO_BUILD_PROXY=teqo-staging-build-proxy
    TEQO_BUILD_PROXY_PORT=5434
    TEQO_SMOKE_BASE=http://localhost:1314
    ;;
  *)
    fatal "unknown TEQO_ENV '$TEQO_ENV' (expected production or staging)"
    ;;
esac

readonly TEQO_CONTAINER TEQO_MIGRATE_SERVICE TEQO_ENV_FILE TEQO_IMAGE_REPO
readonly TEQO_BUILD_PROXY TEQO_BUILD_PROXY_PORT TEQO_SMOKE_BASE DEPLOY_LOCK

# --- serialization (flock) ----------------------------------------------

exec 9>"$DEPLOY_LOCK"
flock -w 3600 9 || fatal "another deploy holds $DEPLOY_LOCK"

# --- idempotency (OPS65) ------------------------------------------------
# A duplicate workflow_dispatch can re-deliver a SHA the cluster already runs:
# rebuilding it is a ~15 min no-op. The truth
# is the RUNNING container's revision label — the compose file can lie after
# a failed rollback (it is swapped before the rollout and restored best-
# effort). A container without the label (or down) counts as "not deployed":
# the deploy proceeds (safe direction — it rebuilds).

running_rev="$(docker inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$TEQO_CONTAINER" 2>/dev/null || true)"
if [ -n "$running_rev" ] && [ "$running_rev" = "$SHA" ]; then
  say "already deployed: $TEQO_CONTAINER runs $SHA — nothing to do"
  exit 0
fi

# --- secrets (sourced locally, never echoed) ----------------------------

set -a
. "$TEQO_ENV_FILE"
. "$STACK_DIR/.env"
set +a

: "${DATABASE_URL:?$TEQO_ENV_FILE is missing DATABASE_URL}"
: "${PAYLOAD_SECRET:?$TEQO_ENV_FILE is missing PAYLOAD_SECRET}"
: "${NEXT_PUBLIC_SITE_URL:?$TEQO_ENV_FILE is missing NEXT_PUBLIC_SITE_URL}"
: "${REVALIDATE_SECRET:?$TEQO_ENV_FILE is missing REVALIDATE_SECRET}"
: "${REGISTRY_USER:?stack/.env is missing REGISTRY_USER}"
: "${REGISTRY_PASSWORD:?stack/.env is missing REGISTRY_PASSWORD}"

# --- workspace at <sha> -------------------------------------------------

if [ ! -d "$WORKSPACE_DIR/.git" ]; then
  say "cloning $TEQO_REPO_URL into $WORKSPACE_DIR"
  git clone "$TEQO_REPO_URL" "$WORKSPACE_DIR"
else
  # OPS71: the pre-cutover clone pointed at the local Forgejo — re-point
  # idempotently so the fetch targets the repo that actually received the
  # merge.
  current_url="$(git -C "$WORKSPACE_DIR" remote get-url origin 2>/dev/null || true)"
  if [ -n "$current_url" ] && [ "$current_url" != "$TEQO_REPO_URL" ]; then
    say "updating workspace origin: $current_url → $TEQO_REPO_URL"
    git -C "$WORKSPACE_DIR" remote set-url origin "$TEQO_REPO_URL"
  fi
  git -C "$WORKSPACE_DIR" fetch origin main
fi
git -C "$WORKSPACE_DIR" checkout --detach "$SHA" || fatal "checkout of $SHA failed"
say "workspace at $SHA"

# --- registry -----------------------------------------------------------

say "logging into local registry $TEQO_REGISTRY"
echo "$REGISTRY_PASSWORD" | docker login "$TEQO_REGISTRY" --username "$REGISTRY_USER" --password-stdin >/dev/null

# --- build --------------------------------------------------------------

# BuildKit rejects a custom bridge network on `--network`, so the build runs
# with `--network host`; the env DB (only reachable inside stack_default) is
# proxied to the host loopback by a one-off socat container on the compose
# network, and DATABASE_URL is rewritten to that endpoint. The proxy is
# idempotent and survives reboots (restart: unless-stopped). Each
# environment publishes its own loopback port (TEQO_BUILD_PROXY_PORT) so the
# two proxies never collide.
ensure_db_proxy() {
  if ! docker inspect "$TEQO_BUILD_PROXY" >/dev/null 2>&1; then
    docker run -d --name "$TEQO_BUILD_PROXY" \
      --network stack_default \
      --restart unless-stopped \
      -p "127.0.0.1:$TEQO_BUILD_PROXY_PORT:$TEQO_BUILD_PROXY_PORT" \
      alpine/socat "TCP-LISTEN:$TEQO_BUILD_PROXY_PORT,fork TCP:postgres:5432" >/dev/null
  fi
}

build_image() {
  local target="$1" image="$2"
  say "building $target ($image)"
  ensure_db_proxy
  # The build's DATABASE_URL points at the loopback proxy; the outer env
  # keeps the original value and nothing is echoed.
  local build_db_url="${DATABASE_URL/@postgres:5432/@127.0.0.1:$TEQO_BUILD_PROXY_PORT}"
  DATABASE_URL="$build_db_url" DOCKER_BUILDKIT=1 docker build \
    --network host \
    --build-arg "NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL" \
    --secret "id=database_url,env=DATABASE_URL" \
    --secret "id=payload_secret,env=PAYLOAD_SECRET" \
    --target "$target" \
    -t "$image" .
}

cd "$WORKSPACE_DIR"

# The migrator stage never runs `next build`, so it builds fine against the
# OLD schema — unlike the runner, whose static generation reads Payload data
# and therefore needs the migrations applied first (OPS66).
build_image migrator "$TEQO_REGISTRY/$TEQO_IMAGE_REPO-migrator:$SHA"

# INF13: the compose references REGISTRY-QUALIFIED tags
# (`$TEQO_REGISTRY/$TEQO_IMAGE_REPO(-migrator):<sha>`) with pull_policy: never
# — the exact name every build produces, so the ref the compose needs can
# never go missing (the old bare `teqo-1313:<sha>` alias was a second
# local-only ref that nothing recreated once lost — homeserver incident
# 24/08, `No such image` on recreate).
docker push "$TEQO_REGISTRY/$TEQO_IMAGE_REPO-migrator:$SHA"

# --- compose swap (backup first; failures from here roll back) ----------

compose="$STACK_DIR/docker-compose.yml"
backup="$compose.pre-$SHA"
cp "$compose" "$backup"
# Image lines: the env-specific repo names cannot touch the other
# environment's services (the migrator pattern runs first; `teqo-1313:`
# never matches `teqo-1313-migrator:`).
sed -i -E \
  -e "s|image: ($TEQO_REGISTRY/)?$TEQO_IMAGE_REPO-migrator:[0-9a-f]+|image: $TEQO_REGISTRY/$TEQO_IMAGE_REPO-migrator:$SHA|g" \
  -e "s|image: ($TEQO_REGISTRY/)?$TEQO_IMAGE_REPO:[0-9a-f]+|image: $TEQO_REGISTRY/$TEQO_IMAGE_REPO:$SHA|g" \
  "$compose"
# Revision label: it lives INSIDE the service block, so a bare global
# replace would stamp THIS env's SHA onto the other environment's service —
# and the "already deployed" guard would read a lying revision. The sed
# range starts at the service key and ends at the next two-space key (the
# next service); keys inside a service are indented four spaces. The range
# is then re-read to fail closed when the service has no revision label
# (a silent no-op would disable the idempotency guard for this env).
label_range="/^  $TEQO_CONTAINER:/,/^  [A-Za-z0-9_.-]+:/"
sed -i -E -e "$label_range s|org.opencontainers.image.revision: [0-9a-f]+|org.opencontainers.image.revision: $SHA|" "$compose"
sed -n -e "$label_range p" "$compose" | grep -q "org.opencontainers.image.revision: $SHA" \
  || fatal "compose swap failed (revision label of $TEQO_CONTAINER)"
grep -q "image: $TEQO_REGISTRY/$TEQO_IMAGE_REPO:$SHA" "$compose" || fatal "compose swap failed (runner image)"
grep -q "image: $TEQO_REGISTRY/$TEQO_IMAGE_REPO-migrator:$SHA" "$compose" || fatal "compose swap failed (migrator image)"

rollback() {
  trap - ERR
  say "FAILED: $* — restoring previous compose and image"
  cp "$backup" "$compose" 2>/dev/null || true
  ( cd "$STACK_DIR" && docker compose up -d "$TEQO_CONTAINER" ) 2>/dev/null || true
  exit 1
}
trap 'rollback "unexpected failure"' ERR

# --- migrate (BEFORE the runner build — OPS66) --------------------------
# The runner build statically generates pages that read Payload data; a
# migration that creates a table a static route reads would otherwise
# deadlock the deploy (build fails -> migrate never runs -> build fails...).
# The migrator image above is already swapped into the compose, so this
# maintenance service runs the migrations of the NEW sha against the env DB.

cd "$STACK_DIR"
say "applying pending migrations (maintenance service $TEQO_MIGRATE_SERVICE)"
# `< /dev/null`: `compose run` attaches stdin by default; the container would
# consume the rest of the script piped into `bash -s` (bash then hits EOF and
# exits right after the migrate step, skipping the rollout).
docker compose --profile maintenance run --rm "$TEQO_MIGRATE_SERVICE" </dev/null || rollback "migrations failed"

# --- runner build (against the migrated schema) --------------------------

cd "$WORKSPACE_DIR"
say "building runner"
build_image runner "$TEQO_REGISTRY/$TEQO_IMAGE_REPO:$SHA"
docker push "$TEQO_REGISTRY/$TEQO_IMAGE_REPO:$SHA"

# --- rollout ------------------------------------------------------------

cd "$STACK_DIR"
say "rolling out $TEQO_CONTAINER"
docker compose up -d "$TEQO_CONTAINER" || rollback "compose up failed"

say "waiting for the healthcheck to go healthy"
health="starting"
for _ in $(seq 1 30); do
  health="$(docker inspect -f '{{.State.Health.Status}}' "$TEQO_CONTAINER" 2>/dev/null || true)"
  [ "$health" = "healthy" ] && break
  [ "$health" = "unhealthy" ] && break
  sleep 10
done
[ "$health" = "healthy" ] || rollback "container not healthy after 300s (status: $health)"

# --- smoke --------------------------------------------------------------

base="$TEQO_SMOKE_BASE"
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

# --- post-deploy cleanup (INF3/F2) --------------------------------------
# O deploy compila no homeserver e acumulava build cache + tags locais
# antigas no disco raiz (incidente 19/08: 45G de cache + ~20 tags teqo
# antigas). Best-effort e APÓS o smoke: falha de limpeza nunca falha um
# deploy verde. O registry localhost:5000 preserva as imagens (rollback
# intacto — runbook teqo-1313-deploy.md); removemos só as tags LOCAIS.
# INF13: a preservação é pelo IMAGE ID do container em uso (`{{.Image}}`),
# não por comparação tag×label do compose — imune a drift de label/recriação
# manual; TODAS as tags da imagem rodando sobrevivem, as demais são removidas.
# Fail-closed: container sem image ID não remove nada além do cache.

say "post-deploy cleanup: build cache + tags locais antigas"
docker builder prune -f >/dev/null 2>&1 || true

in_use_id="$(docker inspect -f '{{.Image}}' "$TEQO_CONTAINER" 2>/dev/null || true)"
if [ -n "$in_use_id" ]; then
  for img in $(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E "^($TEQO_REGISTRY/)?$TEQO_IMAGE_REPO(-migrator)?:" || true); do
    img_id="$(docker image inspect -f '{{.Id}}' "$img" 2>/dev/null || true)"
    [ -n "$img_id" ] && [ "$img_id" = "$in_use_id" ] && continue
    docker rmi "$img" >/dev/null 2>&1 || true
  done
else
  say "cleanup: container sem image ID — mantendo imagens locais"
fi

say "deploy of $SHA complete: $(docker inspect -f '{{.Image}}' "$TEQO_CONTAINER")"
