# Ações rápidas — Dobradinhas

Status: entregue (B83 — #19)
Atualizado em: 2026-08-01
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B83**)
Impeccable: B — drawer B79 em `/dobradinhas` (+ detalhe se houver)
Appetite: ~0,25–0,5 dia eng; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · B79 · lista B37/B36. Craft + **Revisão na implementação**.

Brief: staff na vertical de state deputies quer buscar ou iniciar ritual ligado ao território da dobradinha — sem inventar wizard de dobradinha neste item.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

`/campanha/dobradinhas` (lista). Detalhe se existir na árvore de rotas — mesma política de context.

## Objetivos

- Catálogo sugerido: busca global (B79) + ações Início **sem** prefill; atalho opcional “Municípios desta dobradinha” se houver filtro/URL estável.
- Não inventar `?stateDeputy=` nos wizards A1–A5 nesta fatia.
- Sem migration.

## Revisão na implementação _(obrigatória)_

Agente pode cortar ações Início se o único job real for navegação+busca; ou propor deep-link de filtro se o serializador de lista já permitir.

## Decisões travadas

- **Sem wizard novo de dobradinha.** **Rejeitado:** fluxo paralelo ao `MunicipalityStrategyForm`.
- **i18n:** ids B45; `stateDeputyId` só se nascer atalho.

## Questões em aberto

- **Incluir WA share (B55) como ação do drawer?** **Opções:** A) não (fica na linha de busca) | B) sim. **Recomendação:** **A**.

## Abordagem proposta

Registry `/dobradinhas` → subset staff (ações Início ou só busca+1–2 verbos). Soft link para lista de municípios filtrada se API de URL existir.

## Dependências

Dura: **B79**. Soft: B45 ✓, B52 ✓.

## Não escopo

B79; B82; chips B37.

## Rabbit holes

Prefill município “principal” da dobradinha. Mitigação: N municípios — mesma regra do B82.

## Adiado com gatilho

Nenhum neste item.

## Referências

`dobradinhas/**` · B79 · `campaignHomeActions.ts`

## As-built (#19)

- Registry: `campaignQuickActionDobradinhas.ts` — lista (`Nova dobradinha` + 6 ações Início sem prefill), detalhe/nova (só Início).
- Atalho “Municípios desta dobradinha” **omitido** — `municipalityListUrl` não expõe filtro por `stateDeputy`.
- WA share (B55) **omitido** no drawer (recomendação A do plano).
