# Escala/DRY pós-S9 — integridade e alinhamento das ações públicas

Status: registrado
Atualizado em: 2026-08-19
Issue: a registrar (depends: #93)
Priority: P2
Model: composer-2.5
Appetite: ~0,5–1 dia eng (3 fases pequenas, lock primeiro)

## Fase 1 — Deletar `Consent` em uso falha com erro cru (expensive_lock)

**Sintoma:** deletar um consentimento referenciado por `subscription` (ou
`signature`/`petition`) estoura `23502` no Postgres: a FK é `ON DELETE SET
NULL` mas a coluna `subscription.consent_id` é `NOT NULL` — o gatilho tenta
setar NULL e viola a constraint; no admin o usuário vê um 500 sem explicação.

**Por que existe:** `required: true` no campo `consent` (migration inicial).
O comportamento "não deletar consentimento em uso" é **protetivo** (texto
legal versionado) — o problema é só a superfície: erro cru, sem orientação.

**Decisão de implementação (com produto/jurídico):** mensagem clara no admin
("Consentimento em uso por N assinaturas/inscrições — não é possível
excluir") vs. semântica de arquivamento. Onde: `beforeDelete` hook do
`Consent` (contar referências; lançar `APIError` amigável) ou validação
explícita no delete operation. Descoberto na sessão S9 (também travou os
lifecycles de teste — as purges de `campanha-novidades` precisam deletar
subscriptions antes).

## Fase 2 — `submitWhatsapp`/`submitPetitionSignature` → `withPayloadTransaction`

As duas actions públicas irmãs usam o hand-roll (begin/try/commit/rollback)
que o `submitCampaignNewsletter` (S9) já substituiu pelo dono do concern
(`src/utilities/payloadTransaction.ts`). O helper entrega rollback também
quando o **commit** falha, `AggregateError` quando rollback+erro falham juntos
e o registro after-commit (`onPayloadTransactionCommit`) — a costura pronta
para S10 disparar `Lead` e para notificações pós-write. Sem mudança de
contrato: mesmos creates, mesmo retorno `{ ok: true }`.

## Fase 3 — Consolidar os schemas de estado/cidade em `contact.ts`

O S9 exportou `optionalContactStateSchema` e `contactCityFieldSchema`, mas as
4 fichas do próprio `contact.ts` (`contactSchema`, `contactCreateSchema`,
`contactFieldUpdateSchema`, `contactFullUpdateSchema`) mantêm cópias inline do
predicate `value in CitiesByState` e da chain de cidade (mesma mensagem,
mesmo comportamento). Trocar as cópias pelos exports únicos — DRY de
conhecimento no próprio dono.

## Já resolvido no simplify/critique (não reabrir)

- e2e do path de recusa (consent ausente) — cortado de propósito: a action
  fail-closed devolve 500 e o `e2eFailureGuard` trata 5xx como falha; o int
  spec cobre com a mensagem exata + nada gravado.
- `contactStateSchema` privado (knip) — o export só teria 1 consumidor.

## Explicitamente fora (defers com gatilho)

- Refatorar o hand-roll das actions irmãs ANTES de S9 existir — já feito na
  action nova; o débito é só das irmãs (Fase 2).
- Gatilho: quando S10 precisar do `onPayloadTransactionCommit` para `Lead`, a
  Fase 2 vira requisito (não só limpeza).
