# Split de electionInsights.ts (Pass 2 — W4a)

Status: **entregue** (Pass 2, 2026-07-25) — decisão D2 assinada: DELETAR os clusters mortos
Atualizado em: 2026-07-25
Item pai: [IMPROVE-CODE-QUALITY-PLAN.md](../IMPROVE-CODE-QUALITY-PLAN.md) — Pass 2, W4a
Appetite: ~0,5 dia; precisa terminar antes de E10 começar (~16/08)

## Contexto

`src/lib/electionInsights.ts`: 941 linhas, 71 exports, **2 usados em produção** — `formatElectionNumber` (13 importers) e `computeVoteTrend` (+ tipos, 1 importer: `MunicipalityBaselineCard`). O resto é a matemática de insights da era núcleos (A4: gap vs 2022, limiares 35/20/10, rankings por núcleo) cuja UI morreu no remodel de municípios; os testes que restam testam código sem consumidor.

## Decisão (D2, assinada 2026-07-25)

**Deletar** os ~52 exports sem consumidor + seus testes, com ponteiro para E10 no commit e neste plano. Rejeitado: módulo-quarentena (`electionInsightsLegacy.ts`) — manter matemática morta convida reuso acidental da abordagem de limiares absolutos que E10 explicitamente substitui por classificação relativa (quantis/LQ — ver `docs/research/` e [classificacao-territorial-relativa.md](classificacao-territorial-relativa.md)). As fórmulas ficam no git history e nos planos.

## Escopo

1. Extrair `formatElectionNumber` (+ helpers de formatação vivos) para `src/lib/electionFormat.ts`; atualizar os 13 importers.
2. Manter o cluster `computeVoteTrend` (tipos + função) — em `electionFormat.ts` ou módulo próprio pequeno, o que a costura natural pedir.
3. Deletar `electionInsights.ts` restante + specs correspondentes; knip limpo.
4. Marcar em [classificacao-territorial-relativa.md](classificacao-territorial-relativa.md) que a premissa "editar electionInsights in place" foi superada — E10 nasce em módulo novo.

## Impacto no roadmap

- **E10** (classificação relativa): parte de terreno limpo em vez de herdar 900 linhas de abordagem rejeitada. Precisa desta entrega antes de começar (~16/08).
- Derruba o maior ofensor do knip `exports` (25 findings) — pré-requisito prático de W4b (warn→error).
