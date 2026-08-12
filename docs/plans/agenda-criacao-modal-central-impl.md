# Impl: C123 — Agenda: modal central como única superfície de criação/edição de atividade

Status: aprovado
Atualizado em: 2026-08-11
Issue: #667
Intenção: docs/plans/agenda-criacao-modal-central.md
Appetite restante: herdado (~1–1,5 dia eng)

## Leitura da intenção

- **Outcome:** um overlay só (modal central no desktop, drawer no mobile) cria E edita compromisso com todas as configurações do formulário completo; clique no slot abre criação; clique no evento abre edição; `/nova` e `/editar` saem sem redirecionamento (404); "Local" sem duplicação; Início/Término com seletor de data e seletor de hora separados, visíveis sem rolar; salvar não navega (refetch da janela).
- **O que NÃO negociar:** contrato civil `YYYY-MM-DDTHH:mm` de parse/validação; validação início ≤ término; modo todo-o-dia (só data); prefill do slot; permissões staff (`overrideAccess: false`); título imutável na edição; líderes intocados; detalhe `/atividades/[slug]` continua (não é formulário); recorrência fora.
- **O que reavaliar (hipóteses da intenção):**
  - A intenção sugere "popover vira modal" — confirmado, mas o mecanismo do popover inteiro (anchor no ponto de clique) morre junto; o container passa a ser `Dialog` (desktop) + `Drawer` (mobile, C103 intacto).
  - A intenção assume `ActivityForm.tsx` como referência de seções — confirmado: as seções (cards) migram para o overlay; `ActivityForm` inteiro morre (só as duas páginas o usam).
  - **Descoberta fora da hipótese:** o update em página está **quebrado desde C14** (adc29c03 removeu o `<input type="hidden" name="id">` de `ActivityForm`; `parseActivityUpdateFormData` exige `id` e lança `FormDataBoundaryError` em todo submit). O overlay conserta o caminho de edição ao renderizar `id` explícito.
  - `activityInlineErrors.ts` só mapeia duplicate-title; o overlay (form completo) precisa do mapeamento de `FormDataBoundaryError`/ZodError que `formActions.ts` já tem — os dois mappers se unificam no módulo de erros do overlay (formActions morre).

## Abordagem recomendada

```mermaid
flowchart LR
  slot["dateClick (slot)"] -->|activitySlotPrefill| req["request: {kind:'create', startAt, endAt}"]
  event["eventClick (evento)"] -->|preventDefault + id| req2["request: {kind:'edit', activityId}"]
  req --> overlay["ActivityOverlay<br/>(Dialog desktop / Drawer mobile)"]
  req2 --> overlay
  overlay -->|edit: busca| draft["loadActivityEditDraft<br/>(action, activityFormSelect, overrideAccess:false)"]
  overlay -->|create/edit| form["ActivityOverlayForm<br/>(todas as seções do ActivityForm)"]
  form -->|FormData| create["createActivityOverlay / updateActivityOverlay<br/>(reusa parseActivity*FormData + create/updateActivityRecord)"]
  create -->|{ok}| close["fecha + refetch da janela (setReloadCount)"]
  create -->|{ok:false}| inline["overlay aberto + fieldErrors/toast"]
  draft -->|"ActivityFormViewModel"| form
```

**Opções consideradas:** A (recomendada, abaixo) | B (objeto estruturado client-side) | C (overlay no server component via RSC)
**Recomendação:** A — **editar o dono**: `ActivityInlineCreate.tsx` é renomeado/estendido para `ActivityOverlay.tsx` (container Dialog/Drawer + form completo); o pipeline de submit vira FormData indo para as novas actions `createActivityOverlay`/`updateActivityOverlay` que **reusam os parsers server-side existentes** (`parseActivityCreateFormData`/`parseActivityUpdateFormData` — únicos, testados, usados pelo giro) e os `*Record` transacionais, retornando `{ ok }` com `fieldErrors` mapeados. O overlay renderiza os campos controlados com `name` + inputs hidden (startAt/endAt/allDay/municipality/status/id); as seções (tags/responsáveis/orgs/tarefas/demandas) já emitem hidden inputs próprios. Sem segunda parser no client.
**Rejeitadas:** B — client teria que serializar 5 JSONs (tasks/demands/responsibles/tags/orgs) com parsing próprio, duplicando `activityFormData.ts` no browser; C — RSC não sustenta overlay com estado + fetch pós-clique.

### Decisões de engenharia

**D1 — Container do overlay.**
Opções: A) `Dialog` (desktop, central, com overlay escuro) + `Drawer` topo (mobile, C103) | B) manter `Popover`+anchor e só crescer o conteúdo | C) `Sheet` lateral nos dois.
Recomendação: **A** — o aceite é "modal central", o popover ancorado morre (o anchor `{x,y}` sai do draft); `Dialog` do shadcn (`dialog.tsx`, `max-w-sm` default → override p/ `max-w-2xl`) com corpo rolável e rodapé fixo (corte do rabbit hole da intenção); mobile continua o sheet do topo do C103 (mesma anatomia, mesmas seções, labels sr-only). Seleção pelo mesmo `isNarrow` (ResizeObserver, 640px) de hoje.
Rejeitadas: B — anti-aceite explícito (popover sai); C — sheet lateral não é modal central nem bottom sheet.

**D2 — Dados da edição (quem busca o view model).**
Opções: A) o overlay busca sozinho no mount via action `loadActivityEditDraft(activityId)` | B) o pai (ActivityAgenda) busca no eventClick e passa por prop | C) embutir o form completo no fetch de eventos da janela.
Recomendação: **A** — o overlay vira o dono do contrato "editar atividade por id", reutilizável no detalhe (botão Editar) sem duplicar loading no calendário; `loadActivityEditDraft` = `findByID` com `activityFormSelect`, depth 1, `overrideAccess: false` + actor → `toActivityFormViewModel` (scoping de advisor herdado do access). C deixa o fetch da agenda pesado (todo evento carregaria descrição/orgs/tarefas).
Rejeitadas: B — espalha o fetch para cada host; C — regressão de payload da janela.

**D3 — Submit: FormData nas actions do overlay.**
Opções: A) `createActivityOverlay(formData)`/`updateActivityOverlay(formData)` reusando `parseActivity*FormData` + `create/updateActivityRecord`, retorno `{ok, message, fieldErrors}` | B) manter `createActivityInline(input: object)` e criar `updateActivityInline` análogo, com parse dos JSONs no client | C) useActionState + redirect como o form antigo.
Recomendação: **A** — um parser server-side único (os parsers já existem e o giro depende deles); o client só dá `name` aos controlados (o `ActivityDateTimeField` reescrito emite o civil via hidden input). O mapeamento de erro junta o duplicate-title (`activityInlineErrors.ts`, estendido) + duplicate-demand + `FormDataBoundaryError`/ZodError via `mapCampaignFormActionError` — o `getActionError` do formActions morre junto com as páginas, seu conteúdo migra para `activityOverlayErrors.ts`.
Rejeitadas: B — client duplica parsing/validação de 5 campos JSON (drift client×server que o repo evitou até hoje); C — redirect é anti-aceite (salvar não navega).
**Bug legado consertado:** o overlay de edição renderiza `<input type="hidden" name="id">` — o caminho de update estava quebrado desde C14.

**D4 — Seletor de data + hora separados.**
Opções: A) reescrever `ActivityDateTimeField` internamente: trigger de data (calendar em popover desktop / bottom sheet mobile) + selects Hora/Minuto **inline** lado a lado, sempre visíveis | B) dois componentes novos (DatePicker + TimeSelects) | C) manter o picker único atual e só remover o duplicado de Local.
Recomendação: **A** — contrato civil `YYYY-MM-DDTHH:mm` e props inalterados (quem usa hoje: só o overlay); o time sai de dentro do popover (anti-aceite atual: "horário escondido abaixo do calendário"); all-day oculta só os selects de hora. Mobile: linha `[dia][hora][minuto]` compacta (aceite C123: dia e hora lado a lado na mesma linha, Início em cima / Término embaixo).
Rejeitadas: B — dois módulos para um único conceito "campo data+hora" (pass-through); C — não cumpre o aceite.

**D5 — Clique no evento abre a edição (e o detalhe continua acessível).**
Opções: A) `eventClick` no FullCalendar com `preventDefault` → abre overlay de edição; manter `url` no EventInput (middle-click/abrir em nova aba ainda navega ao detalhe) | B) remover `url` e interceptar tudo | C) manter navegação e só o botão Editar abre overlay.
Recomendação: **A** — decisão do gate (recomendação A da intenção); `preventDefault` no `eventClick` cobre clique simples; o `url` preserva o detalhe por atalhos de browser; o overlay de edição ganha link "Ver detalhes" (ghost, esquerda do rodapé).
Rejeitadas: B — perde o detalhe por middle-click; C — anti-aceite (clique no evento abre overlay).

**D6 — Pontos de entrada que apontavam para `/nova` (não podem 404).**
Opções: A) contexto de quick actions (precedente C94/C114 `openCalendarFeed`/`openGoogleCalendarSync`): `openActivityCreate`/`openActivityEdit` funções no `CampaignQuickActionContext`, bridged por cada página; FAB e botões viram `onAction` | B) manter href e redirecionar para a agenda com `?nova=1` | C) remover os botões.
Recomendação: **A** — mesma ponte que a agenda já usa para os diálogos de feed/Google; cada host monta o overlay e bridga: agenda (FAB + ícone "+" dos filtros → create com draft padrão hoje 09:00–10:00 via `activitySlotPrefill({allDay:true})`), lista `/atividades` (botão "Nova atividade" + FAB), detalhe (botão "Editar" + FAB edit → overlay de edição com `view.id`). `ACTIVITY_NEW_PATH` e a entrada `atividadesNova` do catálogo de chrome morrem.
Rejeitadas: B — param novo na agenda (estado de URL whitelisted) para um atalho que o contexto já resolve; C — regressão de feature.

**D7 — O que morre (remoção sem redirect, 404 — decisão do gate).**

- Páginas `nova/page.tsx` e `[slug]/editar/page.tsx` + `formActions.ts` (redirect-based) + `ActivityForm.tsx` (sections migram para o overlay).
- `activityUi.ts`: `buildActivityCreateHref`, `parseActivityCreatePrefill`, `ActivityCreatePrefill`, `parseActivityAgendaReturnHref` (+ helpers privados de prefill) — "Mais detalhes" morre junto; `activitySlotPrefill` permanece (prefill do slot + draft padrão).
- `activityPageData.ts`: `getActivityEditPageData` (só a página editar usava) — o novo `loadActivityEditDraftRecord` busca por id.
- `campaignPageChrome.ts`: match de `/atividades/nova` + catálogo `atividadesNova` + match de `/atividades/[slug]/editar`.
- `activityQuickActions.ts`: `new-activity` e `edit-activity` passam de `href` para `onAction` (contexto); `ACTIVITY_NEW_PATH` sai.
- `ActivityInlineCreate.tsx` → **`ActivityOverlay.tsx`** (rename + rewrite; `ActivityInlineCreateDraft` vira `ActivityOverlayRequest` sem `anchor`).
- `activityInlineErrors.ts` → **`activityOverlayErrors.ts`** (estende: duplicate-title + duplicate-demand + boundary/zod).

### Componentes / mudanças

- **`ActivityOverlay.tsx`** (client, renomeado de `ActivityInlineCreate.tsx`): props `{ request: ActivityOverlayRequest | null, agendaState, municipalityOptions, organizationOptions, knownTags, searchContacts, searchResponsibles, onClose, onSaved }`; container `Dialog`/`Drawer` pelo `isNarrow`; `ActivityOverlayForm` com todas as seções (Informações básicas → título readOnly na edição + tags + descrição + deputado presente; Data e horário → `ActivityDateTimeField` reescrito + todo-o-dia; Onde → município `StrictCombobox` + Local **uma única vez**; Pessoas e organizações → `ResponsibleMultiSelect` + `RelationMultiSelect`; Tarefas → `ActivityTaskFields`; Demandas → `ActivityDemandFields`); modo edit busca `loadActivityEditDraft` no mount (estado de loading no modal) e renderiza `id` hidden; rodapé fixo: edição `[Ver detalhes] [Cancelar] [Salvar]`, criação `[Cancelar] [Salvar]`; hidden `status=confirmado` só na criação (na edição não envia status — evita realizar→confirmado).
- **`ActivityDateTimeField.tsx`** (client): reescrito — trigger de data (calendar em popover desktop / nested bottom sheet mobile) + `NativeSelect` Hora + Minuto inline; `timeVisible={false}` (todo-o-dia) oculta só os selects; contrato e props preservados.
- **`actions/activity.ts`**: `createActivityOverlay`/`updateActivityOverlay` (FormData → parse → `*Record` → `{ok}`) substituem `createActivityInline`; novo `loadActivityEditDraft` (findByID `activityFormSelect`, depth 1, `overrideAccess:false`).
- **`utilities/activityOverlayErrors.ts`**: mapeamento unificado (duplicate-title, duplicate-demand, boundary/zod, fallback genérico).
- **`ActivityAgenda.tsx`**: estado vira `request` (`create` com prefill do slot / `edit` com id); `eventClick` → preventDefault + edit; `organizationOptions` prop nova; ponte `openActivityCreate` no contexto (draft padrão); onSaved = fechar + refetch (já é o mecanismo de hoje).
- **`agenda/page.tsx`**: carrega `loadOrganizationOptions` (nova) e passa ao `ActivityAgenda`.
- **`[slug]/page.tsx` (detalhe)**: botão "Editar" vira host client `ActivityEditOverlayHost` (botão + overlay + ponte `openActivityEdit`); página passa a carregar municipality/organization options + knownTags.
- **`atividades/page.tsx` (lista)**: botão "Nova atividade" vira host client `ActivityCreateOverlayHost` (draft padrão + ponte `openActivityCreate`); página carrega organization options + knownTags.
- **Migration:** nenhuma — sem mudança de schema.
- **Access / Consent:** nenhum novo — todas as escritas pelos mesmos `*Record` (`overrideAccess: false` + actor); `loadActivityEditDraft` idem (advisor escopado pelo access do payload); líderes não alcançam nenhum host (agenda/detalhe/lista são staff-gated; `isStaff` já condiciona o botão Editar).
- **UI:** Impeccable C — fluxo redesenhado na agenda (shape → craft → critique → polish). Desktop: modal central `max-w-2xl`, seções em cards como o formulário atual, corpo rolável + rodapé fixo. Mobile: sheet do topo do C103 com as mesmas seções em linhas label-less + rodapé fixo; linhas de Início/Término `[dia][hora][minuto]`.

### Dados → forma

N/A — superfície de escrita; nenhum dado novo de apresentação.

## Fases verificáveis

1. **Server/actions** (maior parte do appetite): `activityOverlayErrors.ts`; `createActivityOverlay`/`updateActivityOverlay`/`loadActivityEditDraft`; unit dos mappers; int do `loadActivityEditDraftRecord` (scoping advisor/leader) e do update com `id`. Verificar: `tsc`, `pnpm test` int.
2. **UI overlay** (Impeccable C): `ActivityOverlay.tsx` + `ActivityDateTimeField` reescrito + hosts (agenda/detalhe/lista) + ponte de quick actions; remoção das páginas/formActions/ActivityForm/prefill. Verificar: `tsc`, `lint`, `knip` (órfãos: `buildActivityCreateHref`, `getActivityEditPageData`, `atividadesNova`, `ACTIVITY_NEW_PATH`), `check:cycles`.
3. **Testes** — unit: `activityOverlay.unit.spec.tsx` (rewrite do `activityInlineCreate.unit.spec.tsx`: modal central, Local único, seções completas, edição prefilled + id, título readOnly, Ver detalhes); `activityUi.unit.spec.ts` (sai prefill, fica slotPrefill); `activityAgendaInteractions.unit.spec.tsx` (+ eventClick → overlay de edição). e2e: `campaignActivity.e2e.spec.ts` (o de "/nova com demandas" vira fluxo pelo overlay; "Mais detalhes" vira edição pelo overlay; C104 atualiza clique no evento → overlay → "Ver detalhes"); `campaignAgendaMobile.e2e.spec.ts` (C103: hora inline, sem bottom sheet aninhado nem "Pronto").
4. **Gates** — `tsc --noEmit`, `lint` (0 warnings), `format:check`, `knip`, `check:cycles`, `pnpm test`, `pnpm test:e2e`, `pnpm build` contra DB local.

## Rabbit holes / Não escopo (engenharia)

- Redesenho da página de detalhe (fora — leitura/resultado fica como está).
- Recorrência, drag-and-drop de remarcação, filtros/feed iCal, Google sync — intocados.
- Segundo estilo de card no modal (2ª variante visual) — o modal herda os cards do formulário.
- Prefetch do view model de edição no hover do evento — barato demais para agora; o fetch no mount já é rápido (um findByID).

## Riscos e mitigação

- **e2e quebrados pela remoção das rotas:** esperado — substituir os 3 fluxos (`/nova` com demandas, "Mais detalhes", clique no evento → detalhe) por fluxos via overlay, não remover cobertura.
- **e2e mobile C103 (bottom sheet aninhado do tempo):** o aceite C123 muda a anatomia (hora inline) — atualizar as asserções (sem "Pronto", selects visíveis na linha).
- **Update quebrado desde C14:** o overlay renderiza `id` — o caminho de edição passa a funcionar; cobrir com e2e novo (editar via overlay, evento atualiza sem navegar).
- **`Dialog` aninhado** (seletor de data em popover dentro do modal; `CommandDialog` dos responsáveis por cima): portais Radix separados, mesmo comportamento já validado no sheet do C103; validar no craft.
- **knip com órfãos do form antigo:** remover no mesmo commit das páginas (grep de cada símbolo antes de apagar — `ActivityFormState`, `buildActivityCreateHref`, etc.).
- **Clique vs drag no FullCalendar:** `eventClick` não dispara após drag (comportamento do FullCalendar, já exercitado pelo teste de remarcação que continua verde).

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto: modal central desktop / drawer mobile; todas as seções no overlay (criar E editar); clique no slot abre criação com prefill; clique no evento abre edição (detalhe via link no overlay); `/nova` e `/editar` → 404 sem redirect; "Local" único; data e hora em seletores separados visíveis sem rolar; salvar não navega + refetch da janela; guardrails intactos (civil, início ≤ término, todo-o-dia, título imutável, staff)
- [ ] Invariantes AGENTS/engineering-standards: mesmos `*Record` transacionais com `overrideAccess: false` + actor; sem `Contact`/Consent novos; identificadores em inglês; copy pt-BR; sem migration; líderes intocados
- [ ] Testes de domínio: unit (overlay create/edit, erro inline, mappers), int (scoping do `loadActivityEditDraft`, update com id), e2e (criação completa pelo overlay, edição pelo clique no evento, remoção das rotas, mobile hora inline)
