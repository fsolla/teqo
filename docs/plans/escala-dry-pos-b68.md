# Escala e DRY pós-B68 (sugestões na busca aberta)

Status: rascunho (débito pós-`/simplify` 2026-07-29)
Atualizado em: 2026-07-29
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Fill-ins abertos, **B68+**)
Impeccable: A — perf/estrutura de loader; sem pixel novo
Appetite: ~0,5–0,75 dia eng (F1); F2 cortável
Responsável: —

## Dados → decisão → apresentação

- **Vou apresentar dados?** Não (N/A) — mesmos ~8 hits já mostrados; só muda de onde vêm no primeiro focus.

## Contexto

**B68 ✓ (2026-07-29)** entrega sugestões de municípios no empty state da busca do Início (`mode: 'suggest'` em `POST /campanha/home-search`). O `/simplify` do fechamento mediu que, para **coordenador/candidato**, cada focus dispara um POST que repete `loadMunicipalityScope` + `loadMunicipalityGoalCoverageBundle` — trabalho que a mesma página já pagou em `loadCampaignHomeSummary` no RSC. `React cache()` não cruza a fronteira RSC ↔ route handler.

O simplify da sessão já aplicou mitigação parcial: o bundle E8 roda só em municípios `priority === 'alta'` (não nas 435 linhas) e `toHomeSearchMunicipalityHit` unificou o shaping dos hits.

## Objetivos

- **F1:** primeiro focus no Início staff **não** refaz scope+coverage no POST quando o RSC da página já carregou os insumos — embed `initialSuggest` (ou loader irmão no mesmo `Promise.all` da página) e hidratar `useHomeSearchResultsState` com TTL curto / invalidação ao navegar.
- Sem mudar a política de ranking (assessor = frescor; CG = déficit + frescor).
- Sem migration/collection/Consent.

## Já resolvido no simplify/critique (não reabrir)

- `aria-busy` duplicado (`resultsBusy ?? isDebouncing`).
- Shell de erro sem `errorMessage` nullable intermediário.
- `id` removido do tipo puro do ranker.
- Factory `toHomeSearchMunicipalityHit` nos dois loaders.
- Bundle de cobertura restrito a `priority === 'alta'`.

## Fases

### F1 — RSC embed do suggest (P1 perf)

- Estender `loadCampaignHomeSummary` ou extrair `loadHomeSearchSuggestHits` reutilizável no mesmo request da página (`page.tsx`).
- Passar `initialSuggest` para `CampaignHomeStaffChrome` → `useHomeSearchResultsState({ initialSuggest })`.
- Client: usar payload inicial quando `uiFocused && !query.isActive` e não houver stale/error; POST só para revalidação explícita ou após TTL (opcional v1: só primeiro paint).

### F2 — Comparator compartilhado de déficit (cortável)

- Extrair `compareNullableNumberDesc` + tiebreak hook para `lib/municipalitySort.ts` quando houver 3º call site com política diferente de tiebreak (hoje: B20 nome, B68 frescor, E9 lista).

## Explicitamente fora / Adiado com gatilho

- **Cache client-side / stale-while-revalidate no refocus** — aceito no plano B68 (fetch ao focus); revisitar se sessão reclamar de flash de loading.
- **Unificar constante `8`** (`HOME_SEARCH_SUGGEST_LIMIT` vs `DASHBOARD_PRIORITY_SAMPLE_LIMIT`) — cosmético; mover para `lib/` só se um dos dois mudar.
- **`loadTerritoryOverview` em todo keystroke da busca** — débito adjacente B48 (search path), não B68; gatilho: latência perceptível ao digitar após B49+.
- **Mesclar `loadHomeSearchSuggestions` com `searchHomeMunicipalities`** — dois call sites; extrair só o mapper (já feito).

## Referências

- [sugestoes-busca-vazia-inicio.md](sugestoes-busca-vazia-inicio.md) (B68)
- [`loadHomeSearchSuggestions.ts`](../src/utilities/homeSearch/loadHomeSearchSuggestions.ts)
- [`campaignDashboardData.ts`](../src/utilities/campaignDashboardData.ts) (`loadCampaignHomeSummary`)
- [`HomeSearchResultsContext.tsx`](../src/components/campaign/dashboard/HomeSearchResultsContext.tsx)
