# C96 — Feed iCal: interseptar escopo do criador no read (defesa em profundidade)

Status: rascunho
Atualizado em: 2026-08-08
Issue: #455
Priority: P3
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A sem UI
Appetite: ~0,25–0,5 dia eng
Responsável: —

## Intenção

Débito do `/simplify` do C92 (#436), aprovado no gate humano. O write-side do feed (`canCreateCalendarFeed` + `assertFilterMunicipalityInScope`) já impede um assessor de criar feed pinado a município fora do escopo. Mas o read-side (`buildFeedWhere`, `src/utilities/calendarFeed.ts:104-112`) **confia no `feed.filterMunicipality` sem interseptar os ids acessíveis do criador** quando `accessibleMunicipalityIds` é não-nulo. Consequência: se um assessor é **removido** de um município depois de criar o feed, o feed continua servindo atividades daquele município até o feed ser revogado.

## Aceite

- No GET `/campanha/agenda/ical/[secret]`, quando o criador do feed é advisor e `feed.filterMunicipality` está setado, a consulta intersepta o município do filtro com os municípios atualmente administrados pelo criador — município fora do escopo atual → feed não inclui (404/feed vazio, alinhado ao fail-closed do C16).
- Coordinator/candidate (unrestricted) e admin: comportamento inalterado.
- Sem mudança no write; sem migration (config/consulta only).

## Direção no codebase

- `src/utilities/calendarFeed.ts` → `buildFeedWhere`: quando `feed.filterMunicipality` setado E `accessibleMunicipalityIds` não-nulo (advisor), exigir `{ id: { equals: filterMunicipality } } AND { id: { in: accessible } }` (ou validar antes e 404). `resolveFeedCreatorAccess` já calcula `accessibleMunicipalityIds` no read.
- Precedente: `advisorMunicipalityScopeWhere` (`src/utilities/access/shared.ts`).
- Teste int: `tests/int/calendarFeed.int.spec.ts` — feed criado por advisor em município X, depois advisor removido de X (`assignMunicipalityAdvisors(mun, [])`), GET do feed não lista atividades de X.

## Fora de escopo

- Remodelar o modelo de acesso do feed (maior refactor).
- UI (C94) / sem-filtros (C93), que já são Issues separadas.

## Questões em aberto

- Nenhuma — fail-closed orientado pelo C16 e pelo C92.
