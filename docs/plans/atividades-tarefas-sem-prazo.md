# C124 — Atividades: tarefa só com texto, responsável e concluída (sem data/hora)

Status: rascunho
Atualizado em: 2026-08-11
Issue: #668
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe nas superfícies existentes (campos de tarefa do formulário + checklist do detalhe)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c124-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

O modelo de tarefas da atividade carrega um **prazo** (data/hora) que a mesa não usa. No dia a dia, tarefa é "o que fazer, com quem, e já foi feito?" — o prazo só polui: um input `datetime-local` apertado na linha da tarefa no formulário e um "Prazo: …" no checklist do detalhe, sem desbloquear nenhuma decisão (não há alerta nem filtro por prazo). O usuário pediu para tirar data/hora das tarefas: fica só **texto, responsável e concluída**.

## Persona e fluxo

- **Persona / contexto:** staff criando/editando atividade no formulário completo (`/nova` e `/editar`); liderança marcando tarefas como concluídas no detalhe da atividade (toggle, como hoje).
- **Job principal:** cadastrar e acompanhar tarefas da atividade sem atrito — digitar o que fazer, apontar o responsável, marcar feito.
- **Fluxo desejado:** no formulário, cada tarefa = título + responsável (pessoa) + checkbox "concluída"; no detalhe, o checklist mostra título + "Resp: …" e o toggle de concluída.
- **Anti-goals de produto:** prazo não migra para outro campo da atividade nem vira notificação/relatório; nada de segunda ficha de pessoa.

## Objetivo e aceite

- Criar/editar tarefa tem **exatamente** três controles: título (texto), responsável (pessoa) e "concluída" (checkbox) — o campo de data/hora sai da UI.
- O checklist do detalhe mostra só título + responsável (sem "Prazo: …").
- O **schema** da tarefa não expõe mais prazo: dados existentes com prazo são **descartados** pela migração (verificar no impl que nenhum consumidor usa o campo antes de dropar).
- Guardrail de liderança intacto: liderança só pode marcar "concluída" (não altera título/responsável, não adiciona/remove tarefa) — a comparação de campos do guardrail perde a referência ao prazo.
- `doneAt` (derivado, invisível, "concluída em") permanece — auditoria de quando foi marcada.

## Dados (intenção)

- **Vou apresentar dados?** Não — simplificação de um modelo de entrada; o contador de tarefas concluídas (taskDoneCount) segue como está.
- **Decisões desbloqueadas:** nenhuma de apresentação.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/Activity.ts` (campo `due` do array `tasks` sai do schema; `doneAt` permanece; guard de liderança em `beforeValidate` perde a comparação de `due`), `src/components/campaign/activity/ActivityTaskFields.tsx` (remove o input de prazo e o serializador), `ActivityTaskChecklist.tsx` (remove a linha de prazo), `src/utilities/activityFormData.ts`, `src/lib/schemas/activity.ts`, `src/utilities/activityViewModels.ts` (parsing/validação/view model), migration nova (drop da coluna de prazo do array de tarefas — história de migrations intacta), testes unit/e2e que exercitam tarefas.
- **Precedente a olhar:** migration de adição do campo (`20260718_222832_add_action_plan`) e remodel de schema recente de atividade (`20260808_184113_remodel_activity_responsible`, `20260810_010844_add_activity_all_day`).
- **Risco de acoplamento:** o guardrail de liderança (Activity.ts, `beforeValidate`) compara tarefa a tarefa — mudar o shape exige tocar essa comparação no mesmo item, senão liderança quebra ou perde o fail-closed.

## Dependências

- Nenhuma dura para si. **Ela é dependida pela C123** (modal central da agenda): o overlay único de criação/edição inclui a seção de tarefas e nasce já com o modelo simplificado — a C123 roda depois desta.

## Fora de escopo

- Prazo em demandas/atividades (não criar campo equivalente em outro lugar).
- Notificações/alertas por prazo de tarefa.
- Editar `doneAt` ou o contador `taskDoneCount`.

## Rabbit holes de produto

- **"Prazo volta na listagem".** Alguém pode querer mostrar o prazo na lista de atividades. **Corte:** o campo sai do modelo; se a mesa pedir prazo de novo, é um item novo com intenção própria.
- **"Migrar prazo para outro lugar".** **Corte:** nada consome o prazo hoje (a verificação no impl fecha isso); migração de conteúdo é trabalho morto.

## Questões em aberto (produto)

- **`doneAt` ("concluída em") permanece no modelo?** **Opções:** A) sim, como campo derivado invisível (auditoria sem custo de UI); B) remove junto. **Recomendação:** A — custo zero, mantém rastreabilidade de quando cada tarefa foi marcada. _(assumido — validar com produto)_
- **Prazo com valor preenchido em produção: descartar ou preservar?** **Opções:** A) descartar (nenhum consumidor; dados de campanha internos); B) preservar em coluna morta. **Recomendação:** A — limpeza real, sem coluna fantasma. _(decidido no gate — descartar e remover)_

## Referências

- GitHub Issue #668 (C124)
- Plans C91/C103 (formulário de criação — o overlay da C123 inclui tarefas), C14 (modelo de atividades)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c124-ui-draft.canvas.tsx`
- `src/collections/Activity.ts` · `src/components/campaign/activity/ActivityTaskFields.tsx` · `ActivityTaskChecklist.tsx`
- `src/utilities/activityFormData.ts` · `src/lib/schemas/activity.ts` · `src/utilities/activityViewModels.ts`
