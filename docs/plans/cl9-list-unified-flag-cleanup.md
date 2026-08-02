# CL9 — Limpeza da flag `LIST_UNIFIED`

Status: implementado
Atualizado em: 2026-08-02
Issue: —
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (limpeza)
Appetite: ~0,5 dia eng
Depends: CL8, OH14
Responsável: —

## Decisão

**Remover a flag e manter só `OpsListPage`.** Justificativa: as 8 rotas v1 já migraram (CL3–CL8); dual-path só aumentava complexidade; prod ainda em desenvolvimento (mesmo critério OH14). Sem Issue GitHub — chore directo pós-CL8.

## Entrega

- Apagado `resolveListUnifiedEnabled` / `opsListFlag.ts` / `LIST_UNIFIED` (`next.config`, `.env.example`, Playwright).
- 8 pages de lista sempre renderizam `<OpsListPage …/>` (sem ternário OFF / `CampaignListPendingBoundary` legado na rota).
- Pins unit/e2e sem gate de env; saved filters municípios cobertos pelo suite principal.
- Spec-mãe `lista-unificada-campanha-spec.md` → `Status: implementado`.

## Fases verificáveis

- [x] pages + config + delete flag
- [x] tests + docs + CHANGELOG
- [x] `pnpm gate:fast` + knip + cycles
