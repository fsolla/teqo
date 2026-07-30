# Ações rápidas — Demandas (lista + detalhe)

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B85**)
Impeccable: B — drawer B79 em `/demandas` (+ detalhe)
Appetite: ~0,25–0,5 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · A5 register-demand · B79. Craft + **Revisão na implementação**.

Brief: staff quer registrar pedido ou agir no município da demanda aberta.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/demandas`; detalhe por slug se existir. Wizard `register-demand` (quando B59+ wiring existir) + forms da vertical.

## Objetivos

- **Lista:** `register-demand` (Início/wizard) + busca; opcional “Nova demanda” rota local se for o caminho canônico atual.
- **Detalhe:** se houver município vinculado, prefills A1–A5; atalho específico da demanda (escalar/fechar) só se já existir action/URL — senão omitir.
- Sem migration.

## Revisão na implementação _(obrigatória)_

Confirmar se o caminho canônico de criação ainda é form da vertical ou já é wizard A5; alinhar o href único.

## Decisões travadas

- **Um launcher de “Registrar pedido”, não dois.** **Rejeitado:** botão wizard + botão `/nova` no mesmo peek.
- **i18n:** id `register-demand`.

## Questões em aberto

- **Wizard A5 vs form legado?** **Opções:** A) wizard quando rota existir | B) form. **Recomendação:** **A** se `/acoes/registrar-pedido` estiver no ar; senão B.

## Abordagem proposta

Registry + `wizardActionHref` / rota de create existente.

## Dependências

Dura: **B79**. Soft: B45 ✓, B53, wiring A5.

## Não escopo

B79; B84.

## Rabbit holes

Fila de decisão de demanda no drawer. Mitigação: detalhe.

## Adiado com gatilho

Nenhum neste item.

## Referências

`demandas/**` · B79 · fluxos UX-1 A5
