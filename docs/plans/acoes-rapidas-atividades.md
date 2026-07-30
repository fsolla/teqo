# Ações rápidas — Atividades (lista + detalhe + giros)

Status: rascunho
Atualizado em: 2026-07-30
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha B, item **B84**)
Impeccable: B — drawer B79 em `/atividades`, `/atividades/[slug]`, `/atividades/giros`
Appetite: ~0,5 dia eng; atalhos de criação/agenda; sem migration
Responsável: —

## Design (Impeccable)

Âncoras: PRODUCT/DESIGN · C13 · E13 giros · B79. Craft + **Revisão na implementação**.

Brief: staff na agenda quer criar atividade / planejar giro / (no detalhe) atalho ligado ao município da atividade. Anti-goal: segundo compositor no drawer.

## Dados → decisão → apresentação

Dados: N/A.

## Contexto

Lista, detalhe e compositor `/atividades/giros` (E13). Wizard A1–A5 do Início são secundários aqui; verbo próprio da vertical importa mais.

## Objetivos

- **Lista:** “Nova atividade” → `/atividades/nova`; “Planejar giro” → `/atividades/giros`; opcional subset Início sem prefill.
- **Detalhe:** se houver município na atividade, A1–A5 com `?municipio=`; atalho editar/tarefas via tabs existentes se útil.
- **Giros:** drawer mínimo (busca + voltar lista) — não competir com o compositor.
- Sem migration.

## Revisão na implementação _(obrigatória)_

Se o compositor de giro já tiver CTAs suficientes, o agente pode **omitir** o drawer em `/giros` (exceção local ao mount B79) — documentar.

## Decisões travadas

- **Priorizar verbos da vertical sobre os 6 do Início.** **Rejeitado:** só espelhar B45.
- **i18n:** `new-activity`, `plan-tour`; labels pt-BR.

## Questões em aberto

- **Drawer em `/giros`?** **Opções:** A) omitir | B) só busca. **Recomendação:** **A** ou **B** — não strip de ações.

## Abordagem proposta

Registry por pathname; context `{ municipalitySlug? }` do loader do detalhe.

## Dependências

Dura: **B79**. Soft: E13 ✓, B45 ✓, B60 ✓.

## Não escopo

B79; demandas B85.

## Rabbit holes

Checklist de tarefas no drawer. Mitigação: fica no detalhe.

## Adiado com gatilho

Nenhum neste item.

## Referências

`atividades/**` · E13 plan · B79
