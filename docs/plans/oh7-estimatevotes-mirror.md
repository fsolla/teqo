# OH7 — Estimativas ligadas ao mirror completo

Status: rascunho
Atualizado em: 2026-08-01
Issue: #169
Priority: P1
Model: composer-2.5
Impeccable: B — mesma ilha, agora com dados do mirror
Appetite: ~1 dia eng
Depends: OH5, OH6
Responsável: —

## Premissas

1. OH5 já escreve o snapshot no mirror; OH6 já prova outbox+CAS isolado.
2. `votePledgesCollection` no mirror é a fonte de leitura local; o outbox passa a marcar keys para o merge respeitar.

→ Corrija agora ou sigo com estas.

## Objetivos

- Ilha de estimativa lê valores actuais do mirror (quando flag ON) em vez de só props RSC.
- Outbox marca `pending`/`conflict` keys no registry partilhado que `mergeOpsSnapshot` respeita (não esmaga).
- Após write OK, resposta do server actualiza a row local (`estimatedAt` novo).

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

- **`opsEstimateOutbox.ts`** (alterado): integra `votePledgesCollection` (OH5) — optimistic write na collection; keys pending/conflict registadas no `opsSyncMeta` partilhado; `baseEstimatedAt` vem da row local.
- **Merge (OH2) em acção:** sync full durante pending não reverte o valor optimista (pin unit já existente em OH2 — aqui o teste é de integração).
- **Resposta do write:** server devolve a row actualizada; client faz patch na collection (estado `synced`).

## Fases verificáveis

### Fase 1 — Tracer: leitura do mirror + pending respeitado

- **Quota:** 1 do appetite
- **Entrega:** ilha lê do mirror com flag ON; outbox marca keys; sync concorrente não reverte.
- **Aceite:**
  - [ ] valor actual vem de `votePledgesCollection` quando flag ON
  - [ ] sync full com mutação pending na fila → UI continua mostrando o valor optimista + badge
  - [ ] write OK → patch com `estimatedAt` novo → badge synced
  - [ ] flag OFF: caminho props RSC igual a hoje
- **Verify:** `pnpm gate:fast` + spec unit de integração merge/outbox + e2e flaky-network
- **Files:** `opsEstimateOutbox.ts`, ilha, spec
- **Tamanho:** M

## Dependências

- OH5 (collections + merge keys), OH6 (outbox + CAS).

## Não escopo

- Outras writes (OH10/OH13). Views Local além da ilha (OH9/OH12).

## Rabbit holes

- **Patch do mirror com props RSC “para adiantar”.** Drift entre fontes. **Mitigação:** mirror só muda por sync + respostas de write.
- **Ler de duas fontes no flag ON.** Uma fonte por modo (mirror ON, props OFF) — sem blend.

## Referências

- OH5/OH6 (este lote)
- [`src/components/campaign/votePledge/PledgeEstimateForm.tsx`](src/components/campaign/votePledge/PledgeEstimateForm.tsx)
