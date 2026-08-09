# Impl: B178 — Salvador: cidade agregada no /campanha (página virtual + linha na lista + busca, sem dupla contagem)

Status: aprovado (gate humano 2026-08-09 — regra de assessor conforme recomendado: linha visível em qualquer recorte para coordinator/candidate; para advisor só quando `q` casa com Salvador; página da cidade `noLeader`)
Atualizado em: 2026-08-09
Issue: #461
Intenção: docs/plans/salvador-pagina-detalhe-cidade.md
Appetite restante: ~2–3 dias eng (herdado); agregação virtual, sem migration / collection / Consent

## Leitura da intenção

- **Outcome:** `/campanha/municipios/salvador` resolve para uma página read-only da cidade (rollup eleitoral + demandas/agenda + 19 ZEs); a lista de municípios mostra uma linha agregada da capital quando "Salvador" está no recorte (busca → agregado + 19 ZEs); o guardrail de dupla contagem é estrutural e testável.
- **O que NÃO negociar:** operação continua por ZE (cidade nunca vira unidade operacional / 436º município; sem pledges, lideranças, nível, demandas _por cidade_); cidade **ou** zonas em qualquer somatória — nunca ambas; cada ZE mantém ficha/linha; mapa intocado; leader lockdown (mesmo gate das páginas de município); sem migration/collection/Consent.
- **O que reavaliar:** a hipótese da intenção "loader da lista estendido para inserir a linha agregada" — a linha entra no **bundle** mas **fora do array de docs** (linha compacta acima da tabela, não dentro da tabela de 11 colunas com controles interativos — ver decisões abaixo); "reuso dos loaders de baseline por zona, somados" — o rollup do overview da página usa o **artefato commitado** (soma das chaves de zona), precedência do mapa/dashboard; o loader DB (`loadMunicipalityElectoralBaseline`) fica para a aba Eleições, que já soma por geografia.

## Abordagem recomendada

```mermaid
flowchart LR
  A[catálogo 435 intocado] --> B[lib/salvadorCity.ts — descritor virtual + agregação do artefato]
  B --> C[municipalityCityRow — predicado de recorte espelhando buildMunicipalityListWhere + doc sintético]
  C --> D[lista: linha comum na tabela + mobile, merge no caminho in-memory, células read-only]
  B --> E[página [slug]: branch isCitySlug → CityPage]
  E --> F[ElectionsTab reusado via geography da cidade]
  E --> G[Overview: rollup artefato + top ZEs + entradas]
  B --> H[Sollinha: searchEntities + campaignNavigationUrls aceitam a cidade]
```

**A cidade vira uma LINHA COMUM da lista** (decisão do humano no gate 2026-08-09): participa de filtros, ordenação e paginação como uma entidade de município normal — não apenas no `q=`. O documento é **sintético** (nunca criado no banco): um objeto com forma de `Municipality` (slug `salvador`, name `Salvador (cidade)`, region, ibgeCode, `id` sentinela negativo, sem advisors/trend/level/expectedVotes/…), marcado com `isCity: true` no view model.

**Opções consideradas (cidade):** A = entrada `kind: 'cidade'` no `municipalityCatalog` · B = descritor virtual em módulo novo `src/lib/salvadorCity.ts` · C = estender `metropolitanoTerritoryPeers.ts`
**Recomendação:** B — o catálogo é a fonte das 435 unidades operacionais, congelada por snapshot (`municipality-catalog.snapshot.json`) e por dezenas de consumidores (mapa por map key, TI/E12, artefato eleitoral, `getStatewideFederalTotals`, testes de bijection); a cidade é leitura derivada e não pode entrar nele.
**Rejeitadas:** A porque quebra o snapshot, a contagem 435 e a semântica de `kind` (DB não tem `cidade`), e é exatamente a "aparência de 436º município" que produto vetou (a cidade é derivada, nunca seed); C porque `metropolitanoTerritoryPeers` é o módulo do split Salvador × demais RMS dentro do TI (E12/T4), escopo distinto da superfície da cidade.

**Opções consideradas (participação em filtros/sort/paginação):** A = linha só no `q=` (append pós-query) · B = linha comum com merge no caminho in-memory (recomendada) · C = linha comum com merge na página DB-paginada
**Recomendação:** B — quando o recorte seleciona a cidade, o bundle cai no caminho in-memory já existente (o mesmo do sort derivado/classe: `limit: 0` → filtro em memória → `applyDerivedMunicipalitySort` → slice). O caminho DB-paginado só é usado hoje com sort nativo (name/region/lastUpdateAt/trend) e sem classe; a cidade no recorte apenas estende a condição `isPagedByPayload` (nativeSort && !classMatches && !cityInRecorte). O custo extra é carregar ~435 selects de campos estreitos em vez de 25 — os reads pesados (scope, pledges, goal coverage) já rodam no caminho paginado.
**Rejeitadas:** C porque o merge na página SQL exige a posição ordinal da cidade na lista completa — não calculável com count/where sem carregar o conjunto ordenado inteiro; A porque é o que o humano vetou (só `q=`).

**Opções consideradas (células da linha):** A = células interativas recebem o id fantasma (popovers que falham no save) · B = flag `isCity` no view model + células read-only para a cidade (recomendada) · C = linha especial fora do `CampaignTable`
**Recomendação:** B — ~7 células interativas (expectedVotes, nível, assessores, tendência, lideranças, dobradinhas, sinal) mais os mobile cards renderizam o valor read-only (dash/badge "Não registrada"/classe real) quando `municipality.isCity`; nenhum popover abre para id inexistente; `MunicipalityListGoalCoverageCell` já renderiza o estado vazio (cobertura vazia) sem interação.
**Rejeitadas:** A porque o save falharia no servidor (município não existe) com UX quebrada; C porque contradiz "linha comum" e reabre a duplicação do row rendering.

**Opções consideradas (página):** A = branch dedicado no `[slug]/page.tsx` com `CityPage` reusando `ElectionsTab` · B = contexto sintético no fluxo do município (fabricar `Municipality` doc) · C = rota estática `salvador/page.tsx`
**Recomendação:** A — o shell (chrome + tab nav + Suspense) é o mesmo; a cidade tem abas com dono de dado (overview/elections/demands) e o resto do tab set (dossiê/lideranças/atualizações) simplesmente não existe para ela.
**Rejeitadas:** B porque o view model exigiria um `Municipality` falso (kind/advisorIDs mentem, dossiê/goal account/pledges quebrariam); C porque duplicaria o shell e divergiria do padrão de rota dinâmica.

**Opções consideradas (rollup eleitoral):** A = artefato commitado (`bahia-federal-baseline.json`, soma das 19 chaves de zona) · B = loader DB (`loadMunicipalityElectoralBaseline` com geography da cidade)
**Recomendação:** A para o card do overview (fonte abençoada dos agregados — "o mapa/dashboard nunca consultam essas collections para anos históricos"; puro, sem DB, sem cache) **+ B para a aba Eleições** (comparativo entre candidatos e dobradinhas dependem do DB; `municipalityElectionGeographyForSlug` passa a resolver a cidade, e o `ElectionsTab` reusa sem mudança — o loader já soma `cityCode × zones`).
**Rejeitadas:** usar só B no overview (4+ queries DB para uma superfície de leitura agregada, com cache `election-tse` que a cidade não precisa) e usar só A na aba Eleições (não há comparativo entre candidatos nem dobradinhas no artefato).

**Guardrail de dupla contagem (estrutural):** a cidade nunca entra em `municipalityCatalog`, nunca entra no artefato (o doc sintético só existe no bundle da lista e na página). Portanto nenhum consumidor de agregados (TI/E12, mapa B13, conta da cadeira, potencial, lista de territórios) pode somá-la; o sort/filtros in-memory usam a **soma derivada** (rank da cidade = soma das 19 chaves), nunca votos novos. Testes de invariante fixam isso (fase 1).

### Componentes / mudanças

- **`src/lib/salvadorCity.ts`** (novo, client-safe/puro): `SALVADOR_CITY_SLUG = 'salvador'`, descritor (name "Salvador (cidade)", region "Metropolitano de Salvador", `ibgeCode`/`tseCityCode` do catálogo, `zoneSlugs` derivados de `municipalityCatalogEntriesForCity('Salvador')`, `tseZones` [1..19]), `isCitySlug()`, `getSalvadorCityDescriptor()`, `cityFederalBaseline()` (soma por ano de `getMunicipalityFederalBaseline(zoneSlug)` para votes/valid/campo/tally + `getFederalCompetitiveRank(ibgeCode, ano)`), `cityVoteShareByYear()`, `cityVoteRankEntry(ano)` (votes = soma, share, rank/totalUnits competitivos — a "posição por cidade"). Reusa: catálogo (leitura), artefato, `computeAggregateTerritorialClass` para a classe da cidade.
- **`src/utilities/municipality/municipalityCityRow.ts`** (novo, server-safe): **`cityMatchesFilter(state)`** — predicado puro espelhando a semântica de `buildMunicipalityListWhere` sobre os valores virtuais da cidade: `q` (nome contém q), `regions` (Metropolitano de Salvador ∈), `slugs` ('salvador' ∈), `coverage: 'sem_assessor'` (sem assessores), classes (classe agregada real ∈), e os sentinelas de ausência (`sem_nivel`, `sem_dobradinha`, `sem_lideranca`, `sem_partido`); nunca casa com advisor/trend/level-nomeado/priority/estado-deputado/liderança/partido nomeados (a cidade não tem esses valores) — **+ `buildCityMunicipalityDoc()`** (doc sintético com forma de `Municipality`) **+ `cityListViewModel()`**.
- **`src/utilities/municipality/municipalityPageData.ts`**: (a) `isPagedByPayload` ganha `&& !cityInRecorte`; (b) no caminho in-memory, o doc sintético entra no array **antes** do `applyDerivedMunicipalitySort`; (c) `DerivedSortContext` ganha o rank da cidade (map mesclado para `votos`) e a classificação agregada (map de override para `classe`); (d) `totalDocs`/`totalPages` +1 quando a cidade está no recorte (paginação comum); (e) faceta `slugs` inclui 'salvador' quando no recorte; (f) `parseSlugsParam` aceita o slug da cidade **só na lista de municípios** (`isMunicipalitySlug || isCitySlug`).
- **`src/utilities/municipality/municipalityViewModels.ts`**: `MunicipalityListViewModel` ganha `isCity: boolean` (false no fluxo normal); `toMunicipalityListViewModel` recebe o flag.
- **`src/components/campaign/municipality/MunicipalityList.tsx`** + **`MunicipalityListMobileCards.tsx`**: células read-only para `municipality.isCity` (dash; tendência = badge "Não registrada"; classe = pill real; votos = readout da cidade; nome = link + badge "Cidade · agregado das 19 zonas"); nada de popover para id fantasma.
- **`src/utilities/municipality/municipalityOmnibox.ts`**: chips e seeds de slug resolvem o nome da cidade via descritor (client-safe) quando o slug é `salvador`.
- **`src/app/(campaign)/campanha/(app)/municipios/[slug]/page.tsx`**: branch `isCitySlug(slug)` → `CityPage` (chrome "Salvador · Metropolitano de Salvador · ZE 1–19 · capital (agregado)", tab nav com `tabs` reduzidas, overview/elections/demands, `RecentVisitTracker`); `generateMetadata` com branch da cidade. Sem migration.
- **`src/components/campaign/municipality/MunicipalityTabNav.tsx`**: prop opcional `tabs` (default `municipalityDetailTabs`).
- **`src/utilities/municipality/municipalityElectionGeography.ts`**: `municipalityElectionGeographyForSlug` resolve a cidade (descritor) — `ElectionsTab` reusa inalterado.
- **`src/utilities/municipality/municipalityDetailTabUi.ts`**: `cityMunicipalityDetailTabs = ['overview','elections','demands']` (subset do enum existente, hrefs reaproveitados).
- **`src/components/campaign/municipality/CityOverview.tsx`** (novo, route-local): card de rollup (série 2014/2018/2022 + share + posição por cidade + evolução), top-5 ZEs por votos 2022 (artefato), entradas: 19 ZEs (→ `?q=salvador`), demandas (→ `/campanha/demandas`, padrão da aba do município), agenda (próximas atividades nas 19 ZEs — query `activity.municipality: { in: [ids das 19 ZEs] }` com access do user — + link Agenda), mapa (link).
- **`src/utilities/ai/tools/searchEntities.ts`**: hit `collection: 'cidade'` → `/campanha/municipios/salvador` quando a query casa com Salvador (aceite: "o link da Sollinha passa a ser canônico").
- **`src/utilities/ai/campaignNavigationUrls.ts`**: destino `'municipality'` aceita `isCitySlug` (mesma URL).
- **Migration:** nenhuma. **Access/Consent:** nenhum novo; a linha aparece para staff **unrestricted** (coordenador/candidato) em qualquer recorte que a selecione; para **assessor**, só quando `q` casa com Salvador (o portfólio do assessor é por ZE; a cidade não é administrada por ninguém — ver "Riscos"); página da cidade no gate `noLeader` (leitura); leitura eleitoral via `assertCanReadElectionData`; activities/demandas leem com `overrideAccess: false` + `user` (scoped por assessor).

### Dados → forma

- **Forma escolhida:** rollup da página = card de séries por ano (mesma forma da `MunicipalityBaselineCard`) com a **posição por cidade** ("12º de 663") em destaque no ano de referência; linha da lista = mesma coluna `votos` das demais (share + votos + posição), com a posição **competitiva** da cidade ("12º de 663" — os "mesmos números do rollup" do aceite).
- **Por quê:** a mesa lê relativo/local (share da própria votação + colocação entre candidatos na capital), nunca % estadual absoluto — precedência A11/E10. A posição por cidade é o competitivo do artefato (`federalRankByIbgeCode`, chave por IBGE — a capital inteira).
- **Rejeitadas:** posição por unidade do catálogo na linha (a cidade não é unidade — a semântica da coluna é "posição no catálogo de 435 unidades"); % dos válidos locais como âncora (mesmo veto do research report). Nuance de copy: o hint da coluna `votos` fala em "catálogo de unidades" — para a linha da cidade a leitura é competitiva (número correto via readout; hint genérico de coluna aceito, anotado para ajuste cosmético).

## Fases verificáveis

1. **Tracer / domínio puro** (sem UI): `lib/salvadorCity.ts` + `municipalityCityRow.ts` (`cityMatchesFilter` + doc sintético) + merge no bundle (in-memory, ranks/classes mesclados, totalDocs+1) + **testes de invariante** — (a) `cityFederalBaseline` == Σ das 19 chaves de zona por ano (a cidade é visão derivada das mesmas células, nunca votos novos); (b) `salvador` ausente de `federalBaselineMunicipalitySlugs()` e de `municipalityCatalog` (435 intactos, snapshot inalterado — nenhum consumidor de agregados pode dupla-contar); (c) `cityMatchesFilter` por dimensão (q, região, slug da cidade, sem_assessor, classe, sentinelas de ausência; nunca advisor/trend/nível nomeado/…); (d) bundle: `q=salvador` → 19 docs + cidade, totalDocs 20, paginação correta; `sort=name` → cidade na posição lexical; `sort=votos` → cidade no topo (desc). `pnpm gate:fast`.
2. **UI lista**: flag `isCity` no view model + células read-only (tabela + mobile cards) + badge "Cidade · agregado das 19 zonas" + omnibox/chips resolvendo o nome. `pnpm gate:fast`.
3. **UI página**: branch no `[slug]/page.tsx` + `MunicipalityTabNav.tabs` + `cityMunicipalityDetailTabs` + `municipalityElectionGeographyForSlug` resolvendo a cidade + `CityOverview` + aba demandas (link out) + metadata. `pnpm gate:fast`.
4. **Sollinha**: `searchEntities` + `campaignNavigationUrls`. Gates: `pnpm gate:fast` → `pnpm push` (PR `--base main` + `Closes #461` + auto-merge).

## Rabbit holes / Não escopo (engenharia)

- Operação por cidade (pledges, lideranças, nível, demandas por cidade, avaliação de assessor) — item sucessor, vetado no v1.
- Mudanças no mapa (polígono/legenda/interação) e no dossiê/TI/conta da cadeira — a cidade **não entra** nesses agregados (guardrail estrutural); nada a mudar neles.
- `municipalityPortfolio` (pickers de formulário) — continua listando as 19 ZEs (operação).
- Refatorar `CampaignTable` para suportar linha especial — desnecessário com a linha comum (células read-only).
- `getMunicipalityVotes`/`getMunicipalityOverview` (Sollinha) — continuam por ZE; a ferramenta de navegação é o suficiente para o aceite.
- `parseSlugsParam` de OUTRAS listas (`municipalityUpdateListUrl`) — a cidade só entra na lista de municípios; não estender `isMunicipalitySlug` globalmente.

## Riscos e mitigação

- **Linha comum com id sentinela vaza para controle interativo** → flag `isCity` + células read-only (nenhum popover para id inexistente); teste int garante que nenhum doc do bundle tem id fantasma fora do caminho da cidade.
- **Merge de paginação com sort nativo** → quando a cidade está no recorte, o caminho in-memory assume (condição `isPagedByPayload` estendida); o custo extra é ~410 selects de campos estreitos, e o default (deficit) já era in-memory. Medir no `pnpm build`/uso real; se pesar, revisitamos o merge na página SQL (defer com gatilho).
- **Filtros que a cidade "não tem"** (advisor/trend/nível nomeado/…) → `cityMatchesFilter` falha fechado (cidade fora do recorte), espelhando exatamente o que a entidade normal selecionaria com valores ausentes; sentinelas de ausência (`sem_nivel`, `sem_dobradinha`, `sem_lideranca`, `sem_partido`, `sem_assessor`) selecionam a cidade (ela não tem esses vínculos — semântica idêntica à de um município sem eles).
- **Assessor**: portfólio é por ZE; a cidade não é administrada por ninguém. Regra: a linha aparece para assessor **só quando `q` casa com Salvador** (busca explícita); coordenador/candidato (unrestricted) veem a linha em qualquer recorte que a selecione. Página da cidade permanece `noLeader` (leitura) para staff — sem vazamento (dados eleitorais staff-wide; activities/demandas scoped). **Confirmar com o humano.**
- **Ano sem posição** (`getFederalCompetitiveRank` null) → mostra a série sem fabricar "último lugar" (mesma regra do mapa).
- **Hint genérico da coluna `votos`** ("posição no catálogo de unidades") × posição competitiva da cidade → números corretos no readout; copy do hint aceita como está (anotado para polish futuro).
- **Facetas/omnibox**: slug `salvador` entra na faceta de slugs e nas seeds apenas quando no recorte; chips resolvem o nome via descritor client-safe (nunca mostram "slug cru").

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (página resolve; rollup + posição por cidade; linha comum na lista + busca agregado+zonas; guardrail testável; leader lockdown)
- [x] Invariantes AGENTS/engineering-standards (sem migration/collection/Consent; catálogo 435 e snapshot intocados; identificadores em inglês; copy pt-BR; `overrideAccess: false` com user)
- [x] Testes de domínio previstos: unit (`salvadorCity.unit.spec.ts`, `municipalityCityRow.unit.spec.ts`) + int (`municipalityPageData.int.spec.ts` — bundle com recortes: q=salvador, slug=salvador, região Metropolitano, sort=nome/votos, cidade fora com filtros que não a selecionam)
