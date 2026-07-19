# Escala e DRY pós-E2 (série TSE 2014/2018 + tendência)

Status: Fase 2 entregue (2026-07-19); Fases 1, 3 e 4 pendentes
Atualizado em: 2026-07-19 (Fase 4 helpers de teste eleitoral registrada via `capture-review-debts` pós-simplify E7 F2)
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha E, item E7)
Responsável: —

## Contexto

O E2 ([mapa-projecao-municipios.md](mapa-projecao-municipios.md)) entrega seed `pnpm db:seed:tse -- --year=2014|2018|2022` (federal T1 BA nos anos históricos), `computeVoteTrend` ±10% (`increase|stable|decline|noBaseline`), série no card `NucleusElectoralBaseline`, alerta em `NucleusInsights` e card "Tendência histórica" no overview B1 — loader unificado `loadNucleusListElectionOverview` (gap + tendência numa query union) em `nucleusElectoralBaseline.ts`. O slice **A5-1 taxa de conversão** ([insight-taxa-conversao.md](insight-taxa-conversao.md), 2026-07-19) estende o mesmo loader com agregado `conversion` (`weightedRate` + `distribution` por faixa) e fetch condicional de `electionTally` — ver Fase 2.

Duas passagens `/simplify` no mesmo branch já limparam o que cabia em cleanup: `HISTORICAL_PRIOR_SERIES_YEARS`, `HISTORICAL_SERIES_YEARS`, `buildUnionGeography`, `aggregateVoteTrend` / `comparableTrendCount`, `formatVoteTrendSeries` / `formatVoteTrendSeriesCompact`, `voteTrendAlertVariant`, merge de labels, `FEDERAL_DEPUTY_OFFICE` no build, remoção de `seriesFromYearTotals` e alias `NucleusListOverviewBaseline2022`.

Os revisores (performance / reuse / quality) marcaram como **importantes e maiores que simplify** os follow-ups abaixo. Débitos que **já têm dono em outro item** ficam fora deste plano (ver Não escopo).

1. **Tendência calculada e exibida duas vezes na aba Visão geral do núcleo.** `NucleusActiveTab.tsx` renderiza `NucleusElectoralBaseline` e `NucleusInsights` em sequência; cada um chama `computeVoteTrend(baseline.series)` e ambos mostram a série 2014→2018→2022 (badge + mensagem no card; alerta + mensagem + série no insights). Duplicação de trabalho no cliente e de informação para o usuário.
2. **Sem testes de integração do loader combinado.** ~~`loadNucleusListElectionOverview` substitui loaders separados de gap e tendência; só há cobertura unitária…~~ **Resolvido na Fase 2 (2026-07-19):** `tests/int/nucleusListElectionOverview.int.spec.ts` + `seedMultiYearFederalCandidateFixture` em `tests/helpers/tseFixtures.ts`.
3. **Tipos de distribuição duplicados.** `NucleusTrendOverviewAggregate` em `nucleusElectoralBaseline.ts` é `Record<VoteTrendStatus, number>` enquanto `electionInsights.ts` já expõe `VoteTrendDistribution` + `emptyVoteTrendDistribution` — mesmo shape, dois nomes.
4. **`VoteTrendResult.ratio` exposto na API pública** mas usado sobretudo em asserts de teste; o produto só consome `status` + `message` na UI.
5. **Helpers de teste eleitoral duplicados e wipe lento.** `deleteAllElectionData` está copiado em três int specs (`electionResultsImport`, `nucleusElectoralBaseline`, `nucleusListElectionOverview`); cada um faz `find` + `delete` por documento nas três collections `election*`. O import de produção já usa delete por escopo via Drizzle (`electionResultsImport.ts`).

**Já resolvido no simplify A5-1 / capture-review-debts (não reabrir):** tallies só quando há núcleos comparáveis; union de tallies restrita a `comparableIndexes`; `sumElectorateForGeography` indexado por `cityZoneKey` (mesmo padrão de `votes2022`); conversão desacoplada do gate `candidateVotes > 0`; gap no overview via `computeGapVs2022`; `isComparableConversionBand` / `formatElectionNumber` DRY no overview.

**Já resolvido no simplify pós-E7 F2 (não reabrir):** `loadOverview` sem `findByID` por teste (`generalUser` em closure); assert único de `conversion.distribution`; `TSE_FIXTURE_ZONE_EXPECTED` com `abstencoes`/`confirmedVoteEstimate`; remoção de `feiraZ10` (zone 10 do CSV ≠ zonas TSE oficiais).

**Explicitamente fora (revisores pediram skip no simplify, capture-review-debts ou já têm item):** ranking federal completo no detalhe e filtro por `cityCode` → **A7**; query duplicada lista+overview e re-resolve de geografia no baseline do overview → **E6**; DRY de `formatElectionNumber` nos cards não-tendência do overview → **E6 F3**; remover a query TSE do overview quando não há estimativas comparáveis (o card de tendência exige distribuição mesmo sem gap — comportamento intencional de produto); chip de faixa no Alert de conversão (produto adia); DRY do stack de 3 `Alert`s em `NucleusInsights` até mais insights A5; **imports sequenciais 2014/2018/2022** em `seedMultiYearFederalCandidateFixture` (fixture pequena; paralelizar só se CI atrasar); **documentação de isolamento** entre suites int que apagam `election*` na mesma DB (mitigado por `teqo_test` por worker).

## Objetivos

- Abrir a aba Visão geral de um núcleo calcula a tendência **uma vez** e não repete a série histórica em dois blocos adjacentes.
- `loadNucleusListElectionOverview` tem pelo menos um teste int com fixture TSE que cobre gap agregado + distribuição de tendência + agregado de conversão (`weightedRate`, `distribution` reduto/consolidado/oportunidade) no mesmo path.
- Tipos de distribuição de tendência têm uma única fonte (`VoteTrendDistribution`); loaders e VMs importam de `electionInsights.ts`.
- Helpers compartilhados para wipe/seed de dados eleitorais nos int tests (sem triplicar `deleteAllElectionData`).
- Guardrails: sem migration, sem Consent (dado público TSE). Access continua `overrideAccess: false`. Identificadores em inglês; strings visíveis em pt-BR.
- **Impeccable:** N/A nas fases 2 e 4 (só testes/helpers); Fase 1 é classe **B** (encaixe em `NucleusActiveTab` / cards existentes).

## Decisões travadas

- **Um item E7, quatro fases ordenadas.** Mesmo racional de A7/C8/E6: um ID no roadmap, PRs por fase. Ordem: UX do detalhe → int do loader → higiene de tipos/API → helpers de teste eleitoral.
- **Dependência dura de E2 mergeado.** Só faz sentido com seed multi-ano, `computeVoteTrend` e `loadNucleusListElectionOverview` já no código.
- **Fase 1 não remove o insight de tendência nem o badge no baseline** — apenas unifica o cálculo e evita repetir a série literal; o alerta pode mostrar só `trend.message` se o card acima já exibir `formatVoteTrendSeriesCompact`.
- **Cortável se poucos núcleos e time de campo não reclamar da duplicação visual** — Fase 2 (int) é a mais valiosa antes de E4 import em massa amplificar o conjunto filtrado.
- **i18n e naming** (AGENTS.md): `VoteTrendDistribution` canônico; `NucleusTrendOverviewAggregate` vira alias deprecado ou some na Fase 3.

## Questões em aberto

- **Fase 1: tendência só no Insights ou só no Baseline?** **Recomendação:** manter badge + série compacta no `NucleusElectoralBaseline` (paridade com design `Baseline-Eleitoral-2022`); `NucleusInsights` recebe `trend: VoteTrendResult` por prop e mostra só o alerta com `trend.message` (sem repetir a série). `computeVoteTrend` roda uma vez em `NucleusActiveTab`.
- **Fase 2: fixture int separada ou estender `tseFixtures.ts`?** **Recomendação:** estender `tests/helpers/tseFixtures.ts` com série 2014/2018/2022 mínima para dois núcleos sobrepostos na geografia union; reutilizar padrão de `electionResultsImport.int.spec.ts`.
- **Fase 3: remover `ratio` de `VoteTrendResult`?** **Recomendação:** sim, se nenhum caller de produção ler — ajustar testes para assertar só `status`/`message` ou testar `ratio` via função interna de par se ainda for útil para regressão.

## Abordagem proposta

```mermaid
flowchart TD
    E2["E2 Série + tendência ✓"] --> F1
    F1["Fase 1 — Trend VM único no detalhe<br/>(NucleusActiveTab → filhos)"]
    F1 --> F2["Fase 2 — Int loadNucleusListElectionOverview ✓"]
    F1 --> F3["Fase 3 — VoteTrendDistribution único + API ratio"]
    F2 --> F4["Fase 4 — Helpers teste eleitoral<br/>(clearElectionFixtureData)"]
    F2 -.confiança antes.-> E4["E4 Import planilha"]
    A7["A7 Loader baseline"] -.mesmo módulo.-> F2
    E6["E6 Lista/overview"] -.geo cache.-> F2
```

### Fase 1 — Tendência única na aba Visão geral

- `src/components/campaign/NucleusActiveTab.tsx`: `const trend = baseline ? computeVoteTrend(baseline.series) : null`; passar `trend` opcional para `NucleusElectoralBaseline` e `NucleusInsights`.
- `NucleusElectoralBaseline`: aceitar `trend?: VoteTrendResult | null` — se presente, não chamar `computeVoteTrend` internamente.
- `NucleusInsights`: aceitar `trend` por prop; remover segunda cópia da série no `AlertDescription` (manter só mensagem classificada).
- Testes: ajustar `nucleusElectoralBaselineUi.unit.spec.ts` se asserts dependerem do texto duplicado da série.

### Fase 2 — Testes int do loader combinado ✓ (2026-07-19)

- `tests/helpers/tseFixtures.ts` — `seedMultiYearFederalCandidateFixture`, `TSE_FIXTURE_ZONE_EXPECTED`.
- `tests/int/nucleusListElectionOverview.int.spec.ts` — gap+trend+conversão, tendência sem estimate, geografia vazia, conversão ponderada e aptos sem votos 2022 do candidato.

### Fase 3 — Tipos e API

- Substituir `NucleusTrendOverviewAggregate` por import de `VoteTrendDistribution` nos VMs (`nucleusListOverviewViewModels.ts`, `nucleusElectoralBaseline.ts` exports).
- Avaliar remoção de `VoteTrendResult.ratio` ou torná-lo `@internal` documentado; atualizar `electionInsights.unit.spec.ts`.

### Fase 4 — Helpers de teste eleitoral

- `tests/helpers/electionTestHelpers.ts` (nome final a confirmar na implementação): `clearElectionFixtureData(payload)` que apaga `electionCandidateVote`, `electionTally` e `electionCandidate` em lote (espelhar `deleteScope` / `drizzleBulk` de [`src/utilities/electionResultsImport.ts`](../../src/utilities/electionResultsImport.ts), não N× `payload.delete`).
- Migrar os três int specs para o helper: [`tests/int/electionResultsImport.int.spec.ts`](../../tests/int/electionResultsImport.int.spec.ts), [`tests/int/nucleusElectoralBaseline.int.spec.ts`](../../tests/int/nucleusElectoralBaseline.int.spec.ts), [`tests/int/nucleusListElectionOverview.int.spec.ts`](../../tests/int/nucleusListElectionOverview.int.spec.ts).
- Manter `seedMultiYearFederalCandidateFixture` em `tseFixtures.ts`; Fase 4 só consome o wipe compartilhado.
- **Verificar:** `pnpm test:int` verde; sem tocar Neon (`teqo_test`).

**Migration:** nenhuma nas quatro fases.

## Dependências

- **Dura:** E2 Série TSE 2014/2018 + tendência — implementado no branch (aguardando merge).
- **Suave:** E4 import planilha — amplifica valor da Fase 2; A7 F1 compartilha `nucleusElectoralBaseline.ts` (não misturar PRs sem necessidade); E6 F2 cache de geografia reduz custo do mesmo path do overview.
- Reusa: `electionInsights.ts`, `nucleusElectoralBaseline.ts`, `nucleusListOverviewPageData.ts`, `tests/helpers/tseFixtures.ts`, `src/utilities/electionResultsImport.ts` (`deleteScope`), `src/utilities/drizzleBulk.ts`, padrão int de `electionResultsImport.int.spec.ts`.

## Não escopo

- Agregar ranking federal no detalhe → [escala-dry-pos-a4.md](escala-dry-pos-a4.md) (A7 F1).
- Filtro geográfico por `cityCode` TSE → A7 F2.
- Query duplicada `/campanha/nucleos` lista + overview → [escala-dry-pos-e1.md](escala-dry-pos-e1.md) (E6 F1).
- Re-resolve de geografia no overview baseline → E6 F2.
- `formatElectionNumber` nos cards de estimativa/cobertura/metas do overview → E6 F3.
- Seed 2014 se formato TSE incompatível (spike já validou 2018; 2014 é risco separado no runbook do seed).
- Persistir tendência no banco (permanece derivada em leitura).

## Referências

- `docs/roadmap.md` (Trilha E, E7; E2 implementado)
- `docs/plans/mapa-projecao-municipios.md` — plano pai E2
- `docs/plans/escala-dry-pos-a4.md` / `escala-dry-pos-e1.md` — débitos adjacentes (A7 / E6)
- `src/components/campaign/NucleusActiveTab.tsx` — render duplo baseline + insights
- `src/components/campaign/NucleusElectoralBaseline.tsx` / `NucleusInsights.tsx`
- `docs/plans/insight-taxa-conversao.md` — slice A5-1 (conversão no loader/overview)
- `src/lib/electionInsights.ts` — `computeVoteTrend`, `computeConversionRate`, `aggregateConversionBand`, `VoteTrendDistribution`, `aggregateVoteTrend`
- `src/utilities/nucleusElectoralBaseline.ts` — `loadNucleusListElectionOverview`, `getNucleusElectoralBaseline`
- `src/utilities/nucleusListOverviewPageData.ts`
- `tests/unit/electionInsights.unit.spec.ts` / `tests/unit/nucleusElectoralBaselineUi.unit.spec.ts`
- `tests/helpers/tseFixtures.ts` / `tests/int/electionResultsImport.int.spec.ts` / `tests/int/nucleusListElectionOverview.int.spec.ts`
- `tests/helpers/electionTestHelpers.ts` — alvo da Fase 4 (a criar)
- AGENTS.md — naming, `overrideAccess: false`, seed guards
