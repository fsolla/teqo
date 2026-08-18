# Plano: OPS60 — Guard de intenção explícita para escrita no bucket via `db:seed:posts`

Status: rascunho
Atualizado em: 2026-08-18
Issue: OPS60 (a registrar; achado do /simplify da #37)
Depends: [37] (destrava quando o pai flipar done)
Pai do achado: #10 (OPS52-media — quem fiou o S3 no seed)
Priority: P2
Kind: chore

## Problema

Achado do /simplify da OPS52-media-guard (#37, reviewer 1): o `pnpm db:seed:posts`
(`scripts/seed-posts.mjs:347-348`) faz upload das capas através do adapter de
media configurado — **Garage S3 quando as `S3_*` estão setadas** — sem flag de
intenção dedicada. O provisionador de worktree copia `S3_*` all-or-nothing
(`scripts/lib/worktree-env.mjs:58-77`), então um worktree com credenciais de
prod rodando o seed contra um DB local escreve covers no bucket de **prod** —
a mesma classe de risco que a #37 fechou para `media:recover`, ainda aberta no
seed. O seed é idempotente por slug e sobrescreve o key determinístico — a
escrita é silenciosa e "inofensiva" na aparência.

## Aceite

- Rodar `db:seed:posts` (ou o upload de media do seed) contra bucket `S3_*` de
  prod exige intenção explícita (ex.: `SEED_MEDIA_CONFIRM=1` ou equivalente do
  mesmo padrão `isTruthyEnv` da #37), fail-closed — sem a flag, o seed **não**
  escreve media no bucket (ou recusa apontar para bucket não-local).
- O comportamento local (sem `S3_*` → disk) e o upload via admin/CI de prod
  ficam intactos; dry-run/semântica de guard do seed preservada.
- Guard no dono: `isTruthyEnv` (cli.mjs, já existe da #37) — sem twin.

## Direção no codebase

- `scripts/seed-posts.mjs` — ponto de escrita da media; reusar
  `resolveS3StorageEnv` + `isTruthyEnv`.
- Alternativas a decidir na execução (gate humano): flag de env exigida para
  escrita com S3 ativo (paridade #37) vs exigir bucket local/explicitado;
  `--dry-run` do seed já existente como escape de planejamento.
- Runbook/AGENTS.md com o comando real; changelog.

## Já resolvido no simplify (não reabrir)

- Nada adicional: o achado desta Issue é o único do lote.

## Explicitamente fora (descartes + defers com gatilho)

- **Defer:** banir re-escritas `=== '1'`/`=== 'true'` de env-read no
  `codebaseConventions.unit.spec.ts` — gatilho: quando um 4º site aparecer ou
  no próximo refactor dos 3 sites existentes (`run-e2e-affected.mjs`,
  `worktree.mjs`, `agent-pool-state.mjs` — os dois primeiros são subset
  estrito e o terceiro é outro domínio).
- **Descartados:** echo do confirm no target summary; die com
  `ALLOW_REMOTE_DB`; rename `isTruthyEnv`; grep-invariante do wiring do guard
  (contrato é o runbook; teste de linha de guard é frágil).

## Appetite

~0,5 dia eng (um outcome verificável; sem migration/UI).
