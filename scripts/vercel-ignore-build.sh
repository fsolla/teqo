#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip deployment, exit 1 = build.
# Agent feature branches must not queue preview builds (Hobby = 1 concurrent build).
# stage/main always build (stage preview + prod).
set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"

if [ "$ref" = "main" ] || [ "$ref" = "stage" ]; then
  exit 1
fi

if [[ "$ref" == agent/* ]] || [[ "$ref" == cursor/* ]]; then
  echo "skip: agent/cursor branch ($ref) — merge gate is GitHub Actions, not Vercel"
  exit 0
fi

exit 1
