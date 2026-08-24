# Impl: Reconciliar drift — `allocation_decision.rationale` NOT NULL vs config

Status: rascunho
Atualizado em: 2026-08-24
Issue: #371
Intenção: docs/plans/reconciliar-rationale-alocacao.md
Appetite restante: ~0,25 dia eng

## Leitura da intenção

- **Outcome:** O campo `rationale` na collection `allocationDecision` deve ser nullable no banco de dados, alinhando o schema real com a config (`required: false`). O drift que faz `pnpm migrate:create` re-emitir `ALTER TABLE allocation_decision ALTER COLUMN rationale DROP NOT NULL` deve desaparecer.
- **O que NÃO negociar:** A config `required: false` já está correta (B134). O hook `validateAllocationDecision` já permite `rationale` vazio/null para `outcome: 'movimento'`. A mudança é apenas de schema.
- **O que reavaliar:** Nenhuma hipótese incerta — o problema é um drift factual documentado.

## Abordagem recomendada

```mermaid
flowchart LR
  A[Migration idempotente] --> B[Test idempotência]
  B --> C[Verificar drift zero]
```

**Opções consideradas:**

- **A: Migration hand-written idempotente** — seguir o padrão `consent_text_to_jsonb.ts`: check `information_schema.columns` antes de alterar. Seguro, idempotente, testado.
- **B: `pnpm migrate:create` gerado** — deixar o Payload gerar a migration. **Rejeitado:** o Payload pode gerar um diff mais amplo (drop/recreate de colunas relacionadas) e não garante idempotência.
- **C: Editar a migration inicial** — **Rejeitado:** viola o contrato de que migrations são história congelada.

**Recomendação:** Opção A — porque é o padrão estabelecido no repo, idempotente, e mínima.

### Componentes / mudanças

- **Migration:** `src/migrations/<timestamp>_reconcile_allocation_decision_rationale_nullable.ts` — hand-written, idempotent, segue padrão `consent_text_to_jsonb.ts`
- **Registro:** `src/migrations/index.ts` — adicionar entrada após a última migration existente
- **Teste:** `tests/int/campaignMigrationReconciliation.int.spec.ts` — adicionar caso que verifica idempotência (executar duas vezes, segunda é no-op)
- **Access / Consent:** Nenhuma mudança — o hook `validateAllocationDecision` já valida corretamente
- **UI:** Nenhuma mudança

### Dados → forma

N/A — mudança de schema apenas.

## Fases verificáveis

1. **Migration** — criar arquivo hand-written com guard `is_nullable = 'NO'` + `DROP NOT NULL`; registrar em `index.ts`; aplicar em dev e test
2. **Teste** — adicionar caso em `campaignMigrationReconciliation.int.spec.ts` que:
   - Executa a migration duas vezes
   - Verifica que a segunda execução é no-op (schema inalterado)
   - Verifica que `rationale` é nullable após a migration
3. **Verificação de drift** — rodar `pnpm migrate:create <probe>` e confirmar que não re-emite mais o ALTER; deletar o probe
4. **Gates** — `pnpm gate:fast`; push via `pnpm push`

## Rabbit holes / Não escopo (engenharia)

- Não alterar o fluxo E14 (motivo opcional do wizard/lista) — escopo do #288
- Não tocar `snapshot`/`reversalSignals` (vivem só no JSON do snapshot; sem migration)
- Não alterar o hook `validateAllocationDecision` — já está correto
- Não criar migration gerada pelo Payload — hand-written é mais seguro para drift reconciliation

## Riscos e mitigação

- **Risco:** Migration falha em DB onde `rationale` já é nullable (fresh local DB). **Mitigação:** guard idempotente verifica `is_nullable` antes de alterar.
- **Risco:** Prod tem `NOT NULL` com dados existentes. **Mitigação:** `DROP NOT NULL` é seguro — não altera dados, apenas relaxa a restrição.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (rationale nullable, drift zero)
- [ ] Invariantes AGENTS/engineering-standards (migration idempotente, padrão estabelecido)
- [ ] Testes de domínio previstos (int spec de idempotência da migration)
