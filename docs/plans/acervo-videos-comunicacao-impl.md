# Impl: Vertical Comunicação: papel communicator + Acervo pesquisável

Status: executado
Atualizado em: 2026-09-13
Issue: #956
Intenção: docs/plans/acervo-videos-comunicacao.md
Appetite restante: herdado (~2–3 dias; 1 outcome verificável — o assessor entra com acesso próprio, busca uma fala por tema/município/termo e assiste/baixa o trecho)

## Leitura da intenção

- **Outcome:** o assessor de comunicação (`communicator`) entra, vê **só** a vertical `/campanha/comunicacao`, busca falas por termo (com e sem acento), tema, alcance, ano, fase, município citado e duração; vê o trecho destacado; abre o detalhe com o player já no ponto do trecho, transcrição clicável, sumário/contexto e ações de baixar/abrir fonte. `coordinator`/`candidate` também veem; `advisor`/`leader` não. Mobile utilizável; estados vazio, carregando e sem permissão.
- **O que NÃO negociar:**
  - O `communicator` **não herda staff** (`isStaffCampaignRole` intocado); `leader` continua em lockdown; nada de permissão por município (comunicação é global).
  - URLs da intenção: home `/campanha/comunicacao`; acervo `/campanha/comunicacao/acervo`; detalhe `/campanha/comunicacao/acervo/[id]`.
  - VOD da Câmara nesta fase (sem espelho/S3), crédito CC BY 4.0 visível; sem editor de corte, sem busca semântica, sem exposição pública, sem segundo cadastro de pessoas.
  - Sem dashboard de vaidade nem % estadual absoluto; nenhuma PII de cidadão (dado parlamentar público — o guardrail é access, não Consent novo).
- **O que reavaliar (hipóteses da intenção):**
  - "Busca em endpoint `POST` no wrapper `campaignJsonMutationRoute`": a lista é leitura paginada server-rendered — o padrão do repo (apoiadores/pessoas/municípios) é URL state + RSC; reavaliado em D4.
  - "Módulo de access reexportado por `campaignAccess.ts`": o C153 já entregou `canReadSpeech`/`canUpdateSpeech`; o C154 **consome** e não mexe em `src/utilities/access` (evita acordar os e2e curados de RBAC e o fail-closed de risco à toa). O gate de página usa o predicado client-safe `canReadSpeechCatalog`.
  - "Precedente `home-search` (busca com `contains`)": o precedente certo de lista é `src/utilities/supporter/` + `CampaignListOmnibox`; `home-search` é uma busca de cliente, outra superfície.
  - "Sem player no repo" (verificado): não existe player; o único vídeo é um iframe YouTube. O C154 usa `<video>` nativo (D6) — sem dependência nova.
  - "0 discursos no `teqo_wt154`" (verificado): e2e/int criam os próprios fixtures (ownership estendido); a prova viva com conteúdo real exige `pnpm camara:import --limit` no worktree.
  - `excerptTMs` é o offset em **ms na sessão**; `segment.startSeconds` é relativo ao **MP4 do trecho** — nunca misturar (seek = `startSeconds`).

## Abordagem recomendada

```mermaid
flowchart LR
  A[login] --> B{/campanha}
  B -- communicator --> C[/campanha/comunicacao]
  C --> D[/campanha/comunicacao/acervo]
  D --> E[speechListUrl<br/>parse/canonicaliza]
  E --> F[buildSpeechListWhere]
  F --> G[(speech.find<br/>facetas + searchText like<br/>ou keywords contains)]
  G --> H[(speechSegment.find<br/>speech in pageIds)]
  H --> I[speechHighlight<br/>offsets normalizado para original]
  I --> J[cards com trecho destacado]
  J --> K[/campanha/comunicacao/acervo/:id]
  K --> L[(loadSpeechDetailPageData<br/>speech + segmentos)]
  L --> M[video nativo<br/>seek no startSeconds]
  M --> N[transcricao clicavel<br/>baixar / abrir fonte]
```

**Opções consideradas:** A | B | C por decisão (D1–D6 abaixo).
**Recomendação:** D1–D6 na ordem em que travam as demais — D1/D2 travam o schema e a query, D3/D5 travam o acesso e as rotas, D4 trava o contrato de URL, D6 trava o detalhe.
**Rejeitadas:** registradas dentro de cada decisão (formato obrigatório da decision-quality).

### Decisões de engenharia

#### D1 — Busca e paginação por discurso: denormalizar `speech.searchText` (C)

- **Opções:** A) scan paginado de `speechSegment` por `searchText contains` + dedupe de discurso em memória + `find` de `speech` por IDs com facetas + segunda query de segmentos da página | B) SQL cru drizzle com `DISTINCT ON (speech_id)` + join das tabelas de faceta | C) coluna `searchText` no `speech` (concatenação normalizada dos segmentos, GIN trgm) e **uma** query de `speech` com busca + facetas, paginando por discurso; segunda query só para os segmentos da página.
- **Recomendação:** C — a contagem e a paginação passam a ser do **discurso** (é o que a UI mostra: "N falas encontradas"), sem dedupe entre páginas e sem perder resultado; busca e facetas caem na mesma `where` do Payload, com `overrideAccess: false` e o access do C153 aplicado de verdade. O custo é uma migration mecânica (coluna + GIN + backfill) e uma linha a mais no `upsertSpeechBundle`, que já é o dono dos segmentos. O `Where` é montado assim (explícito, em `speechListFilters.ts`):
  ```ts
  where = {
    and: [
      ...facetFilters, // year in, topics in, scopes in, phase in, mentionedMunicipalities in, OR dos buckets de duração
      ...(q
        ? [
            {
              or: [
                { searchText: { like: normalizeForSearch(q) } }, // segmentos concatenados, palavras em qualquer ordem, sem acento
                { keywords: { contains: q } }, // keyword oficial, termo exato (ILIKE)
              ],
            },
          ]
        : []),
    ],
  }
  ```
  A paginação é feita **por discurso** com `payload.find({ collection: 'speech', where, sort: '-speechAt', page, limit: 25, user, overrideAccess: false })` — o `totalDocs` já é o número de falas, e nenhum segmento extra pode "vazar" para a página 2. Os trechos vêm de uma segunda query enxuta: `payload.find({ collection: 'speechSegment', where: { speech: { in: pageIds } }, sort: 'order', pagination: false, select: { speech, order, startSeconds, endSeconds, text, searchText }, user, overrideAccess: false })`, escolhendo em memória o primeiro segmento cujo `searchText` casa TODOS os termos normalizados (senão o primeiro segmento; senão o `summary`).
- **Limite de escala:** a coluna concatena ~10–50 KB por discurso; a 4 mil discursos (backfill C155) o GIN trgm fica na casa das centenas de MB e `%term%` de 2 chars vira seq scan (trigram exige ≥3). **Gatilho de revisitação:** catálogo > ~5.000 discursos, p95 da busca > 300ms, índice > ~1 GB, ou `q` de 1–2 chars virar caso de uso real — aí B (drizzle `DISTINCT ON`) ou `tsvector` passam a valer.
- **Rejeitadas:**
  - A porque o count/paginação por discurso exigiria varrer **todos** os segmentos que casam a cada página (um termo curto casa o catálogo inteiro), o dedupe entre lotes reintroduz o bug clássico de resultado que some na página 2, e ainda obrigaria um `speech in [até 4.000 ids]` em toda query.
  - B porque bypassa o access do Payload (a camada fail-closed), duplica a montagem de joins (`speech_topics`, `speech_scopes`, `speech_rels`) e vira um twin do query layer para um ganho que C já entrega no tamanho atual.
  - A variante "buscar também no `officialTranscript`" fica fora por ora: a intenção fixa busca nos segmentos, e o transcript oficial não tem offset para posicionar o player. Revisitar se a taxa de discurso sem segmentos do C155 justificar.

#### D2 — Ciclo de vida do `speech.searchText` (quem mantém)

- **Opções:** A) `upsertSpeechBundle` (C153) calcula e grava no mesmo write quando `segments !== undefined`; migration faz o backfill | B) hook `afterChange`/`afterDelete` em `speechSegment` recomputa o pai | C) trigger de banco.
- **Recomendação:** A — o bundle é o único escritor de segmentos em produção (o segmento é `admin.hidden`), roda em transação e já normaliza cada segmento; `searchText` do discurso = `normalizeForSearch(segments.map(text).join(' '))`, gravado no mesmo `create`/`update`. `segments: undefined` **preserva** o valor armazenado (mesma semântica dos segmentos no C153). A migration backfill usa `string_agg(search_text, ' ' ORDER BY "order")` sobre `speech_segment`.
- **Rejeitadas:** B porque cada insert de segmento dispararia um update do pai — O(n²) no import (7.590 segmentos na prova C153) — e escreveria dentro de hook com access; C porque esconde a regra fora do fluxo de migrations e dificulta o teste local.
- **Drift conhecido:** escrita de segmento fora do bundle (teste, script futuro) não atualiza o pai; o contrato é "o import é o dono" e um int test pina o bundle. Gatilho: segundo escritor de segmentos em produção.

#### D3 — Gate do papel: novo valor `'speechCatalog'` no `requireCampaignPageActor`

- **Opções:** A) novo gate `'speechCatalog'` no `CampaignPageGate`, usando `canReadSpeechCatalog` (já existe, client-safe) | B) reusar `gate: 'staff'` e promover o communicator a staff | C) sem gate de página, só o access da collection.
- **Recomendação:** A — a página redireciona cedo (leader → `/campanha/meus-contatos`; advisor/outros → `/campanha`), e o `denyRedirect` ganha o atalho `communicator → /campanha/comunicacao` para o login não fazer o communicator escalar pelo home de staff. O predicado é o **mesmo** do access (`canReadSpeechCatalog`), então página e collection não divergem; `isStaffCampaignRole` fica intocado (lockdown C153).
- **Rejeitadas:** B porque abriria todas as áreas de staff ao communicator (viola "vê só a vertical"); C porque a página renderizaria erro/vazio silencioso em vez do redirect canônico, e o `codebaseConventions.unit.spec.ts` já pina que o prologue de página vem do `requireCampaignPageActor`.

#### D4 — Contrato de filtros: params canônicos na URL (A)

- **Opções:** A) params multi-select canônicos `q · year · topic · scope · phase · municipality · duration · page`, sobre `resolveListUrl`/`buildListHref` | B) POST em `campaignJsonMutationRoute` (hipótese da intenção) | C) estado só de cliente.
- **Recomendação:** A — é o contrato B18/B127 já usado por apoiadores/pessoas/municípios: URL compartilhável/bookmarkável, redirect de params desconhecidos e clamp de página grátis (`resolveListUrl`), pending/loading e omnibox existentes. Enums exaustivos (`topic` 18, `scope` 3, `duration` 4) passam por `parseExhaustiveEnumParam` (selecionar todos = sem filtro); `year` (4 dígitos), `phase` (texto ≤80) e `municipality` (id > 0) são data-driven e validados estruturalmente. Buckets de duração: `curta` < 120s · `media` 120–300s · `longa` > 300s · `sem_duracao` (nulo) — registrado. Sem param de sort neste item: ordem fixa `-speechAt` (o "Mais recentes ▾" do draft fica como rótulo estático). Opções que dependem de DB (ano, fase, município citado) vêm do servidor; tema/alcance/duração são constantes client-safe de `speechFacets.ts`. `q` de 1 char é ignorado (mesma ideia de `isContactSearchQueryReady`).
- **Rejeitadas:** B porque o wrapper de mutação é para escrita com erro seguro; uma leitura paginada por POST perde deep-link, voltar/avançar e o pending compartilhado do RSC; C porque perde tudo isso e a URL canônica que o resto do produto usa.
- **Nota de semântica:** a busca sobre segmentos usa `like` com o termo normalizado — todas as palavras em qualquer ordem, sem acento (uma palavra é o caso trivial); keyword oficial é termo exato case-insensitive (`contains` → ILIKE) e sensível a acento; a busca sem acento continua coberta pelo `searchText` dos segmentos. A copy do campo deve dizer "termo exato" para keyword.

#### D5 — Rotas e home da vertical: redirect (A)

- **Opções:** A) `/campanha/comunicacao` redireciona para `/campanha/comunicacao/acervo`; nav aponta para a home | B) landing com um card "Acervo" | C) nav aponta direto para o acervo e a home fica vazia.
- **Recomendação:** A — a intenção fixa as três rotas; o job do assessor **é** a busca (a primeira cena do gate de forma é o acervo), então uma landing de um card é um clique morto. O redirect preserva a identidade da vertical (nav ativa em tudo que é `/campanha/comunicacao/...`), dá casa para itens futuros e evita duas URLs para a mesma página. O login cai em `/campanha`, então `(app)/page.tsx` redireciona o communicator para a vertical (e o `denyRedirect` do D3 usa o mesmo alvo).
- **Rejeitadas:** B porque inventa tela fora do gate de forma e adiciona um clique; C porque deixa a rota da intenção sem conteúdo.

#### D6 — Player e seek: `<video>` nativo (A)

- **Opções:** A) `<video controls preload="metadata">` nativo com seek via `#t=<startSeconds>` no `src` + `currentTime` em `loadedmetadata`, sem dependência | B) react-player/hls.js | C) iframe do YouTube da sessão.
- **Recomendação:** A — o VOD é MP4 direto (`vodPlaybackUrl`, o MP4 do trecho), os segmentos são relativos a esse MP4 (seek = `startSeconds`) e o repo não tem player; o controle nativo é acessível, mobile-friendly e de bundle zero. Sem autoplay (bloqueado pelos browsers): o usuário dá play e começa no fragmento. Um único client component (`SpeechDetailPlayer`) segura o ref do `<video>` e a lista de segmentos clicáveis (click → `currentTime` + `play()`). Fallbacks: sem `vodPlaybackUrl` → bloco "VOD indisponível" + Abrir fonte; sem segmentos → transcrição oficial, sem seek.
- **Rejeitadas:** B porque adiciona dependência e superfície para tocar MP4 progressivo; C porque a sessão do YouTube não tem o offset do trecho confiável e o guardrail pede o VOD da Câmara nesta fase (o YouTube continua como "Abrir fonte", sem seek).

### Componentes / mudanças

- **`src/collections/Speech.ts`** (editar o dono): campo `searchText` (textarea, `defaultValue: ''`, `admin.readOnly` + description "Concatenação normalizada dos segmentos; mantida pelo import") — sem `index` no campo (GIN é hand-written). **Reavaliado na execução:** `required: true` foi descartado porque o Payload rejeita string vazia em campo required e uma fala sem segmentos legitimamente não tem texto de busca; o campo fica opcional com default `''` (coluna nullable, default `''`).
- **`src/utilities/speech/speechImport.ts`** (editar o dono): quando `bundle.segments !== undefined`, calcular `segmentSearchText` (join normalizado dos segmentos, reusando o mesmo `normalizeForSearch` de cada create) e incluir no `data` do create/update do discurso; `segments: undefined` não toca no valor. Um write, transação preservada.
- **Migration:** `pnpm migrate:create add_speech_search_text` (coluna) + hand-written `add_speech_search_text_trgm_index` com backfill `string_agg(search_text, ' ' ORDER BY "order")` e `CREATE INDEX "speech_search_text_trgm_idx" ON "speech" USING gin ("search_text" gin_trgm_ops)`; registrar em `src/migrations/index.ts`; `down` dropa só o índice (backfill é dado, documentado). Seguir a skill `payload-migrations`.
- **`src/lib/speechHighlight.ts`** (novo, puro): `findHighlightRanges(text, query)` via mapa char-a-char normalizado→range original (NFD remove combining marks e muda comprimento; lowercase pode expandir; espaços colapsam) e `buildHighlightedExcerpt(text, query, { radius })` → `{ parts, truncatedStart, truncatedEnd }`; múltiplos termos (a query é dividida em palavras normalizadas, todas destacadas). Rejeitadas: `text.toLowerCase().indexOf` (quebra com acento/NFD), regex sobre o original (mesmo problema), destacar o texto normalizado (perde a grafia original), highlight só no cliente (o RSC já renderiza).
- **`src/utilities/speech/speechListUrl.ts`** (novo, puro/client-safe): `SpeechListState`, nomes de param, `parseSpeechListParams` (page estrito, `q` normalizado, enums exaustivos, year/phase/municipality estruturais), `buildSpeechListSearchParams`, `buildSpeechListHref`, `resolveSpeechListUrl`, `buildSpeechFiltersKey`, buckets/labels de duração, `toggleSpeechFilterValue`.
- **`src/utilities/speech/speechListFilters.ts`** (novo, puro): `buildSpeechListWhere(state)` exatamente como D1 (a montagem do `Where` fica em UM lugar, testável por unit/int).
- **`src/utilities/speech/speechPageData.ts`** (novo, `server-only`): `loadSpeechAcervoPageData` (find do discurso + segmentos da página + opções server-side), `loadSpeechDetailPageData` (discurso `depth: 0` + segmentos por `order`), `SpeechNotFoundError` via `createEntityNotFoundError('Speech', 'Fala não encontrada.')`, `loadSpeechFilterOptions` (anos/fases do catálogo; municípios citados → `loadMunicipalityLabelsByIds` — o bypass justificado de `loadNamesByIds`, pois os ids vêm de discursos que o ator já podia ler).
- **`src/utilities/speech/speechViewModels.ts`** (novo, puro): `formatSpeechAt` (fatiar o wall-clock `speechAt` sem `new Date` — sem TZ, DST-safe), `formatSpeechDuration`, `toSpeechListItemViewModel` (trecho escolhido, `matchKind: segment|keyword|fallback`, chips, URLs), `toSpeechDetailViewModel` (segmentos, municípios, `seekSeconds`).
- **`src/utilities/speech/speechOmnibox.ts`** (novo, puro/client-safe): chips ativos, seeds de sugestão (temas/alcances/durações + anos/fases/municípios server-side) e ações (toggle/remove/clear) reusando `src/lib/campaignListOmnibox.ts`.
- **`src/components/campaign/speech/SpeechAcervoFilters.tsx`** (novo, client): `<form role="search">` com `campaignListOmniboxFormClassName` + `CampaignListOmnibox` (busca/chips/pending) e a régua de facetas com `CampaignHeaderFilterPopover` (multi-select, `closeOnChoose: false`), no padrão de `MunicipalityHeaderFilter`.
- **`src/components/campaign/speech/SpeechResultList.tsx` / `SpeechResultCard.tsx`** (novos, server): cards com trecho destacado, chips (temas/alcances preenchidos; keywords outline) e ações "Assistir no trecho" (`?t=&q=`), "Baixar" (`vodDownloadUrl`) e "Abrir fonte" (`officialTextUrl` ?? `youtubeUrl`).
- **`src/components/campaign/speech/SpeechDetailPlayer.tsx`** (novo, client): `<video>` + transcrição ASR clicável (timestamps), highlight do `q`, segmento ativo, `data-slot="speech-player"`/`data-start-seconds`; transcrição oficial em `<details>` (leitura/citação).
- **`src/components/campaign/shared/CampaignHeaderFilterPopover.tsx`** (editar o dono): prop opcional de trigger-chip (`triggerVariant?: 'icon' | 'chip'` + `triggerLabel`), default `'icon'` — os call sites existentes ficam byte-idênticos.
- **`src/utilities/campaignPageActor.ts`** (editar): gate `'speechCatalog'` com `canReadSpeechCatalog` + atalho do communicator no `denyRedirect`.
- **`src/components/campaign/shell/nav.ts`** (editar): `communicatorNav` com o item "Comunicação" (ícone `MegaphoneIcon`), retornado para o communicator; o mesmo item no `staffNav` filtrado por `isUnrestrictedCampaignRole` (coordinator/candidate veem; advisor não). `getCampaignBottomNav`/`getCampaignOverflowNav` intocados: communicator não é staff → sem bottom nav (usa a sidebar/Sheet no mobile, como o leader); coordinator/candidate ganham "Comunicação" no drawer "Mais".
- **`src/lib/campaignPageChrome.ts`** (editar): entradas `comunicacao` ("Comunicação") e `acervo` ("Acervo de falas" + subtitle "Discursos do Deputado Jorge Solla na Câmara"); path rules para `/campanha/comunicacao` e `/campanha/comunicacao/acervo`; detalhe → `null` (chrome por rota via `SetCampaignPageChrome`).
- **`src/lib/campaignPaths.ts`** (editar): `CAMPAIGN_COMMUNICATION_HOME` e `CAMPAIGN_COMMUNICATION_ACERVO`.
- **`src/app/(campaign)/campanha/(app)/page.tsx`** (editar): `if (user.role === 'communicator') redirect(CAMPAIGN_COMMUNICATION_HOME)` (o login cai em `/campanha`).
- **Pages** (`src/app/(campaign)/campanha/(app)/comunicacao/`): `page.tsx` (redirect para o acervo), `acervo/page.tsx` (lista; `metadata = campaignPageMetadataFromCatalog('acervo')`; `requireCampaignPageActor({ gate: 'speechCatalog' })`; `redirectHref` do `resolveSpeechListUrl`), `acervo/loading.tsx` (skeleton no molde de apoiadores), `acervo/[id]/page.tsx` (`generateMetadata` com catch → "Fala"; loader; `notFound()` em `SpeechNotFoundError`; `SetCampaignPageChrome`), `acervo/[id]/not-found.tsx` (Empty + voltar ao acervo, molde apoiadores).
- **Access / Consent:** sem mudança de access (reusa `canReadSpeech`/`canUpdateSpeech` do C153 e o predicado `canReadSpeechCatalog`); sem Consent novo (dado parlamentar público CC BY 4.0). Leituras sempre `user` + `overrideAccess: false`; o único bypass é `loadMunicipalityLabelsByIds` (doutrina `loadNamesByIds`).
- **UI:** Impeccable C — três cenas do gate de forma (lista, detalhe, mobile ~390px) + vazio; shells reusados (`CampaignPageShell`, `CampaignListOmnibox` sticky, `CampaignHeaderFilterPopover`, `CampaignListEmptyState/Results/Pending/Footer`, `CampaignPageChrome`); `<mark>` para destaque e o acento do app (não o amber literal do draft); ciclo shape→craft→critique→polish; sem token novo. O card do draft mapeia: data/tipo/duração/presidiu → excerpt com `<mark>` → chips → ações; o vazio sugere temas/alcances + limpar; mobile empilha e a régua de filtros rola na horizontal.
- **Testes:** unit `speechHighlight`, `speechListUrl`, `speechListFilters`, `speechOmnibox`; extensões `campaignNav.unit.spec.ts` (communicator deixa de ser vazio) e `campaignPageChrome.unit.spec.ts`; int `speechAcervo.int.spec.ts` (busca com/sem acento, keyword exata, facetas, paginação por discurso, RBAC allow/deny) + extensão `speechImport.int.spec.ts` (bundle mantém `speech.searchText`; `segments: undefined` preserva); e2e `campaignSpeechAcervo.e2e.spec.ts` + entry no manifest + ownership de `speech`/`speechSegment` nos fixtures (e2e e int).
- **Manifest e2e:** entry `prefixes: ['src/app/(campaign)/campanha/(app)/comunicacao', 'src/components/campaign/speech', 'src/utilities/speech', 'src/lib/speech']`, `specs: ['campaignSpeechAcervo']` (o `src/lib/speech` cobre `speechSearch`/`speechFacets`/`speechHighlight`); `e2eAffectedManifest.unit.spec.ts` pina existência em disco e os curated/risk ficam intocados.
- **Changelog:** `docs/changelog/2026-09-13-c154.md`.

### Ajustes descobertos na execução (com dono no repo)

- **Sollinha fora da vertical (débito C153 resolvido).** O C153 deferiu com gatilho C154 os chips de líder que o fallback não-staff devolvia ao communicator. O C154 esconde as superfícies do assistente para esse papel: `canUseCampaignAssistant(role)` em `src/lib/campaignRoles.ts`, early-return em `CampaignAISidebarShell` e o botão do header condicionado em `CampaignDesktopHeader` (role threaded pelo layout). Coordinator/candidate/leader intocados.
- **Keywords oficiais: parser do C153 corrigido no dono.** A API da Câmara separa grupos por linha e keywords individuais por vírgula (dado vivo: `Governo federal,reconstrução,Política pública`); `parseOfficialKeywords` (`scripts/lib/camaraSpeeches.mjs`) só quebrava linha e o card exibia um chip gigante. Agora quebra `[\r\n,]+`; unit test atualizado com o shape real. C155 importa produção já com o parser certo.
- **Densidade do card:** temas/alcances/keywords são capados (3/2/3) com um chip `+N`; o detalhe lista tudo. Os botões de ação do card e os gatilhos de filtro em chip usam `min-h-11`/`min-h-10` (alvo de toque).

### Dados → forma (se aplicável)

- **Forma escolhida:** lista de cards de fala (data/hora · tipo · duração · quem presidia → trecho com destaque → chips de tema/alcance/keywords → ações), contagem simples "N falas encontradas" e paginação; chips de faceta como rótulos, sem número/percentual. Por quê: a unidade é uma fala com texto para **ler e escolher**; o dado que desbloqueia a decisão é o trecho (onde está a citação), não um agregado.
- **Rejeitadas:** tabela (não deixa ler o trecho, que é o ponto), dashboard/gráficos (vaidade; a intenção proíbe % absoluto/KPI), timeline (sem necessidade de produto e sem ganho sobre a lista por data).

## Fases verificáveis

1. **Tracer / schema+server** (≈1 dia): migration + campo `searchText` + bundle; `speechListUrl`/`speechListFilters`/`speechPageData`; gate `'speechCatalog'`, nav, paths, chrome e redirect do home; acervo renderizando o resultado cru. **Prova vertical cedo:** `tests/int/speechAcervo.int.spec.ts` cria 2 discursos (um com 3 segmentos que casam, outro com 1), prova busca sem acento (`q=saude` acha "saúde"), keyword exata (`contains`), facetas, `totalDocs` = discursos (não segmentos) e RBAC (communicator/coordinator/candidate leem; advisor/leader não). Migrations aplicadas em `teqo_wt154` e `_test` antes dos int.
2. **UI** (≈1–1,25 dia): `SpeechAcervoFilters` (omnibox + popovers), cards com highlight, `SpeechDetailPlayer` (seek/transcrição/baixar/abrir fonte, VOD indisponível, sem segmentos), vazio/loading/not-found, mobile; rodada Impeccable de critique/polish sobre as três cenas do draft.
3. **Gates** (≈0,5 dia): `pnpm gate:fast`; `pnpm test:e2e:affected` (prefixo shell + entry nova); `pnpm knip`; `pnpm generate:types` sem diff; `pnpm migrate`/`migrate:status` limpos; smoke vivo com `pnpm camara:import --limit 3` no `teqo_wt154` + um communicator de teste navegando (busca "saude"/"SUS", filtro por município, seek no detalhe, download); `pnpm push`; changelog.

**Quota total:** ~2,5–2,75 dias, dentro do appetite; a migration é a única peça "de schema" e é mecânica.

## Rabbit holes / Não escopo (engenharia)

- **Player de verdade:** hls.js/react-player, controles customizados, PiP, autoplay, playlist. Corte: `<video>` nativo.
- **Espelho/CORS/proxy de mídia:** baixar o MP4 para o S3, resolver Range/CORS do VOD. Corte: link direto + "Abrir fonte" (é o guardrail do C155).
- **Corte/edição no browser, fila de render, coleções/favoritos, download em lote.** Corte: player + download por trecho.
- **Busca semântica/IA, ranking, frase exata, `tsvector`/`unaccent`.** Corte: `searchText like` normalizado + keyword exata.
- **Busca no `officialTranscript`** (discurso sem segmento): revisitar com dados do C155.
- **Keyword sem acento (normalizada):** exigiria campo/denormalização extra; revisitar se virar atrito real.
- **Sort param, saved filters (B18), sugestões de busca, destaque alinhado oficial↔ASR.** Fora.
- **YouTube com seek** para discurso sem VOD: só "Abrir fonte" sem offset.
- **Permissão por município na comunicação / home rica da vertical.** Fora (anti-goals).
- **Mexer em `src/utilities/access` ou `campaignAccess.ts`:** desnecessário (C153 já cobre) e acordaria o fail-closed de risco.

## Riscos e mitigação

- **Seek/CORS/Range/autoplay do MP4:** controle nativo + `#t=` + `currentTime` em `loadedmetadata`; sem autoplay; fallback "Abrir fonte"; e2e não testa reprodução (só o HTML/atributos) — se o VOD não suportar Range, o seek pode degradar, e o detalhe continua útil (transcrição + download).
- **VOD indisponível/nulo:** UI condicional ("VOD indisponível" + fonte), sem crash; `vodDownloadUrl ?? vodPlaybackUrl`.
- **Discurso sem segmentos (transcrição oficial só):** detalhe mostra a oficial e não oferece seek; lista mostra `summary` como preview; sem quebra.
- **Busca de frase que atravessa segmentos:** a concatenação acha o discurso, mas nenhum segmento isolado casa — o card cai no fallback (summary/primeiro segmento) sem highlight; documentado.
- **Performance/índice:** GIN trgm em `speech.search_text`; `%q%` de 2 chars = seq scan aceitável no tamanho atual; limite/gatilho registrados em D1; migration roda antes do build (OPS66) e o `CREATE INDEX` não-concurrente é irrelevante no volume atual.
- **Drift do `speech.searchText`:** só o bundle escreve; int test pina; escrito fora do bundle é caminho não suportado.
- **E2E de RBAC:** spec novo cobre communicator/coordinator (200) e advisor/leader (redirect canônico), na rota do acervo e do detalhe; helper `assertCampaignRedirect` generaliza o `assertLeaderRedirect` existente (owner em `campaignHttpTest.ts`).
- **Dados nos testes:** e2e/int criam `speech`/`speechSegment` com marcadores únicos (`runID`) e ownership estendido (segmento antes de discurso no cleanup); não dependem do import real.
- **Pins que mudam:** `campaignNav.unit.spec.ts` (communicator deixa de ser `[]`) e `campaignPageChrome.unit.spec.ts`; o manifest ganha entry nova e o spec existe em disco (pinned).
- **Regressão da régua de filtros compartilhada:** a extensão do `CampaignHeaderFilterPopover` é opt-in; rodar os e2e de municípios/pessoas via `test:e2e:affected` (prefixo do shell) antes do push.
- **Wildcards em `q` (`%`/`_`):** `contains`/`like` já tratam o valor como literal param (sem SQL injection), mas `%` vira curinga — mesmo comportamento dos filtros existentes; aceito e documentado.

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: `communicator` vê só a vertical; coordinator/candidate veem; advisor/leader não; busca com e sem acento sobre segmentos + keyword exata; filtros (ano/tema/alcance/fase/município citado/duração); destaque do termo; detalhe com player no trecho, transcrição clicável, sumário/contexto, baixar e abrir fonte; estados vazio/carregando/sem permissão; mobile; crédito CC BY 4.0.
- [ ] Invariantes AGENTS/engineering-standards: migration via `migrate:create` + índice/backfill hand-written registrado; `src/utilities/speech/` (sem módulo top-level novo); `server-only` no loader; identificadores em inglês; `overrideAccess: false` nas leituras com `user`; `communicator` fora de `isStaffCampaignRole`; sem `Consent` novo.
- [ ] Testes de domínio previstos: unit (highlight, URL/filtros, omnibox, nav, chrome) e int (busca acento/keyword/facetas/paginação/RBAC + bundle do `searchText`); e2e novo + manifest; `e2eAffectedManifest.unit.spec.ts` verde.

## Self-score decision-quality

1. **Decisões caras têm rejeitadas?** 5/5 — D1 (busca/paginação), D2 (ciclo do `searchText`), D3 (gate), D4 (contrato de URL), D5 (rotas/home) e D6 (player) estão no formato Opções|Recomendação|Rejeitadas, com o porquê de cada rejeitada; as baratas (buckets de duração, ícones, copy) ficam registradas em uma linha.
2. **Cabe no appetite?** 5/5 — ~2,5–2,75 dias contra 2–3 herdados; a única peça de schema é mecânica e o player é `<video>` nativo sem dependência.
3. **Rabbit holes nomeados?** 5/5 — player "de verdade", espelho/CORS de mídia, corte no browser, busca semântica/tsvector, busca no transcript oficial, keyword normalizada, YouTube com seek, home rica, mexer no access do C153.
4. **Depth check reusa?** 5/5 — `resolveListUrl`/`buildListHref`, `CampaignListOmnibox` + `campaignListOmnibox`, `CampaignHeaderFilterPopover` (extensão opt-in), `CampaignListEmptyState/Results/Pending/Footer`, `requireCampaignPageActor`, `createEntityNotFoundError`, `loadNamesByIds`, `withPayloadTransaction` e o bundle do C153; nenhum shell ou query layer novo.
5. **Intenção permanece satisfeita?** 5/5 — o outcome não foi reescrito: as três rotas da intenção existem, o communicator não herda staff, a busca é substring com/sem acento + keyword exata, e a única adição de schema (`speech.searchText`) serve exatamente ao "N falas encontradas" com paginação por discurso que a UI pede.

## Débitos (triage pós-simplify)

Nenhum achado dos dois revisores virou Issue nova (nenhum `expensive_lock` com score ≥4). O que ficou:

**Deferido com gatilho:**

- **`loadSpeechFilterOptions` varre o catálogo inteiro a cada página** (`pagination: false` sobre ano/fase/municípios citados): trivial nos 234 discursos atuais e o custo é o mesmo em qualquer página. Gatilho: o mesmo do D1 (catálogo > ~5.000 discursos ou p95 do acervo > 300ms) — aí a leitura vira `DISTINCT`/agregação SQL ou cache das opções, respeitando o access do papel.

**Descartado:**

- **Chave React ausente** (`LeadershipSortableHead`/`AdvisorsPage`, componentes compartilhados): pré-existente em `main`, fora da superfície do C154; warning só em dev (CI/prod verde). Bug separado, não deste lote.
- **`pickMatchingSegment` re-normaliza `segment.text`** em vez de usar o `searchText` do segmento: micro-CPU sem impacto; o select do campo foi removido no /simplify como plumbing morto. Reabrir só com profiling.
- **`redirectHref ?? canonicalUrl.redirectHref`** no loader do acervo: redundante, mas espelha o dono (`supporterPageData`); consistência vale mais que a linha.
- **Fixture e2e duplica o contrato do bundle** (`searchText` hardcoded): deliberado para não importar `server-only` no spec; o int test pina o bundle.

**Já resolvido no simplify (não reabrir):**

- `speechOmnibox` unificado (`mutateFacet`).
- `parseOfficialKeywords` corrigido no dono (vírgula + linha) — C155 importa certo.
- Sollinha escondido do `communicator` (débito C153 fechado).
