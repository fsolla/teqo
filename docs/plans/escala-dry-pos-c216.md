# Escala/DRY pós-C216 — débitos do simplify da terceira fonte do acervo

Status: rascunho
Atualizado em: 2026-09-24
Issue: (a registrar — `depends: [1292]`)
Priority: P3
Impeccable: A — só backend/shell (sem superfície visual nova)
Appetite: ~1 dia eng fill-in
Responsável: —
Depende de: #1292 (C216)

## Contexto

O `/simplify` do C216 (terceira fonte "Falas na internet") aplicou os cleanup da
sessão (extração de `withSeekQuery`, inline do gate de sort, remoção de exports
sem consumidor, `loadWebSpeechMediaForActor` nas duas rotas novas, extração do
ramo Câmara em `CamaraSource`) e deixou três débitos maiores que o cleanup, mais
os defer+gatilho registrados no `acervo-fonte-falas-web-impl.md` (§Simplify —
triage). Este lote consolida os três numa trilha ordenada (lock primeiro).

## Fases

1. **F1 — Gate fail-closed das rotas de mídia privada (expensive_lock).**
   O gate `getCampaignUser` + predicado do catálogo + validação de id +
   `findByID(...).catch(() => null)` + 404 silencioso está replicado nas rotas
   `acervo/gravacoes/[id]/arquivo`, `reels/*`, `conteudos/*` e agora
   `acervo/internet/[id]/arquivo|capa` (as duas novas já compartilham o loader
   `loadWebSpeechMediaForActor`). Extrair um helper de rota no dono
   `utilities/privateMedia/` (ex.: `loadPrivateMediaForActors`) que recebe a
   collection, o predicado e o mapa de campos, devolvendo `null` para toda
   negação — as rotas ficam com o HTTP (range/disposition/404) e o helper com o
   gate. Int/e2e existentes (`campaignSpeechAcervo`, `campaignReel`, Central de
   Conteúdos) são o pino; não mudar nenhuma resposta HTTP.
2. **F2 — Scaffold de resultados dos três ramos da página do acervo.**
   `CamaraSource`/`RecordingsSource`/`WebSpeechesSource` repetem o heading do
   modo tema, o `CampaignListEmptyState` com ternários e o `CampaignListFooter`.
   Extrair um shell local (ou `shared/`) parametrizado por copy/links — sem
   mudar bytes de nenhum dos ramos (o pin é o e2e `campaignSpeechAcervo`).
3. **F3 — Excerpt e chips dos cards de fala (cheap_polish).**
   `SpeechResultCard` e `WebSpeechResultCard` duplicam o excerpt truncado
   (`… <mark> …`) e o render de chips com caps 3/2 + `+N`. Extrair o excerpt
   para o dono do highlight (`SpeechHighlightParts`) ou um componente irmão;
   chips param por lista de grupos (a Câmara tem keywords, a web não). Gatilho
   antecipado: um terceiro card de fala.

## Rabbit holes / Não escopo

- Não unificar `speechHasActiveFilters` × `recordingHasActiveFilters` (shapes
  divergentes: `phases` × `people`; DRY <3) — defer com gatilho no impl do C216.
- Não centralizar os bytes de fixture MP4/MP3 dos int specs (2 sites) — defer.
- Não mexer em `speechCoverage`/Sollinha/C217.

## Riscos

- F1 toca access fail-closed: o helper precisa manter o 404 silencioso e o
  `overrideAccess: false`; qualquer resposta diferente é regressão pinada por
  int/e2e.
- F2/F3 são cosméticos de shell; o risco é bytes de copy — os specs da vertical
  (C154/C199/C211/C216) são o pino.
