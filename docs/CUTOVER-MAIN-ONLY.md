# Cutover checklist (main-only + gated deploy) — done

Completed 2026-08-01. Branch `stage` and GitHub Environment `stage` are deleted. Production deploys only from `ci.yml` after the full verifier is green.

- [x] Code PR opened (main-only cutover) — merged to `main`
- [x] `pnpm configure:branch-protection` applied on `main` (required: `checks` (+ `migration-lock` until 2026-08-12), `strict=false`, 0 reviews) — **GitHub-era; reaplicado no Forgejo em 2026-08-18 (OPS61) com o contexto real `CI (PR) / checks` (glob `CI (PR) / checks*`)**
- [x] No open PRs targeting `stage` at cutover time
- [x] Repo secrets present (`VERCEL_*`, `POOL_GITHUB_TOKEN`)
- [x] `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` synced from local `.vercel/project.json` (`vercel link`)
- [x] `ci.yml` deploy job green (`vercel@55`, Node `24.x`, alias https://pt.jorgesolla.com.br)
- [x] **Git auto-deploy OFF** (`vercel.json` `git.deploymentEnabled: false` + ignore script) — correct for Actions-gated deploys
- [x] **Auto-assign Custom Production Domains ON** (Project → Settings → Environments → Production → Branch Tracking). Turning this OFF stages CLI `--prod` deploys without moving `pt.jorgesolla.com.br`; CI re-enables it.
- [x] **Domain Git Branch empty** for `pt.jorgesolla.com.br` (Settings → Domains). A branch binding only moves with Git Integration; with Git OFF, CI clears it then `promote` + `alias set`. Emergency: Actions → "Vercel promote production".
- [x] Branch `stage` deleted
- [x] GitHub Environment `stage` (and `STAGE_*` secrets) deleted
- [x] Dead stage tooling removed (`db:refresh:stage`, `agent:promote`)

Operational reference: [AGENT-OPS.md](AGENT-OPS.md).
