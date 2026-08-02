# Impl: B129 — Remover overview da lista de municípios

Status: aprovado
Atualizado em: 2026-08-02
Issue: #266
Intenção: docs/plans/remover-overview-lista-municipios.md
Appetite restante: remoção cirúrgica (sem redesign)

## Leitura da intenção

- **Outcome:** `/campanha/municipios` mostra filtros → lista, sem strip de métricas agregadas.
- **O que NÃO negociar:** filtros + cenário na barra; overview de apoiadores e dashboard intactos; leader lockdown.
- **O que reavaliar:** manter prefetch `loadStatewideSuggestedGoals` — sim, ainda aquece cache para `loadMunicipalityGoalCoverageBundle` usado nas linhas/colunas.

## Abordagem recomendada

**Opções consideradas:**

- **A — Esconder com CSS/feature flag:** rejeitada — morto no loader e no bundle é mais honesto e barato.
- **B — Remover UI, manter `overview` no bundle:** rejeitada — viola “dead code dies immediately”.
- **C — Remover UI + tipo/campo/computação do loader:** **recomendada**.

**Rejeitadas:** A, B.

### Componentes / mudanças

- **`municipios/page.tsx`:** remover import/render de `MunicipalityListOverview` e `shameHref`.
- **`MunicipalityListOverview.tsx`:** deletar arquivo.
- **`municipalityPageData.ts`:** remover `MunicipalityListOverviewData`, campo `overview` do bundle, rollup/overview-only fields; manter `staffScope` → `pledgeAggregates` + `goalCoverageByMunicipalityID` para sort/células.
- **Tests:** remover asserts de `bundle.overview`; manter asserts de lista/filtros/classe.
- **Migration:** sem migration.
- **Access / Consent:** sem mudança.

## Fases verificáveis

1. **Server** — limpar loader + deletar componente morto.
2. **UI** — página sem overview; comentário em `MunicipalityList.tsx`.
3. **Gates** — `pnpm gate:fast`; push via `pnpm push`.

## Rabbit holes / Não escopo

- Redesenhar `loading.tsx` (fora do aceite).
- Tocar `SupporterListOverview` ou dashboard.
- **Defer:** escopo de `loadMunicipalityGoalCoverageBundle` ao page slice quando `isPagedByPayload` (gatilho: perf review pós-B129); skip `aggregateByScenario` no loader de lista (gatilho: 2º consumidor de rows-only).

## Riscos e mitigação

- **Sort por déficit depende de goal coverage:** mitigado mantendo `loadMunicipalityGoalCoverageBundle` no loader.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto
- [x] Invariantes AGENTS/engineering-standards
- [x] Testes de domínio previstos (int `municipalityPageData`)
