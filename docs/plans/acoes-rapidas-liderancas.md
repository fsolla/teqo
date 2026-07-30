# Ações rápidas — Lideranças (lista + detalhe)

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B82**)
Impeccable: B — catálogo drawer B79 em `/liderancas` e `/liderancas/[id]`
Appetite: ~0,5 dia eng; prefills A4 + município(s) da liderança; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · B45 · B70 · B79. Craft compacto + **Revisão na implementação**.

Brief: staff na rede quer atualizar a pessoa à frente ou lançar ritual no município dela. Anti-goal: spreadsheet no drawer.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

Lista `/campanha/liderancas`; detalhe `/campanha/liderancas/[id]`. Wizard A4 (**B70**) é o verbo central; municípios da liderança alimentam prefill opcional de A1–A3/A5.

## Objetivos

- **Lista:** subset — `update-leadership` (sem id), atalhos de lista se existirem; demais ações Início sem prefill _(recomendado: strip enxuta, não os 6)_ .
- **Detalhe:** `update-leadership` com context `leadershipId` (query a definir no B70/chassis — se ainda não houver, href para ficha `/editar` ou wizard quando o param existir); se a liderança tiver **um** município, prefills A1–A3/A5 com esse slug; se N, não adivinhar — usuário escolhe no B60.
- Sem migration.

## Revisão na implementação _(obrigatória)_

Se B70 ainda não expuser query de liderança, o agente deve (1) propor o param mínimo no wizard ou (2) degradar para link da ficha — registrar escolha no as-built.

## Decisões travadas

- **Não auto-escolher município quando N&gt;1.** **Rejeitado:** “primeiro da lista” / TI inteiro.
- **i18n:** `leadershipId` em inglês; labels B58.

## Questões em aberto

- **Query `?lideranca=` no wizard A4?** **Opções:** A) sim no B70/B82 | B) só município. **Recomendação:** **A** quando B70 estiver no ar — senão degradar.

## Abordagem proposta

Context `{ leadershipId, municipalitySlug? }` → registry. Reuso `wizardActionHref`.

## Dependências

Dura: **B79**. Soft: B70, B60 ✓, B45 ✓.

## Não escopo

Chassis B79; dobradinhas B83; Contatos leader B89.

## Rabbit holes

**Convite WhatsApp (B30) no drawer.** Mitigação: já está na lista; não duplicar.

## Adiado com gatilho

Prefill multi-município com picker no drawer — quando N&gt;1 for o caso dominante em campo.

## Referências

`liderancas/**` · B70 plan · B79 plan · `campaignHomeActions.ts`
