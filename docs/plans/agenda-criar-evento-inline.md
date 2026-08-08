# Criar evento inline no calendário da agenda (estilo Google Calendar)

Status: rascunho
Atualizado em: 2026-08-08
Issue: #428
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: C — fluxo novo de criação inline sobre uma tela existente (`/campanha/agenda`)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c91-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; um outcome verificável — staff cria compromisso no slot certo sem sair da agenda
Responsável: —

## Dependência rápida

- **Dura: [C90 — remodelar `responsible` da Atividade](remodelar-responsaveis-atividade.md) (#426)** (campo único polimórfico multi-valor; remove `advisors`/`leadership`). O seletor de responsáveis do overlay **consome o campo remodelado**; este item não decide schema.

## Intenção

A agenda (C15) já mostra a semana e o mês, mas criar exige **sair** para `/campanha/atividades/nova` (o clique no slot só pré-preenche a URL). Quebra o ritmo de planejamento na mesa: “onde eu estava” se perde. Queremos criar **no lugar clicado**, como no Google Calendar — um popover com dia e horários já preenchidos do slot, editáveis, e o evento surgindo no calendário assim que salvar, sem reload. A mesa-alvo já vive no Google Calendar; a promessa é “mesma letra, no Teqo”.

A criação rápida também leva o **seletor de responsáveis** do fluxo completo para o overlay (popover/drawer): o responsável de um compromisso pode ser **candidato**, **assessor** (staff `campaignUser`), **liderança** ou **dobradinha** — não só um Contact avulso. Na mesa, o coordenador decide o compromisso e quem o conduz no mesmo gesto, sem abrir o formulário grande só para isso.

## Persona e fluxo

- **Persona / contexto:** coordenador (ou assessor no recorte) planejando a semana do candidato, desktop e mobile, no meio de uma conversa — quer lançar compromissos rápido e seguir.
- **Job principal:** criar um compromisso no dia/horário certo da agenda **sem sair dela**.
- **Fluxo desejado:**
  1. Abre `/campanha/agenda`, aplica filtros se quiser.
  2. Clica num slot vazio (semana ou mês) no desktop → popover abre **naquele ponto**, com título vazio e **dia/horário já preenchidos do slot** (editáveis).
  3. Mobile → em vez de popover, um **bottom sheet** sobe com o mesmo conteúdo.
  4. Digita o mínimo obrigatório (título + município) e escolhe o **responsável** (candidato, assessor, liderança ou dobradinha), salva → o evento **aparece no calendário na hora**, sem reload.
  5. Precisa de mais campos? “Mais detalhes” leva ao formulário completo pré-preenchido.
- **Anti-goals de produto:** o popover **não** vira o formulário completo (tarefas, organizações, demandas, liderança vinculada e assessores responsáveis ficam no detalhe); salvar **não** navega (voltar à tela quebra o fluxo); **não** é mode de edição em massa; o seletor de responsável **não** cadastra pessoa nova — só escolhe entre entidades já existentes da campanha (candidato/assessor/liderança/dobradinha).

### Esboço de fluxo (C)

```text
[/campanha/agenda + filtros]
  → clique em slot vazio
  → [desktop] popover ancorado ao ponto / [mobile] bottom sheet
      → título + horário (pré-preenchido do slot, editável) + município + local
      → seletor de responsável (candidato · assessor · liderança · dobradinha)
      → Salvar → evento insere no calendário (sem reload)
      → “Mais detalhes” → /nova pré-preenchida (form completo)
```

## Objetivo e aceite

- Clicar num slot vazio da agenda abre criação **inline** (popover no desktop, bottom sheet no mobile) em vez de navegar para `/campanha/atividades/nova`.
- O popover/sheet abre com **início e fim pré-preenchidos do slot clicado** (ex.: o intervalo do clique; clique no dia cheio “vira” 09:00–10:00, como o comportamento atual de `dateClick`), e os horários são **editáveis**.
- Campos mínimos para salvar: **título** e **município** (obrigatórios do modelo) — local e **responsável** opcionais no overlay.
- O overlay traz um **seletor de responsáveis** que escolhe **um ou mais** entre **candidato/assessor/coordenador (staff `campaignUser`), liderança (`leadership`) ou dobradinha (`stateDeputy`)** — entidades da campanha já existentes, buscadas por nome (e celular quando fizer sentido), com rótulo indicando o tipo (ex.: “Maria (Assessora)”). Usa o campo **`responsible` polimórfico multi-valor** do remodel (C90).
- Após salvar, o evento **aparece imediatamente** na agenda sem recarregar a página; falha → toast de erro e nada some.
- “Mais detalhes” leva ao formulário completo (`/atividades/nova`) já com o que foi digitado, sem perder o que já foi feito.
- Reusa componentes shadcn já existentes (popover, drawer/sheet, inputs) — não inventar primitiva paralela.
- Liderança não acessa a agenda (inalterado).

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — affordance de escrita sobre a agenda; não introduz métrica, série, ranking ou mapa.
- **Decisões desbloqueadas:** ator decide “que compromisso entra neste slot” **no momento do planejamento**, sem fila de navegação.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/components/campaign/activity/ActivityAgenda.tsx` — `handleDateClick` hoje só monta `buildActivityCreateHref` e redireciona; vira abrir o popover/sheet com prefill.
  - `src/utilities/activityUi.ts` — `buildActivityCreateHref` / `parseActivityCreatePrefill`: o prefill do slot já existe; a criação inline precisa de um caminho que **não navegue**.
  - `src/app/(campaign)/campanha/actions/activity.ts` — `createActivity` já é uma action; criar inline via action que retorna o evento (sem `redirect`), e o calendário insere no estado local (mesma família do `rescheduleActivity`).
  - `src/app/(campaign)/campanha/(app)/atividades/nova/page.tsx` + `ActivityForm.tsx` — forma atual (referência de campos/validação), reutilizada só no “Mais detalhes”.
  - **Responsável:** hoje `responsible` é um `Contact` único (via `ContactCombobox`); `advisors` (hasMany `campaignUser`) e `leadership` (única) são campos separados. O seletor unificado do overlay precisa agregar opções de `leadership` + `stateDeputy` + staff `campaignUser` — precedentes: `searchActivityLeadershipOptions` (`activityLeadershipOptions`), `loadStateDeputyOptions` (`campaignRelationOptions`), `searchActivityContactOptions` (`contactSearchActions`). A direção de schema (`responsible` único vs lista) é questão em aberto de produto — não travada aqui (ver Rabbit holes / Questões).
- **Precedente a olhar:** `ActivityForm.tsx` (campos/validação), `rescheduleActivity`/`loadActivityAgendaEvents` (estado local do calendário), bottom drawer já usado em listas mobile (`CampaignListSheetHost` → `Drawer`), `criar-assessor-inline-popover-municipios` (B154 — criação inline em popover como precedente de pattern).
- **Risco de acoplamento:** estado local do FullCalendar (`events`/`reloadCount` em `ActivityAgenda`) — a criação inline deve seguir o mesmo padrão de otimismo/atualização do reschedule ou a célula pode dessincronizar; não quebrar o fluxo `redirect` do formulário completo.

## Dependências

- **Dura: C90 — remodelar `responsible` da Atividade ([#426](https://github.com/fsolla/teqo/issues/426))** (campo único polimórfico multi-valor; remove `advisors`/`leadership`). O seletor de responsáveis do overlay **consome o campo remodelado**.
- **Suaves:** `loadActivityAgendaEvents` (refetch da janela) — se a criação inline só insere localmente, revalidar a janela ao fechar.

## Fora de escopo

- Campos avançados inline (tarefas, organizações, demandas, liderança vinculada, assessores responsáveis) → formulário completo `/atividades/nova`.
- **Seletor de responsável não cadastra entidade nova** — só combina entidades já existentes (staff/candidato/liderança/dobradinha). Criar um `campaignUser` ou `leadership` na hora (padrão B154) **não** entra aqui, a menos que o produto peça explicitamente.
- Edição inline de evento existente (abrir continua indo ao detalhe).
- Recorrência, resources, sync Google (C16 já cobre import/sync).
- Mudanças no formulário completo de `/atividades/nova`.

## Rabbit holes de produto

- **“Vira o formulário inteiro no popover.”** Se alguém “só completar” campos, o popover vira uma segunda página de criação. **Corte neste item:** mínimo (título + município + horário + local) e um link “Mais detalhes”.
- **Responsável = vários campos.** O remodel (C90) unifica tudo num `responsible` polimórfico multi-valor; este item **não** soma campos — **Corte:** o overlay usa o campo remodelado (vários responsáveis de qualquer papel) e pronto. Se a mesa pedir algo além disso, vira novo item, não estica o popover.
- **“Criar a pessoa se não existir.”** B154 criou assessor inline na lista; aqui não. **Corte:** o seletor só escolhe dentre o que já existe; mensagem clara quando a busca não acha.
- **“Salvar e voltar pro detalhe.”** Navegar após salvar quebra o fluxo. **Corte neste item:** salvar fecha o overlay, evento aparece, usuário segue na agenda.
- **“Mostrar também nas células do mês.”** Mês é sprint de visão; criação no slot é o job. **Corte:** funcionar na semana e dia; no mês, clique no dia abre o popover com 09:00–10:00 (comportamento atual).

## Questões em aberto (produto)

- **Intervalo pré-preenchido:** **Opções:** A) usar o próprio intervalo do clique (meia-hora tipada no slot da semana) | B) fixo 1h a partir do horário do clique | C) 1h como hoje. **Recomendação: A** — é o que mais replica o Google Calendar; onde o intervalo do clique não dá (dia cheio do mês), usamos o comportamento atual (09:00–10:00). _(assumido — validar)_
- **“Mais detalhes” preserva o rascunho?** **Opções:** A) prefere popular o form completo via URL (já existe) | B) mantém o texto do popover no `defaultValue`. **Recomendação: A** + preencher `title` no link (novo parâmetro). _(assumido — validar)_
- **Após salvar, refetch ou inserção local?** **Opções (produto):** o evento deve **aparecer já** (inserção otimista/local) | ou **refetch da janela** (mais caro, mas “correto” com filtros). **Recomendação: refetch da janela** no fechamento — é o mesmo contrato dos filtros e evita estado duplicado; a sensação de “sem reload” vem de não navegar. _(decidir — se parecer lento no app, volta para inserção local)_
- **Validação de município no popover:** **Opções:** A) combobox com opções do escopo do ator (já carregadas na página) | B) select nativo | C) em branco e erra ao salvar. **Recomendação: A** — combobox leve, com o município do filtro ativo como opção inicial se houver filtro. _(assumido — validar)_
- **Seletor de responsáveis — decisão tomada no gate:** campo **`responsible` polimórfico multi-valor** (staff `campaignUser` nas funções assessor/candidato/coordenador, `leadership`, `stateDeputy`) — **remodel em C90**. Este item (C91) **consome** o campo remodelado no overlay; não decide schema. _Removido como questão em aberto — travada._
- **Responsável obrigatório ou opcional no overlay?** **Opções:** A) opcional (como o form completo hoje) | B) obrigatório para criar rápido. **Recomendação: A** — obrigatório só `title` e `municipality`; responsável é preenchido na primeira chance, sem travar a criação. _(assumido — validar)_

## Referências

- GitHub Issue: [#428](https://github.com/fsolla/teqo/issues/428)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c91-ui-draft.canvas.tsx`
- `src/components/campaign/activity/ActivityAgenda.tsx` — `handleDateClick` (prefill do slot + redirect atual)
- `src/utilities/activityUi.ts` — `buildActivityCreateHref`, `parseActivityCreatePrefill`
- `src/app/(campaign)/campanha/actions/activity.ts` — `createActivity`, `rescheduleActivity`, `loadActivityAgendaEvents`
- `src/components/campaign/activity/ActivityForm.tsx` — campos e validação do form completo
- `docs/plans/criar-assessor-inline-popover-municipios.md` — precedente de criação inline em popover (B154)
