# AGENT-OPS — operação do paradigma de agentes paralelos

Uma página. Norte: simplicidade (só GitHub + Cursor), agente para no merge a `stage`, `main`/prod via auto-promote quando o CI stage fica verde.

## Ambientes de dados (test ladder — nunca misturar)

| Ambiente                                       | Conteúdo                                                     | Quem usa                                           |
| ---------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| **Mínimo** (`teqo_test` local / service CI)    | schema migrado + `pnpm db:seed:minimal` (sintético, sem PII) | agentes, Cursor Cloud, CI de PR                    |
| **Stage** (Neon branch `stage`, clone de prod) | snapshot 100% de prod (PII!)                                 | só CI `ci-stage.yml` + humanos em smoke controlado |
| **Prod** (Neon prod)                           | real                                                         | deploy Vercel a partir de `main` apenas            |

Agentes **nunca** recebem `DATABASE_URL` de stage/prod e nunca setam `ALLOW_REMOTE_DB`. O escape `ALLOW_STAGE_TEST_DB` (`tests/helpers/assertTestDatabase.ts`) só existe para o workflow `ci-stage.yml`.

## Fluxo

```text
claim → feature branch → PR --base stage → CI PR green → auto-merge em stage (sem exigir estar na head de stage; conflito = rebase)
stage → CI stage green → auto-promote (workflow promote-stage-to-main.yml) → main → Vercel prod
```

**Skills do fluxo (desde 2026-07-30):** `plan-issue` (ideia → plano completo + gate de confirmação + Issue via `agent:register --model`) → `work-issue` (claim → verificação de modelo → freshness audit → execução → /simplify → PR `--base stage` → acompanha CI até o merge) → `project-status` (overview/fila/mermaid/bloqueios/consolidação, read-only). `docs/roadmap.md` = **legado congelado** (stub); a fonte canônica são as GitHub Issues.

- **Agente faz sozinho:** `pnpm agent:claim` → implementa → **`pnpm push`** (bootstrap deps/hooks + hook `gate:push`) → `gh pr create --base stage` com `Closes #N` (**Ready**, sem `--draft`) → `gh pr merge --auto --merge` → `gh pr checks --watch --required` até o merge. Regra PR: `.cursor/rules/agent-pr-workflow.mdc`.

### Dono do PR, dono do CI (desde 2026-07-30 — incidente PR #50)

**Done = PR mergeado em `stage` com CI verde.** Falha de CI no teu PR — infra do workflow, teste pré-existente ou regressão da feature — é tua até o merge. "Fora do escopo da feature" não é motivo para parar: corrige na mesma branch. Triagem das três classes: (a) **infra do workflow** (job mal configurado, step faltando) → fix no workflow no mesmo PR; (b) **teste pré-existente quebrado ou frágil** → repair no mesmo PR, no padrão dos specs irmãos; (c) **regressão da feature** → fix normal. Exceção de blast radius: se o fix exigir migration, access control ou Consent, para e escala com Opções — esses nunca se corrigem "de passagem". Flaky não se resolve com retry: repair, ou quarentena justificada no PR + débito registrado (`capture-review-debts`).

- **Só humano:** `pnpm db:refresh:stage` (refresh semanal do snapshot), editar envs Vercel/Neon, rodar `pnpm build` contra qualquer banco remoto. `pnpm agent:promote --i-am-human` permanece como override manual de emergência (mesmas verificações, sem esperar o workflow).
- **Auto-promote:** `promote-stage-to-main.yml` dispara quando `ci-stage.yml` termina com sucesso. Só promove se o `headSha` do run ainda for o head de `stage` (commit mais novo ganha quando o CI enfileira). Recusa se `main` divergiu de `stage` (hotfix: merge `main` em `stage` + CI stage green de novo).
- **Merge em stage sem estar na head:** branch protection de `stage` com `strict=false` — PR pode auto-merger com CI green mesmo que outro PR tenha entrado antes; conflito de merge continua bloqueando (rebase obrigatório). Aplicar/reparar: `pnpm configure:branch-protection`.
- **Secret opcional:** `PROMOTE_GITHUB_TOKEN` (PAT admin do repo) se `GITHUB_TOKEN` não conseguir `gh pr merge --admin` na proteção de `main`. Settings → Actions → "Allow GitHub Actions to create and approve pull requests" também ajuda.
- **Engineering-audit é solitário:** quando roda, o paralelismo pausa (nenhum outro agente no repo) e o agente do audit executa as remediações P0/P1 na mesma sessão; inclui o harvest `kind:agent-miss` → guardrails.

## Comandos

| Comando                                                                                                       | Faz                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm agent:claim [-- --dry-run]`                                                                             | Fila ready+unblocked por prio → `in-progress` + brief no stdout. Deps sem Issue = itens entregues do roadmap (satisfeitas, avisadas no brief)                          |
| `pnpm agent:register -- --id X --title T [--prio P1] [--depends A,B] [--plan docs/plans/x.md] [--model slug]` | Cria Issue (spec + labels + frontmatter com `model:` quando informado)                                                                                                 |
| `pnpm agent:status`                                                                                           | Read-only: overview, fila na ordem do claim (com `model:`), mermaid, bloqueios, sugestões de consolidação                                                              |
| `pnpm agent:prioritize -- <issue> <P0..P3>`                                                                   | Troca a label `prio:*`                                                                                                                                                 |
| `pnpm agent:file-miss -- --title ...`                                                                         | Issue `kind:agent-miss` → harvest em guardrail (`docs/GUARDRAILS.md`)                                                                                                  |
| `pnpm agent:pool -- status\|tick --dry-run\|doctor`                                                           | Inspeção local do pool de workers Cloud; start/stop/pause **remotos** via `gh workflow run agent-pool.yml -f action=…` (ver "Agent pool" abaixo)                       |
| `pnpm agent:promote -- --i-am-human`                                                                          | **Override manual:** PR `stage→main` + merge se CI stage green (auto-promote faz isso sozinho)                                                                         |
| `pnpm push [-- -u origin HEAD …]`                                                                             | **Canônico:** `ensure-repo-deps` + `gate:push` + `git push --no-verify` (gate no script — não depende do Husky)                                                        |
| `pnpm configure:branch-protection [-- --dry-run]`                                                             | Ajusta proteção de `stage` (`strict=false`) e `main` (0 reviews — auto-promote substitui o humano)                                                                     |
| `pnpm db:seed:minimal`                                                                                        | DB mínimo sintético (contrato: [`scripts/lib/seed-minimal-manifest.mjs`](../scripts/lib/seed-minimal-manifest.mjs), pin `tests/unit/seedMinimalManifest.unit.spec.ts`) |
| `pnpm db:refresh:stage`                                                                                       | **Humano:** nova Neon branch `stage` de prod + swap do secret `STAGE_DATABASE_URL` (requer `NEON_API_KEY`)                                                             |

Labels: estado `ready|in-progress|blocked|done|in-prod`, `prio:P0..P3`, `kind:feature|defect|chore|agent-miss`, `needs:migration|consent`, `requirements-changed`. Issues carregam frontmatter `id/depends/serializes/priority/model` no body.

## Contrato de PR (toda entrega)

1. Se toca schema (migration, collection, Consent key, dado de boot) → **atualizar `db:seed:minimal` no mesmo PR** (label `needs:migration`). CI PR falha se `migrate + seed:minimal + test:int` não passam.
2. ≤1 PR aberto tocando `src/migrations/` | `payload-types.ts` (job `migration-lock`).
3. `docs/plans/<slug>.md` novo só para Issue nova — nunca recriar plans históricos no merge.
4. **Ready + auto-merge:** ver `.cursor/rules/agent-pr-workflow.mdc` — `gh pr create --base stage` (sem `--draft`) → `gh pr merge --auto --merge`; acompanhar com `gh pr checks --watch --required` (Vercel não é gate).

## CI por alvo

| Workflow                    | Trigger                     | Banco                                      | Passos                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci-pr.yml`                 | PR → `stage`/`main`         | service Postgres 17 (mínimo)               | jobs paralelos: `lint`/`format`/`typecheck`/`knip`/`cycles` · `unit`/`int` (**afetados pelo diff**: `vitest --changed` vs base do PR; fallback full em paths de risco — `scripts/test-affected.mjs`) · `e2e` (manifesto path→spec — `scripts/e2e-affected.mjs`, bloqueante) · `build` + `migration-lock`; job rollup **`checks`** agrega todos (nome legado exigido pela branch protection — não re-serializa a suíte) |
| `ci-stage.yml`              | push em `stage`             | `STAGE_DATABASE_URL` (Environment `stage`) | **smoke** `migrate` + subset int curado contra snapshot Neon (não é suíte completa — full int estourou timeout 2× em 2026-07-30). Gate de **promote automático** para `main`. **NUNCA `pnpm build`**                                                                                                                                                                                                                   |
| `promote-stage-to-main.yml` | ci-stage success em `stage` | —                                          | auto-merge `stage→main` se head ainda é o de `stage`; marca Issues `done` → `in-prod`                                                                                                                                                                                                                                                                                                                                  |
| `ci.yml`                    | push em `main`              | service Postgres                           | **gate completo sempre** (rede de segurança pós-promote): estático + unit + int full (com seed:minimal) + build + e2e full                                                                                                                                                                                                                                                                                             |

Fast gate local do agente (iteração): `pnpm gate:fast` (lint + typecheck + test:unit). **Push canônico:** `pnpm push` — `ensure-repo-deps` + `gate:push` no script + push (`--no-verify` só porque o gate já rodou). Hook `.husky/pre-push` repete o mesmo para quem usa `git push` após `pnpm i`. Cursor Cloud: `pnpm install` já está em `.cursor/environment.json` (`install`). Requer Postgres local com `teqo_test`. Escape WIP: `git push --no-verify` sem `pnpm push`. Debug e2e: `pnpm test:e2e:affected`.

## Stage DB — runbook de refresh (semanal, humano)

1. `export NEON_API_KEY=…` (console.neon.tech → API keys; projeto `jorgesolla` / `lively-math-34249863`).
2. `pnpm db:refresh:stage` — deleta a branch `stage` velha, cria nova do snapshot de prod, faz swap do secret `STAGE_DATABASE_URL` no Environment `stage`. `--dry-run` inspeciona.
3. Próximo `ci-stage` já usa o snapshot novo. Preview Vercel da branch `stage` (`jorgesolla-git-stage-solla.vercel.app`) aponta para o mesmo banco via envs `Preview (stage)` — **atenção**: o endpoint muda a cada refresh; rode também `vercel env add DATABASE_URL preview stage` com a URL nova (o script imprime a URL mascarada; pegue a completa no console Neon ou rode `vercel env pull`).

## Cursor Cloud

`.cursor/environment.json` instala deps, sobe Postgres nativo (`ensure-postgres.sh` — VMs Cloud não rodam Docker/compose), migra e roda `db:seed:minimal` — clone + `gh` + DB mínimo bastam. Sem secrets de stage/prod. Hooks do repo são portáteis (paths relativos em `.cursor/hooks.json`); hooks pessoais (ex.: impeccable) ficam no `~/.cursor/hooks.json` do usuário.

## Agent pool (orquestrador de workers Cloud)

Supervisor **remoto** que mantém até 5 Cursor Cloud Agents rodando `work-issue` sobre Issues `ready` elegíveis para autonomia (label `ready`, sem `blocked`/`requirements-changed`/`needs:consent`, deps satisfeitas; `needs:migration` cede ao `migration-lock`). Implementação: `.github/workflows/agent-pool.yml` (tick stateless: `schedule */10min` + `pull_request` closed em `stage` + `workflow_dispatch`) rodando `scripts/agent-pool.mjs`; workers spawnados via Cloud Agents API v1 com o `model:` da Issue (fallback `composer-2.5`). Canal canônico humano: `gh workflow run agent-pool.yml -f action=start|stop|pause|resume` (wrappers: `pnpm agent:pool -- start|stop|pause|resume|status|doctor`). Estado escalar em repo variables `POOL_*`; ativos derivados (marcadores `pool-worker` nos comentários + status dos runs). Claim coordenado pelo supervisor (alocador único, sem race); falha terminal → Issue a `blocked` para triagem; fila drenada → pool se desliga. **Nunca** chama `agent:promote`. Requer repo secret `CURSOR_API_KEY`; `schedule`/trigger de PR só ativam após merge em `main`. Arquitetura e runbook: [`docs/plans/agent-pool-orchestrator.md`](plans/agent-pool-orchestrator.md) + skill `agent-pool`.

## Guardrails progressivos

`pnpm agent:file-miss` → Issue `kind:agent-miss` → harvest periódico → guardrail programático (spec `codebaseConventions`, ESLint, check CI) → ledger `docs/GUARDRAILS.md`. Padrão já fichado: "migration sem atualizar seed:minimal".

## Leitura always-on (ordem)

`AGENTS.md` (fatiado 2026-07-30) → `.cursor/rules/codebase-map.mdc` → `.cursor/rules/engineering-standards.mdc` → esta página → kernels [`PRODUCT.md`](../PRODUCT.md) / [`DESIGN.md`](../DESIGN.md) / [`CUSTOMER.md`](CUSTOMER.md) (kernel no topo). Histórico: [`CHANGELOG-AGENTS.md`](CHANGELOG-AGENTS.md). Referência Payload sob demanda: [`PAYLOAD-REFERENCE.md`](PAYLOAD-REFERENCE.md).
