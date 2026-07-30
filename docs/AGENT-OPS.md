# AGENT-OPS — operação do paradigma de agentes paralelos

Uma página. Norte: simplicidade (só GitHub + Cursor), agente para no merge a `stage`, `main`/prod só via promote humano.

## Ambientes de dados (test ladder — nunca misturar)

| Ambiente | Conteúdo | Quem usa |
| --- | --- | --- |
| **Mínimo** (`teqo_test` local / service CI) | schema migrado + `pnpm db:seed:minimal` (sintético, sem PII) | agentes, Cursor Cloud, CI de PR |
| **Stage** (Neon branch `stage`, clone de prod) | snapshot 100% de prod (PII!) | só CI `ci-stage.yml` + humanos em smoke controlado |
| **Prod** (Neon prod) | real | deploy Vercel a partir de `main` apenas |

Agentes **nunca** recebem `DATABASE_URL` de stage/prod e nunca setam `ALLOW_REMOTE_DB`. O escape `ALLOW_STAGE_TEST_DB` (`tests/helpers/assertTestDatabase.ts`) só existe para o workflow `ci-stage.yml`.

## Fluxo

```text
claim → feature branch → PR --base stage → CI PR green → auto-merge em stage
stage → CI stage green → (humano) pnpm agent:promote --i-am-human → main → Vercel prod
```

- **Agente faz sozinho:** `pnpm agent:claim` (pega a próxima Issue `ready` desbloqueada por `prio:P0..P3`, lock otimista ready→in-progress) → implementa → fast gate → `gh pr create --base stage` com `Closes #N` → **PARA**. PR para `stage` mergeia sozinho quando o CI fica verde (auto-merge nativo + protection em `stage`).
- **Só humano:** `pnpm agent:promote --i-am-human` (PR `stage→main` + merge com CI stage + ci-pr green; recusa se `main` divergiu de `stage` — merge main em stage antes), `pnpm db:refresh:stage` (refresh semanal do snapshot), editar envs Vercel/Neon, rodar `pnpm build` contra qualquer banco remoto.
- Se `main` divergir de `stage` (hotfix): merge/rebase de `main` em `stage` + CI stage green de novo, só depois promote.

## Comandos

| Comando | Faz |
| --- | --- |
| `pnpm agent:claim [-- --dry-run]` | Fila ready+unblocked por prio → `in-progress` + brief no stdout. Deps sem Issue = itens entregues do roadmap (satisfeitas, avisadas no brief) |
| `pnpm agent:register -- --id X --title T [--prio P1] [--depends A,B] [--plan docs/plans/x.md]` | Cria Issue (spec + labels) |
| `pnpm agent:prioritize -- <issue> <P0..P3>` | Troca a label `prio:*` |
| `pnpm agent:file-miss -- --title ...` | Issue `kind:agent-miss` → harvest em guardrail (`docs/GUARDRAILS.md`) |
| `pnpm agent:promote -- --i-am-human` | **Humano:** PR `stage→main` + merge se CI green |
| `pnpm db:seed:minimal` | DB mínimo sintético (contrato: [`scripts/lib/seed-minimal-manifest.mjs`](../scripts/lib/seed-minimal-manifest.mjs), pin `tests/unit/seedMinimalManifest.unit.spec.ts`) |
| `pnpm db:refresh:stage` | **Humano:** nova Neon branch `stage` de prod + swap do secret `STAGE_DATABASE_URL` (requer `NEON_API_KEY`) |

Labels: estado `ready|in-progress|blocked|done|in-prod`, `prio:P0..P3`, `kind:feature|defect|chore|agent-miss`, `needs:migration|consent`, `requirements-changed`. Issues carregam frontmatter `id/depends/serializes/priority` no body.

## Contrato de PR (toda entrega)

1. Se toca schema (migration, collection, Consent key, dado de boot) → **atualizar `db:seed:minimal` no mesmo PR** (label `needs:migration`). CI PR falha se `migrate + seed:minimal + test:int` não passam.
2. ≤1 PR aberto tocando `src/migrations/` | `payload-types.ts` (job `migration-lock`).
3. `docs/plans/<slug>.md` novo só para Issue nova — nunca recriar plans históricos no merge.

## CI por alvo

| Workflow | Trigger | Banco | Passos |
| --- | --- | --- | --- |
| `ci-pr.yml` | PR → `stage`/`main` | service Postgres 17 (mínimo) | lint, format, typecheck, knip, cycles, unit → migrate → **seed:minimal** → int → **build** + `migration-lock` |
| `ci-stage.yml` | push em `stage` | `STAGE_DATABASE_URL` (Environment `stage`) | **só** `migrate` + `test:int` — **NUNCA `pnpm build`** (build migra o banco que vê), nunca seed:minimal |
| `ci.yml` | push em `main` | service Postgres | gate pós-promote |
| E2E | fora do caminho crítico (nightly/label futura) | — | não bloqueia autonomia |

Fast gate local do agente antes do push: `pnpm lint && pnpm exec tsc --noEmit && pnpm test:unit` (+ `pnpm format:check` e `pnpm check:cycles` antes de commitar; int/build = CI).

## Stage DB — runbook de refresh (semanal, humano)

1. `export NEON_API_KEY=…` (console.neon.tech → API keys; projeto `jorgesolla` / `lively-math-34249863`).
2. `pnpm db:refresh:stage` — deleta a branch `stage` velha, cria nova do snapshot de prod, faz swap do secret `STAGE_DATABASE_URL` no Environment `stage`. `--dry-run` inspeciona.
3. Próximo `ci-stage` já usa o snapshot novo. Preview Vercel da branch `stage` (`jorgesolla-git-stage-solla.vercel.app`) aponta para o mesmo banco via envs `Preview (stage)` — **atenção**: o endpoint muda a cada refresh; rode também `vercel env add DATABASE_URL preview stage` com a URL nova (o script imprime a URL mascarada; pegue a completa no console Neon ou rode `vercel env pull`).

## Cursor Cloud

`.cursor/environment.json` instala deps, sobe Postgres (compose), migra e roda `db:seed:minimal` — clone + `gh` + DB mínimo bastam. Sem secrets de stage/prod. Hooks do repo são portáteis (paths relativos em `.cursor/hooks.json`); hooks pessoais (ex.: impeccable) ficam no `~/.cursor/hooks.json` do usuário.

## Guardrails progressivos

`pnpm agent:file-miss` → Issue `kind:agent-miss` → harvest periódico → guardrail programático (spec `codebaseConventions`, ESLint, check CI) → ledger `docs/GUARDRAILS.md`. Padrão já fichado: "migration sem atualizar seed:minimal".

## Leitura always-on (ordem)

`AGENTS.md` (fatiado 2026-07-30) → `.cursor/rules/codebase-map.mdc` → `.cursor/rules/engineering-standards.mdc` → esta página → kernels [`PRODUCT.md`](../PRODUCT.md) / [`DESIGN.md`](../DESIGN.md) / [`CUSTOMER.md`](CUSTOMER.md) (kernel no topo). Histórico: [`CHANGELOG-AGENTS.md`](CHANGELOG-AGENTS.md). Referência Payload sob demanda: [`PAYLOAD-REFERENCE.md`](PAYLOAD-REFERENCE.md).
