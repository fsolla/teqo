# Ações rápidas — Assessores

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B87**)
Impeccable: B — drawer B79 em `/assessores` (unrestricted)
Appetite: ~0,25–0,5 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · B19 ✓ · B79. Craft + **Revisão na implementação**.

Brief: CG/candidato gerindo contas quer novo assessor / abrir carteira / busca — sem A1–A5 como foco.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/assessores` + detalhe; só `isCampaignUnrestricted`. Assessor autenticado **não** monta esta vertical.

## Objetivos

- Catálogo: “Novo assessor” → `/assessores/nova` (ou rota real); no detalhe, atalho carteira/municípios se útil; busca global.
- Gate: drawer nesta rota só se o actor for unrestricted (alinhado ao page gate).
- Sem migration.

## Revisão na implementação _(obrigatória)_

Confirmar paths reais (`nova` / `[id]`) no tree atual antes de hardcodar hrefs.

## Decisões travadas

- **Sem ações de município como primárias.** **Rejeitado:** strip B45 completa aqui.
- **i18n:** `new-advisor`; labels pt-BR B19.

## Questões em aberto

- **Reset de senha no drawer?** **Opções:** A) não (fica no detalhe) | B) sim. **Recomendação:** **A**.

## Abordagem proposta

Registry + role gate unrestricted.

## Dependências

Dura: **B79**. Soft: B19 ✓.

## Não escopo

B79; B86.

## Rabbit holes

Editar carteira inteira no drawer. Mitigação: B34/B19 cells.

## Adiado com gatilho

Nenhum neste item.

## Referências

`assessores/**` · B19 plan · B79
