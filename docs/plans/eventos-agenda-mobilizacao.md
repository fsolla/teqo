# Eventos / presença e agenda de mobilização

Status: implementado
Atualizado em: 2026-07-18
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Janela 2, ordem 9 — C3)
Responsável: —

## Referência visual (UX Pilot)

Dois designs cobrem este plano:

| Tela                                 | Arquivos                                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista de planos (`/campanha/planos`) | [`Planos-de-Acao.png`](../design-refs/latest/Planos-de-Acao.png) · [`Planos-de-Acao.html`](../design-refs/latest/Planos-de-Acao.html)                 |
| Form novo plano                      | [`Novo-Plano-de-Acao.png`](../design-refs/latest/Novo-Plano-de-Acao.png) · [`Novo-Plano-de-Acao.html`](../design-refs/latest/Novo-Plano-de-Acao.html) |

Como usar:

- **Lista — adotar:** tabs de janela/status ("Próximos" default, "Todos", "Realizados", "Rascunhos"), filtros "Tipo de ação" e "Território", cards com badge de `kind`/`status`, data/hora + município, chip do Território de Identidade, "Resp: {nome}" e progresso de tarefas. Rascunho sem `startAt` mostra "Data a definir".
- **Form — adotar:** seções "Informações básicas", "Data e horário", "Território" (reusa `NucleusTerritoryFields`), "Pessoas" (coordenadores, responsável, liderança vinculada) e status inicial (Planejado | Rascunho).
- **Detalhe:** tabs Visão geral / Tarefas / Atualizações no padrão `NucleusTabNav` (sem design nesta leva).
- **Ajustar cores:** tokens do tema `campaign`. Entrada "Planos" no nav (`src/components/campaign/nav.ts`).

## Contexto

Cada documento `actionPlan` é uma ação/evento calendarizável (caminhada, comício, etc.), com checklist de tarefas e feed de atualizações, alimentando o bloco "Próximos eventos" no overview de núcleos e no dashboard.

## Decisões travadas

- **Granularidade: entidade única `actionPlan`.**
- **Território próprio, sem link a `electoralNucleus`.** Arrays `regions`/`cities`/`neighborhoods` + validação Bahia compartilhada (`campaignTerritoryValidation.ts`).
- **Filtro de território na lista/overview usa `{ equals }`** sobre arrays (semântica A1), não `contains`.
- **`startAt` opcional só em `rascunho`; obrigatório ao passar para `planejado`/`confirmado`/`realizado`/`cancelado`.** Card mostra "Data a definir" quando ausente. (Decisão de produto 2026-07-18.)
- **Pessoas = `Contact` + `campaignUser`:** `coordinators` → `campaignUser`, `responsible` → `Contact`, `leadership` → `leadership` (opcional; escopo de leitura para `lideranca`).
- **`kind` / `status` enums em pt-BR** (valores de dados).
- **`slug` canônico imutável** a partir do `title`.
- **`tasks` e `updates` como arrays no MVP** (append-only para updates; `doneAt`/`author`/`createdAt` derivados no servidor).
- **Access:** `geral` tudo; `coordenador` onde está em `coordinators` (e pode criar, auto-incluído); `lideranca` onde `leadership` ∈ engajadas — escrita só toggle `tasks.done` + append `updates`.
- **Transações:** escritas de domínio via `withPayloadTransaction` (`src/utilities/payloadTransaction.ts`).
- **Sem `Consent`** (dado interno de staff).

## Questões em aberto (resolvidas na implementação)

- **`lideranca` edita tarefas?** Sim — só toggle `done` + append `update`.
- **`tasks.responsible`:** contatos no escopo do ator (`getAccessibleContactIds` via busca do combobox).
- **Filtro de janela:** tabs Próximos / Todos / Realizados / Rascunhos; default Próximos.
- **Bloco no dashboard:** sim, sem filtros de lista.
- **Recorrência / `actionUpdate` dedicado:** fora do MVP.

## Entrega (2026-07-18)

- Collection `actionPlan` + migration `20260718_222832_add_action_plan`
- Vertical `/campanha/planos` (lista, detalhe com tabs, novo/editar)
- Blocos "Próximos eventos" no overview de núcleos e no dashboard
- Access control + testes int `tests/int/campaignActionPlan.int.spec.ts`

## Revisões

- 2026-07-18: auditoria pré-implementação — operador de território `equals` (não `contains`); transações via `withPayloadTransaction`; nav em `nav.ts`; validação de território extraída para helper compartilhado; `startAt` opcional só em rascunho.

## Não escopo

- Collection dedicada `actionUpdate`, captura nominal de presentes, calendário/mapa, link a `electoralNucleus`, recorrência, notificações (D2).
- Escala/DRY pós-entrega (território/contato compostos, selects por aba, RMW de tasks/updates, índice `status+startAt`) — C7 / [escala-dry-pos-c3.md](escala-dry-pos-c3.md).
