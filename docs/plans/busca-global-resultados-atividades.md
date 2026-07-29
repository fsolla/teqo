# Busca global — resultados Atividades

Status: rascunho
Atualizado em: 2026-07-29
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item B51 — busca global)
Impeccable: B — grupo de hits no slot B47
Appetite: ~0,5–0,75 dia eng; loader + grupo; share = B55
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` / `DESIGN.md` · `/campanha/atividades` · tema `campaign`.

Brief: achar atividade por título; secundário = município + data. Clique → `/campanha/atividades/[slug]`.

## Dados → decisão → apresentação

Dados: N/A (agenda). Lista com data legível pt-BR.

## Objetivos

- `searchHomeActivities(query, user)` com access de `activity`; match no `title` (word-start).
- Grupo **“Atividades”**; oculto se vazio.
- Linha: título; secundário município + quando; slot para share (**B55**).
- Sem migration / Consent.

## Decisões travadas

- **Detalhe existente por slug.** **Rejeitado:** abrir compositor de giro.
- **Share não neste item** → **B55**.
- **i18n:** `HomeSearchActivityHit`; “Atividades”.

## Questões em aberto

- **Incluir rascunhos?** **Opções:** A sim no escopo do ator | B só próximos/realizados. **Recomendação:** A — busca é achar o que eu criei. _(assumido)_

## Abordagem proposta

Loader perto de activity list data; grupo UI.

## Dependências

- Dura: **B47**. Soft: C13 ✓; **B55**.

## Não escopo

Share → **B55**. Grid → **B54**.

## Rabbit holes

**Full-text no `resultSummary`.** **Mitigação:** só título no v1.

## Adiado com gatilho

Nenhum neste item.

## Referências

- [busca-global-inicio-input.md](busca-global-inicio-input.md) · `utilities/activityPageData.ts` / `activityDetailPageData.ts` · `/campanha/atividades/[slug]`
