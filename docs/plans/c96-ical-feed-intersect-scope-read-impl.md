# Impl: C96 — Feed iCal: interseptar escopo do criador no read (defesa em profundidade)

Status: aprovado
Atualizado em: 2026-08-09
Issue: #455
Intenção: docs/plans/c96-ical-feed-intersect-scope-read.md
Appetite restante: ~0,25–0,5 dia eng (herdado)

## Leitura da intenção

- **Outcome:** no GET `/campanha/agenda/ical/[secret]`, um feed de assessor cujo `filterMunicipality` caiu fora dos municípios atualmente administrados pelo criador para de servir atividades dele — fail-closed (feed vazio, alinhado ao C16). Sem mudança para coordinator/candidate/admin. Sem mudança no write, sem migration.
- **O que NÃO negociar:** leader lockdown; cancelado fica fora; o segredo não vaza; coordinator/candidate/admin inalterados.
- **O que reavaliar:** hipótese da intenção ("validar antes e 404" vs "interseptar na where") — ver decisão abaixo. Resolvido a favor da **interseção na `where`** porque é o único lugar que o módulo de acesso do feed já orquestra o escopo no read e já tem o fragmento canônico `advisorMunicipalityScopeWhere`; 404 é aceitável mas a interseção na query serve o mesmo outcome sem nova ramificação no route.

## Abordagem recomendada

```mermaid
flowchart LR
  GET[route.ts] --> resolve[resolveFeedCreatorAccess]
  resolve --> load[loadFeedActivities]
  load --> where[buildFeedWhere]
  where --> f1[range/status/deputy/tag]
  where --> f2[filterMunicipality equals]
  where --> f3[advisor scope in ids]
  f2 & f3 --> and[and: {...}]
```

**Opções consideradas:** A | B
**Recomendação:** A — porque o escopo do assessor já é resolvido no read (`resolveFeedCreatorAccess` → `accessibleMunicipalityIds`); interseptá-lo na `where` muda o mínimo, reusa o fragmento canônico `advisorMunicipalityScopeWhere` (obrigatório pela convention guard), e produz feed vazio (aceitável no aceite) sem tocar o route.
**Rejeitadas:** B (validar antes e 404) porque duplica a decisão de acesso no route (nova ramificação + novo helper de resolução do id do filtro), quando a query já é o ponto único de orquestração.

### Componentes / mudanças

- **`buildFeedWhere`** (`src/utilities/calendarFeed.ts:104-112`): quando `feed.filterMunicipality` estiver setado **e** `accessibleMunicipalityIds` não-nulo, adicionar **também** o fragmento `advisorMunicipalityScopeWhere('municipality', accessibleMunicipalityIds)` ao array de filtros (hoje o `else if` o ignora quando há filtro). `accessibleMunicipalityIds === null` (coordinator/candidate/admin) → comportamento inalterado. `[]` → `in: []` não casa nada → feed vazio.
- **Migration:** sem migration (config/consulta only).
- **Access / Consent:** sem `Consent` novo; mesmos `overrideAccess: true` já documentados no read (feed unauthenticated por secret; escopo re-derivado do autor). Invariante de `overrideAccess:false` com `user` intocado (não há `user` neste read).
- **UI:** Impeccable A — N/A sem UI.

## Fases verificáveis

1. **Schema/server** — `buildFeedWhere` (intersecção condicional) em `src/utilities/calendarFeed.ts`.
2. **Testes int** — extensão de `tests/int/calendarFeed.int.spec.ts`:
   - assessor cria feed pinado a X (`filterMunicipality`) com atividade em X → `resolveFeedCreatorAccess` devolve `[X]` → `loadFeedActivities` lista a atividade (regressão positiva);
   - assessor removido de X (`assignMunicipalityAdvisors(X, [])`) → `resolveFeedCreatorAccess` devolve `[]` → `loadFeedActivities` **não** lista a atividade (aceite C96);
   - coordinator/candidate pinados a X inalterados: `accessibleMunicipalityIds === null` → atividade de X continua listada.
   - fixtures: reusar `createActivityRecord` (coordinator), `assignMunicipalityAdvisors`, `getMunicipality`, `own`.
3. **Gates** — `pnpm gate:fast` na iteração; `pnpm test` (int afetado); `pnpm build` local.

## Rabbit holes / Não escopo (engenharia)

- **Refactor do modelo de acesso do feed** (maior pool de escopo para além da where) — a intenção declara fora de escopo.
- **404 vs feed vazio** — decisão de UX documentada (C16 aceita ambos); implementado feed vazio; sem nova ramificação no route.
- **UI do feed / sem-filtros (C94/C93)** — Issues separadas.

## Riscos e mitigação

- **Regressão em coordinator/candidate:** interseção só ativa quando `accessibleMunicipalityIds` não-nulo (somente advisor); teste int cobre o caminho null.
- **`in: []` não casando nada:** comportamento já estabelecido do fragmento canônico usado em todo o repo (fail-closed); teste int cobre o advisor removido.
- **Dupla cláusula `municipality` (`equals` + `in`) no msm `and`:** Payload combina cláusulas sob a mesma chave via `and`; idempotente para X ∈ escopo (equals domina), vazio para X ∉ escopo.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (advisor fora do escopo → feed não inclui; unrestricted/admin inalterados; sem write; sem migration)
- [ ] Invariantes AGENTS/engineering-standards (fragmento canônico de escopo; copy pt-BR; identificadores EN; sem `overrideAccess:false` invertido)
- [ ] Testes int de domínio (advisor no escopo lista; advisor removido não lista; coordinator inalterado)
- [ ] `pnpm gate:fast` + `pnpm test` + `pnpm build` verdes
