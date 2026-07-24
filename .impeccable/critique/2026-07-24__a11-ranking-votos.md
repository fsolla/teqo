# Critique — A11 posição em votos

⚠️ DEGRADED: Assessment A via design subagent; Assessment B (browser/detector) skipped — no logged-in `/campanha` session in this delivery.

**Alvos:** `MunicipalityBaselineCard`, `MunicipalityList`, `MunicipalitySortableHead`, `MunicipalityFilters`
**Data:** 2026-07-24

## Findings (pós-polish 2026-07-24)

- **P0:** nenhum
- **P1 fechados nesta sessão:** dual % separado (dominância local demoted); rank no mobile; default lista = votos desc; célula lidera com % da votação; select mobile com dir; chevron só quando ativo; aria-label descreve próximo clique
- **P2 restante:** B15 amplia headers das demais colunas; copy Praça→Município em R6

## Polish applied in-session

- Align prop explícito no header `votos` (direita)
- Célula: share primário + votos/rank secundários
- 2022 no baseline com ring sutil (não heat map)
- Dominância local em linha própria, explicitamente distinta

## Verificação

- Unit: municipalityVoteRank, municipalityUi sort params, campaignComponents
- Int: municipalityPageData (incl. `sort=votos`) via `TEQO_TEST_DATABASE_URL` :55432 (porta 5432 ocupada por outro compose neste host)
- `tsc --noEmit`, `pnpm lint --max-warnings=0`
