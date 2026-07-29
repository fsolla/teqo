# Busca global — resultados Dobradinhas

Status: rascunho
Atualizado em: 2026-07-29
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

Nenhum neste item.

## Referências

- [busca-global-inicio-input.md](busca-global-inicio-input.md) · `utilities/stateDeputyData.ts` (`loadStateDeputyListPageData`) · `/campanha/dobradinhas/[slug]`
