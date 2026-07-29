# Escala e DRY pós-E12 (camada TI)

Status: entregue (F1, 2026-07-29)
Atualizado em: 2026-07-29
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Fill-ins abertos, **E12+**, fill-in de engenharia)
Impeccable: A — N/A (higiene de loaders/utilities; sem superfície nova)
Appetite: ~0,25–0,5 dia eng; duas fases opcionais, nenhuma com migration
Responsável: —

**Revisão 2026-07-29:** F1 entregue por override explícito de produto (antes do 4º call site): `src/lib/metropolitanoTerritoryPeers.ts` concentra constantes, filtros de sub-linha e `catalogPeersForSlug`; `territoryOverview.ts`, `loadTerritoryOverview.ts` e `territoryIntraCaptureBenchmark.ts` migrados. **F2 out:** `benchmarkBySlug` em `territoryIntraCaptureBenchmark.ts` já memoiza por slug por processo; `loadMunicipalityGoalAccount` chama o benchmark uma vez por request — sem `cache()` adicional.

## Dados → decisão → apresentação

- **Vou apresentar dados?** Não (N/A).

## Contexto

**E12** ([camada-territorios-identidade.md](camada-territorios-identidade.md), entregue 2026-07-26) estendeu E17/B21 com rollups MAUP, colunas Cobertura/Captura/Classe em `/campanha/territorios` e benchmark intra-TI no card Conta da cadeira. O `/simplify` da entrega (duas rodadas, 2026-07-26) aplicou o cleanup barato (`medianOf`, `territorialClassSortWeight` em `lib/`, constantes Metropolitano exportadas de `territoryOverview.ts`) e deixou achados maiores que cleanup, registrados aqui.

**Já resolvido no simplify (não reabrir):** `medianOf` compartilhado (`src/lib/median.ts`) e usado no classificador E10; pesos de sort de classe em `src/lib/territorialClassSortWeight.ts`. **E12+ (2026-07-29):** regras Metropolitano (constantes, sub-linhas, peers por slug) em `src/lib/metropolitanoTerritoryPeers.ts` — substitui as constantes que viviam em `territoryOverview.ts` e a lógica espelhada no benchmark T4.

## Objetivos

- Um módulo client-safe para regras de peers/sub-linhas do Metropolitano (quando valer o custo de extrair).
- Evitar recomputar o mapa de captura por TI no detalhe do município se medição mostrar custo.

## Decisões travadas

- **F1 só extrai quando o 3º consumidor dedicado aparecer ou a regra de peers crescer.** Hoje são três imports de constantes + lógica espelhada em `territoryIntraCaptureBenchmark` — ainda cabe em `territoryOverview.ts`. **Rejeitado:** `lib/metropolitanoTerritoryPeers.ts` prematuro com uma função por arquivo (YAGNI).
- **F2 memo de peer-group só com evidência.** O benchmark T4 roda uma vez por request de detalhe; cache de processo só se profiling mostrar duplicação dentro da mesma árvore RSC.

## Abordagem proposta

- **F1 — `metropolitanoTerritoryPeers` (condicional).** Extrair helpers puros (`isSalvadorSubRow`, `peerSlugsForMunicipality`, labels) quando um quarto call site surgir (ex. mapa TI ou agrupamento na lista de municípios) ou quando testes de peers precisarem de fixture isolada.
- **F2 — memo opcional.** `cache()` ou mapa por request em `territoryIntraCaptureBenchmark` apenas se o loader do detalhe passar a chamar o benchmark mais de uma vez.

## Não escopo

- **Bundle E8 só `central` em `/campanha/territorios`** — adiado até cenário na URL ou perf medido no loader (`loadMunicipalityGoalCoverageBundle` hoje carrega os três cenários).
- **Célula compartilhada de classe territorial** entre lista de municípios e lista de TIs — cosmético (2 surfaces); extrair só com 3º call site.
- **UI de `sanityCheckSuggestedGoalsByTerritory`** — continua fora do E12 v1 (plano-pai).

## Explicitamente fora (triage close-delivery 2026-07-26)

| Achado                         | Destino    | Gatilho / racional                           |
| ------------------------------ | ---------- | -------------------------------------------- |
| Módulo Metropolitano peers     | defer → F1 | 4º call site ou regra de peers mais complexa |
| E8 bundle escopado a `central` | defer      | `?scenario=` na lista de TIs ou perf         |
| Célula classe compartilhada    | descartar  | score 2; 2 surfaces                          |
| Memo peer-group T4             | defer → F2 | profiling no detalhe                         |
