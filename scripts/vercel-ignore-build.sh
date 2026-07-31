#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip deployment, exit 1 = build.
# Production deploys are gated by GitHub Actions (`ci.yml` → `vercel deploy --prod`).
# Git pushes must NOT trigger Vercel builds (Hobby concurrency + ungated deploy race).
set -euo pipefail

ref="${VERCEL_GIT_COMMIT_REF:-}"

if [ "$ref" = "main" ] || [ "$ref" = "stage" ]; then
  echo "skip: $ref — production deploy is Actions-gated (ci.yml), not Vercel Git"
  exit 0
fi

if [[ "$ref" == agent/* ]] || [[ "$ref" == cursor/* ]]; then
  echo "skip: agent/cursor branch ($ref) — merge gate is GitHub Actions, not Vercel"
  exit 0
fi

echo "skip: non-canonical branch ($ref) — no Vercel Git builds"
exit 0
