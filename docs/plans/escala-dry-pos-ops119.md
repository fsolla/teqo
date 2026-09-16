# OPS119+ — launch do worktree: risk map das libs + pin do wiring do `plan`

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1071
Intenção: débito pós-entrega da OPS119 (#1066)
Priority: P3
Impeccable: A — N/A (CLI/shell, sem superfície de produto)
Appetite: ~1h eng

## Origem

Triagem do `/simplify` da entrega OPS119 (#1066 — `worktree plan` sem bag abre
driverless): dois achados de score 3 na **mesma superfície** (launch do worktree
↔ `agent-session`), mesclados neste lote.

- **S6 — risk map (integridade do guard):** `HIGH_RISK_EXACT`
  (`scripts/lib/test-affected-core.mjs:25-53`) só marca `scripts/worktree.mjs`.
  Um diff que toca **apenas** `scripts/lib/worktree.mjs`,
  `scripts/lib/agent-session.mjs` ou `scripts/agent-session.mjs` classifica
  `classifyTestScope` como `none` — a suíte unit **não roda** no PR (e o static
  scope também é `none`). A entrega OPS119 só rodou full porque tocou
  `scripts/worktree.mjs`; um fix lib-only passaria verde sem teste. Fail-closed
  do blast radius: as libs puras são pinadas por specs unit que nunca seriam
  exercitados no diff que as quebra.
- **S4 — pin do wiring:** o repasse `argument: bag` de `cmdPlan` →
  `cmdNamespaceBranch` (`scripts/worktree.mjs:764-768`) não tem pin unitário —
  só as libs puras (`purposeInvocation`, `opencodeLaunchDirective`) estão
  pinadas. Um `argument` dropado no runner não é pego por teste.

## Fases

1. **F1 — risk map (~30min):** incluir os arquivos do launch no piso de blast
   radius — `scripts/agent-session.mjs`, `scripts/lib/agent-session.mjs`,
   `scripts/lib/worktree.mjs` em `HIGH_RISK_EXACT`. **Alternativa rejeitada:**
   prefixo `scripts/lib/` inteiro — engoliria libs sem harness próprio e
   forçaria full em diffs triviais. Atualizar o pin do dono
   (`tests/unit/testAffected.unit.spec.ts` /
   `tests/unit/ciSkipInvariants.unit.spec.ts`). Verificação: o classificador
   devolve `full` para um diff só-lib.
2. **F2 — pin do wiring (~30min):** tornar o mapeamento do `cmdPlan` testável.
   **Opções:** A) exportar o mapa purpose→opções (não o spawn); B) caso unit
   que injeta as opções em `cmdNamespaceBranch`. **Rejeitada:** teste que cria
   worktree de verdade (lento, side effects, colide no slot). Verificação:
   `pnpm test:unit`.

## Já resolvido no simplify (não reabrir)

- Doc drift de `opencodeLaunchDirective` e do comentário de
  `cmdNamespaceBranch`, e o fixture fantasma do spec `driverArgs`
  (`plan-issue` com `arguments:''` → hoje `bug-fix` com bag vazio) — corrigidos
  na própria OPS119.

## Explicitamente fora

- **S1** (`return { command, arguments: '' }` final de `purposeInvocation`
  inalcançável hoje): é o fallback fail-safe para um purpose mapeado sem args —
  removê-lo reintroduziria a classe de bug que ele evita. Descartado (YAGNI).
- **S2** (sanitização `replace(/["\\]/g,'')` duplicada entre as duas libs):
  defer — gatilho: 3º call site ou import cruzado das libs.
- **S3** (política driverless em `!==` no CLI): defer — gatilho: 3º purpose
  driverless/sem-args.
- **Prefill-sem-submit no opencode** (upstream): fora — proposição
  `~/Code/propositions/opencode/prefill-prompt-sem-submit.md` já re-flagada.
