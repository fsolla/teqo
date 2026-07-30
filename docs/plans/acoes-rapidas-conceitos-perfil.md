# Ações rápidas — Conceitos + Perfil (só busca)

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B90**)
Impeccable: B — drawer B79 sem strip de ações (ou strip vazia) em `/conceitos` e `/perfil`
Appetite: ~0,25 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · E18 conceitos · B79. Craft + **Revisão na implementação**.

Brief: páginas de referência/conta — usuário ainda precisa da busca global para sair rápido para um município/pessoa; ações de ritual **não** competem com leitura de glossário ou form de perfil.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/conceitos` (staff secondary nav); `/campanha/perfil`. Não são mesas de operação.

## Objetivos

- Mount B79 com **busca global staff** e **sem** catálogo de ações (ou só “Voltar ao Início” se critique exigir âncora).
- Leader em `/perfil`: sem home-search staff; drawer mínimo ou omitir — **Recomendação:** omitir drawer no perfil leader se não houver busca segura.
- Sem migration.

## Revisão na implementação _(obrigatória)_

Se o perfil ganhar atalhos úteis (ex. biometria B40), o agente pode adicionar 1 launcher — não a strip B45.

## Decisões travadas

- **Sem A1–A5 em Conceitos/Perfil.** **Rejeitado:** paridade Início “por consistência”.
- **i18n:** nenhum id de ação obrigatório; `home-href` se existir.

## Questões em aberto

- **“Ir ao Início” no peek?** **Opções:** A) não (sidebar) | B) sim. **Recomendação:** **A**.

## Abordagem proposta

Registry entries com `actions: []` + search enabled para staff.

## Dependências

Dura: **B79**. Soft: B47 ✓.

## Não escopo

Quadro (fora do inventário 2026-07-30); B79 chrome.

## Rabbit holes

Glossário searchable no drawer. Mitigação: página Conceitos já é o índice.

## Adiado com gatilho

Nenhum neste item.

## Referências

`conceitos/**` · `perfil/**` · B79
