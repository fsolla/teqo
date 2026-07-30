# Etapa de busca de município nos wizards

Status: **entregue** (2026-07-29)
Atualizado em: 2026-07-29
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B60 — UX-1 wizards)
Impeccable: B — encaixe da UX da busca do Início (B47/B48) numa etapa de wizard, só municípios
Appetite: ~1 dia eng; input + lista de hits + auto-avanço; soft reuso do loader B48
Responsável: —

## As-built (entrega)

### Contrato de URL

- `?municipio=<slug>` na rota atual `/campanha/acoes/<actionSlug>` (sem nested routes).
- Helpers client-safe em `src/lib/campaignActionRoutes.ts`: `wizardActionHref`, `parseWizardMunicipioParam`, `WIZARD_MUNICIPIO_QUERY_KEY`.
- Refresh em `?municipio=` válido mantém caption; slug fora do escopo → `notFound()`.

### Loader

- `searchStaffMunicipalityHits` (`src/utilities/homeSearch/searchStaffMunicipalityHits.ts`) — núcleo municipality-only extraído de B48.
- `searchHomeMunicipalities` refatorado para chamar o helper + bloco de territórios inalterado.
- `POST /campanha/home-search` com `mode: 'wizard-municipality'` → `{ status: 'success', municipalities }`.

### UI

- `WizardMunicipalitySearchStep` — `CampaignSearchInput` + `useHomeSearchQuery` + lista com `HomeSearchHitRow` variante `button` (`role="option"`).
- Select = `router.push(wizardActionHref(actionSlug, slug))` — sem botão Continuar.
- Empty: "Nenhum município encontrado."; erro via `HOME_SEARCH_GENERIC_ERROR_MESSAGE`.
- Readout 2022: `MunicipalityVotePositionReadout layout="search"` (paridade B48).
- Pós-seleção: `WizardMunicipalitySelectedStub` (placeholder B61) com `municipalityLabel` no shell; Voltar → passo de busca.

### Removido

- `WizardMunicipalityPlaceholderStep` (substituído pela etapa real + stub B61).

### Adiado

- Chips de recentes/prioritários — módulo `recentVisits` não existe no repo; revisitar se o CG pedir atalho sem digitar.
- Loader de escopo enxuto para busca (`loadMunicipalityScope` sem agregado de pledges) — hoje wizard e `searchStaffMunicipalityHits` pagam o custo completo do escopo; gatilho: latência perceptível no debounce ou 3º consumidor de busca municipality-only.
- Hook compartilhado de fetch `POST /campanha/home-search` (seq/abort/loading) — wizard e `HomeSearchResultsContext` duplicam a máquina; gatilho: 3º consumidor além desses dois.

### Testes

- Unit: `campaignActionRoutes` (`wizardActionHref`, `parseWizardMunicipioParam`).
- Int: `searchStaffMunicipalityHits.int.spec.ts` (match, escopo assessor, leader rejeitado).
- E2e: `campaignHomeActions.e2e.spec.ts` — Início → Ajustar votos → buscar Cairu → `?municipio=cairu` + caption.

### Sem migration · sem Consent · staff-only (layout `acoes/` já gateia)

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · B47 `CampaignHomeSearch` / B48 linhas de município · tema `campaign`.

Na implementação: craft compacto → critique → polish.

Brief compacto:

- **Persona:** CG digita “Cairu” no meio do ritual A1/A2 e quer o município em 1 toque.
- **Job principal:** achar o município no escopo do ator e **avançar sozinho** ao selecionar.
- **Estratégia de cor:** Restrained.
- **Edit where you see:** não — seleção é navegação de fluxo.
- **Anti-goals:** grupos (TI/lideranças/…); botão “Continuar” após selecionar; card por linha.

## Dados → decisão → apresentação

- **Vou apresentar dados?** Sim — hits de município (nome, TI, readout 2022).
- **Decisões:** escolher **qual** município entra no fluxo.
- **Forma:** lista ranqueada por nome (word-start), igual espírito B48. **Rejeitado:** mapa; grupos multi-entidade.
- **Profile:** scoped ao access; tipicamente &lt;20 hits.
- **Anti-goals de dado:** sem inventar métrica; sem TIs neste passo (wizard precisa de unidade operacional `municipality`).

## Contexto

No Início, **B47** ✓ entrega input + modo focado; **B48** lista Municípios (+ TIs no mesmo grupo). Nos wizards (pedido 2026-07-29): **mesma experiência de busca**, com duas diferenças — (1) **sem grupos**: só municípios; (2) **selecionar = avançar** ao próximo passo, sem confirmar.

Serve A1 (votos), A2 (sinal), A3/A4/A5 e qualquer fluxo que precise de local cedo ([fluxos-acao-primeiro-inicio.md](fluxos-acao-primeiro-inicio.md) § contrato #2).

## Decisões travadas

- **Só municípios** — TIs fora deste passo (wizard grava em `municipality`). **Rejeitado:** copiar B48 com TIs (não há `municipality` para um TI).
- **Select = auto-avanço.** **Rejeitado:** seleção + “Continuar” (pedido explícito; atrito no ritual).
- **Query `?municipio=`** na rota atual. **Rejeitado:** nested `/acoes/<action>/<slug>` antes de B61; store client-only (perde refresh/Zap).
- **Mesma linguagem visual da busca do Início** (linha sem card, tipografia). **Rejeitado:** `Command`/`Combobox` de lista (B27) como UI primária — é outro modelo mental.
- **Readout 2022:** sim (paridade B48 — Opção A).
- **i18n:** copy “Em qual município?”.

## Dependências

- Dura: **B59** ✓. Soft: **B48** ✓ (UX/loader), **B47** ✓ (debounce).

## Não escopo

- Grupos lideranças/assessores/… → B49–B53 (só Início). Ajuste de votos → **B61**. Chassis → **B59** ✓.

## Referências

- [busca-global-inicio-input.md](busca-global-inicio-input.md) · [busca-global-resultados-municipios.md](busca-global-resultados-municipios.md) · [chassis-wizard-campanha.md](chassis-wizard-campanha.md) · `lib/wordStartFilter.ts`
- AGENTS.md — access advisor; `overrideAccess: false`
