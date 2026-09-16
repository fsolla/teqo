# OPS119++ — blast radius de `scripts/`: risk map das libs restantes + static scope

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1077 (`depends: [OPS119+]`)
Intenção: débito pós-entrega da OPS119+ (#1071)
Priority: P3
Impeccable: A — N/A (CLI/CI, sem superfície de produto)
Appetite: ~1h eng

## Origem

Triagem do `/simplify` da OPS119+ (#1071): a entrega fechou a classe S6
(diff só-lib classificava `none` → unit não rodava) apenas para os 3 arquivos de
launch/agent-session. O resíduo é a mesma classe nos demais módulos `scripts/`.

- **F1 — risk map das libs restantes (expensive_lock, score 3):**
  `HIGH_RISK_EXACT` (`scripts/lib/test-affected-core.mjs:25-56`) cobre só alguns
  dos ~40 módulos `scripts/lib/*.mjs` importados por specs unit.
  `scripts/lib/worktree-env.mjs` — mesma superfície de launch, pinada por
  `tests/unit/worktree.unit.spec.ts:5-16` e importada por
  `scripts/lib/auto-unblock.mjs:10` — segue classificando `none` num diff
  só-nele: a unit que a cobre não roda. **Opções:** A) invariante derivado
  (todo módulo `scripts/**` importado por um spec unit é high-risk) — fail-closed,
  mata a classe na raiz; B) estender o allowlist literal com os arquivos
  conhecidos — menor blast radius, mas reabre o buraco a cada lib nova.
  **Recomendação:** A, com allowlist de exceções explícitas se houver falso
  positivo. **Rejeitadas:** prefixo `scripts/lib/` inteiro (rejeitado na
  intenção-mãe: engole libs sem harness e força `full` em diffs triviais).
- **F2 — static scope de `scripts/` (cheap_polish, score 2):** `isCodePath`
  (`scripts/lib/test-affected-core.mjs:131-140`) não inclui `scripts/`, então
  `classifyStaticScope` devolve `none` e lint/typecheck/knip ficam pulados num
  diff só-scripts. Estender `isCodePath` a `scripts/` (revisar o custo de CI de
  rodar o static num diff de `.mjs`).

## Fases verificáveis

1. **F1 — derivar/estender o risk map** e atualizar os pins do dono
   (`testAffected.unit.spec.ts` / `ciSkipInvariants.unit.spec.ts`). Verificação:
   um diff só-`scripts/lib/<lib>` devolve `full` em `classifyTestScope`.
2. **F2 — `isCodePath` cobrir `scripts/`**; pin em `ciSkipInvariants`. Verificação:
   um diff só-scripts devolve `code` em `classifyStaticScope`.

## Rabbit holes / Não escopo

- Ampliar o escopo para qualquer superfície fora de `scripts/` (produto/UI): fora.
- Reescrever o harness de classificação: fora — só o risk map e `isCodePath`.
