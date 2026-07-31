# Cutover checklist (main-only + gated deploy) — human, once

Status after agent delivery (2026-07-31):

- [x] Code PR opened (main-only cutover) — see PR targeting `main`
- [x] `pnpm configure:branch-protection` applied on `main` (required: `checks` + `migration-lock`, `strict=false`, 0 reviews)
- [x] No open PRs targeting `stage` at cutover time
- [ ] Repo secrets still needed:
  - `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (deploy job fail-closed until set)
  - `POOL_GITHUB_TOKEN` (PAT: `actions:write` + `issues:write` + `contents:read`) — `PROMOTE_GITHUB_TOKEN` already exists; reuse/rename if scopes cover Actions variables, else mint a new PAT

After the cutover PR merges to `main`:

1. Validate Vercel Git skip: push to `main` must **not** start a Vercel Git build (`ignoreCommand` exit 0). Production comes only from `ci.yml` → deploy.
2. Confirm `ci.yml` runs full suite; deploy job runs or fails closed with a clear missing-secrets message until `VERCEL_*` are set.
3. `POOL_GITHUB_TOKEN=… pnpm agent:pool -- doctor` must read repo variables.
4. Optionally delete branch `stage` and its Environment/secrets when idle.

See [AGENT-OPS.md](AGENT-OPS.md).
