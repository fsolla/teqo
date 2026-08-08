# Impl: Criar evento inline no calendário da agenda (estilo Google Calendar)

Status: aprovado
Atualizado em: 2026-08-08
Issue: #428
Intenção: docs/plans/agenda-criar-evento-inline.md
Appetite restante: herdado (~1–1,5 dia eng)
Model: composer-2.5 (sessão: DeepSeek V4 Flash — família Flash, pareia com `model-local: deepseek-v4-flash-high`; segue sem pausa)

## Leitura da intenção

- **Outcome:** clicar num slot vazio de `/campanha/agenda` abre criação **inline** (popover no desktop, bottom sheet no mobile) com dia/horário do slot pré-preenchidos e editáveis; campos mínimos título + município (+ local e responsáveis opcionais); salvar **não navega** e o evento **aparece já** na agenda; "Mais detalhes" vai ao formulário completo pré-preenchido.
- **O que NÃO negociar:** não vira formulário completo no overlay; salvar não navega; seletor de responsáveis **não cadastra** entidade nova (só combina entidades existentes de candidato/assessor/coordenador - `campaignUser`, `leadership`, `stateDeputy`); `leader` não acessa agenda; reusa componentes shadcn (popover, drawer, inputs) — sem primitiva paralela.
- **O que reavaliar (hipóteses da intenção):**
  - A intenção cita "`ActivityForm.tsx` reutilizada só no 'Mais detalhes'". Revisão: `ActivityForm` é o formulário completo multi-card — **não** é base do overlay. O overlay é um componente novo mínimo; a referência de campos/validação vem de `activityCreateSchema`/`activityFormData.ts`, não do JSX do form.
  - A intenção supõe "state local do FullCalendar" como o único mecanismo. O contrato já decidido é **refetch da janela** no fechamento (`setReloadCount`) — que é exatamente o mesmo mecanismo que o reschedule usa. Não há "inserção otimista" a inventar.
  - `dateClick` hoje é a **única** ocorrência de `useRouter` em `ActivityAgenda` — com a criação inline, o router sai do componente (simplificação real, não cerimônia).

## Abordagem recomendada

```mermaid
flowchart LR
  click["dateClick(info)"] -->|"slotPrefill(info)"| prefill["{startAt,endAt} (30min / 09:00–10:00 no mês)"]
  click -->|"narrowRef?"| container{"isNarrow"}
  container -->|"não (desktop)"| popover["Popover + PopoverAnchor no ponto do clique"]
  container -->|"sim (mobile)"| drawer["Drawer bottom sheet"]
  popover --> form["ActivityInlineCreateForm (mesmo conteúdo)"]
  drawer --> form
  form -->|"Salvar"| action["createActivityInline (server action)"]
  action -->|"{ok:true}"| close["fecha overlay + setReloadCount(n+1)"]
  action -->|"{ok:false}"| inline["erros inline + toast · overlay aberto"]
  form -->|"Mais detalhes"| href["buildActivityCreateHref(+ title/municipalityId) → /nova"]
```

**Opções consideradas:** A (recommendada, abaixo) | B | C …
**Recomendação:** A — overlay mínimo novo reusando todo o maquinário existente: `createActivityRecord` (transação + access), `popover`/`drawer`, `ResponsibleMultiSelect` + `searchActivityResponsibleOptionsAction`, `StrictCombobox` sobre `municipalityOptions`, intervalo +30min (recomendação 1 da intenção), refetch da janela no fechamento (decisão da intenção). Cobre o aceite sem abrir segunda página de criação nem nova rota.
**Rejeitadas:** ver Decisões D1–D5.

### Decisões de engenharia

**D1 — Superfície server da criação inline.**
Opções: A) nova server action `createActivityInline` em `src/app/(campaign)/campanha/actions/activity.ts`, retornando `{ ok: true } | { ok: false; message; fieldErrors? }` (mesmo contrato de resultado do `rescheduleActivity`) | B) cliente chama `createActivity` (existente) e mapeia erro no try/catch | C) rota JSON nova.
Recomendação: **A** — `rescheduleActivity` já estabelece o padrão `{ok}` de ação chamada pelo calendário; `createActivity` lança erro (serve `createActivityFormAction`, que faz redirect) e **não** tem mapeamento de erro amigável (ZodError/unique). O wrapper A chama `createActivityRecord` (transação + access por `overrideAccess: false` + `user`, byte a byte o caminho do form completo), detecta o duplicate-title (constante `'Já existe uma atividade com este título.'`, mesma string do formAction) e mapeia `fieldErrors` de `title`/`municipality` para dentro do overlay.
Rejeitadas: B — duplica o mapeamento de erro no cliente e vaza `ZodError` cru; C — rota JSON onde a ação de server já existe (over-d escopo).

**D2 — Onde vive o overlay.**
Opções: A) tudo inline em `ActivityAgenda.tsx` | B) componente novo `ActivityInlineCreate.tsx` em `src/components/campaign/activity/` | C) reusar `ActivityForm` com variante minimalista.
Recomendação: **B** — `ActivityAgenda` já tem ~340 linhas e é dona do FullCalendar (resize/refetch/estado). O overlay é uma unidade coesa (prefill, estado do form mínimo, ação, erros) que merece módulo próprio; o conteúdo único `ActivityInlineCreateForm` é renderizado dentro do **Popover** (desktop) ou do **Drawer** (mobile) conforme `isNarrow`.
Rejeitadas: A — incha o componente de calendário com form state; C — `ActivityForm` é o formulário completo (tarefas/orgs/demandas); antiviral da intenção é o overlay **não** virar o form completo.

**D3 — Contêiner do overlay (desktop vs mobile).**
Opções: A) desktop `Popover`+`PopoverAnchor` no ponto do clique (`info.jsEvent.clientX/Y`) / mobile `Drawer` bottom; conteúdo compartilhado | B) `Dialog` único para os dois | C) `Sheet` lateral.
Recomendação: **A** — é o único que cumpre "popover abre naquele ponto" (aceite explícito) e "bottom sheet" (aceite explícito), reusando as primitivas existentes (`Popover` com `PopoverAnchor`, `Drawer`). A seleção usa o mesmo breakpoint do ResizeObserver atual (`MOBILE_BREAKPOINT_PX = 640`), espelhado em estado `isNarrow`.
Rejeitadas: B — modal central não é ancorado ao ponto e quebra o aspecto de Google Calendar; C — `Sheet` lateral não é bottom sheet no mobile nem popover no desktop.

**D4 — Intervalo pré-preenchido.**
Opções: A) `info.dateStr` (já cherry-pickado pelo snap do FullCalendar, slot 30min) → end = start + 30min; allDay (mês) → 09:00–10:00 como hoje | B) +1h sempre | C) meia-hora sempre, mês também.
Recomendação: **A** — é a recomendação 1 da intenção ("mesma letra do Google Calendar": o clique no slot tipado vira o próprio slot). Helper puro `activitySlotPrefill` em `activityUi.ts` (testável, usa `parseBahiaDateTimeInput` já importado lá). O teste e2e existente que afirma 1h no slot (comportamento antigo) é **atualizado** para 30min.
Rejeitadas: B/C — divergem do que o plano de intenção travou.

**D5 — "Mais detalhes" preserva o rascunho.**
Opções: A) preencher o form completo via URL — `startAt`/`endAt`/`municipality` (já suportados) + **`title`** (parâmetro novo) | B) guardar rascunho em memória/estado global.
Recomendação: **A** — `ActivityCreatePrefill` ganha `title?: string`; `buildActivityCreateHref` passa `title` e passa a usar o `municipalityId` (o tipo já o declarava, o builder o omitia); `parseActivityCreatePrefill` valida `title` (trim ≤ 160); `ActivityFormFields` lê `initialValues?.title` no `defaultValue` do campo título (ordem: `submittedTitle ?? initialValues?.title ?? activity?.title`).
Rejeitadas: B — estado efêmero não sobrevive à navegação; a URL já é o contrato de prefill do form completo.

### Componentes / mudanças

- **`activitySlotPrefill`** (`src/utilities/activityUi.ts`): `({ allDay, dateStr }) => { startAt, endAt }` — allDay → `parseBahiaDateTimeInput(`${date[0..9]}T09:00`)` + 1h (hoje); timeGrid → `dateStr` + 30min. Puro, exportado.
- **`ActivityCreatePrefill.title` + `buildActivityCreateHref` + `parseActivityCreatePrefill`** (`src/utilities/activityUi.ts`): param `title` e uso de `municipalityId` no href.
- **`ActivityForm.tsx`**: `defaultValue` do título inclui `initialValues?.title` (uma linha).
- **`createActivityInline`** (`src/app/(campaign)/campanha/actions/activity.ts`): wrapper `{ok}` chamando `createActivityRecord` com `input: ActivityCreateInput` (title/municipality/startAt/endAt/locality/responsible), mapeando erro → `message` + `fieldErrors` (duplicate-title → `title`). Retorna `ActivityInlineCreateResult`.
- **`ActivityInlineCreateForm` + `ActivityInlineCreate`** (client, `src/components/campaign/activity/ActivityInlineCreate.tsx`): o primeiro é o _conteúdo_ (título, Início/Término `datetime-local`, Município `StrictCombobox`, Local, `ResponsibleMultiSelect`, erros inline via `FieldError`/`Alert`, rodapé "Mais detalhes" + "Salvar" com spinner); o segundo é o _contêiner_ que escolhe `Popover` (com `PopoverAnchor` fixo no ponto do clique) ou `Drawer`, controla `open`, chama `createActivityInline` e notifica `onCreated` no sucesso. Reusa `StrictCombobox` (mapeando `municipalityOptions` → `{ value: String(id), label: name }`), `searchActivityResponsibleOptionsAction`, `formatIsoAsBahiaDateTimeInput`/`parseBahiaDateTimeInput`.
- **`ActivityAgenda.tsx`**: `handleDateClick` → `activitySlotPrefill` + abre o overlay (estado `draft { startAt, endAt }` + `anchor { x, y }` + `isNarrow`); remove `useRouter`; sucesso do overlay → `setReloadCount(n+1)` (refetch da janela, contrato dos filtros); feliz: nenhum `redirect`. Nova prop `municipalityOptions: RelationOption[]` (já carregada na page).
- **`agenda/page.tsx`**: passa `municipalityOptions` para `ActivityAgenda`.
- **Migration:** nenhuma (nenhuma mudança de schema).
- **Access / Consent:** nenhum novo — a criação inline herda o access do `createActivityRecord` (`overrideAccess: false` + `user`; advisor restrito ao portfolio pelo mesmo caminho do form completo). Sem `Consent` (dado interno de staff).

### Dados → forma

N/A — affordance de **escrita** sobre a agenda; a intenção já declara `Dados: N/A`. Nenhuma métrica/série/ranking novo.

## Fases verificáveis

1. **Schema/server** (maior parte do appetite): helper `activitySlotPrefill` + prefill title/municipalityId + `createActivityInline` + unit (helper, URLs, prefill, action int).
2. **UI** (Impeccable C — fluxo novo sobre tela existente): `ActivityInlineCreateForm` + contêiner Popover/Drawer → shape → craft → critique → polish. Fine-tuning do `isNarrow`/breakpoint.
3. **Gates**: `pnpm gate:fast` na iteração; e2e do fluxo inline (desktop) e atualização do teste antigo de slot→redirect; `pnpm push` no fechamento (com este impl.md no commit).

### Testes

- **Unit** (`tests/unit/activityUi.unit.spec.ts`): `activitySlotPrefill` (timeGrid +30min; allDay 09:00–10:00; datas inválidas → fallback seguro); `buildActivityCreateHref` com `title`/`municipalityId`; `parseActivityCreatePrefill.title` (trim, cap 160, drop inválido).
- **Unit interação** (`tests/unit/activityAgendaInteractions.unit.spec.tsx`): mock do FullCalendar ganha `dateClick`; asserta que clicar abre o overlay (não usa mais `routerPush`); salvar chama `createActivityInline` e, no sucesso, dispara refetch da janela; na falha mantém o overlay aberto + toast.
- **Int** (`tests/int/campaignActivity.int.spec.ts`): `createActivityInline` — coordinator/candidate criam com `responsible` polimórfico (multi) e sem; advisor cria dentro do portfolio e é negado fora do escopo (mesmo caminho de access do form completo); título duplicado → `{ ok:false, fieldErrors.title }` com a string do formAction; payload mínimo inválido → fieldErrors.
- **E2E** (`tests/e2e/campaignActivity.e2e.spec.ts`): **atualizar** o teste "leva o slot semanal para o formulário existente" → "abre a criação inline no slot clicado": clicar no slot abre o popover com `datetime-local` pré-preenchido (30min), preencher título + município, Salvar → evento aparece sem navegar; novo teste "Mais detalhes" → `/campanha/atividades/nova` com título/município/horários pré-preenchidos. (Drawer mobile: coberto por unit de componente se viável; e2e mobile fica fora do appetite curto — decisão de escopo.)

## Rabbit holes / Não escopo (engenharia)

- Overlay vira formulário completo (tarefas/organizações/demandas) → anti-goal, `Mais detalhes` cobre.
- Seletor de responsável cadastrar entidade nova (padrão B154) → anti-goal explícito.
- Inserção otimista local complexa no FullCalendar → contrato decidido é refetch da janela.
- Double-nested modal: `CommandDialog` do `ResponsibleMultiSelect` abre por cima do Drawer/Popover (portais separados). Risco de usabilidade em mobile (nested modal). Sem nova primitiva no v1; se janky no teste manual, swap do contêiner do seletor vira follow-up — não estica o popover.
- Posicionamento do `PopoverAnchor` usanado ponto `clientX/clientY` fixo: risco de borda (clique perto da margem). Mitigação: `align="start"` + `sideOffset`; radix reposiciona via content parts; aceitável.
- Mês: criação no slot do dia cheio → 09:00–10:00 (comportamento atual, inalterado).

## Riscos e mitigação

- **Quebra do teste e2e antigo (slot → redirect):** esperado — o comportamento mudou por aceite; substituir pelo fluxo inline, não remover a cobertura.
- **Nested CommandDialog sobre o Drawer (mobile):** reuso do componente existente por DRY; se o teste manual mostrar janky, degradar para abrir o seletor sem dialog (Command inline) num follow-up curto.
- **Refetch pós-criação parecer lento:** mesmo contrato dos filtros (mais barato que o estado local duplicado); se no app parecer lento, a intenção autoriza voltar para inserção local — medir, não presumir.
- **`StrictCombobox` de município com 435 opções no popover:** filtro por inicio de palavra já cobre; o `state.municipality` ativo vem pré-selecionado (opção inicial da intenção).

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: clique no slot abre inline (popover desktop / sheet mobile), horários do slot pré-preenchidos e editáveis, título+município mínimos, local e responsáveis opcionais, seletor polimórfico multi (C90) sem cadastro novo, salvar não navega e evento aparece (refetch), falha fica no overlay + toast, "Mais detalhes" pré-preenche o form completo, `leader` intocado
- [ ] Invariantes AGENTS/engineering-standards: escrita multi-collection via `createActivityRecord` já transacional com `req`; `overrideAccess: false` com `user` herda o caminho abaixado; identificadores em inglês / strings pt-BR; sem migration; sem `Consent` novo
- [ ] Testes de domínio: unit (slotPrefill/URLs/prefill), unit interação (dateClick→overlay→create→refetch), int (`createActivityInline` roles/escopo/duplicate), e2e (percentual do fluxo desktop + teste antigo atualizado)
