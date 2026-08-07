# Impl: FullCalendar em `/campanha/agenda`

Status: aprovado
Atualizado em: 2026-08-07
Issue: #390
Intenção: docs/plans/fullcalendar-agenda-campanha.md
Appetite restante: ~1,5–2 dias eng (herdado; sem ampliar para sync, recorrência ou taxonomia)

## Leitura da intenção

- **Outcome:** staff opera a semana em `/campanha/agenda`: filtra o recorte que pode ver, cria pelo slot, abre o detalhe e remarca compromissos permitidos. Semana é a vista inicial; mês e lista continuam a um clique.
- **O que NÃO negociar:** filtros por município, deputado presente e tag; município obrigatório; coordinator/candidate são os únicos que remarcam compromisso com deputado; advisor preserva o escopo de atividades atual; leader continua em lockdown; C16 fica dona de import/sync.
- **O que reavaliar:** a hipótese previa novos componentes/actions de agenda sem saber que C14 já consolidou `activity`, filtros, formulário e o gate no owner atual. Também deixava redirect das rotas antigas em aberto, mas giros ainda geram atividades sem `startAt`, que não cabem no FullCalendar.

## Abordagem recomendada

```mermaid
flowchart LR
  U[URL /campanha/agenda<br/>municipality + deputyPresent + tag] --> R[RSC staff-gated<br/>opções acessíveis]
  R --> C[Ilha FullCalendar v7<br/>week / month / list]
  C -->|events function: intervalo ativo| A[server action de leitura]
  A --> L[activityPageData<br/>range limitado + overrideAccess false]
  L --> D[DTO mínimo por evento]
  C -->|slot| F[/atividades/nova<br/>horário + município prefilled]
  C -->|evento| E[/atividades/slug<br/>detalhe existente]
  C -->|drop / resize| W[rescheduleActivity]
  W --> T[transaction + lock activity:id<br/>fresh actor + overrideAccess false]
  T --> H[hooks Activity<br/>schedule + deputado]
  W -->|falha| X[FullCalendar revert + feedback]
```

### Decisões de engenharia

**1. FullCalendar v7 como uma dependência route-local**
Opções: A) `@fullcalendar/react@7.0.2` com subpaths v7 | B) React v7 com plugins separados v6 | C) calendário próprio.
Recomendação: **A** — instalar `@fullcalendar/react@7.0.2` e o peer `temporal-polyfill`, importando `daygrid`, `timegrid`, `list`, `interaction`, locale e tema pelos subpaths do próprio pacote. É MIT, declara React 19 e evita misturar majors. A ilha só entra no chunk de `/campanha/agenda`; `next/dynamic` com `ssr: false` entra apenas se o build provar que o pacote exige browser no import.
Rejeitadas: B — os pacotes separados publicados estão em v6.1.21 e criam incompatibilidade concreta; C — reimplementa seleção, week/month/list, drag, resize, teclado e touch fora do appetite.

**2. `activity` permanece o único modelo; sem migration**
Opções: A) calendar sobre `activity` | B) collection `agenda` | C) materialização paralela de eventos.
Recomendação: **A** — C14 já entregou `startAt`, `endAt`, `tags`, `deputyPresent`, município, status, índices e access.
Rejeitadas: B/C — duplicam ownership, exigem sincronização e não acrescentam produto.

**3. Feed dinâmico por server action POST e intervalo visível**
Opções: A) server action chamada pelo `events` function | B) GET JSON feed | C) carregar todo o histórico no RSC/browser.
Recomendação: **A** — o FullCalendar pede `[start, end)` ao navegar; a action autentica novamente e chama um loader no owner `activityPageData`. POST evita que o service worker de `/campanha` grave um GET autenticado em Cache Storage. O range é validado, exclusivo e limitado a 45 dias.
Rejeitadas: B — o service worker atual faz `cache.put` de GETs sob `/campanha`; exigiria outra exceção de segurança; C — payload sem limite e exposição desnecessária.

O `where` preserva eventos que atravessam a borda da vista:

```text
startAt < rangeEnd
AND (endAt > rangeStart OR (endAt ausente AND startAt >= rangeStart))
```

Município, deputado presente e tag combinam entre si com AND. Atividades sem data continuam fora do calendário e disponíveis na lista antiga.

**4. Contrato de filtro compartilhável, porém uma tag exata na v1**
Opções: A) `?municipality=12&deputyPresent=1&tag=Comício` | B) estado local | C) multi-tag já nesta fatia.
Recomendação: **A** — estender o owner client-safe `activityUi.ts` com parse, canonicalização, href e `where` da agenda. Ausência de `deputyPresent` significa todos; `1` significa somente com deputado. A tag é uma seleção exata entre valores acessíveis, preservando o contrato já entregue por C14 e deixando um link estável para C16.
Rejeitadas: B — não é compartilhável nem consumível por C16; C — exige fechar semântica OR/AND e UI de multisseleção sem necessidade para o aceite. Gatilho: C16 ou evidência da mesa de que um link precisa unir várias tags.

**5. Remarcação estreita, não o update completo**
Opções: A) action `rescheduleActivity` que aceita só `id/startAt/endAt` | B) chamar `updateActivity` | C) confiar apenas em `editable` no browser.
Recomendação: **A** — schema próprio, transação, fresh actor, advisory lock `activity:<id>`, leitura da linha com `overrideAccess: false` e update somente do horário. A política de deputado fica nomeada em `access/activities.ts`, é reutilizada pelo DTO/action/hook e o hook passa a considerar o estado original ou resultante de `deputyPresent`.
Rejeitadas: B — abre campos, demandas e parsing alheios ao gesto; C — affordance não é autorização.

A action retorna união serializável `{ ok: true } | { ok: false, message }`. Falha chama `revert()` no `eventDrop`/`eventResize`; a recusa de deputado usa uma constante segura única, e demais falhas viram mensagem genérica.

**6. Rotas antigas ficam vivas; agenda vira a entrada primária**
Opções: A) nav e links primários para `/agenda`, mantendo `/atividades` | B) redirect global `/atividades` → `/agenda` | C) mover detalhe/form para `/agenda`.
Recomendação: **A** — nav “Agenda”, page chrome, quick actions, dossier e navegação assistida apontam à agenda; detalhe, criação, edição, giros e a lista de cards continuam nos URLs atuais. `isCampaignNavActive` reconhece `/agenda` e a subárvore `/atividades` como uma vertical.
Rejeitadas: B — descarta `q/tab/status/page` e deixa rascunhos de giro sem data sem superfície; C — quebra links, notificações e bookmarks sem ganho.

**7. Detalhe existente em vez de drawer paralelo**
Opções: A) evento navega para `/campanha/atividades/[slug]` | B) novo painel/drawer | C) modal com cópia parcial.
Recomendação: **A** — o detalhe já concentra tarefas, atualizações, resultado e edição, além de permanecer acessível por teclado via URL do evento.
Rejeitadas: B/C — duplicam dados e estados sem serem exigidos pelo aceite.

**8. Bahia é o fuso explícito e a página continua dona do scroll**
Opções: A) `timeZone: 'America/Bahia'`, instantes UTC no servidor e `height: 'auto'` | B) fuso local do dispositivo | C) calendário com altura fixa e segundo scroll vertical.
Recomendação: **A** — callbacks usam strings ISO com offset/UTC e o formulário continua convertendo via `campaignTime`. `height: 'auto'` evita scroll vertical aninhado no shell. A toolbar compacta mantém Semana/Mês/Lista visíveis; touch usa o long-press nativo, mas formulário e botões continuam sendo as alternativas de teclado/touch.
Rejeitadas: B — desloca compromisso de quem estiver fora da Bahia; C — disputa scroll com `CampaignContentScroll`.

### Componentes / mudanças

- **Dependências** (`package.json`, `pnpm-lock.yaml`): `@fullcalendar/react@7.0.2` + `temporal-polyfill`; não instalar plugins v6 separados nem pacote premium.
- **`activityAgendaRequestSchema` / `activityRescheduleSchema`** (`src/lib/schemas/activity.ts`): range ISO limitado, filtros canônicos e payload mínimo de remarcação; constante segura da recusa de deputado.
- **Agenda URL/query** (`src/utilities/activityUi.ts`): `ActivityAgendaState`, parse/build/resolve de `/campanha/agenda` e `buildActivityAgendaWhere`; a lista antiga mantém o contrato atual.
- **Access** (`src/utilities/access/activities.ts`, `src/utilities/campaignAccess.ts`): política nomeada de remarcação; coordinator/candidate liberados, advisor só em compromisso sem deputado, leader negado.
- **DTO** (`src/utilities/activityViewModels.ts`): select mínimo e `ActivityAgendaEvent` com id, title, URL/slug, start/end, status, tags, deputado, município/localidade e `canReschedule`; sem Contact, liderança, tarefas ou documento Payload inteiro.
- **Loaders** (`src/utilities/activityPageData.ts`): eventos do range com `user + overrideAccess: false`; tags conhecidas deduplicadas e ordenadas sobre atividades acessíveis; nenhuma cache longa para dado vivo de 2026.
- **Actions** (`src/app/(campaign)/campanha/actions/activity.ts`): `loadActivityAgendaEvents` e `rescheduleActivity`; remarcação sob `withPayloadTransaction` + `acquireTextAdvisoryLocks`.
- **Defense in depth** (`src/collections/Activity.ts`): reutilizar a política nomeada no gate C14 e avaliar deputado no doc original ou resultante; sem alteração de schema/migration.
- **Rota** (`src/app/(campaign)/campanha/(app)/agenda/page.tsx`, `loading.tsx`): gate `staff`, canonicalização da URL, opções de município/tags acessíveis, CTAs existentes e skeleton local.
- **Filtros** (`src/components/campaign/activity/ActivityAgendaFilters.tsx`): controles acessíveis de município, deputado e tag; URL via `useCampaignListFilterNavigation`; loading/pending no resultado, não só no controle.
- **Calendário** (`src/components/campaign/activity/ActivityAgenda.tsx` + CSS escopado): ilha FullCalendar com `timeGridWeek`, `dayGridMonth`, `listMonth`, `interaction`, pt-BR e tema adaptado aos tokens `data-theme='campaign'`; `events` assíncrono, empty/error/loading, event click, slot click, drop/resize e `revert()`.
- **Criação prefilled** (`atividades/nova/page.tsx`, `ActivityForm.tsx`): aceitar `startAt/endAt/municipality` validados; município só é pré-selecionado se estiver nas opções acessíveis; reutilizar a action/form atual.
- **Chrome e caminhos** (`campaignPaths.ts`, `campaignQuickActionPaths.ts`, `campaignPageChrome.ts`, `components/campaign/shell/nav.ts`): separar “home da agenda” do root de detalhe de atividades, manter quick actions e estado ativo coerentes.
- **Links primários** (`MunicipalityDossier.tsx`, `campaignNavigationUrls.ts`, cancelamento do form quando for criação): apontar à agenda preservando filtros equivalentes; giro continua retornando à lista antiga para expor atividades sem data.
- **Migration:** nenhuma. A migration C14 é história congelada e não será editada.
- **Access / Consent:** staff-only; leader fail-closed pelas barreiras de página/action/collection. Sem PII nova e sem Consent.
- **UI:** Impeccable D, mas dentro da linguagem atual: FullCalendar route-local, tokens da campanha, alvos de 44 px, estado não comunicado só por cor, evento com texto/ícone de deputado/status e CTA visível como alternativa ao clique/drag.

### Dados → forma

- **Forma escolhida:** time grid semanal como decisão operacional primária; month para visão de distribuição; list para varredura linear e mobile/acessibilidade.
- **Por quê:** o job é conflito/encaixe no tempo, não comparação analítica; cards continuam úteis apenas como fila legada de sem-data e busca avançada.
- **Rejeitadas:** tabela (perde simultaneidade), cards como default (estado atual que C15 substitui), resources por assessor (premium e anti-goal).

### Fontes oficiais verificadas

- React 17–19, instalação v7, plugins por subpath e integração Next: https://fullcalendar.io/docs/react
- Event source assíncrono e fim exclusivo do range: https://fullcalendar.io/docs/events-function
- Named time zone e Temporal: https://fullcalendar.io/docs/timeZone
- `eventDrop.revert()`: https://fullcalendar.io/docs/eventDrop
- `eventResize.revert()`: https://fullcalendar.io/docs/eventResize
- Editabilidade por evento e `url`: https://fullcalendar.io/docs/event-object
- Touch por long-press: https://fullcalendar.io/docs/touch
- `height: 'auto'` sem scrollbar interna: https://fullcalendar.io/docs/height

## Fases verificáveis

1. **Tracer / contrato + server (~35%)**
   - Testes unitários primeiro para URL, range exclusivo/cap, combinação dos três filtros e política de remarcação.
   - Schemas, policy helper, loader range/tags, DTO, action de leitura e action de remarcação.
   - Testes de integração: coordinator/candidate movem compromisso com deputado; advisor move atividade comum do escopo, não move a do deputado; advisor fora do escopo e leader não leem/não movem; range e filtros não vazam linhas.
2. **UI funcional (~40%)**
   - Dependências v7, rota, filtros e ilha route-local com semana/mês/lista.
   - Slot → form prefilled; evento → detalhe; drop/resize → action + revert; loading/error/empty.
   - Nav/chrome/quick actions/links primários, mantendo lista/detalhe/giros antigos.
3. **Craft, critique e polish (~15%)**
   - Adaptar tema aos tokens, hierarquia de conteúdo e densidade da agenda.
   - Browser/E2E em desktop e 390×844: toolbar, week/month/list, teclado, clique de evento, prefill e drag permitido; negação server-side fica pinada no int test.
   - Confirmar que não há console error, scroll vertical aninhado nem indicador apenas por cor.
4. **Gates (~10%)**
   - `pnpm gate:fast` durante a iteração.
   - `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`, testes int/e2e afetados e build local no fechamento.
   - Push somente via `pnpm push`; PR Ready + auto-merge apenas com required checks verdes.

## Rabbit holes / Não escopo (engenharia)

- Sync Google, ICS/link de import e autenticação de feed: C16.
- Recorrência, resources, scheduler premium, calendários por assessor.
- Multi-tag OR/AND, filtros salvos, persistência de view/data no URL ou preferência de dispositivo.
- Drawer/modal de detalhe, quick-create paralelo e mudança das URLs de entidade.
- Tornar `startAt` NOT NULL: giros E13 mantêm drafts intencionalmente sem data.
- Corrigir em C15 defeitos adjacentes de C14 que não bloqueiam a agenda (escopo de município no create manual, status hidden no edit e política de notificações); revisar no `/simplify` e capturar débito se pontuar.
- Otimização raw SQL/distinct de tags antes de medida real; o loader acessível simples é a v1.

## Riscos e mitigação

- **Major incompatível:** v7 concentra plugins em `@fullcalendar/react`, enquanto pacotes separados estão em v6. Mitigação: pin único v7 + peer oficial; testes de build antes de craft.
- **Bundle:** week/month/list/interaction + Temporal são pesados. Mitigação: imports apenas na ilha da rota, DTO mínimo e inspeção do chunk no build; sem `locales-all` nem plugins premium.
- **Fuso:** native `Date` pode refletir o dispositivo mesmo com named zone. Mitigação: persistir UTC, usar `startStr/endStr` com offset e helpers Bahia; testes com instantes conhecidos.
- **RBAC:** editabilidade client pode ficar stale. Mitigação: fresh actor, Payload access com `overrideAccess: false`, policy no action/hook e `revert()` na UI.
- **Concorrência:** dois drags podem sobrescrever horário. Mitigação: advisory lock por atividade e desabilitar nova mutação do mesmo evento enquanto a primeira está pendente.
- **Range/performance:** overlap correto consulta `endAt` sem índice. Mitigação: range máximo de 45 dias, select mínimo e dado esperado pequeno; medir antes de migration de índice.
- **Mobile:** semana de sete colunas é densa e touch drag exige long-press. Mitigação: toolbar que quebra sem overflow, conteúdo compacto, lista sempre a um toque, CTA/form como alternativa e E2E 390×844; não usar `dayMinWidth`, que requer premium.
- **Atividades sem data:** não renderizam em calendário. Mitigação: manter lista antiga e retorno do compositor de giros.
- **Notificações:** o hook atual notifica assessores em toda mudança, inclusive drag. Mitigação nesta fatia: preservar comportamento existente; se o browser test mostrar ruído de produto, capturar como decisão separada em vez de silenciar implicitamente.

## Divergências da hipótese de direção

- **Sem novo `activityAgendaData.ts`:** leitura e DTO entram nos owners `activityPageData.ts` e `activityViewModels.ts`, evitando twin e novo top-level pinado.
- **Sem GET feed:** server action POST evita o cache explícito do PWA para GET autenticado.
- **Sem painel de evento:** o detalhe atual é a superfície operacional completa e vira o destino do clique.
- **Sem redirect de `/campanha/atividades`:** a lista permanece como compatibilidade e fila de giros sem data; somente a entrada primária muda para `/campanha/agenda`.
- **Uma tag por link na v1:** mantém o contrato C14 e cabe no appetite; multi-tag ganha gatilho explícito em vez de semântica inventada.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto: week/month/list, três filtros combinados, slot/create, detalhe, drag/resize permitido e rotas antigas.
- [x] `leader` negado e advisor limitado pelo access atual; nenhum loader/action usa Local API em nome do ator sem `overrideAccess: false`.
- [x] Remarcação é transacional, serializada por atividade e não usa o update amplo.
- [x] FullCalendar e CSS não entram no bundle comum de `/campanha`.
- [x] Fuso Bahia, range exclusivo, erro/revert, loading/empty e alternativas de teclado/touch testados.
- [x] Sem schema change/migration; C14 permanece congelada.

Decision-quality: 5/5 — decisões caras têm alternativas, cabe no appetite, rabbit holes estão nomeados, owners existentes são reutilizados e o outcome não foi reescrito.
