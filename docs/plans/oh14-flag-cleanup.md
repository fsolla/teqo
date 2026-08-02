# OH14 — Limpeza da flag `OPS_HYBRID` + documentação final

Status: implementado
Atualizado em: 2026-08-02
Issue: #175
Priority: P1
Model: composer-2.5
Impeccable: A — N/A (limpeza/docs)
Appetite: ~0,5–1 dia eng
Depends: OH13, OH11
Responsável: —

## Decisão (OH14)

**Opção A — remover a flag e ligar sempre para staff.** Justificativa: OH11 (e2e offline + SW) e OH13 (writes CAS por domínio) verdes em staging/CI; prod ainda em desenvolvimento; a flag compile-time só servia rollout seguro durante OH2–OH13.

## Entrega

- Apagado `resolveOpsHybridEnabled` / `OPS_HYBRID` (`next.config`, `.env.example`, Playwright).
- `CampaignOpsSyncProvider` liga por `isStaffCampaignRole` no layout; `OfflineBoundary` só verifica offline do browser.
- Ramificações legacy OFF removidas dos forms/controles staff; e2e offline corre em CI sem env.
- Spec-mãe `ops-hibrido-rsc-local-spec.md` → `Status: implementado` + receita “nova write offline”.

## Fases verificáveis

### Fase 1 — Decisão + aplicação

- [x] decisão no PR (staging verde OH11/OH13)
- [x] `knip` / cycles limpos; e2e sem `OPS_HYBRID`

### Fase 2 — Doc de referência

- [x] plano-mãe em “implementado” + receita de nova write offline
- [x] CHANGELOG-AGENTS entrada final
