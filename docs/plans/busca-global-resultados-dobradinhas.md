# Busca global — resultados Dobradinhas

Status: entregue (2026-07-29)
Atualizado em: 2026-07-29 — as-built: `searchHomeStateDeputies` (staff; word-start em nome ou partido; cap 25; `municipalityIdsByStateDeputyIds` exportado de `stateDeputyData`); `HomeSearchStateDeputyHit` + campo `stateDeputies` no `POST /campanha/home-search`; `HomeSearchStateDeputyGroup` após Assessores; secundário = partido · N municípios; sem WA (B55 — entidade sem telefone); int `homeSearchStateDeputies.int.spec.ts`.
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B52 — busca global)
Impeccable: B — grupo de hits no slot B47
Appetite: ~0,5 dia eng; loader + grupo; WA = B55
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · `/campanha/dobradinhas` · tema `campaign`.

Brief: achar deputado estadual / dobradinha por nome ou partido; clique → `/campanha/dobradinhas/[slug]`.

## Dados → decisão → apresentação

Dados: N/A. Secundário = partido + contagem de municípios se barato.

## Objetivos

- `searchHomeStateDeputies(query, user)`; match nome (e partido se couber sem ruído).
- Grupo **“Dobradinhas”**; oculto se vazio.
- Slot trailing para WhatsApp (**B55**) quando houver telefone no modelo — se não houver telefone na entidade, B55 no-op nessa linha.
- Sem migration.

## Decisões travadas

- **Detalhe existente.** **Rejeitado:** abrir município da dobradinha.
- **i18n:** `HomeSearchStateDeputyHit`; “Dobradinhas”.

## Questões em aberto

- **Telefone na dobradinha existe?** **Opções:** A WA só se campo existir | B omitir WA neste grupo. **Recomendação:** A — B55 esconde ícone se `whatsAppHrefForPhone` for null. _(assumido)_

## Abordagem proposta

Loader `stateDeputy` list; grupo UI.

## Dependências

- Dura: **B47**. Soft: **B55**; B33 ✓.

## Não escopo

WA → **B55**.

## Rabbit holes

**Buscar por município da dobradinha.** **Mitigação:** nome/partido só; município já está em B48.

## Adiado com gatilho

- **Orquestrador único do POST / dedup de queries** — herdado de B48/B50; ver [busca-global-resultados-municipios.md](busca-global-resultados-municipios.md) § Adiado. **Gatilho:** após B51–B53 ou se latência do POST medir >~300 ms em dev.
- **`collectByRelationIds` genérico** — só 2 call sites (`municipalityIdsByAdvisorIds`, `municipalityIdsByStateDeputyIds`). **Gatilho:** 3º agregado de relação ou refactor de `loadStateDeputyListPageData` leadership fan-out.
- **Contagem de municípios só após top-25** — otimização marginal com catálogo pequeno. **Gatilho:** query por partido (`PT`) com dezenas de matches e latência perceptível.

## Já resolvido no simplify (não reabrir)

- Prefilter DB `contains` em nome **ou** partido + word-start em memória (B49 precedent).
- `loadStateDeputyListPageData` reusa `municipalityIdsByStateDeputyIds`.
- `HOME_SEARCH_RESULT_HIT_CAP` + `formatHomeSearchMunicipalityCount` compartilhados.

## Referências

- [busca-global-inicio-input.md](busca-global-inicio-input.md) · `utilities/stateDeputyData.ts` (`loadStateDeputyListPageData`) · `/campanha/dobradinhas/[slug]`
