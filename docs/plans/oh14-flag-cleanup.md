# OH14 — Limpeza da flag `OPS_HYBRID` + documentação final

Status: rascunho
Atualizado em: 2026-08-01
Issue: #175
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (limpeza/docs)
Appetite: ~0,5–1 dia eng
Depends: OH13, OH11
Responsável: —

## Premissas

1. Feature verde em staging (e2e offline + CI) — é hora de ligar por omissão ou decidir manter flag.
2. Prod ainda está em desenvolvimento: a decisão é “remover a flag e ligar sempre” **ou** “manter flag até data X” — registrar explicitamente.

## Objetivos

- Decisão registada e aplicada: remover `OPS_HYBRID` (sync sempre ON para staff) **ou** manter com default documentado.
- Se removida: `resolveOpsHybridEnabled` apagado, código desligado morto removido, knip/cycles limpos.
- Doc final: como o híbrido funciona (sync, mirror, outbox, CAS, OfflineBoundary) numa página de referência para futuras features.

## Dados → decisão → apresentação

Dados: N/A.

## Abordagem proposta

- **Se remover:** deletar `opsHybridFlag.ts`, props `enabled` do provider/boundary, branches OFF mortos; e2e deixa de precisar da env.
- **Se manter:** documentar default e o caminho de remoção futura; NADA muda em código.
- **Doc de referência:** `docs/plans/ops-hibrido-rsc-local-spec.md` actualizada para “Status: implementado” + secção “Como adicionar uma nova write offline” (receita: schema base → action Cas → mutationFn → controle).

## Fases verificáveis

### Fase 1 — Decisão + aplicação

- **Quota:** ~0,6
- **Aceite:**
  - [ ] decisão no corpo do PR com justificativa (staging verde citado)
  - [ ] se removida: `pnpm exec knip` sem novos erros; 0 ciclos; e2e sem env verde
  - [ ] se mantida: doc de default + remoção futura; código intacto
- **Verify:** `pnpm gate:fast` + knip + cycles
- **Files:** flag/provider/boundary (se remoção), docs
- **Tamanho:** M

### Fase 2 — Doc de referência

- **Quota:** ~0,4
- **Aceite:**
  - [ ] plano-mãe em “implementado” + receita de nova write offline
  - [ ] CHANGELOG-AGENTS entrada final
- **Verify:** `pnpm gate:fast`
- **Files:** docs
- **Tamanho:** S

## Dependências

- OH13, OH11 (feature completa e medida em staging).

## Não escopo

- Novas writes (OH13 fechou o lote); delta sync/tombstones; WebSocket.

## Rabbit holes

- **Remover a flag sem staging medido.** Rollback caro. **Mitigação:** dependência dura OH11 + verde em staging citado.
- **Manter flag “para sempre” sem doc.** Dívida silenciosa. **Mitigação:** doc obrigatória em qualquer dos desfechos.

## Referências

- [`src/lib/campaignOps/opsHybridFlag.ts`](src/lib/campaignOps/opsHybridFlag.ts) (se existir na altura)
- [`docs/CHANGELOG-AGENTS.md`](docs/CHANGELOG-AGENTS.md)
- OH1 (spec-mãe)
