# Impl: C101 — Agenda mobile: calendário com cara de app nativo

Status: aprovado
Atualizado em: 2026-08-09
Issue: #497
Intenção: docs/plans/c101-agenda-mobile-calendario-nativo.md
Appetite restante: ~1,5–2 dias eng (herdado)

## Leitura da intenção

- **Outcome:** no celular, `/campanha/agenda` se comporta como calendário nativo: contexto do período no header do app (no lugar de "Agenda"), navegação por arrasto horizontal, filtro edge-to-edge sem rótulo e sempre na tela, visão de dia abrindo na hora atual (fixa em 08:00) com o cabeçalho "domingo 9" fixo ao rolar.
- **O que NÃO negociar:** desktop intacto (título + "< > Hoje" do FullCalendar permanecem); criação inline por tap (C91) e remanejo por arrasto (C15) intactos; seletor de vista C95 no header; líder lockdown; sem segunda barra de controles; sem mudar o filtro das outras listas.
- **O que reavaliar:** a hipótese da intenção de que o cabeçalho do dia e o scroll da linha do tempo vêm do `scrollTime` existente — **verificado no browser: hoje não há scroll interno** (height auto → a página rola, o col-header "domingo 9" rola junto, `scrollTime` é inerte). O aceite exige scroll interno + cabeçalho fixo → precisa de altura fixa no mobile.

## Abordagem recomendada

```mermaid
flowchart LR
  A[ActivityAgenda (mobile)] --> B[datesSet → visibleRange+view]
  B --> C[activityAgendaPeriodLabel pure]
  C --> D[AgendaPeriodChrome → SetCampaignPageChrome]
  D --> H[TopBar: título período + tap→today]
  A --> G[useAgendaSwipeNavigation]
  G --> F[api.next/prev + touchcancel sintético]
  A --> I[headerToolbar=false + height liquid + scrollTimeReset=false]
  I --> J[FC: scroll interno, col-header fixo, 08:00]
  K[strip: .activity-agenda-filter-strip] --> L[edge-to-edge, sem label, sticky]
```

**Opções consideradas:** A | B | C | D
**Recomendação:** A — combina os mecanismos que o código já possui (chrome override por página, ResizeObserver/breakpoints, FC height/scrollTime) sem collection, sem lib nova, sem tocar nas outras listas.
**Rejeitadas:** B — capar o corpo do timegrid por CSS (max-height + overflow) dessincroniza o eixo de horas do corpo (FC só sincroniza scrollers quando `verticalScrolling`); C — `contentHeight` fixo em px ignora o tamanho real do viewport (quebra em telas menores); D — deixar como está (rolagem de página) falha o aceite "cabeçalho do dia fixo".

### Componentes / mudanças

- **`activityAgendaPeriodLabel`** (`src/utilities/activityUi.ts`): pura — `(view, startStr, endStr) => string | null`; usa `formatBahiaCivilDate` + nomes de mês pt-BR em array estático (sem Intl). `day → "9 Agosto"`, `week → "3–9 Agosto" | "28 Julho – 3 Agosto"` (end−1), `month → "Agosto"`, `list → "Agenda"`, inválido → `null`. Inversa `activityAgendaViewFromFcId` (espelha `activityAgendaViewFcId`).
- **`ActivityAgenda.tsx`** (`src/components/campaign/activity/ActivityAgenda.tsx`): estado `visibleRange` ganha `view` (de `DatesSetInfo.view.type`); condicionais por `useIsMobileMeasured()` (janela <768 — o mesmo breakpoint da top bar `md:hidden`; **não** o container 640, para não vazar mobile-ismo no desktop 768–800 com sidebar):
  - `headerToolbar={isMobile ? false : { start: 'prev,next today', center: 'title' }}`
  - `height={isMobile ? '100%' : 'auto'}` + CSS `.activity-agenda { height: calc(100svh - …) }` no media ≤767px (tune no browser) → FC liga `verticalScrolling` → scroll interno + col-header fora do scroller (fixo por construção) + `scrollTime` deixa de ser inerte.
  - `scrollTimeReset={!isMobile}` → swipe dia→dia **preserva** o scroll do usuário; desktop mantém o reset atual.
  - `eventDragStart/eventDragStop` → ref `isDraggingEvent` (guarda do gesto).
  - label memo + `AgendaPeriodChrome` + `onToday` (useCallback: `api.today()` + `api.scrollToTime('08:00:00')`).
- **`useAgendaSwipeNavigation`** (`src/components/campaign/activity/useAgendaSwipeNavigation.ts`): hook novo, agenda-only. Pointer events no container, `pointerType touch|pen`, limiar 48 px com dominância horizontal |dx| > 1.4·|dy|, um disparo por gesto. No consumo: `onSwipe('next'|'prev')` + `TouchEvent('touchcancel')` sintético no alvo do touchstart **antes** do `touchend` real — mata o timer de long-press (650 ms) do FC (senão o drag de evento começaria no meio do swipe) e o tap pendente. Enquanto `isDraggingEvent` → ignora (arrasto de remanejo é do FC).
- **`AgendaPeriodChrome`** (`src/components/campaign/activity/AgendaPeriodChrome.tsx`): ponte agenda→header (padrão do `AgendaViewChrome`); `chrome = useMemo({ title: label, onTitleClick }, [label, onTitleClick])` + `useLayoutEffect` set/cleanup (o mesmo padrão do `SetCampaignPageChrome` — o flash "Agenda" entre commits não pinta, layout effects do mesmo commit são batched). Nada renderizado em desktop (só mobile seta).
- **`CampaignPageChrome`** (`src/lib/campaignPageChrome.ts`): campo opcional `onTitleClick?: () => void`.
- **`CampaignPageChromeText.tsx`** (branch mobile): quando `onTitleClick`, o título vira `<button>` (mantém truncate/flex; `title="Voltar para hoje"`; texto continua sendo o accessible name).
- **`ActivityAgendaFilters.tsx`**: envolve a omnibox em `<div className="activity-agenda-filter-strip">`.
- **`ActivityAgenda.css`**: bloco `@media (max-width: 767px)`:
  - strip: `margin-inline: -1rem; margin-top: -1rem; margin-bottom: -1.5rem` (edge-to-edge, colada na top bar e no topo do calendário), `position: sticky; top: 0; z-index: 20; background: var(--background)` (branco sólido do tema campaign); label virado `sr-only` (mantém accessible name do combobox).
  - `.activity-agenda { height: … }` para o `height='100%'` liquid (tune no browser; alvo ≈ `calc(100svh - 11rem)`).
- **Migration:** nenhuma (só UI/estado de tela). Nenhum `Consent`/access novo.

### Dados → forma

- Forma escolhida: rótulo de período em texto no header do app (título da página) — "o que estou olhando" num olhar, sem UI nova. Rejeitadas: chip/segunda linha no header (vira segunda barra — anti-goal); título custom dentro do calendário (duplicaria o contexto).

## Fases verificáveis

1. **Tracer (schema+server é nulo aqui) → mecânica do calendário**: label pura + unit tests; props condicionais (toolbar/height/scrollTimeReset) + verificação no browser (scroll interno, col-header fixo, 08:00, `scrollTimeReset=false` preservando scroll). Ajuste do `height` calc no browser.
2. **UI**: `AgendaPeriodChrome` + `onTitleClick` no chrome compartilhado; strip CSS edge-to-edge/sticky; gesto de swipe + `touchcancel` sintético. Impeccable C: shape → craft → critique → polish localizado na superfície mobile da agenda.
3. **Gates**: `pnpm gate:fast` na iteração; `pnpm push` na entrega. E2E: atualizar asserções mobile do C95 (toolbar some, título mostra o período) + novos testes C101 (swipe por CDP touch, tap no título volta ao hoje, strip sticky/sem label, dia abre em 08:00 com cabeçalho fixo).

## Rabbit holes / Não escopo (engenharia)

- Animação do swipe / transição suave entre períodos (FC7 não tem; corte: troca instantânea — prefer motion-reduce).
- Ano no rótulo (mês "Agosto" cruzando ano fica ambíguo — corte: sem ano, como o aceite; registrar débito leve).
- `touch-action` no container (proibido: `pan-y` quebraria o arrasto vertical de remanejo; o gesto horizontal não precisa — não há scroll horizontal na página).
- Re-centrar dinamicamente na "hora atual" real (o aceite fixa 08:00; registrar como opção futura).
- Gesto no desktop e arrasto com mouse; hamburger/sidebar (C102); mudar omnibox das outras listas.

## Riscos e mitigação

- **Height liquid do FC7**: `height='100%'` + CSS no `.activity-agenda` — verificar no browser; fallback `contentHeight` em px só se o liquid não fechar (com tune por breakpoint).
- **Conflito gesto × long-press do FC** (650 ms): swipe rápido em cima de evento — `touchcancel` sintético mata o timer do EventDragging; swipe lento (>650 ms) — `eventDragStart` já setou o guard → não navega. Janela residual coberta: o consumo exige 48 px com dominância; sem movimento, sem consumo.
- **`TouchEvent` ausente em jsdom/unit**: guard `typeof TouchEvent !== 'undefined'` (browser tem; o unit test do hook cobre o disparo do `onSwipe`, não o cancel).
- **Overflow horizontal**: o strip usa margens negativas idênticas ao `.activity-agenda-shell` (que já é edge-to-edge sem overflow) — o e2e existente (`scrollWidth <= innerWidth`) protege.
- **Breakpoint 768–800 com sidebar**: `isMobile` é janela (<768) — a faixa desktop 768–800 com container estreito mantém o chrome desktop (toolbar visível, sem override, sem swipe). Comportamento existente do C95 (day view por container) intacto.
- **E2E swipe via CDP**: `Input.dispatchTouchEvent` (precedente: WebAuthn usa CDP); swipe rápido em slot vazio (fixture cria 1 evento às 10:00 — alvo acima dele) para nunca cruzar a janela do long-press.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (toolbar some no mobile, título por período, swipe, strip sticky, 08:00, "domingo 9" fixo, desktop intacto)
- [ ] Invariantes AGENTS/engineering-standards (sem migration, sem prod, sem Consent novo, copy pt-BR / ids em inglês)
- [ ] Testes de domínio: unit do label (day/week mês-cruzado/list/inválido) + hook do gesto (limiar/dominância/pointerType/guarda); e2e mobile novos + C95 ajustado; gate:fast e gate:push verdes
