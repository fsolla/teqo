# Busca global — resultados Demandas

Status: rascunho
Atualizado em: 2026-07-29
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B53 — busca global)
Impeccable: B — grupo de hits no slot B47
Appetite: ~0,5 dia eng; loader + grupo; share = B55
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · `/campanha/demandas` · tema `campaign`.

Brief: achar pedido pelo título/assunto; secundário município + status; clique → `/campanha/demandas/[slug]`.

## Dados → decisão → apresentação

Dados: N/A. Lista.

## Objetivos

- `searchHomeDemands(query, user)` com access staff de demandas; match no título (e campos de texto baratos já selecionados na lista).
- Grupo **“Demandas”**; oculto se vazio.
- Slot share (**B55**).
- Sem migration / Consent.

## Decisões travadas

- **Detalhe existente.** **Rejeitado:** criar demanda a partir do empty state neste item.
- **i18n:** `HomeSearchDemandHit`; “Demandas”.

## Questões em aberto

- **Buscar descrição longa?** **Opções:** A só título | B título+resumo. **Recomendação:** A no v1. _(assumido)_

## Abordagem proposta

Loader demand list; grupo UI.

## Dependências

- Dura: **B47**. Soft: **B55**.

## Não escopo

Share → **B55**. Leader nunca vê (já sem access).

## Rabbit holes

**Filtro por status na busca.** **Mitigação:** query de nome só.

## Adiado com gatilho

Nenhum neste item.

## Referências

- [busca-global-inicio-input.md](busca-global-inicio-input.md) · `utilities/campaignDemandData.ts` (`loadDemandListPageData`) · `/campanha/demandas/[slug]`
