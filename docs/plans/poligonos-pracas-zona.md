# B8 — Polígonos dos Municípios-zona de Salvador (ZE 1–19)

Status: F1 entregue em código (2026-07-21; em produção desde 2026-07-23); **F2 entregue em código (2026-07-26)** — deploy pendente
Atualizado em: 2026-07-26
Revisão 2026-07-26 (F2 entregue): as duas questões em aberto foram fechadas na implementação (malha **IBGE 2022**, sem pivô para GeoSalvador; chave = **híbrido A+B** — `municipalitySlug` nas zonas, `ibgeCode` no resto, com o polígono municipal de Salvador **mantido como base sem interação** em vez de removido). As-built completo na seção "F2 as-built" abaixo; débitos novos em "Adiado com gatilho".
Revisão 2026-07-24 (remodelagem Municípios M1): **Camaçari saiu do escopo** — virou município inteiro (ZE 170/171 agregadas), e as entradas de Camaçari foram removidas do catálogo (`MunicipalityZoneNeighborhoodCity = 'Salvador'`; fonte única `tre-ra-02-2017`). B8 agora cobre **só as 19 zonas de Salvador**. Identificadores renomeados `plaza*` → `municipality*` na M1. As menções a Camaçari abaixo foram mantidas apenas como histórico de pesquisa.
Revisão 2026-07-21: F1 implementada — `municipalityZoneNeighborhoods.ts`, fixture+int, `MunicipalityZoneNeighborhoodsCard` no overview do Município-zona; mapa inalterado (F2).
Revisão 2026-07-21 (pós-`/simplify` + capture-review-debts): débitos S1–S3 absorvidos como **F2 prep** (~½ dia, dentro do appetite F2); S4–S10 em Explicitamente fora / Adiado; JR1–JR7 em Já resolvido (não reabrir no simplify).
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B8)
Impeccable: B — encaixe em `/campanha/municipios/[slug]` (lista de bairros) + `MunicipalityMapPanel`/`BahiaMap` (polígonos); sem rota nova
Appetite: F2 restante ~1,5–2,5 dias eng (+~½ dia F2 prep); F1 (~1 dia) já entregue
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` (register product — Field Desk) · tema `data-theme='campaign'` · shells existentes (`CampaignPageShell`, `MunicipalityMapPanel`, `BahiaMap`, cards do detalhe do município).

Na implementação (`implement-roadmap-item`): craft compacto → critique → polish (superfícies já existem; F1 é bloco de leitura; F2 estende o mapa).

Brief compacto:

- **Persona / contexto:** Assessor (ou Alex) abre um Município-zona de Salvador e precisa saber **quais bairros** ele cobre; no mapa, quer ver a zona colorida sozinha — não o município inteiro agregado.
- **Job principal:** geografia operacional do Município-zona legível (bairros) e desenhável (polígono) sem inventar camada estadual de ZE.
- **Estratégia de cor:** Restrained; coroplético existente (sequencial / divergente) inalterado em tokens.
- **Anti-goals:** não geocodificar seções; não PostGIS; não redesign do mapa; não unidade = seção; não segundo sistema de geometrias paralelo ao padrão B2.

## Contexto

Os 19 Municípios-zona de Salvador (ZE 1–19) são unidades operacionais reais, mas o mapa ainda pinta **só o polígono municipal** de Salvador e lista as zonas num painel textual:

- `MunicipalityMapPanel` copy explícita: zonas não têm polígono oficial — Salvador aparece agregada.
- `loadMunicipalityMapBundle` (`municipalityMapData.ts`) soma votos da zona no `ibgeCode` do município; `zoneBreakdown` é a única visão por Município-zona.
- [remodelagem-pracas.md](remodelagem-pracas.md) e o roadmap marcavam polígonos de zona como rabbit hole / fora de escopo (B4 histórico = dissolver municípios membros de ZE multi-município — **problema diferente**).

Pedido de produto (2026-07-21): mapear polígonos das unidades-zona; bairros por zona já são úteis na página do município. _(Na época o pedido incluía Camaçari; a remodelagem M1 de 2026-07-23 tirou Camaçari do modelo de zona.)_

### Pesquisa de fontes (2026-07-21)

| Necessidade                      | Salvador                                                                                                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista zona → bairros/localidades | **Oficial:** TRE-BA — Resolução Administrativa nº 2/2017 (Anexo I, circunscrição por bairro das ZE 1–19) + PDFs de rezoneamento em [tre-ba.jus.br/servicos-eleitorais/rezoneamento](https://www.tre-ba.jus.br/servicos-eleitorais/rezoneamento). **Já no repo** (F1).                    |
| Polígonos oficiais de ZE         | **Não existem** no TSE/TRE-BA (só tabular). Consenso comunitário ([mapaslivres/zonas-eleitorais](https://github.com/mapaslivres/zonas-eleitorais)): construir por cruzamento.                                                                                                            |
| Polígonos de bairro              | IBGE Censo 2022 `BA_bairros_CD2022` ([geoftp](https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/bairros/shp/UF/)); alternativa municipal GeoSalvador. Cobertura parcial; gaps exigem fallback. |

_Histórico Camaçari (fora de escopo desde M1):_ não havia lista oficial zona↔bairro; a aproximação seria via locais de votação TRE (ZE 171 = Abrantes/Arembepe/orla; ZE 170 = sede) + curadoria. Registrado caso o modelo volte a dividir Camaçari.

## Objetivos

- **F1 (entregue):** catálogo estático versionado `zoneNumber → neighborhoods[]` de Salvador (TRE RA 02/2017), com fixture/teste; bloco “Bairros” no detalhe `/campanha/municipios/[slug]` quando `kind === 'zona'`.
- **F2:** TopoJSON dos 19 Municípios-zona (`properties: { municipalitySlug, zoneNumber, cityCode }`) por **dissolução** dos polígonos de bairro mapeados; script re-executável no padrão B2; mapa pinta o Município-zona individualmente (não só Salvador agregada).
- Guardrails: sem migration, sem collection, sem Consent, sem PostGIS; leitura com access existente; geometrias estáticas no repo; disclaimer de aproximação (não é limite oficial TSE).

## Decisões travadas

- **Item novo B8 (não reviver B4 nem absorver em B7).** B4 era “camada ZE estadual por dissolução de municípios membros”; aqui o gap é **intra-municipal** (19 unidades dentro de Salvador). B7 é filtro URL do mapa. (2026-07-21, roadmap-item.) **Rejeitado:** reabrir B4 com o desenho antigo; fill-in sem plano (escopo explode em geoprocessamento).
- **F1 shipável sem F2.** Catálogo + UI no município entregam valor imediato e são pré-requisito do dissolve. (Confirmado: F1 está em produção sem F2.)
- **Fonte Salvador = TRE-BA RA 02/2017 (+ PDFs de rezoneamento se divergirem).** Circunscrição oficial por bairro. **Rejeitado:** scrapers de “Onde Votar” / e-Título (frágil, PII-adjacent); aba SALVADOR da planilha E5 (DE-PARA não-oficial).
- **Escopo geográfico = só os 19 Municípios-zona de Salvador** (desde M1). Demais ZE da BA continuam fora; Camaçari é município inteiro. **Rejeitado:** camada ZE estadual no mapa; manter Camaçari dividida.
- **Polígonos = dissolve de bairros (IBGE e/ou malha municipal), não geocodificar seções.** Mesmo padrão de dissolução já usado em TIs (B2). Gaps: polígono manual leve ou omitir pedaço com nota. **Rejeitado:** geocodificar milhares de seções → casco; pedir shapefile ao TRE neste ciclo; PostGIS.
- **i18n e naming** (AGENTS.md): identificadores `municipalityZoneNeighborhoods` (existente), `build-municipality-zone-geometries.mjs`, `bahia-municipality-zones.topo.json`, `getMunicipalityZoneFeature(slug)`; strings UI em pt-BR.

## Questões em aberto — fechadas na F2 (2026-07-26)

- **Malha de bairros: IBGE 2022 vs GeoSalvador?** → **A (IBGE `BA_bairros_CD2022`)**, sem pivô. O spike deu **170/170** polígonos de Salvador atribuídos e **19/19** zonas cobertas; os unmatched críticos que disparariam GeoSalvador (>10% dos bairros TRE sem polígono) não apareceram. Custo: `shpjs` como devDependency, porque o IBGE só publica SHP (SIRGAS 2000) nesse recorte.
- **Chave do coroplético: `municipalitySlug` ou `ibgeCode` + overlay?** → **híbrido A+B**, com um ajuste sobre a recomendação: o polígono municipal de Salvador **não sumiu**, ficou desenhado por baixo como **base sem dado e sem pointer**. Duas malhas simplificadas de forma independente não fecham na mesma linha de costa, e apagar o polígono municipal abria sliver de fundo no contorno do estado. A base não entra no índice de chaves, então não há dupla contagem visual nem alvo duplo de hover — o risco que a recomendação original queria evitar.

## Abordagem proposta

```mermaid
flowchart TD
  treSSA["TRE-BA RA 02/2017<br/>ZE → bairros Salvador"] --> catalog["src/lib/municipalityZoneNeighborhoods.ts<br/>+ fixture (F1 ✓)"]
  catalog --> ui["Bloco Bairros<br/>municipios/slug overview (F1 ✓)"]
  catalog --> reconcile["Reconciliação nomes<br/>↔ NM_BAIRRO IBGE/Geo"]
  ibge["BA_bairros_CD2022<br/>(ou GeoSalvador)"] --> script["scripts/build-municipality-zone-geometries.mjs"]
  reconcile --> script
  script --> topo["bahia-municipality-zones.topo.json"]
  topo --> map["BahiaMap + municipalityMapData<br/>Município-zona = feature própria"]
```

Componentes:

- **`src/lib/municipalityZoneNeighborhoods.ts`** _(F1, existente)_ — catálogo estático Salvador indexado por `municipalitySlug`; helpers `municipalityZoneNeighborhoodEntryForSlug(slug)` + `municipalityZoneNeighborhoodSourceLabel(source)`; cabeçalho de proveniência. Fixture `tests/fixtures/municipality-zone-neighborhoods.official.json` + int (19 zonas, sem bairro órfão duplicado). **F2 prep:** refatorar para autorar só `{ municipalitySlug, source, neighborhoods[] }` e hidratar `city`/`zoneNumber` de `getMunicipalityCatalogEntry` (ver seção abaixo).
- **UI detalhe** _(F1, existente)_ (`municipios/[slug]/page.tsx` overview): se `view.kind === 'zona'`, `MunicipalityZoneNeighborhoodsCard` a partir do helper (sem Payload). Copy: fonte TRE.
- **`scripts/build-municipality-zone-geometries.mjs`** (`pnpm build:municipality-zone-geometries`): baixa/cache malha de bairros (padrão `downloadToBuffer` / cache `data/geometries/`), filtra Salvador, dissolve por zona via catálogo reconciliado (`topojson` merge como TIs), emite `src/lib/geometries/bahia-municipality-zones.topo.json`; reporta bairros sem match.
- **`src/lib/bahiaGeometries.ts`** (ou módulo irmão profundo, sem pass-through): `getMunicipalityZoneFeature(slug)` + tipo da topologia; decode lazy como o restante das geometrias (B5 F1 já entregue no hardening — seguir `loadMunicipalityGeometryModule`).
- **`municipalityMapData.ts` / `municipalityMapContract.ts` / `MunicipalityMapPanel` / `BahiaMap`:** valores por `municipalitySlug` (ou chave estável da feature) para Municípios-zona; remover/ajustar copy “sem polígono oficial”; manter disclaimer de aproximação. `zoneBreakdown` pode permanecer como lista ou virar highlight no mapa. Tipos do bundle vivem em `municipalityMapContract.ts` (client-safe) — estender lá.
- **Depth check:** reusar padrão B2 (`bahiaGeometries`, `build-bahia-geometries`, fixtures); não criar collection de geometria; não segundo Leaflet stack.
- **Migration:** Sem migration, sem collection, sem server action.

### Fases

| Fase      | Entrega                                                                                     | Appetite      |
| --------- | ------------------------------------------------------------------------------------------- | ------------- |
| F1 ✓      | Catálogo + testes + bloco no município (entregue; Salvador-only desde M1)                   | ~1 dia        |
| F2 prep ✓ | Hidratação via `municipalityCatalog` + teste ordem de slugs (S1+S3; **S2 cortado**, abaixo) | ~½ dia        |
| F2 ✓      | Spike cobertura malha → script → TopoJSON → mapa (entregue 2026-07-26)                      | ~1,5–2,5 dias |

**F2 prep** (débitos pós-`/simplify`, capture-review-debts 2026-07-21 — não item paralelo no roadmap):

1. **S1 — Hidratar identidade do catálogo:** autorar entradas como `{ municipalitySlug, source, neighborhoods[] }`; derivar `city` e `zoneNumber` de `getMunicipalityCatalogEntry(slug)` em `entry()` ou no read path (padrão `municipalityElectionGeographyForSlug`). Reduz campos duplicados e risco de drift antes do dissolve.
2. **S2 — Fonte única TS ↔ fixture:** o script `build-municipality-zone-geometries.mjs` (ou gerador irmão) emite `municipalityZoneNeighborhoods.ts` a partir de `municipality-zone-neighborhoods.official.json` (ou o inverso com JSON como canônico de evidência). Elimina linhas espelhadas; `evidenceSha256` permanece no fixture.
3. **S3 — Ordem de slugs:** int leve `municipalityZoneNeighborhoods.map(e => e.municipalitySlug)` vs slugs `kind === 'zona'` de `municipalityCatalog` (alinha ao snapshot do catálogo).

## Dependências

- **Dura:** R2 (mapa + detalhe) — entregue e em produção (2026-07-23).
- **Suave:** padrão B2 geometrias; B7 (filtro do mapa) entregue — B8 respeita o mesmo `buildMunicipalityListWhere`.
- Reusa: `municipalityCatalog`, `MunicipalityMapPanel`, `BahiaMap`, `municipalityMapData`/`municipalityMapContract`, `bahiaGeometries` / script B2.

## Não escopo

- Geocodificação de seções / unidade = seção → permanece **fora de escopo** no roadmap.
- Camada ZE para toda a Bahia / B4 histórico (dissolve multi-município) — não reabrir.
- **Camaçari** (município inteiro desde M1) — só volta se o modelo territorial mudar.
- E5 Salvador por bairro como unidade operacional (supersedido; aqui bairro é **atributo** do Município-zona).
- Filtro URL do mapa → **B7** (entregue); `setStyle` incremental → **B6** (entregue).
- PostGIS; edição de geografia no admin.

## Rabbit holes

- **Geocodificar seções “só para fechar o polígono”.** Semanas + cascos frágeis. **Mitigação:** dissolve por bairro + gaps manuais; seções fora deste item.
- **Reconciliação perfeita de 100% dos nomes TRE↔IBGE.** Explode o appetite. **Mitigação:** cobertura mínima documentada (ex. ≥90% Salvador); lista de unmatched no script; gaps manuais só nos críticos.
- **Desenhar 19 polígonos à mão no QGIS sem catálogo.** Irrepetível e sem teste. **Mitigação:** F1 obrigatória (feita); manual só para unmatched.
- **Tratar polígono derivado como limite oficial TSE.** Risco jurídico/comunicação. **Mitigação:** copy “aproximação a partir de bairros; não é limite oficial”.

## F2 as-built (2026-07-26)

**Artefato.** `src/lib/geometries/bahia-municipality-zones.topo.json` — **72.310 bytes** (~20 KB gzip; budget de 600 KB do padrão B2 sobrou inteiro), objeto `municipalityZones`, 19 features com `properties: { municipalitySlug, name, zoneNumber, ibgeCode }`. Gerado por `pnpm build:municipality-zone-geometries` (`scripts/build-municipality-zone-geometries.mjs`, flag `--report` para só reconciliar sem escrever), que baixa/cacheia `BA_bairros_CD2022.zip` em `data/geometries/` (gitignored), parseia com `shpjs`, filtra `CD_MUN === '2927408'`, simplifica no quantil 0.35, dissolve por zona com `topojson.merge` e quantiza em 1e4 — mesma ordem do irmão `build-bahia-geometries.mjs`, e como ele **não toca o banco**. Consumo lazy por `loadMunicipalityZoneGeometryModule()` (`bahiaMunicipalityZoneGeometries.ts`), no padrão memoizado de B5 F1: o grafo default do `/campanha` não paga o decode.

**Reconciliação (a parte que não é código).** Três tabelas curadas no cabeçalho do script, cada linha com a evidência:

- `IBGE_TO_TRE_NEIGHBORHOOD` — 7 aliases de grafia/composição (`Beiru/Tancredo Neves`, CAB, ilhas da baía).
- `TRE_NEIGHBORHOODS_MERGED_INTO` — bairro da resolução sem polígono próprio no IBGE (Jardim Cruzeiro dentro de Vila Ruy Barbosa). O build **recusa** um merge cujos dois lados caiam em zonas diferentes.
- `SPLIT_NEIGHBORHOOD_ZONES` — Periperi, que a RA 02/2017 corta na Rua das Pedrinhas entre duas zonas, vai **inteiro** para a ZE 17: o bairro é o átomo geométrico disponível, e partir polígono por descrição de rua era o rabbit hole que este plano já recusava.

Atribuição em dois passes: (1) nome citado pela resolução; (2) **maior fronteira compartilhada** para os 5 bairros que a RA nunca nomeia (Ilha Amarela, Dois de Julho, Chame-Chame, Horto Florestal, Mirantes de Periperi). O passe 2 foi **validado**, não assumido: rodado sobre os 4 bairros que a resolução nomeia sob outro rótulo, ele reproduz a zona oficial nos 4. O build falha se sobrar polígono órfão ou bairro TRE sem polígono — hoje 170/170 → 19/19.

**Re-keying (o que mudou fora do mapa).** Map key = `kind === 'zona' ? municipalitySlug : ibgeCode`, via `mapKeyForMunicipality` + `buildMunicipalitiesByMapKey` (`municipalityMapNavigation.ts`). O bundle inteiro passou a ser keyed por ela (`valuesByYear`, `values2026ByScenario`, `validVotesByYear`, `diffByYear`, `territorialClassByMapKey`, `projectedValidVotesByMapKey`, `municipalitiesByMapKey`); os rollups pararam de acumular com `+=` porque cada chave é agora 1:1, e por isso `computeAggregateTerritorialClass` deu lugar a `computeMunicipalityTerritorialClass`. `resolveMunicipalityMapNavigation` virou 1:1 e o ramo `kind: 'zones'` morreu junto com a copy "toque de novo para ver as zonas" e o scroll-anchor do painel. `buildMunicipalitiesByIbgeCode` sobrevive intacto: o href de lista do **B14 ✓** é por cidade, de propósito.

**Rank competitivo continua por cidade.** O artefato TSE (v3) só tem `federalRankByIbgeCode`, então as 19 zonas herdam a posição da cidade inteira — exatamente o que a legenda da escala "posição no município" já afirma. Int novo pina que as 19 compartilham **uma** posição, para que a limitação seja um invariante testado e não uma surpresa. Rank por ZE exigiria uma dimensão nova no artefato (gatilho abaixo).

**Mapa.** `BahiaMap` monta a camada de município a partir de duas malhas (`loadLayerFeatures`), com o polígono municipal de Salvador desenhado por baixo como base sem dado e sem pointer (`baseKeys`). `keyPropertyForMode`/`featureKeyFromProperties` deram lugar a `featureMapKey` (`municipalitySlug ?? codarea ?? code` — as três nunca coexistem, então o argumento de modo era supérfluo); `fitMapToHighlights` passou a medir os paths desenhados (`pathByKeyRef`) em vez do módulo de geometria, que já não sabe sozinho de qual malha veio a chave, e `geometryModuleRef` foi apagado.

**Dois fatos medidos (não re-derivar).** (1) O polígono municipal de Salvador tem **~690 km²** e a soma das 19 zonas **~324 km²**: a diferença é a água da baía que o limite municipal encerra e a malha de bairros não desenha. Por isso o int de área compara contra a área de **terra** (280–360 km²) e não contra o município — a primeira versão do teste, que exigia ≥95% de razão, estava medindo terra contra terra+água. (2) Centróide-dentro-de-outra-zona **não** é teste de sobreposição válido aqui: a ZE 16 é concava e envolve a ZE 14, então o centróide da 16 cai legitimamente na 14. A não-sobreposição é garantida estruturalmente (cada bairro entra em exatamente uma zona, verificado no build) mais a soma de áreas.

**Testes.** Int de contrato do artefato (19 features, slugs == catálogo `kind === 'zona'`, budget, centróide de cada zona dentro do polígono municipal de Salvador, área somada); int de rank compartilhado; unit de `featureMapKey` e de `mapKeyForMunicipality`/`buildMunicipalitiesByMapKey`; e2e `campaignZoneMap.e2e.spec.ts` — 436 paths / 435 interativos (o único não-interativo é a base de Salvador), readout "Salvador — ZE N" e clique abrindo `/campanha/municipios/salvador-ze-N`.

**Gate.** tsc, lint, format, knip (P3 pré-existente em `payload.config.ts`), `check:cycles`, unit+int, e2e e build rodados. **Aikido não fechou:** o scanner responde Opengrep exit code 2 em qualquer entrada, inclusive num arquivo-probe trivial de uma linha, então os achados que ele reportou são artefato da execução quebrada e não são atribuíveis; o feed do Aikido não lista nada deste repo. SCA do `shpjs` (devDependency nova) também pendente — ambos registrados como débito abaixo.

## Já resolvido no simplify/critique (não reabrir)

- **JR1** — `MunicipalityZoneNeighborhoodsCard`: um lookup `municipalityZoneNeighborhoodEntryForSlug` (sem duplo hit no `entryBySlug`).
- **JR2** — export wrapper redundante removido.
- **JR3** — guard do card: `!entry?.neighborhoods.length`.
- **JR4** — assert de integridade só no módulo (não exportado).
- **JR5** — testes redundantes de sort e checksum duplicado removidos do int spec.
- **JR6** — cobertura usa `zoneMunicipalities.length` em vez de constante fixa.
- **JR7** — _(histórico)_ exclusividade de Camaçari sem teste — obsoleto: Camaçari saiu do catálogo na M1.
- Impeccable compacto na F1: sem snapshot `.impeccable/critique/` nem P0–P3 abertos nesta superfície; polish visual amplo → **R6**.
- **JR8** _(F2)_ — comentário de `NearbyMunicipalityResolution.zoneCity` que afirmava não existirem polígonos de zona: corrigido para dizer que existem e que o card **deliberadamente** não os usa.
- **JR9** _(F2)_ — duas asserções do int de bairros que a hidratação da Fase 0 tornou tautológicas (comparavam `city`/`zoneNumber` com o catálogo de onde acabaram de ser copiados) removidas; a verificação real segue no `deepEqual` contra o fixture transcrito à mão.
- **JR10** _(F2)_ — o script re-indexava geometrias simplificadas por **nome** de bairro; passou a usar `id` próprio (o irmão usa `codarea`, único por construção). Hoje são 170 nomes distintos, mas um nome repetido em malha futura colapsaria dois polígonos em silêncio dentro de um artefato commitado. Rebuild saiu byte-idêntico.

## Explicitamente fora (skips `/simplify` + descartes do triage)

- **S4 — Remover assert de integridade no import.** Fail-fast no import é aceitável aqui; int spec já cobre slugs zona.
- **S5 — Incluir `source` no SHA-256 canônico.** `deepEqual` fixture↔código já detecta mudança de `source`.
- **S7 — Tipo de cidade paralelo.** Absorvido por S1 se F2 prep rodar (hoje `MunicipalityZoneNeighborhoodCity = 'Salvador'`).
- **S8 — Proveniência em 3 camadas** (header TS, fixture `provenance`, `municipalityZoneNeighborhoodSourceLabel`). Padrão aceitável para catálogo com copy UI por `source`.
- **S9 — Double gate** `view.kind === 'zona'` na página + card `null`. Defesa em profundidade; não simplificar só por DRY.
- **S10 — `key={neighborhood}` no card.** Seguro com exclusividade Salvador testada.

## Débitos do `/simplify` da F2 → B8+

Os relatórios dos três revisores chegaram **depois** do merge; o cleanup barato entrou antes (ver "Já resolvido"), e os quatro achados maiores viraram o fill-in **B8+**: [escala-dry-pos-b8f2.md](escala-dry-pos-b8f2.md) — a malha de 19 zonas com a densidade de vértices da malha estadual (as duas constantes de simplificação são relativas ao bbox), o buraco de teste da map key, a falha de chunk das zonas derrubando o mapa inteiro (mais a ressalva de aproximação sumindo no modo comparação), e o que a entrega orfanou.

## Adiado com gatilho

- **S6 — CSS compartilhado lista zona** (`MunicipalityMapPanel` zone breakdown ↔ `MunicipalityZoneNeighborhoodsCard`). **Gatilho disparou** na F2 (o painel foi alterado) e foi reavaliado: as duas listas continuam pequenas e com estrutura diferente, então extrair peça compartilhada agora seria abstração por coincidência visual. Segue adiado, agora com gatilho único: **R6** citar a duplicação em ≥2 superfícies de zona.
- **F2-D1 — card "Onde estou" (B14 ✓) resolver a ZE exata de Salvador.** Os polígonos passaram a existir nesta entrega, e `featureContainsPoint` já é genérico o suficiente para recebê-los; o card continua levando à lista filtrada por decisão. **Gatilho:** pedido de campo ("estou em Salvador e quero abrir minha zona"). Custo real é uma segunda malha no chunk do card, não matemática nova. Aresta já registrada no grafo do roadmap.
- **F2-D2 — rank competitivo por ZE.** Exige dimensão nova no artefato TSE (hoje `federalRankByIbgeCode`), o que mexe no budget de 700 KB. **Gatilho:** E11 pedir o eixo de competição dentro de Salvador, ou o dossiê de um Município-zona exibir posição própria. Hoje as 19 zonas herdam a posição da cidade, com int pinando o fato.
- **S2 — fonte única TS ↔ fixture do catálogo de bairros** (gerar `municipalityZoneNeighborhoods.ts` a partir do JSON). **Cortado na F2 prep:** a curadoria que a F2 exigia foi para o **script** de geometrias, não para o catálogo, então o gerador não teria a quem servir; o `deepEqual` fixture↔código já pega drift. **Gatilho:** um terceiro consumidor precisar do catálogo em runtime não-TS.
- **Malha GeoSalvador em vez de IBGE.** Revisitar quando: spike F2 mostrar unmatched críticos em Salvador (>10% bairros TRE sem polígono).
- **Camada ZE estadual (B4 antigo).** Revisitar quando: produto pedir mapa de ZE fora de Salvador (improvável neste ciclo).

## Referências

- `docs/roadmap.md` (B8; fora de escopo estreitado; supersedido B4)
- `docs/plans/mapa-bahia-geometrias.md` — padrão estático + dissolução; B4 histórico (multi-município)
- `docs/plans/remodelagem-municipios.md` — M1 (Camaçari inteira; rename `plaza*`→`municipality*`); precedente: `remodelagem-pracas.md`
- `docs/plans/mapa-pracas-filtrado.md` — B7 (filtro; entregue)
- `src/utilities/municipalityMapData.ts`, `src/utilities/municipalityMapContract.ts`, `src/components/campaign/MunicipalityMapPanel.tsx`, `src/lib/municipalityCatalog.ts`, `src/lib/municipalityZoneNeighborhoods.ts`, `src/lib/bahiaGeometries.ts`, `scripts/build-bahia-geometries.mjs`
- TRE-BA RA 02/2017 Anexo I; [rezoneamento](https://www.tre-ba.jus.br/servicos-eleitorais/rezoneamento)
- IBGE `BA_bairros_CD2022.zip` (geoftp)
- AGENTS.md — geometrias B2, naming, modelo Municípios
- `PRODUCT.md` / `DESIGN.md` — Field Desk / Restrained
