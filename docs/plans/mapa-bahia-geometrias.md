# Mapa da Bahia na campanha — geometrias estáticas + Leaflet

Status: rascunho
Atualizado em: 2026-07-17
Item do roadmap: [docs/roadmap.md](../roadmap.md) (seção "Campanha → Próximos ciclos")
Responsável: —

## Contexto

O roadmap (linha 52) prevê "Mapa / PostGIS: Leaflet, geometria/point, imagem Docker PostGIS; âncora `/mapa` do design-ux adiada". Este plano destrincha esse item para a vertical `/campanha`: preparar o webapp para representar o mapa da Bahia (municípios + Territórios de Identidade) e usar esse mapa para visualizar agregados da campanha de forma mais clara.

Hoje o `electoralNucleus` (`src/collections/ElectoralNucleus.ts`) indexa território por texto (`region`/`city`/`neighborhood`/`tseZones`) e as agregações saem de queries Payload por essas chaves (`src/utilities/campaignDashboardPageData.ts`, `src/utilities/nucleusViewModels.ts`). Não há nenhuma geometria. A decisão de produto (2026-07-17) é adotar **geometrias estáticas versionadas no repo** (mesmo padrão de `src/lib/bahiaTerritories.ts`), sem PostGIS, e integrar Leaflet nas superfícies já existentes — a âncora `/mapa` do design-ux permanece adiada.

## Decisões travadas (confirmadas com o usuário)

- **GeoJSON/TopoJSON estático versionado no repo**, sem PostGIS. Mesmo padrão de `src/lib/bahiaTerritories.ts` (dado versionado com proveniência + fixture + teste int).
- **v1 cobre municípios (IBGE) + Territórios de Identidade (IDE Bahia).** Zonas TSE como camada ficam para um ciclo seguinte (dependem de `zonas-por-municipio`).
- **`/mapa` dedicada do design-ux permanece adiada.** v1 incorpora o mapa em superfícies já existentes: overview da lista de núcleos, detalhe do núcleo e dashboard `/campanha`.
- **Zona segue como granularidade eleitoral de referência** do núcleo — não mapear núcleo a seções (ver "Granularidade seção vs. zona").
- **Sem migration, sem collection, sem Consent, sem server action nova.** Só dado estático + componentes cliente + agregações já existentes.

## Por que estático e não PostGIS

O `electoralNucleus` já indexa território por texto e as agregações saem de queries Payload por essas chaves — não há query espacial (point-in-polygon, raio, geocodificação) no horizonte curto. PostGIS adicionaria imagem Docker PostGIS local, extensão no Neon, colunas `geometry` + migrations e um endpoint de serving, sem benefício imediato. PostGIS só volta à mesa se surgir query espacial real (ex.: geocodificar endereços de apoiadores, busca por raio). Movido para "Fora de escopo por enquanto" no roadmap.

## Fontes oficiais (pesquisa)

- **Municípios (BA):** IBGE Malha Municipal 2024. GeoJSON/TopoJSON via API `https://servicodados.ibge.gov.br/api/v3/malhas/estados/29?formato=application/vnd.geo+json&intrarregiao=municipio` (resolução 1–2 ideal para web; `codarea` = código IBGE de 7 dígitos). Shapefile em `geoftp.ibge.gov.br/.../municipio_2024/UFs/BA/`. CRS SIRGAS 2000 (EPSG:4674) ≈ WGS84 para web (diferença sub-metro, irrelevante em escala municipal).
- **Territórios de Identidade:** IDE Bahia / SEI publica polígono vetorial oficial 1:100.000 (2019, EPSG:4674): `https://metadados.ide.ba.gov.br/geonetwork/srv/api/records/90b140bf-17df-496f-b048-5783fdf02864` (Shapefile + KML). Configuração vigente desde 2016 (a mesma de `bahiaTerritories.ts`). Não precisamos dissolver.
- **Zonas TSE:** o TSE **não** publica polígonos — só o cadastro tabular "Eleitorado por município e zona" (composição município→zona) e os endereços de locais de votação/seções. Polígonos só por construção derivada (aproximação; padrão da literatura). Fica fora da v1.

## Granularidade seção vs. zona

Hierarquia TSE: município → (1+) zona → (muitas) seção; a relação município↔zona é muitos-para-muitos (uma cidade pode ter várias zonas; uma zona pode cobrir vários municípios pequenos). Decisão (2026-07-17): **manter zona como granularidade eleitoral de referência** do núcleo, não seções, porque:

1. O núcleo é unidade operacional da campanha, não eleitoral — o coordenador pensa em bairro/município/território.
2. O cruzamento com a baseline TSE 2022 (`baseline-eleitoral-tse`) é por zona.
3. Não existe mapeamento oficial seção↔bairro — não dá para auto-derivar as seções do bairro do núcleo; seria manual e frágil, e números de seção mudam entre eleições.
4. Caso sub-zona (núcleo menor que a zona) é o único em que seção traria precisão; hoje a baseline da zona sobre-cobre o núcleo (aproximação aceitável, documentada como limitação).

## Modelagem de dados

- **Arquivos de geometria** (TopoJSON, menor que GeoJSON) commitados no repo:
  - `src/lib/geometries/bahia-municipalities.topojson` — uma Feature por município, `properties: { codarea, name }`.
  - `src/lib/geometries/bahia-identity-territories.topojson` — uma Feature por território, `properties: { code, name }` (`code` = "01".."27", já existe em `bahiaIdentityTerritoryRecords`).
- **Join por chave estável:**
  - Municípios: o núcleo guarda `city` (nome). Precisamos de `name → codarea`. Criar `src/lib/bahiaMunicipalityCodes.ts` (record nome→código IBGE de 7 dígitos) com proveniência + fixture `tests/fixtures/bahia-municipality-codes.official.json` + teste `tests/int/bahiaMunicipalityCodes.int.spec.ts` (espelha `bahiaTerritories`). Necessário porque nomes IBGE ≠ nomes SECULT canônicos (acentos, "Dias D'Ávila", etc.) — a tabela reconcilia.
  - Territórios: join por `code` (01–27) já presente em `bahiaIdentityTerritoryRecords`; sem tabela extra.
- **Proveniência e versionamento:** cada arquivo `.topojson` e cada tabela estática com cabeçalho/documentação de proveniência (URL, versão/ano, SHA-256 do download de origem), no estilo de `bahiaTerritories.ts`.

## Script de geração (one-off, re-executável)

- `scripts/build-bahia-geometries.mjs`: baixa IBGE (API) + IDE Bahia (shapefile), converte/simplifica com `topojson-server` + `topojson-simplify` (ou `@turf/simplify`), emite os `.topojson` e a tabela `bahiaMunicipalityCodes.ts`. Não roda em build/dev — só quando se atualiza a versão de origem. Mesmo guard de não-produção dos outros scripts (não toca prod).

## Leaflet na campanha

- Dependência: `leaflet` + `topojson-client` (cliente). `react-leaflet` é opcional; preferir wrapper cliente fino com `leaflet` direto e `dynamic(() => import(...), { ssr: false })` para evitar SSR.
- **Base tiles:** OpenStreetMap raster (ou CartoDB Positron) com atribuição obrigatória; ou fundo neutro sem tiles (só coroplético) como opção mais leve. Decidir na implementação; default OSM.
- **Componentes novos (todos `src/components/campaign/`, PascalCase):**
  - `BahiaMap.tsx` — cliente, recebe `geometry` (TopoJSON) + `values: Record<string, number>` (chave→métrica) + `mode: 'municipality' | 'territory'` + `colorScale`; renderiza coroplético Leaflet.
  - `NucleusOverviewMap.tsx` — mapa no overview de `/campanha/nucleos`, escopado pelos mesmos filtros da lista, com toggle município/território e escolha da métrica (estimativa confirmada, nº de núcleos, baseline 2022 Solla quando disponível).
  - `NucleusDetailMap.tsx` — mapa pequeno no detalhe do núcleo destacando seus municípios/território (+ marcadores ponto das zonas TSE, quando a camada de zonas existir).
  - `DashboardMap.tsx` — coroplético por território no dashboard `/campanha`.
- **Agregação:** servidor continua a fonte. Reusar `campaignDashboardPageData` / `nucleusViewModels` e expor agregados por `codarea`/`code` de território; o cliente junta com a geometria. Sem query espacial.

## Phasing

- **Fase 1 — Fundação de geometrias:** `bahiaMunicipalityCodes.ts` + fixture + teste; `.topojson` de municípios e territórios; script de geração; helpers `getMunicipalityFeature(codarea)`, `getTerritoryFeature(code)`.
- **Fase 2 — Leaflet nas superfícies:** `BahiaMap` + `NucleusOverviewMap` + `NucleusDetailMap` + `DashboardMap`, com agregados existentes.

**Sequenciamento (2026-07-17):** a Fase 1 é independente e paralelizável a qualquer momento. A Fase 2 rende mais **depois** de [overview-lista-nucleos.md](overview-lista-nucleos.md) (o `NucleusOverviewMap` é um bloco daquele painel) e ganha muito valor com [baseline-eleitoral-tse.md](baseline-eleitoral-tse.md) implementado (coroplético de baseline 2022 e da classificação territorial é onde o mapa vira instrumento de decisão, não só visual). Nenhum dos dois é bloqueante — o mapa funciona só com estimativa/nº de núcleos — mas a ordem recomendada no roadmap coloca overview e baseline antes.

## Ciclo seguinte — Zonas TSE como camada

Após `zonas-por-municipio`. Polígono por dissolução dos municípios membros (abordagem A, default) ou por geocodificação dos endereços das seções → casco convexo/côncavo (abordagem B, questão em aberto). Ponto representativo por centroide da zona. Item separado no roadmap.

- **(A) Dissolução dos municípios membros:** o TSE publica quais municípios compõem cada zona; como a v1 já terá os polígonos municipais (IBGE), basta dissolver os municípios de cada zona. Limpo, alinhado às divisas oficiais, sem geocodificação, sem serviço externo. Mais fiel porque usa a composição oficial.
- **(B) Geocodificar endereços das seções/locais de votação → casco:** pegar os locais de votação de cada zona, geocodificar (OSM Nominatim com rate-limit, IBGE logradouros, ou geocoder pago) e gerar o polígono. Independente do mapeamento município→zona, mas: milhares de endereços para geocodificar em batch offline, locais de votação se concentram em centros urbanos (casco irregular, áreas rurais cobertas mal), e pode divergir da composição oficial do TSE.

## Não escopo

- PostGIS (adiado; só se surgir query espacial real).
- `/mapa` dedicada do design-ux (adiada).
- Camada de Zonas TSE — polígono ou ponto (ciclo seguinte; depende de `zonas-por-municipio`).
- Mapear núcleo a seções eleitorais (zona segue como referência).
- Geocodificação de endereços de apoiadores.
- Outros estados (todo núcleo é BA).

## Dependências

- Reusa `bahiaIdentityTerritoryRecords`/`bahiaMunicipalities` (`src/lib/bahiaTerritories.ts`), `CitiesByState.BA` (`src/lib/cities`), `campaignDashboardPageData` / `nucleusViewModels` (agregados existentes), e o padrão de fixture/teste de `bahiaTerritories`.
- **Camada de Zonas** depende de `docs/plans/zonas-por-municipio.md`.

## Referências

- `docs/roadmap.md` (item "Mapa / PostGIS", linha 52; "Import do cadastro oficial de zonas TSE", linha 59)
- `src/lib/bahiaTerritories.ts` + `tests/fixtures/bahia-identity-territories.official.json` + `tests/int/bahiaTerritories.int.spec.ts` (padrão a espelhar)
- `src/collections/ElectoralNucleus.ts`, `src/utilities/campaignDashboardPageData.ts`, `src/utilities/nucleusViewModels.ts` (agregados a reusar)
- `docs/plans/zonas-por-municipio.md` (dependência da camada de Zonas)
- `docs/plans/baseline-eleitoral-tse.md` (baseline por zona, consumidor do mapa)
- AGENTS.md (naming, "Bahia implícita", padrão de dado estático versionado)
- IBGE — API de Malhas: https://servicodados.ibge.gov.br/api/docs/malhas
- IDE Bahia / SEI — Territórios de Identidade 1:100.000: https://metadados.ide.ba.gov.br/geonetwork/srv/api/records/90b140bf-17df-496f-b048-5783fdf02864
