# AGENT-OPS — operação do paradigma de agentes paralelos

Uma página. Norte: simplicidade (só GitHub + Cursor), agente entrega em `main`, deploy de produção só após o verificador full-suite verde.

## Ambientes de dados (test ladder — nunca misturar)

| Ambiente                                    | Conteúdo                                                     | Quem usa                         |
| ------------------------------------------- | ------------------------------------------------------------ | -------------------------------- |
| **Mínimo** (`teqo_test` local / service CI) | schema migrado + `pnpm db:seed:minimal` (sintético, sem PII) | agentes, Cursor Cloud, CI        |
| **Prod** (`teqo_1313`, homeserver)          | real                                                         | job `deploy` do `ci.yml` (OPS53) |

Agentes **nunca** recebem `DATABASE_URL` de prod e nunca setam `ALLOW_REMOTE_DB`. Não há mais smoke Neon `stage` / `ALLOW_STAGE_TEST_DB` / `ci-stage.yml`.

## Fluxo

```text
claim → feature branch → PR --base main → CI PR green (cascade + skips) → auto-merge em main
main → ci.yml full suite verde → job `deploy` (homeserver, OPS53 — merge em main == site atualizado)
```

**Skills:** `plan-issue` (intenção + Issues) → `work-issue` (humano: Issue já claimada → impl plan → confirmação → execução) ou `agent-work-issue` (pool: já claimada → impl plan → execução sem pausa) → `/simplify` → `capture-review-debts` → PR `--base main` → `project-status`. `docs/roadmap.md` = legado congelado; fonte canônica = GitHub Issues.

- **Agente faz sozinho:** claim (pool-supervisor no pool; humano via `pnpm agent:claim` fora da sessão — OPS33: `worktree next` claima) → implementa → **`pnpm push`** → PR **Ready** (nunca draft) com `Closes #N` → `gh pr merge --auto --rebase` → `gh pr checks --watch --required`. Regra always-on: `.agents/rules/agent-pr-workflow.mdc`. Em Cursor Cloud: `ManagePullRequest` com `draft: false`, depois armar auto-merge via `gh pr merge --auto --rebase` (o default draft da tool **não** vale neste repo).
- **Só humano:** secrets Vercel (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`), `POOL_GITHUB_TOKEN`, `pnpm configure:branch-protection`, editar envs Neon/Vercel.

### Dono do PR, dono do CI

**Done = PR mergeado em `main` com CI verde.** Falha de CI no teu PR — infra, teste pré-existente ou regressão — é tua até o merge. Exceção de blast radius: migration / access / Consent → pare e escale.

### Bypass de CI (cutover / transição)

- **Local:** se `gate:push` ainda espelha pipeline antigo e bloqueia push legítimo da PR que o muda → `git push --no-verify` permitido como escape de transição (não WIP permanente). Documentado aqui; após o cutover, entregas passam no CI novo sem bypass.
- **Cutover humano:** pode relaxar temporary required checks se o flip de proteção travar merges; reverter para `checks` em `main` assim que o CI novo estiver verde.

## Comandos

| Comando                                                                                                       | Faz                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm agent:claim [-- --dry-run]`                                                                             | Fila ready+unblocked por prio → `in-progress` + brief                        |
| `pnpm worktree next [--issue N] [--stay]`                                                                     | Claim determinístico (mesma fila/lock do claim) → worktree + provisionamento |
| `pnpm agent:register -- --id X --title T [--prio P1] [--depends A,B] [--plan docs/plans/x.md] [--model slug]` | Cria Issue (`--plan` ⇒ `blocked` até `agent:ready`; sem plano ⇒ `ready`)     |
| `pnpm agent:ready -- --issue N[,N…]`                                                                          | Pós-merge do plano: `blocked`→`ready` (só Issues com link `docs/plans/`)     |
| `pnpm agent:status`                                                                                           | Overview / fila / mermaid                                                    |
| `pnpm agent:prioritize -- <issue> <P0..P3>`                                                                   | Troca `prio:*`                                                               |
| `pnpm agent:file-miss -- --title ...`                                                                         | Issue `kind:agent-miss`                                                      |
| `pnpm agent:pool -- status\|tick --dry-run\|doctor`                                                           | Pool Cloud; start/stop via `gh workflow run agent-pool.yml`                  |
| `pnpm push [-- -u origin HEAD …]`                                                                             | Canônico: ensure-deps + gate:push + push                                     |
| `pnpm configure:branch-protection [-- --dry-run]`                                                             | Proteção de `main`: `checks`, `strict=false`, 0 reviews                      |
| `pnpm db:seed:minimal`                                                                                        | DB mínimo sintético                                                          |

Labels: `ready|in-progress|blocked|done|in-prod`, `prio:*`, `kind:*`, `needs:*`.

**plan-issue (OPS17 + OPS18):** gate pós-overview fecha o lote antes de qualquer Issue/PR; register com `--plan` nasce `blocked` (não entra na fila do claim/pool); após o PR de planos mergear em `main` (`Related #N`), promote dual idempotente: (A) `pnpm agent:ready` na sessão; (B) Action `plan-issue-ready-on-main-merge.yml` lê `Related #N` e promove Issues ainda “aguardando plano” (`blocked` + link `docs/plans/`). Chores sem plano continuam nascendo `ready`.

## Contrato de PR

1. Schema → atualizar `db:seed:minimal` no mesmo PR (`needs:migration`).
2. Migrations NÃO são serializadas entre PRs: o CI (migrate + int, incl. `campaignMigrationReconciliation`) valida a cadeia em todo PR e na main; rebase antes de `migrate:create` continua obrigatório.
3. Ready + auto-merge: `gh pr create --base main` → `gh pr merge --auto --rebase`; `gh pr checks --watch --required` (Vercel Git não é gate). **Merge é por rebase** (nunca merge commit): preserva a linha histórica limpa do `main` e é o modo que o CI guarda contra conflitos latentes.
4. **Changelog da entrega (OPS44):** toda entrega escreve `docs/changelog/<data>-<id>.md` (ex. `2026-08-13-ops44.md`) e roda `pnpm changelog:build` antes do push — o agregado `docs/CHANGELOG-AGENTS.md` é **insert-only** (nunca remove/reescreve entradas; entradas históricas não são migradas). Guard de CI `docs-guards`: (a) agregado é append-only (multiset sobre blobs — perda de linha falha); (b) `docs/changelog/` é additions-only (M/D falham); (c) agregado está up to date com `docs/changelog/` (`changelog:check`); (d) nenhum marcador de conflito em diffs de markdown (docs/, AGENTS.md, .agents/ — cobre PRs docs-only, onde a suíte unit não roda). **Desde OPS63 os mesmos três checks rodam também no pre-push local** (`gate:push` → `gate:ci`, fase 1 — mesmos scripts, default `origin/main`). Restauração legítima (header muda, restauração estilo D8) escapa escrevendo **`changelog-rewrite: <motivo>` como linha própria** no body do PR — definição canônica aqui; o texto do checkbox do PR template nunca ativa (linha-ancorado). **O escape é CI-only (body do PR):** no pre-push local a restauração legítima falha com a mesma mensagem do CI — bypass documentado é `git push --no-verify` direto (o CI, com o escape no body, continua sendo a via da restauração). A própria troca `--merge` → `--rebase` deste doc usou o escape — header do agregado mudou.

## Registries compartilhados (serialização por arquivo, não por PR)

Arquivos de "lista" que N agentes escrevem em paralelo (changelog, plans, migrações, catalog) conflitam por construção: cada escrita reescreve o arquivo inteiro. Regras:

- **Cada entrega escreve UM arquivo por registro** (`docs/changelog/<data>-<id>.md`, `docs/plans/<slug>.md`, migration com nome único, etc.) — o arquivo comum é **derivado** (build/CI) ou **só-leitura por PR** (guard).
- **`serializes` no plano de intenção** nomeia o registro exato que a Issue toca (ex. `serializes: 'docs/plans/'`), para o executor agendar com clareza — é dica de ordem, não lock (rebase continua obrigatório).
- O rebase (Contrato de PR item 3) é o mecanismo real de conciliação: conflitos de append resolvem com `git checkout --ours/--theirs` por lado.

## CI por alvo

| Workflow                             | Trigger                                | Banco               | Passos                                                                                                                                                                   |
| ------------------------------------ | -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci-pr.yml`                          | PR → `main`                            | service Postgres 17 | Fase 1 barata → fase 2 cara; skips via `ci-scope.mjs`; fail-fast cancela o run no 1º job vermelho; rollup `checks`                                                       |
| `ci.yml`                             | push / dispatch `main`                 | service Postgres    | Full sempre; fail-fast cancela o run no 1º job vermelho; rollup `checks`; job `deploy` (runs-on `host`) publica no homeserver via `scripts/deploy-homeserver.sh` (OPS53) |
| `issue-done-on-main-merge.yml`       | PR merged → `main`                     | —                   | `Closes`/`Fixes` → `done` + `in-prod`                                                                                                                                    |
| `plan-issue-ready-on-main-merge.yml` | PR merged → `main`                     | —                   | `Related #N` aguardando plano → `ready` (OPS18; soft-skip)                                                                                                               |
| `agent-pr-ready-automerge.yml`       | PR same-repo → `main` (open/sync/…)    | —                   | Safety net via `forgejo-pr-automerge.mjs` (plain Node): espera checks e mergea por rebase; draft `cursor/*` → Ready; draft não-`cursor/*` = veto, skip                   |
| `agent-pool.yml`                     | schedule / PR closed `main` / dispatch | —                   | Supervisor do pool (`POOL_GITHUB_TOKEN`)                                                                                                                                 |

Action runtimes: `actions/checkout@v5`, `actions/setup-node@v5`, `pnpm/action-setup@v6` e `styfle/cancel-workflow-action@0.13.1` usam Node 24 nativo — sem `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`.

Fast gate: `pnpm gate:fast`. Push: `pnpm push`.

### Secrets (humano, uma vez)

| Secret              | Uso                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ |
| `FORGEJO_API_TOKEN` | Supervisor do pool e scripts Forgejo (`forgejo-api.mjs`)                             |
| `CURSOR_API_KEY`    | Supervisor do pool (Cursor Cloud)                                                    |
| `POOL_GITHUB_TOKEN` | PAT `actions:write` + `issues:write` (variables do pool; `GITHUB_TOKEN` costuma 403) |

Deploy (OPS53): o job `deploy` do `ci.yml` roda no host do runner (workstation) e streama `scripts/deploy-homeserver.sh` para o homeserver via SSH — build no homeserver (secrets de `~/stack/teqo-1313.env`), registry `localhost:5000`, migrate pelo serviço de maintenance `teqo-1313-migrate` antes do rollout, smoke pós-deploy. Nenhum secret novo no Forgejo. Runbook (rollback, falhas conhecidas): `docs/ops/teqo-1313-deploy.md`. O deploy Vercel (`vercel-promote.yml`, scripts, `vercel.json`) foi removido no OPS50.

## Cursor Cloud

`.cursor/environment.json` instala deps + Postgres nativo + `db:seed:minimal`. Sem secrets de prod. Preferir `pnpm push`; escape `git push --no-verify` só no cutover documentado acima.

## Agent pool

Supervisor remoto (`agent-pool.yml`): schedule + replenish em merge → `main` + dispatch. Workers PR `--base main`. Default model `composer-2.5`. **Secret `POOL_GITHUB_TOKEN`** obrigatório se `GITHUB_TOKEN` 403 em `/actions/variables`. Doctor: `pnpm agent:pool -- doctor`. Skill: `agent-pool`.

## Guardrails / leitura

`pnpm agent:file-miss` → harvest → `docs/GUARDRAILS.md`. Always-on: `AGENTS.md` → codebase-map → engineering-standards → esta página → PRODUCT/DESIGN/CUSTOMER.
