# Ações rápidas — Apoiadores

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B86**)
Impeccable: B — drawer B79 em `/apoiadores` (staff)
Appetite: ~0,25–0,5 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · C2 · B79. Craft + **Revisão na implementação**.

Brief: staff no cadastro nominal quer cadastrar / importar / buscar sem voltar ao Início. Leader usa **B89**, não esta rota.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/apoiadores` staff (access `canAccessSupporterArea`). Import CSV e create já existem na vertical.

## Objetivos

- Catálogo sugerido: “Cadastrar apoiador” (rota/create da vertical), atalho import se houver URL estável, busca global B79; **não** empurrar A1–A5 como primários.
- Sem migration / sem novo Consent (usa chaves C2 existentes nos flows).

## Revisão na implementação _(obrigatória)_

Se import estiver escondido atrás de wizard multi-step, o launcher deve apontar ao step 1 — não inventar atalho que bypassa preview.

## Decisões travadas

- **Staff only nesta rota.** Leader → B89. **Rejeitado:** misturar catálogos.
- **i18n:** `register-supporter` / labels da vertical.

## Questões em aberto

- **Incluir A1–A5 como secundários?** **Opções:** A) não | B) no expanded. **Recomendação:** **A**.

## Abordagem proposta

Registry `/apoiadores` → 1–2 launchers da vertical + busca.

## Dependências

Dura: **B79**. Soft: C2 eng ✓.

## Não escopo

B89 Contatos; B79.

## Rabbit holes

Import token / bulk no drawer. Mitigação: wizard existente.

## Adiado com gatilho

Nenhum neste item.

## Referências

`apoiadores/**` · B79 · C2 plans
