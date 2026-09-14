#!/usr/bin/env bash
#
# OPS106 auto-unblock — entrypoint of `.github/workflows/auto-unblock.yml` on
# the homeserver. Holds `/tmp/teqo-unblock.lock` (flock) for the read of the
# single-flight state and hands the open fd 9 to the detached agent wrapper, so
# the lock is held for the agent's whole lifetime while this job exits in ~1
# minute (the runner slot is not blocked). A second failure finds the lock busy
# and only comments on the open token — never queues an agent.
#
# The lock is intentionally NOT the deploy lock: the agent must never block a
# deploy and a deploy must never be mistaken for the agent.
set -euo pipefail

UNBLOCK_HOME="${TEQO_UNBLOCK_HOME:-$HOME/teqo-unblock}"
LOCK_FILE="${TEQO_UNBLOCK_LOCK:-/tmp/teqo-unblock.lock}"

mkdir -p "$UNBLOCK_HOME/logs" "$UNBLOCK_HOME/state" "$UNBLOCK_HOME/worktrees"

exec 9>"$LOCK_FILE"
LOCK_BUSY=0
flock -n 9 || LOCK_BUSY=1

# Hand the exact lock path to the orchestrator (its lock probe uses it).
export TEQO_UNBLOCK_LOCK="$LOCK_FILE"
exec node scripts/auto-unblock.mjs "--lock-busy=$LOCK_BUSY"
