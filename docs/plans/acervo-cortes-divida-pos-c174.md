# Acervo cortes — dívida pós-C174: select enxuto dos loaders, teto do `id in` da origem e paridade busca↔VM

Status: rascunho
Atualizado em: 2026-09-16
Issue: (C180 — registrada por `agent:register`)
Priority: P3
Impeccable: A (só backend/utilities; nenhuma superfície visual nova)
Appetite: ~0,5–1 dia eng fill-in
Depends: #1084 (C174 — destrava no flip `done` do pai)

## Contexto

O `/simplify` do C174 (Issue #1084) deixou três achados de performance/paridade que **não** foram absorvidos no cleanup da sessão. Nenhum bloqueia a entrega: são custo de query e risco de drift silencioso, todos em `src/utilities/speech/`.

## Fases

1. **F1 — `select` enxuto nos loaders de corte e DTO estreito.** `loadSpeechCutsForSpeech`, `loadSpeechCutsForSpeeches` e `loadSpeechCutOriginSpeechIds` (`src/utilities/speech/speechCutPageData.ts`) hoje trazem a linha inteira (`limit: 0`, sem `select`) e o VM entrega `SpeechCutViewModel` completo (`description`/`mediaUrl`/`failureMessage`/`youtubeVideoId`) para superfícies que só renderizam `id`/`title`/`status`/`durationLabel`. Adicionar `select` aos três e um `SpeechCutSummaryViewModel` (ou um `toSpeechCutSummaryViewModel`) consumido pela seção "Cortes desta fala" e pelo aninhamento da busca. Prova: int existente de `speechCut`/`speechAcervo` verde + um caso de loader que confirme a ausência dos campos não usados.
2. **F2 — predicado único busca↔VM.** `speechMatchesText` (`src/utilities/speech/speechViewModels.ts`) espelha por comentário o ramo textual do `where` (`buildSpeechTextBranches`, `src/utilities/speech/speechListFilters.ts`). Se os dois divergirem, a fala aparece sem o aviso "Fala de origem" (ou com ele indevido). Extrair um predicado puro compartilhado (ou manter o `where` como única fonte e comparar por id já resolvido) e cobrir com unit o par `searchText`/`keywords`.
3. **F3 — teto/estratégia do `id in` da origem.** `loadSpeechCutOriginSpeechIds` devolve todos os ids de fala de origem; com termo comum o `id: { in: [...] }` do acervo cresce sem limite. Definir estratégia (cap + degradação honesta, ou subquery) e uma constante com gatilho de volume, como o precedente do `searchText` do C168 (~5–10 mil cortes).

## Explicitamente fora (skips do simplify + descartes deste triage)

- **Sub-lista de subitens duplicada** (`CampaignSidebar` × `CampaignBottomNav`) — defer; gatilho: um 3º consumidor real de `subItems` (hoje os dois consomem primitivos distintos: `SidebarMenuSub*` × `div`/`Link`).
- **`[data-slot="speech-player"]` literal no CTA** — defer; gatilho: um 2º scroller externo do player ou rename do slot (a falha só degrada o scroll, não quebra).
- **Rename `matchedTextSearch`** — descartado (pureza de nome, score 1).
- **`OpenCutButton` / `countLabel` / `campaignSpeechCutDetailHref` com <3 call sites** — descartados; `campaignSpeechCutDetailHref` é decisão explícita do plano do C174 (D1) para 2 call sites.
- **Seletor `button[data-start-seconds="43"]`** — descartado; é do player (C166/C167), fora do escopo do C174.

## Riscos

- **`select` enxuto quebrar o VM**: o `toSpeechCutViewModel` lê `error`/`step` para o `failureMessage`; o `select` da summary precisa manter o que a superfície renderiza e nada além. Coberto pelos int do C174.
- **Predicado único divergir do SQL**: o `where` usa operadores do Payload (`like`/`contains`) que o JS não replica 1:1; a fase deve documentar a semântica assumida (texto normalizado e keyword crua) e testar o par.

## Self-score (decision-quality ≥4)

1. **Decisões caras com rejeitadas — 4/5:** F1/F3 mexem em shape de DTO e em limites de query do acervo (barato de reverter, mas com custo de coordenação); F2 tem opções (predicado compartilhado vs comparar por id) explicitadas.
2. **Cabe no appetite — 5/5:** 0,5–1 dia; reusa os int/unit existentes.
3. **Rabbit holes nomeados — 5/5:** a lista de "Explicitamente fora" fecha o escopo.
4. **Depth check — 4/5:** mantém `utilities/speech/` como dono único; nenhum módulo gêmeo.
5. **Intenção de produto — 5/5:** nenhuma mudança de comportamento visível; é custo de query e robustez.
