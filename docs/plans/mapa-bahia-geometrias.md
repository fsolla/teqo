# Mapa da Bahia na campanha — geometrias estáticas + Leaflet

Status: Fase 1 entregue (B2); Fase 2 (B3 Leaflet) pendente
Atualizado em: 2026-07-18
Item do roadmap: [docs/roadmap.md](../roadmap.md) — B2 (Fase 1) / B3 (Fase 2) / B4 (camada de zonas); lazy load e DRY de scripts → [B5](escala-dry-pos-b2.md)
Responsável: —

## Contexto

O roadmap (trilha B) prevê o mapa da Bahia na vertical `/campanha`: preparar geometrias estáticas (municípios + Territórios de Identidade) e usá-las para visualizar agregados da campanha. A âncora `/mapa` do design-ux permanece adiada.

O `electoralNucleus` indexa território por texto (`regions`/`cities`/`neighborhoods`/`tseZones` — arrays `hasMany` desde A1) e as agregações saem de queries Payload por essas chaves. Não há query espacial. A decisão de produto (2026-07-17) é adotar **geometrias estáticas versionadas no repo** (mesmo padrão de `src/lib/bahiaTerritories.ts`), sem PostGIS, e integrar Leaflet nas superfícies já existentes.

## Decisões travadas (confirmadas com o usuário)

- **GeoJSON/TopoJSON estático versionado no repo**, sem PostGIS. Mesmo padrão de `src/lib/bahiaTerritories.ts` (dado versionado com proveniência + fixture + teste int).
- **v1 cobre municípios (IBGE) + Territórios de Identidade.** Zonas TSE como camada ficam para B4 (dependem de A2 ✓ + B3).
- **Territórios de Identidade por dissolução IBGE** (decisão 2026-07-18): polígonos dos TIs saem de `topojson.merge` dos municípios IBGE conforme a composição oficial em `bahiaIdentityTerritoryRecords` — não do shapefile IDE Bahia. A IDE Bahia fica como referência de validação na proveniência. Garante coerência mapa ↔ composição do app e antecipa a abordagem A do B4.
- **Extensão `*.topo.json`** (não `.topojson`) para import JSON nativo no Next/TS sem config extra.
- **`/mapa` dedicada do design-ux permanece adiada.** v1 (B3) incorpora o mapa em superfícies já existentes: overview da lista de núcleos, detalhe do núcleo e dashboard `/campanha`.
- **Zona segue como granularidade eleitoral de referência** do núcleo — não mapear núcleo a seções (ver "Granularidade seção vs. zona").
- **Sem migration, sem collection, sem Consent, sem server action nova.** Só dado estático + componentes cliente + agregações já existentes.

## Por que estático e não PostGIS

O `electoralNucleus` já indexa território por texto e as agregações saem de queries Payload por essas chaves — não há query espacial (point-in-polygon, raio, geocodificação) no horizonte curto. PostGIS adicionaria imagem Docker PostGIS local, extensão no Neon, colunas `geometry` + migrations e um endpoint de serving, sem benefício imediato. PostGIS só volta à mesa se surgir query espacial real (ex.: geocodificar endereços de apoiadores, busca por raio). Movido para "Fora de escopo por enquanto" no roadmap.

## Fontes oficiais (pesquisa)

- **Municípios (BA):** IBGE Malhas API v3 (`qualidade=intermediaria`) + Localidades API v1 para `id`/`nome`. `codarea` = código IBGE de 7 dígitos. CRS SIRGAS 2000 (EPSG:4674) ≈ WGS84 para web.
- **Territórios de Identidade:** composição oficial em `bahiaTerritories.ts` (SECULT/SEPLAN); polígonos = dissolução dos municípios IBGE. IDE Bahia / SEI (referência de validação): `https://metadados.ide.ba.gov.br/geonetwork/srv/api/records/90b140bf-17df-496f-b048-5783fdf02864`.
- **Zonas TSE:** o TSE **não** publica polígonos — só o cadastro tabular. Polígonos só por construção derivada. Fica fora da v1 (B4).

## Granularidade seção vs. zona

Hierarquia TSE: município → (1+) zona → (muitas) seção; a relação município↔zona é muitos-para-muitos. Decisão (2026-07-17): **manter zona como granularidade eleitoral de referência** do núcleo, não seções, porque:

1. O núcleo é unidade operacional da campanha, não eleitoral — o coordenador pensa em bairro/município/território.
2. O cruzamento com a baseline TSE 2022 (`baseline-eleitoral-tse`) é por zona.
3. Não existe mapeamento oficial seção↔bairro — não dá para auto-derivar as seções do bairro do núcleo; seria manual e frágil, e números de seção mudam entre eleições.
4. Caso sub-zona (núcleo menor que a zona) é o único em que seção traria precisão; hoje a baseline da zona sobre-cobre o núcleo (aproximação aceitável, documentada como limitação).

## Modelagem de dados

- **Arquivos de geometria** (TopoJSON) commitados no repo:
  - `src/lib/geometries/bahia-municipalities.topo.json` — uma Feature por município, `properties: { codarea, name }` (name = canônico do app).
  - `src/lib/geometries/bahia-identity-territories.topo.json` — uma Feature por território, `properties: { code, name }` (`code` = "01".."27").
- **Join por chave estável:**
  - Municípios: o núcleo guarda `cities[]` (array de nomes, desde A1). Tabela `src/lib/bahiaMunicipalityCodes.ts` (nome canônico → código IBGE de 7 dígitos) + fixture `tests/fixtures/bahia-municipality-codes.official.json` + teste `tests/int/bahiaMunicipalityCodes.int.spec.ts`. Reconciliação IBGE→canônico via `canonicalizeMunicipalityName` (`src/lib/electionResults.ts`).
  - Territórios: join por `code` (01–27) já presente em `bahiaIdentityTerritoryRecords`; sem tabela extra.
- **Helpers:** `src/lib/bahiaGeometries.ts` — `getMunicipalityFeature(codarea)`, `getTerritoryFeature(code)`, topologias tipadas (framework-free para B3).
- **Proveniência e versionamento:** cada artefato com cabeçalho/documentação de proveniência (URL, SHA-256 do download de origem), no estilo de `bahiaTerritories.ts` / `bahiaTseZones.ts`.

## Script de geração (one-off, re-executável)

- `scripts/build-bahia-geometries.mjs` (`pnpm build:geometries`): baixa IBGE Malhas + Localidades, reconcilia nomes, constrói topologia com `topojson-server` + `topojson-simplify` + `quantize`, dissolve territórios com `topojson-client` `merge`, emite os `*.topo.json`, `bahiaMunicipalityCodes.ts` e o fixture. Cache em `data/geometries/` (gitignored). **Não toca banco** — sem `assertLocalDatabase`. Não roda em build/dev — só quando se atualiza a versão de origem.

## Leaflet na campanha (B3 — pendente)

- Dependência: `leaflet` (+ `topojson-client` já instalado na Fase 1). `react-leaflet` é opcional; preferir wrapper cliente fino com `leaflet` direto e `dynamic(() => import(...), { ssr: false })` para evitar SSR.
- **Lazy load (B5 F1):** não importar `bahiaGeometries` de forma eager no path default de `/campanha`. Preferir split município/TI + `import()` dinâmico no mount do mapa — ver [escala-dry-pos-b2.md](escala-dry-pos-b2.md). Se B3 aplicar isso no mesmo PR, fecha B5 Fase 1.
- **Base tiles:** OpenStreetMap raster (ou CartoDB Positron) com atribuição obrigatória; ou fundo neutro sem tiles (só coroplético) como opção mais leve. Decidir na implementação; default OSM.
- **Componentes novos (todos `src/components/campaign/`, PascalCase):**
  - `BahiaMap.tsx` — cliente, recebe `geometry` (TopoJSON) + `values: Record<string, number>` (chave→métrica) + `mode: 'municipality' | 'territory'` + `colorScale`; renderiza coroplético Leaflet.
  - `NucleusOverviewMap.tsx` — mapa no overview de `/campanha/nucleos`, escopado pelos mesmos filtros da lista, com toggle município/território e escolha da métrica (estimativa confirmada, nº de núcleos, baseline 2022 Solla quando disponível).
  - `NucleusDetailMap.tsx` — mapa pequeno no detalhe do núcleo destacando seus municípios/território (+ marcadores ponto das zonas TSE, quando a camada de zonas existir).
  - `DashboardMap.tsx` — coroplético por território no dashboard `/campanha`.
- **Agregação:** servidor continua a fonte. Reusar `campaignDashboardPageData` / `nucleusViewModels` / `nucleusListOverviewPageData` e expor agregados por `codarea`/`code` de território; o cliente junta com a geometria. Sem query espacial.

## Phasing

- **Fase 1 — Fundação de geometrias (B2) ✓ entregue 2026-07-18:** `bahiaMunicipalityCodes.ts` + fixture + teste; `*.topo.json` de municípios e territórios; script `pnpm build:geometries`; helpers em `bahiaGeometries.ts`.
- **Fase 2 — Leaflet nas superfícies (B3):** `BahiaMap` + `NucleusOverviewMap` + `NucleusDetailMap` + `DashboardMap`, com agregados existentes. Preferir fechar [B5 F1](escala-dry-pos-b2.md) (lazy geometrias) no mesmo PR.

**Sequenciamento:** a Fase 1 é independente e paralelizável. A Fase 2 rende mais depois de B1 ✓ (overview) e ganha valor com A4 (baseline no produto). Nenhum dos dois bloqueia B3 — o mapa funciona só com estimativa/nº de núcleos. B5 F1 é dependência suave de qualidade de bundle.

## Ciclo seguinte — Zonas TSE como camada (B4)

Após A2 ✓ + B3. Polígono por dissolução dos municípios membros (abordagem A, default — já validada na Fase 1 para TIs) ou por geocodificação dos endereços das seções → casco (abordagem B, questão em aberto). Ponto representativo por centroide da zona.

- **(A) Dissolução dos municípios membros:** o TSE publica quais municípios compõem cada zona (`bahiaTseZones`); com os polígonos municipais IBGE, basta dissolver. Limpo, alinhado às divisas oficiais.
- **(B) Geocodificar endereços das seções/locais de votação → casco:** milhares de endereços, casco irregular em áreas rurais, pode divergir da composição oficial.

## Não escopo

- PostGIS (adiado; só se surgir query espacial real).
- `/mapa` dedicada do design-ux (adiada).
- Camada de Zonas TSE — polígono ou ponto (B4; depende de A2 ✓ + B3).
- Mapear núcleo a seções eleitorais (zona segue como referência).
- Geocodificação de endereços de apoiadores.
- Outros estados (todo núcleo é BA).

## Dependências

- Reusa `bahiaIdentityTerritoryRecords`/`bahiaMunicipalities` (`src/lib/bahiaTerritories.ts`), `canonicalizeMunicipalityName` (`src/lib/electionResults.ts`), `CitiesByState.BA` (`src/lib/cities`), `campaignDashboardPageData` / `nucleusViewModels` / `nucleusListOverviewPageData` (agregados para B3), e o padrão de fixture/teste de `bahiaTerritories`.
- **Camada de Zonas (B4)** depende de A2 (`docs/plans/zonas-por-municipio.md`) + B3.
- **Lazy load / DRY CLI (B5):** débitos do `/simplify` pós-B2 — [escala-dry-pos-b2.md](escala-dry-pos-b2.md). F1 preferencialmente com B3; F2 (`ensureCachedDownload`) independente.

## Revisões

- **2026-07-18 (auditoria pré-B2 + entrega Fase 1):** territórios por dissolução IBGE (não shapefile IDE Bahia); extensão `*.topo.json`; reuso de `canonicalizeMunicipalityName`; núcleo usa `cities[]` (A1); script sem guard de banco; referências de linha do roadmap antigas removidas; Fase 1 implementada e marcada entregue.
- **2026-07-18 (B5 registrado):** follow-ups do `/simplify` que não entraram no cleanup (lazy geometrias + cache CLI compartilhado) viraram item B5; B3 deve preferir F1.

## Referências

- `docs/roadmap.md` (B2 / B3 / B4 na trilha B)
- `src/lib/bahiaTerritories.ts` + `tests/fixtures/bahia-identity-territories.official.json` + `tests/int/bahiaTerritories.int.spec.ts` (padrão a espelhar)
- `src/lib/bahiaMunicipalityCodes.ts`, `src/lib/bahiaGeometries.ts`, `src/lib/geometries/*.topo.json`
- `scripts/build-bahia-geometries.mjs`
- `src/collections/ElectoralNucleus.ts`, `src/utilities/campaignDashboardPageData.ts`, `src/utilities/nucleusViewModels.ts`, `src/utilities/nucleusListOverviewPageData.ts` (agregados a reusar no B3)
- `docs/plans/zonas-por-municipio.md` (dependência da camada de Zonas)
- `docs/plans/baseline-eleitoral-tse.md` (baseline por zona, consumidor do mapa)
- AGENTS.md (naming, "Bahia implícita", padrão de dado estático versionado)
- IBGE — API de Malhas: https://servicodados.ibge.gov.br/api/docs/malhas
- IDE Bahia / SEI — Territórios de Identidade 1:100.000 (referência): https://metadados.ide.ba.gov.br/geonetwork/srv/api/records/90b140bf-17df-496f-b048-5783fdf02864
