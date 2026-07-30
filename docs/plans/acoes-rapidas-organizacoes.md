# Ações rápidas — Organizações

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B88**)
Impeccable: B — drawer B79 em `/organizacoes` (+ detalhe)
Appetite: ~0,25–0,5 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · vertical organizações · B79. Craft + **Revisão na implementação**.

Brief: staff em orgs (ramificações políticas, ex. SindMed) quer criar/buscar/ligar — prioridade baixa vs Municípios/Lideranças, mas **não cortável** no lote (produto 2026-07-30).

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/organizacoes` + `[slug]` / `nova`. Fora do `staffNav` principal em alguns momentos históricos — rota existe.

## Objetivos

- Catálogo: “Nova organização”, busca global; no detalhe, atalho para lideranças vinculadas se URL de lista filtrada existir; A1–A5 só se houver município óbvio (geralmente **não**).
- Sem migration.

## Revisão na implementação _(obrigatória)_

Se a vertical estiver pouco usada no momento do implement, manter **busca + nova** e omitir A1–A5 sem culpa.

## Decisões travadas

- **Drawer existe mesmo fora do bottom-nav histórico.** **Rejeitado:** pular org do lote.
- **i18n:** `new-organization`.

## Questões em aberto

- **Prefill liderança a partir da org?** **Opções:** A) não v1 | B) se B70 aceitar. **Recomendação:** **A**.

## Abordagem proposta

Registry paths org → launchers CRUD locais + busca.

## Dependências

Dura: **B79**. Soft: B69 ✓ (org permanece no modelo).

## Não escopo

B82; B79.

## Rabbit holes

Multi-org membership editor no drawer. Mitigação: forms existentes.

## Adiado com gatilho

Nenhum neste item.

## Referências

`organizacoes/**` · B79 · B69 plan
