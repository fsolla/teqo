# Ações rápidas — Contatos (liderança)

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B89**)
Impeccable: B — drawer B79 para role `leader` em `/campanha/contatos`
Appetite: ~0,25–0,5 dia eng; lockdown; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT.md Depth for staff / light for leader · B43/B45 leader · B79. Craft + **Revisão na implementação**.

Brief: liderança no celular cadastra apoiador / vê contatos; **sem** omnibus estadual nem A1–A5.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

Leader home de trabalho = `/campanha/contatos` (B43). Catálogo B45: `register-supporter`, `my-contacts`.

## Objetivos

- Montar drawer só para `leader` nas rotas leader (Contatos; Início leader já tem ações — **sem** drawer no Início, mesma exclusão B79).
- Ações: espelho B45 leader; busca: **não** reusar `home-search` staff — ou omitir busca, ou busca local só nos próprios contatos se já existir endpoint/lista filter. **Recomendação v1:** ações + sem omnibox global (fail closed).
- Sem migration; Consent das actions de apoiador inalterado.

## Revisão na implementação _(obrigatória)_

Se no momento existir busca local de contatos, o agente pode plugar no slot de busca do B79 **sem** abrir `home-search` staff.

## Decisões travadas

- **Lockdown: zero wizards de município.** **Rejeitado:** “só leitura” de mapa/lista.
- **Sem POST `/campanha/home-search` para leader.** **Rejeitado:** scoped hack no mesmo endpoint sem access review.
- **i18n:** ids B45 leader.

## Questões em aberto

- **Busca local no drawer?** **Opções:** A) omitir v1 | B) filtrar lista client-side. **Recomendação:** **A** se a página já tem search; **B** se a lista for longa e sem filtro.

## Abordagem proposta

Registry role=leader + path contatos → 2 ações B45. Slot search vazio ou filtro local.

## Dependências

Dura: **B79**. Soft: B45 ✓, B43 ✓.

## Não escopo

B86 staff apoiadores; B79 staff search providers.

## Rabbit holes

WebAuthn / perfil no drawer. Mitigação: `/perfil` separado (B90).

## Adiado com gatilho

Nenhum neste item.

## Referências

`contatos/**` · `campaignHomeActions.ts` leader · B79
