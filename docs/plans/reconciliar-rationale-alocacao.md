# Reconciliar drift — `allocation_decision.rationale` NOT NULL vs config

Status: rascunho
Atualizado em: 2026-08-04
Issue: #364 (registrada via agent:register)
Origem: débito B156 (triage S5/S14) — descoberto no `migrate:create` de `20260804_061017_add_state_deputy_advisors`
Appetite: ~0,25 dia eng
Model: `composer-2.5`

## Contexto

- `20260724_180000_add_campaign_foundation_records` criou `allocation_decision.rationale` como `varchar NOT NULL`.
- B134 (#288) tornou o motivo **opcional** na config (`AllocationDecision.rationale.required: false`), sem migration reconciliando a coluna.
- Consequência: todo `pnpm migrate:create` volta a emitir `ALTER TABLE allocation_decision ALTER COLUMN rationale DROP NOT NULL` (diff recorrente, fora do escopo da migration em questão — foi removido manualmente da migration do B156).
- Risco de runtime: uma escrita E14 com motivo omitido envia `null` e o Postgres rejeita (coluna `NOT NULL`) — o fluxo "motivo opcional" do B134 pode falhar em prod.

## Fases verificáveis

1. **Migration própria e idempotente** — `pnpm migrate:create reconcile_allocation_decision_rationale_nullable`; validar que o SQL gerado é apenas o `DROP NOT NULL` (guard: só executar quando `is_nullable = 'NO'`, precedente do consent `varchar → jsonb`); aplicar em dev e test.
2. **Verificação do drift** — rodar `pnpm migrate:create <probe>` e confirmar que não re-emite mais o ALTER (ou conferir `migrate:status` + diff); manter o probe descartado.
3. **Teste** — int spec do caminho E14 com movimento sem motivo (ou unit do hook/action que escreve `rationale` nulo) para provar o write aceito; gates completos (`pnpm gate:fast`, `pnpm push`).

## Já resolvido no simplify/critique (não reabrir)

- N/A — débito novo desta triage.

## Explicitamente fora

- Não alterar o fluxo E14 em si (motivo opcional do wizard/lista) — escopo do #288 (B134), do qual este item é a reconciliação de schema.
- Não tocar `snapshot`/`reversalSignals` (vivem só no JSON do snapshot; sem migration).
