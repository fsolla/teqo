# Sistema de listas da campanha (Pass 2 — W1)

Status: **entregue** (Pass 2, 2026-07-25)
Atualizado em: 2026-07-25
Item pai: [IMPROVE-CODE-QUALITY-PLAN.md](../IMPROVE-CODE-QUALITY-PLAN.md) — Pass 2, W1 (2 entregas)
Appetite: ~4 dias; sem migration, sem mudança de comportamento visível
Gate: W0 ([pinagem-superficies-lista.md](pinagem-superficies-lista.md)) verde

## Contexto

12 superfícies `ui/Table` no `/campanha`, cada uma com parser de URL, header, paginação e filtros re-implementados por feature. Uma espinha compartilhada já existe pela metade (`campaignListUrl.ts` 6 importers, `CampaignListPagination` 9, `CampaignListPendingBoundary` 8, `CampaignSearchForm` 4) — mas a lista de municípios (a mais rica: sort, filtros no header, células editáveis B9, overview E8/E9) é um monolito (`MunicipalityList.tsx` 496 + `MunicipalityFilters` 354 + `MunicipalityHeaderFilter` 311 + `municipalityUi.ts` 765/59 exports), e as listas de lideranças/organizações/dobradinhas são clones de página com 5 parsers locais duplicados. B17 (seletor de colunas) e B18 (filtros salvos) pousariam em cima disso multiplicado.

## Objetivos

- Definições de coluna como dado: `id`, header, cell renderer, `sortKey?`, `filterDef?`, `mandatory?`, `defaultVisible?`, tratamento mobile.
- Estado de URL genérico (parse/canonicalize/serialize) estendendo `campaignListUrl.ts` — contrato de URL existente **byte-idêntico** (pins de W0 verdes).
- Tabela server-first + ilhas client generalizadas de `MunicipalitySortableHead`/`MunicipalityHeaderFilter`.
- Slots de toolbar (busca, barra de filtros, botões futuros de B17/B18); empty state que mantém o chrome montado (lição de B16); slot de card-stack mobile; paginação/pending pelos shells existentes.
- Superfície migrada = código antigo deletado na mesma entrega (knip limpo).

## Entregas

**D1 — núcleo + lista de municípios.** O sistema nasce extraído da lista mais rica, não inventado: column defs, URL state, ilhas, toolbar. Absorve o **B16+** ([escala-dry-pos-b16.md](escala-dry-pos-b16.md)): hook `useOptimistic` de navegação compartilhado, hrefs de opção a partir de uma base `URLSearchParams`, payload de facet por slugs. **Divide `municipalityUi.ts`** nas costuras naturais (url/filters/sort/labels/freshness). Células de edição inline (B9) viram cell-renderer islands.

**D2 — migra o resto + deleta o superado.** Tripé de entidades (lideranças/organizações/dobradinhas) numa composição de página compartilhada + parsers de `campaignListUrl` (fecha o débito de parser do C8 F3); demandas (`CampaignFilterChips` → filter def); apoiadores (mantém cards mobile); assessores (tabela client adota estado/toolbar/paginação; inline-create continua bespoke).

## Fora do escopo (D5 do sign-off — anti-classitis, documentado)

- `ActionPlanList` — domínio de cards, não de tabela; adota só toolbar/URL state.
- `TerritoryOverviewTable` — exceção documentada de sort no cliente (dataset ≤27 linhas, já carregado).
- `MunicipalityCandidateComparisonTable`, `LeaderContactsPanel`, preview do wizard de import — pequenas/estáticas demais.
- B17/B18 **não são implementados** — o sistema deixa as costuras (visibilidade por column id, serializador de filtros) e para aí.

## Impacto no roadmap

- **Quase de graça depois:** B17 (seletor de colunas = toggle de visibilidade sobre column ids + localStorage), B18 (filtros salvos = serializador + slot na toolbar), "Cenário junto aos filtros" (slot na barra; cenário nunca entra na serialização de URL), ícone de prioridade (accessory slot na célula de nome).
- **Costuras para:** E10/E14 (nova coluna = nova column def + ilha inline opcional), E12 (ponto de extensão de group-mode documentado, não construído).
- **Absorve:** B16+ (plano marcado como absorvido).
- **Conflitos:** precisa terminar antes do trabalho de colunas da janela 3 (~16/08) e antes de B17/B18 entrarem em desenvolvimento.
- **Supersede premissas em:** [seletor-colunas-lista-municipios.md](seletor-colunas-lista-municipios.md), [filtros-salvos-municipios.md](filtros-salvos-municipios.md), [cenario-junto-filtros-municipios.md](cenario-junto-filtros-municipios.md), [escala-dry-pos-b16.md](escala-dry-pos-b16.md) (seções marcadas em W5).

## Rabbit holes

- **Generalizar `MunicipalityHeaderFilter` inteiro no D1.** As facetas de município (435 opções + busca) são as mais complexas; a generalização é a _interface_ (filterDef + slot), a implementação rica continua específica até um segundo consumidor pedir.
- **DataTable do shadcn como base.** Consultar composição, mas a casa já tem `ui/Table` + DESIGN.md; introduzir TanStack Table trocaria o modelo server-first por client state — não.
- **Mexer na semântica de URL "aproveitando".** Congelada (B18 depende dela).

## Referências

- `src/utilities/campaignListUrl.ts`, `src/utilities/municipalityUi.ts`, `src/components/campaign/MunicipalityList.tsx`, `MunicipalitySortableHead.tsx`, `MunicipalityHeaderFilter.tsx`, `MunicipalityFilters.tsx`
- `src/app/(campaign)/campanha/(app)/{liderancas,organizacoes,dobradinhas,demandas,apoiadores,assessores}/page.tsx`
- [escala-dry-pos-c6.md](escala-dry-pos-c6.md) (C8 F3/F4), [filtros-no-header-lista-municipios.md](filtros-no-header-lista-municipios.md) (B16), DESIGN.md
