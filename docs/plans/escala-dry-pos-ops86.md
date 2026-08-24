# OPS86+: curated não engole unmapped-risk sem rastro

Status: rascunho
Atualizado em: 2026-08-24
Issue: #846
Intenção: docs/plans/ops86-blast-radius-testes-prs.md (débito pós-entrega)
Priority: P2
Impeccable: A — N/A sem UI
Appetite: ~2h eng

## Origem

Triagem do simplify da entrega OPS86 (#832): o cheque high-risk de
`selectE2eSpecs` (`scripts/lib/test-affected-core.mjs`) precede a computação
de `unmappedRisk`. Um diff que toca uma migração (high-risk) **e** um arquivo
novo de área de risco (ex. `src/utilities/access/novo.ts`) cai em `curated`
com `unmapped: []` — o arquivo de risco desaparece sem rastro no `reason`.
Segurança mantida (o conjunto curado inclui as specs de RBAC/visibilidade),
mas o fail-closed é bypassado sem pista de diagnóstico exatamente no caso que
o OPS86 existe para caçar.

## Fase única

1. **Núcleo + pin** — reordenar `selectE2eSpecs` para computar os unmapped de
   área de risco **antes** do early-return de high-risk, e incluí-los no
   `reason` do curated (ex.: "curated + risk files without mapping: …"), sem
   mudar o mode (`curated` continua vencendo — a curadoria cobre as
   superfícies de risco). Alternativa rejeitada: fazer `unmapped-risk` vencer
   o high-risk — piora o falso negativo (a spec nova de RBAC poderia não
   existir e o curated é a rede mais forte). Pins: `testAffected.unit.spec.ts`
   ganha caso "high-risk + risco não-mapeado → curated com unmapped no
   reason"; `ciSkipInvariants`/`e2eAffectedManifest` intactos.
   Verificação: `pnpm test:unit` (pins), `pnpm gate:fast`, classificador
   exercitado à mão no caso combinado.

## Já resolvido no simplify/critique (não reabrir)

- gate-ci falha em `unmapped-risk` (espelho fail-fast do CI); pin do wrapper
  espelhando `package.json`; `E2E_SMOKE_FALLBACK_SPEC` movido para o
  manifesto; labels risk-aware no `ci-scope`/`e2e-affected`; wording do passo
  de falha no `ci-pr.yml`; switch no `run-e2e-affected`; `AGENT-OPS.md`
  atualizado.

## Explicitamente fora (defer/descartes desta triagem)

- **Descartado:** pin do ci-pr.yml casa 1 ocorrência de `selected || curated`
  (S6) — remover `curated` de um passo isolado quebra loud no CI (sem
  browser/build); pin redundante aceitável.
- **Descartado:** replicação da lista curada/risco em docs (S10) — o pin de
  teste é o guard real; changelog é registro histórico por convenção.
- **Descartado:** 10 specs órfãs full-only (G1) — gap já registrado no
  changelog da entrega; dono natural é o OPS87 (#833).
- **Defer + gatilho:** `startsWith('src/utilities/ai')` sem trailing slash
  over-seleciona um futuro `src/utilities/ai*` (S7) — direção segura
  (fail-closed); gatilho: surgir o 1º módulo irmão `src/utilities/ai*` fora
  de `ai/`.
- **Defer + gatilho:** parse manual de argv no `vitest-changed-or-full.mjs`
  diverge do `scripts/lib/cli.mjs` (3º estilo de parsing no repo) (S9) —
  DRY com 1 call site de 2 flags; gatilho: 3ª flag ou 2º script duplicando o
  loop.
