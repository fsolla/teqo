# Cutover checklist (main-only + gated deploy) — human, once
#
# After merging the CI cutover PR to main:
#
# 1. Repo secrets (Settings → Secrets and variables → Actions):
#    - VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
#    - POOL_GITHUB_TOKEN (PAT: actions:write, issues:write, contents:read)
#
# 2. Branch protection:
#    pnpm configure:branch-protection
#    (main: required checks `checks` + `migration-lock`, strict=false, 0 reviews)
#    Optionally remove protection from `stage` and delete the branch when idle.
#
# 3. Open PRs still targeting `stage`:
#    gh pr list --base stage
#    Retarget each to main (`gh pr edit <N> --base main`) or merge/close first.
#
# 4. Validate:
#    - Push/no-op on main → Vercel Git build SKIPPED (ignoreCommand exit 0)
#    - ci.yml runs full suite; deploy job runs (or fail-closed if Vercel secrets missing)
#    - agent-pool doctor: `POOL_GITHUB_TOKEN=… pnpm agent:pool -- doctor` reads variables
#
# See docs/AGENT-OPS.md.
