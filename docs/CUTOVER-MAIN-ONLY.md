# Cutover checklist (main-only + gated deploy) — done

Completed 2026-08-01. Branch `stage` and GitHub Environment `stage` are deleted. Production deploys only from `ci.yml` after the full verifier is green.

- [x] Code PR opened (main-only cutover) — merged to `main`
- [x] `pnpm configure:branch-protection` applied on `main` (required: `checks` + `migration-lock`, `strict=false`, 0 reviews)
- [x] No open PRs targeting `stage` at cutover time
- [x] Repo secrets present (`VERCEL_*`, `POOL_GITHUB_TOKEN`)
- [x] `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` synced from local `.vercel/project.json` (`vercel link`)
- [x] `ci.yml` deploy job green (`vercel@55`, Node `24.x`, alias https://pt.jorgesolla.com.br)
- [x] Branch `stage` deleted
- [x] GitHub Environment `stage` (and `STAGE_*` secrets) deleted
- [x] Dead stage tooling removed (`db:refresh:stage`, `agent:promote`)

Operational reference: [AGENT-OPS.md](AGENT-OPS.md).
