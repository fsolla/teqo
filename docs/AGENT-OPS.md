# AGENT-OPS — operação do paradigma de agentes paralelos

Uma página. Norte: simplicidade (só GitHub + Cursor), agente entrega em `main`, deploy de produção só após o verificador full-suite verde.

## Ambientes de dados (test ladder — nunca misturar)

| Ambiente                                    | Conteúdo                                                     | Quem usa                         |
| ------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| **Mínimo** (`teqo_test` local / service CI) | schema migrado + `pnpm db:seed:minimal` (sintético, sem PII) | agentes, Cursor Cloud, CI        |
| **Prod** (Neon prod)                        | real                                                         | deploy Vercel gated por `ci.yml` |

Agentes **nunca** recebem `DATABASE_URL` de prod e nunca setam `ALLOW_REMOTE_DB`. Não há mais smoke Neon `stage` / `ALLOW_STAGE_TEST_DB` / `ci-stage.yml`.

## Fluxo

```text
claim → feature branch → PR --base main → CI PR green (cascade + skips) → auto-merge em main
main → ci.yml full suite → vercel deploy --prod (se verde) → requeue se HEAD andou
```

**Skills:** `plan-issue` → `work-issue` (claim → modelo → freshness → execução → /simplify → PR `--base main` → CI até o merge) → `project-status`. `docs/roadmap.md` = legado congelado; fonte canônica = GitHub Issues.

- **Agente faz sozinho:** `pnpm agent:claim` → implementa → **`pnpm push`** → PR **Ready** (nunca draft) com `Closes #N` → `gh pr merge --auto --merge` → `gh pr checks --watch --required`. Regra always-on: `.cursor/rules/agent-pr-workflow.mdc`. Em Cursor Cloud: `ManagePullRequest` com `draft: false`, depois armar auto-merge via `gh pr merge --auto --merge` (o default draft da tool **não** vale neste repo).
- **Só humano:** secrets Vercel (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), `POOL_GITHUB_TOKEN`, `pnpm configure:branch-protection`, editar envs Neon/Vercel.

### Dono do PR, dono do CI

**Done = PR mergeado em `main` com CI verde.** Falha de CI no teu PR — infra, teste pré-existente ou regressão — é tua até o merge. Exceção de blast radius: migration / access / Consent → pare e escale.

### Bypass de CI (cutover / transição)

- **Local:** se `gate:push` ainda espelha pipeline antigo e bloqueia push legítimo da PR que o muda → `git push --no-verify` permitido como escape de transição (não WIP permanente). Documentado aqui; após o cutover, entregas passam no CI novo sem bypass.
- **Cutover humano:** pode relaxar temporary required checks se o flip de proteção travar merges; reverter para `checks` + `migration-lock` em `main` assim que o CI novo estiver verde.

## Comandos

| Comando                                                                                                       | Faz                                                                        |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm agent:claim [-- --dry-run]`                                                                             | Fila ready+unblocked por prio → `in-progress` + brief                      |
| `pnpm agent:register -- --id X --title T [--prio P1] [--depends A,B] [--plan docs/plans/x.md] [--model slug]` | Cria Issue                                                                 |
| `pnpm agent:status`                                                                                           | Overview / fila / mermaid                                                  |
| `pnpm agent:prioritize -- <issue> <P0..P3>`                                                                   | Troca `prio:*`                                                             |
| `pnpm agent:file-miss -- --title ...`                                                                         | Issue `kind:agent-miss`                                                    |
| `pnpm agent:pool -- status\|tick --dry-run\|doctor`                                                           | Pool Cloud; start/stop via `gh workflow run agent-pool.yml`                |
| `pnpm push [-- -u origin HEAD …]`                                                                             | Canônico: ensure-deps + gate:push + push                                   |
| `pnpm configure:branch-protection [-- --dry-run]`                                                             | Proteção de `main`: `checks` + `migration-lock`, `strict=false`, 0 reviews |
| `pnpm db:seed:minimal`                                                                                        | DB mínimo sintético                                                        |

Labels: `ready|in-progress|blocked|done|in-prod`, `prio:*`, `kind:*`, `needs:*`.

## Contrato de PR

1. Schema → atualizar `db:seed:minimal` no mesmo PR (`needs:migration`).
2. ≤1 PR aberto tocando migrations / `payload-types.ts` (`migration-lock`).
3. Ready + auto-merge: `gh pr create --base main` → `gh pr merge --auto --merge`; `gh pr checks --watch --required` (Vercel Git não é gate).

## CI por alvo

| Workflow                       | Trigger                                | Banco               | Passos                                                                                                                |
| ------------------------------ | -------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ci-pr.yml`                    | PR → `main`                            | service Postgres 17 | Fase 1 barata → fase 2 cara; skips via `ci-scope.mjs`; fail-fast cancela o run no 1º job vermelho; rollup `checks`    |
| `ci.yml`                       | push / dispatch `main`                 | service Postgres    | Full sempre; fail-fast cancela o run no 1º job vermelho → `deploy` (`vercel deploy --prod`) → `requeue` se HEAD andou |
| `issue-done-on-main-merge.yml` | PR merged → `main`                     | —                   | `in-progress` → `done` + `in-prod`                                                                                    |
| `agent-pr-ready-automerge.yml` | PR `cursor/*` → `main` (open/sync/…)   | —                   | Draft→Ready + `gh pr merge --auto --merge` (safety net; audit incluso)                                                |
| `agent-pool.yml`               | schedule / PR closed `main` / dispatch | —                   | Supervisor do pool (`POOL_GITHUB_TOKEN`)                                                                              |

Fast gate: `pnpm gate:fast`. Push: `pnpm push`.

### Secrets (humano, uma vez)

| Secret              | Uso                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ |
| `VERCEL_TOKEN`      | Deploy gated em `ci.yml`                                                             |
| `VERCEL_ORG_ID`     | idem                                                                                 |
| `VERCEL_PROJECT_ID` | idem                                                                                 |
| `POOL_GITHUB_TOKEN` | PAT `actions:write` + `issues:write` (variables do pool; `GITHUB_TOKEN` costuma 403) |

Vercel Git builds: `scripts/vercel-ignore-build.sh` skipeia **todas** as branches (incl. `main`) — prod só via Action.

## Cursor Cloud

`.cursor/environment.json` instala deps + Postgres nativo + `db:seed:minimal`. Sem secrets de prod. Preferir `pnpm push`; escape `git push --no-verify` só no cutover documentado acima.

## Agent pool

Supervisor remoto (`agent-pool.yml`): schedule + replenish em merge → `main` + dispatch. Workers PR `--base main`. Default model `composer-2.5`. **Secret `POOL_GITHUB_TOKEN`** obrigatório se `GITHUB_TOKEN` 403 em `/actions/variables`. Doctor: `pnpm agent:pool -- doctor`. Skill: `agent-pool`.

## Guardrails / leitura

`pnpm agent:file-miss` → harvest → `docs/GUARDRAILS.md`. Always-on: `AGENTS.md` → codebase-map → engineering-standards → esta página → PRODUCT/DESIGN/CUSTOMER.
