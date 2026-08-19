# AGENT-OPS — operação do paradigma de agentes paralelos

Uma página. Norte: simplicidade (Forgejo = tracker, GitHub = Actions), agente entrega em `main`, deploy de produção é **manual** com verificação full (OPS71).

## Ambientes de dados (test ladder — nunca misturar)

| Ambiente                                    | Conteúdo                                                     | Quem usa                                     |
| ------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| **Mínimo** (`teqo_test` local / service CI) | schema migrado + `pnpm db:seed:minimal` (sintético, sem PII) | agentes, Cursor Cloud, CI                    |
| **Prod** (`teqo_1313`, homeserver)          | real                                                         | job `deploy` do `deploy.yml` (OPS53 + OPS71) |

Agentes **nunca** recebem `DATABASE_URL` de prod e nunca setam `ALLOW_REMOTE_DB`. Não há mais smoke `stage` / `ALLOW_STAGE_TEST_DB` / `ci-stage.yml`.

## Fluxo

```text
claim → feature branch → PR --base main (GitHub) → CI PR green (cascade + skips) → auto-merge nativo em main (rebase)
main → (opcional, deliberado) workflow_dispatch deploy.yml → verify full suite verde → job deploy no homeserver (OPS53)
```

**Skills:** `plan-issue` (intenção + Issues) → `work-issue` (humano: Issue já claimada → impl plan → confirmação → execução) ou `agent-work-issue` (pool: já claimada → impl plan → execução sem pausa) → `/simplify` → `capture-review-debts` → PR `--base main` (GitHub) → `project-status`. `docs/roadmap.md` = legado congelado; fonte canônica = Issues do Forgejo (`git.solla.dev/fsolla/teqo`).

- **Agente faz sozinho:** claim (pool-supervisor no pool; humano via `pnpm agent:claim` fora da sessão — OPS33: `worktree next` claima) → implementa → **e2e local afetado** (OPS72, discricionário: roda os e2e que criou + os da mesma superfície — `pnpm test:e2e:affected`; ver skill) → **`pnpm push`** (origin = GitHub) → PR via `node scripts/github-pr.mjs` **Ready** (nunca draft) com `Closes #N` → o safety net `agent-pr-ready-automerge.yml` arma o **auto-merge nativo do GitHub** (`enablePullRequestAutoMerge`, rebase) — o servidor mergea quando o required check `CI (PR) / checks` fica verde. Regra always-on: `.agents/rules/agent-pr-workflow.mdc`. Em Cursor Cloud: `ManagePullRequest` com `draft: false` (o default draft da tool **não** vale neste repo) — o merge continua pelo safety net.
- **Só humano:** envs de produção no homeserver (`~/stack/teqo-1313.env`, fora do repo — o deploy as lê via BuildKit secrets), `GITHUB_TOKEN` local (PAT) para os scripts GitHub, secrets no repo GitHub, `pnpm configure:branch-protection` (idempotente; reaplicar se o drift voltar), runbook manual/rollback (`docs/ops/teqo-1313-deploy.md`).

### Dono do PR, dono do CI

**Done = PR mergeado em `main` com CI verde.** Falha de CI no teu PR — infra, teste pré-existente ou regressão — é tua até o merge. Exceção de blast radius: migration / access / Consent → pare e escale.

### Bypass de CI (cutover / transição)

- **Local:** se `gate:push` ainda espelha pipeline antigo e bloqueia push legítimo da PR que o muda → `git push --no-verify` permitido como escape de transição (não WIP permanente). Documentado aqui; após o cutover, entregas passam no CI novo sem bypass.
- **Cutover humano:** pode relaxar temporary required checks se o flip de proteção travar merges; reverter para `CI (PR) / checks` em `main` assim que o CI novo estiver verde.

## Comandos

| Comando                                                                                                       | Faz                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm agent:claim [-- --dry-run]`                                                                             | Fila ready+unblocked por prio → `in-progress` + brief (Forgejo)                                                                    |
| `pnpm worktree next [--issue N] [--stay]`                                                                     | Claim determinístico (mesma fila/lock do claim) → worktree + provisionamento                                                       |
| `pnpm agent:register -- --id X --title T [--prio P1] [--depends A,B] [--plan docs/plans/x.md] [--model slug]` | Cria Issue no Forgejo (`--plan` ⇒ `blocked` até `agent:ready`; sem plano ⇒ `ready`)                                                |
| `pnpm agent:ready -- --issue N[,N…]`                                                                          | Pós-merge do plano: `blocked`→`ready` (só Issues com link `docs/plans/`)                                                           |
| `pnpm agent:status`                                                                                           | Overview / fila / mermaid                                                                                                          |
| `pnpm agent:prioritize -- <issue> <P0..P3>`                                                                   | Troca `prio:*`                                                                                                                     |
| `pnpm agent:file-miss -- --title ...`                                                                         | Issue `kind:agent-miss`                                                                                                            |
| `pnpm agent:pool -- status\|tick --dry-run\|doctor`                                                           | Pool Cloud **dormente (OPS65)** — o workflow `agent-pool.yml` foi removido; dispatch falha 404; scripts/skill ficam para histórico |
| `pnpm push [-- -u origin HEAD …]`                                                                             | Canônico: ensure-deps + gate:push + push para o **GitHub** (origin)                                                                |
| `GITHUB_TOKEN=… node scripts/github-pr.mjs --head <b> --title <t> --body-file <f>`                            | Abre PR no **GitHub** (Ready, base `main`, nunca draft)                                                                            |
| `GITHUB_TOKEN=… pnpm configure:branch-protection [-- --dry-run]`                                              | Proteção de `main` no **GitHub**: required check `CI (PR) / checks` (idempotente — cria/atualiza/no-op)                            |
| `pnpm db:seed:minimal`                                                                                        | DB mínimo sintético                                                                                                                |

Labels (Forgejo): `ready|in-progress|blocked|done|in-prod`, `prio:*`, `kind:*`, `needs:*`.

**plan-issue (OPS17 + OPS18):** gate pós-overview fecha o lote antes de qualquer Issue/PR; register com `--plan` nasce `blocked` (não entra na fila do claim/pool); após o PR de planos mergear em `main` (`Related #N`), promote dual idempotente: (A) `pnpm agent:ready` na sessão; (B) Action `plan-issue-ready-on-main-merge.yml` lê `Related #N` e promove Issues ainda “aguardando plano” (`blocked` + link `docs/plans/`). Chores sem plano continuam nascendo `ready`.

## Contrato de PR

1. Schema → atualizar `db:seed:minimal` no mesmo PR (`needs:migration`).
2. Migrations NÃO são serializadas entre PRs: o CI (migrate + int, incl. `campaignMigrationReconciliation`) valida a cadeia em todo PR; rebase antes de `migrate:create` continua obrigatório.
3. Ready + auto-merge: `pnpm push -u origin HEAD` (GitHub) → PR via `node scripts/github-pr.mjs` (Ready, base `main`, `Closes #N`) → o safety net `agent-pr-ready-automerge.yml` (`scripts/github-pr-automerge.mjs`) arma o **auto-merge nativo do GitHub por rebase** — o servidor espera o required check `CI (PR) / checks` e mergea; nada a armar por PR, não há `gh` (OPS50) e não há poll (OPS71). **Merge é por rebase** (nunca merge commit): preserva a linha histórica limpa do `main` e é o modo do auto-merge.
4. **Changelog da entrega (OPS44):** toda entrega escreve `docs/changelog/<data>-<id>.md` (ex. `2026-08-13-ops44.md`) e roda `pnpm changelog:build` antes do push — o agregado `docs/CHANGELOG-AGENTS.md` é **insert-only** (nunca remove/reescreve entradas; entradas históricas não são migradas). Guard de CI `docs-guards`: (a) agregado é append-only (multiset sobre blobs — perda de linha falha); (b) `docs/changelog/` é additions-only (M/D falham); (c) agregado está up to date com `docs/changelog/` (`changelog:check`); (d) nenhum marcador de conflito em diffs de markdown (docs/, AGENTS.md, .agents/ — cobre PRs docs-only, onde a suíte unit não roda). **Desde OPS63 os mesmos três checks rodam também no pre-push local** (`gate:push` → `gate:ci`, fase 1 — mesmos scripts, default `origin/main`). Restauração legítima (header muda, restauração estilo D8) escapa escrevendo **`changelog-rewrite: <motivo>` como linha própria** no body do PR — definição canônica aqui; o texto do checkbox do PR template nunca ativa (linha-ancorado). **O escape é CI-only (body do PR):** no pre-push local a restauração legítima falha com a mesma mensagem do CI — bypass documentado é `git push --no-verify` direto (o CI, com o escape no body, continua sendo a via da restauração).

## Registries compartilhados (serialização por arquivo, não por PR)

Arquivos de "lista" que N agentes escrevem em paralelo (changelog, plans, migrações, catalog) conflitam por construção: cada escrita reescreve o arquivo inteiro. Regras:

- **Cada entrega escreve UM arquivo por registro** (`docs/changelog/<data>-<id>.md`, `docs/plans/<slug>.md`, migration com nome único, etc.) — o arquivo comum é **derivado** (build/CI) ou **só-leitura por PR** (guard).
- **`serializes` no plano de intenção** nomeia o registro exato que a Issue toca (ex. `serializes: 'docs/plans/'`), para o executor agendar com clareza — é dica de ordem, não lock (rebase continua obrigatório).
- O rebase (Contrato de PR item 3) é o mecanismo real de conciliação: conflitos de append resolvem com `git checkout --ours/--theirs` por lado.

## CI por alvo (GitHub Actions, OPS71)

| Workflow                             | Trigger                                                         | Banco                  | Passos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | --------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci-pr.yml`                          | PR → `main` (same-repo)                                         | 2× service Postgres 17 | Job único `checks` sequencial (OPS62 X1): guards → lint→format→typecheck→knip→cycles→unit→int→build→e2e; skips via `ci-scope.mjs` (step `scope`); **fail-fast estrutural** — step vermelho interrompe o job, o run falha; `concurrency` nativo cancela o run em push novo; e2e **apenas blast radius** (`selected`, nunca `full` — OPS72) em 1 processo com `PLAYWRIGHT_WORKERS=4`; 2 services por nome na rede do job (`postgres-int`/`postgres-build`, sem publish host); fork-PR excluída no `if:` do job (repo público — não queima minutes)          |
| `deploy.yml`                         | **`workflow_dispatch` manual**                                  | 2× service Postgres 17 | **Dois jobs:** `verify` (hosted, suíte **full** sem skips — lint→format→typecheck→knip→cycles→unit→int→build→e2e full) → `deploy` (`needs: [verify]`, `runs-on: [self-hosted, homeserver]`) executa `scripts/deploy-homeserver.sh <sha>` **localmente** no homeserver (sem SSH; idempotente; HEAD guard; flock; migrator→migrate→runner→rollout→smoke)                                                                                                                                      |
| `issue-done-on-main-merge.yml`       | PR merged → `main` (same-repo) + **dispatch manual (recovery)** | —                      | `Closes`/`Fixes` → `done` + `in-prod` + **close** **no Forgejo** (PAT `FORGEJO_API_TOKEN`; body do PR via `PR_BODY` do evento GitHub — no dispatch, busca via `gh` com o mesmo contrato: merged + main + same-repo)                                                                                                                                                                                                                                                                         |
| `plan-issue-ready-on-main-merge.yml` | PR merged → `main` (same-repo) + **dispatch manual (recovery)** | —                      | `Related #N` aguardando plano → `ready` **no Forgejo** (OPS18; soft-skip; mesmo PAT)                                                                                                                                                                                                                                                                                                                                                                                                        |
| `agent-pr-ready-automerge.yml`       | PR same-repo → `main` (open/sync/…)                             | —                      | Safety net via `github-pr-automerge.mjs` (plain Node, REST+GraphQL): draft `cursor/*` → Ready (PATCH); arm `enablePullRequestAutoMerge` (rebase) **com o `AUTOMERGE_PAT`** (fail-closed — nunca o `GITHUB_TOKEN` nativo, cujo merge como `github-actions[bot]` não cria runs no `closed`; OPS71-FLIP) — o **servidor** espera o required check `CI (PR) / checks` (o OPS64 "rollup pode mentir" é estrutural aqui: job único posta um check-run honesto); draft não-`cursor/*` = veto, skip |
| `archive-cursor-agent.yml`           | dispatch manual (ops)                                           | —                      | Helper: cancela run + arquiva um agente Cursor Cloud (`CURSOR_API_KEY`) — **dormente (OPS65)** como o pool                                                                                                                                                                                                                                                                                                                                                                                  |
`agent-pool.yml` foi **removido no OPS65** (pool dormente; o tick `*/10` custava 144 `pnpm install`/dia na workstation). O verificador de main (`ci.yml`) foi **eliminado no OPS71** (gate 2026-08-19): só o `verify` do dispatch manual roda a suíte full.

Action runtimes: `actions/checkout@v5`, `actions/setup-node@v5`, `pnpm/action-setup@v6` e `actions/cache@v4`.

Fast gate: `pnpm gate:fast`. Push: `pnpm push`.

### Secrets (humano, uma vez — repo GitHub)

| Secret              | Uso                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FORGEJO_API_TOKEN` | Scripts Forgejo (`forgejo-api.mjs`) e flips pós-merge (`issue-done`, `plan-issue-ready`) — o `GITHUB_TOKEN` nativo do GitHub não toca Issues do Forgejo (OPS61)                                                                                                                                                                                                                                            |
| `AUTOMERGE_PAT`     | **Arm do auto-merge nativo** (`agent-pr-ready-automerge.yml`) — PAT de usuário real (fsolla) com `pull-requests: write` + `contents: write` no repo. **Sem ele o job falha fail-closed**: o `GITHUB_TOKEN` nativo armado faria o merge como `github-actions[bot]` e o `closed` do PR não criaria runs (anti-recursão do GitHub) — os flips pós-merge ficariam silenciosamente mortos (OPS71-FLIP, PR #746) |
| `CURSOR_API_KEY`    | Supervisor do pool (Cursor Cloud) — **dormente (OPS65)**; só o helper `archive-cursor-agent.yml` a usa hoje                                                                                                                                                                                                                                                                                                |

Local: `GITHUB_TOKEN` (PAT com escopo `repo`) para `node scripts/github-pr.mjs`, `pnpm configure:branch-protection` e qualquer script GitHub — o push SSH usa a chave `~/.ssh/id_ed25519` registrada no GitHub. Envs de produção (DB, S3, VAPID, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_URL`) vivem em `~/stack/teqo-1313.env` no homeserver — nunca como secrets do GitHub. `POOL_GITHUB_TOKEN` é **legado** (era da transição GitHub pré-OPS50).

### Flips pós-merge (OPS71-FLIP): o evento `closed` e a recuperação manual

O flip `issue-done`/`plan-issue-ready` roda no `pull_request: closed` do PR no GitHub — mas **o merge feito pelo auto-merge armado com o `GITHUB_TOKEN` nativo é atribuído a `github-actions[bot]` e NÃO cria workflow runs** (anti-recursão documentada do GitHub: eventos acionados por ações do `GITHUB_TOKEN` não geram runs; o `closed` fica no timeline do PR com 0 runs — achado ao vivo no PR #746). Isso só não acontece porque o arm agora usa o `AUTOMERGE_PAT` (merge atribuído a usuário real → runs criados, comportamento do PR #742).

**Se mesmo assim o flip não rodou** (evento perdido, run falhou, PR mergeado por bot antes do fix): o workflow tem **`workflow_dispatch` de recuperação** — dispatch de `issue-done-on-main-merge.yml` (ou `plan-issue-ready-on-main-merge.yml`) com o input `pr` = número do PR; o job busca o PR via `gh` e aplica o mesmo contrato do evento (merged + base main + same-repo, senão skip). Fallback local (sem GitHub): `PR_BODY='Closes #N' node scripts/forgejo-issue-transition.mjs --pr <N>` com o `GITHUB_TOKEN` do ambiente (PAT). O flip agora também **fecha** a Issue (`PATCH state=closed` — o merge no GitHub não fecha Issues do Forgejo como o merge nativo da era Forgejo fazia). Falha em qualquer passo = job vermelho (OPS61, nunca mentir); o `forgejo-api.mjs` retenta 410/5xx transitórios (OPS67 + OPS71-FLIP: 410 do proxy retenta em qualquer método — a origem nunca viu o request).

Branch protection de `main` no **GitHub** (aplicada no cutover do OPS71, via `pnpm configure:branch-protection`): required check `CI (PR) / checks` (a UI exibe workflow/job; o **literal de match é `checks`** — o GitHub casa pelo nome do check-run — pin ao vivo PR #742), `strict=false`, 0 reviews, `enforce_admins: true` (nem admin mergea com CI vermelho — mesmo invariante do rule-based Forgejo). O auto-merge nativo espera esse mesmo check antes de mergear; a regra no servidor é o gate real de qualquer caminho de merge, inclusive API manual. Reaplicar/consertar drift: `pnpm configure:branch-protection` (idempotente).

Deploy (OPS53 + OPS71): **manual** via `workflow_dispatch` no `deploy.yml` — o job `verify` (hosted, suíte full incl. e2e full) roda **antes** do job `deploy` (`needs: [verify]`), que executa `scripts/deploy-homeserver.sh <sha>` no runner self-hosted do GitHub **no homeserver** (conecta outbound ao GitHub — funciona atrás do Cloudflare tunnel; o hosted nunca toca o homeserver; o self-hosted não conta minutos hosted). O script: HEAD guard (`TEQO_REPO_URL` — default `https://github.com/fsolla/teqo.git`, público) → flock → guard "already deployed" (revision do container) → build do migrator (BuildKit, secrets de `~/stack/teqo-1313.env`) → push/tag em `localhost:5000` → swap dos tags no compose (backup) → **migrations** (`teqo-1313-migrate` — antes do build do runner, OPS66) → build do runner (contra o banco JÁ migrado) → rollout → healthcheck → smoke. Falha = job vermelho; nada é publicado pela metade. Runbook (rollback, falhas conhecidas): `docs/ops/teqo-1313-deploy.md`. O deploy Vercel foi removido no OPS50; o verificador automático de main foi eliminado no OPS71 — se um dia o merge em main quiser rede de regressão, o `ci.yml` volta com 1 linha de trigger (sem deploy).

## Cursor Cloud

`.cursor/environment.json` instala deps + Postgres nativo + `db:seed:minimal`. Sem secrets de prod. Preferir `pnpm push`; escape `git push --no-verify` só no cutover documentado acima. PR via `ManagePullRequest` (draft: false) — o merge continua pelo safety net do GitHub.

## Agent pool

**Dormente (OPS65)** — o workflow `agent-pool.yml` foi removido e o dispatch
via CLI falha 404; scripts/skills ficam para histórico. O que foi:
Supervisor remoto (`agent-pool.yml`): schedule + replenish em merge → `main` +
dispatch. Workers PR `--base main`. Default model `composer-2.5`. Doctor:
`pnpm agent:pool -- doctor`. Skill: `agent-pool`.

## Guardrails / leitura

`pnpm agent:file-miss` → harvest → `docs/GUARDRAILS.md`. Always-on: `AGENTS.md` → codebase-map → engineering-standards → esta página → PRODUCT/DESIGN/CUSTOMER.
