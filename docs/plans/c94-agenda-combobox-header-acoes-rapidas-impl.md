# Impl: C94 — Agenda: filtro combobox único, header compacto (ícones) e ações no FAB mobile

Status: rascunho
Atualizado em: 2026-08-09
Issue: #438
Intenção: docs/plans/c94-agenda-combobox-header-acoes-rapidas.md
Appetite restante: ~1–1,5 dia eng (herdado); sem ajuste

## Leitura da intenção

- **Outcome:** toolbar da agenda consolidada em um combobox único (chips removíveis + sugestões agrupadas), entrada de criação por viewport com um caminho só: desktop = `[combobox][carrinho giro][+ nova]` + "Link de import" como ícone agenda-contextual no header do app; mobile = sem botões de criação no corpo, tudo no drawer do FAB ("Nova atividade", "Link de import", "Planejar giro").
- **O que NÃO negociar:** filtros hoje = Município (único) + Tag + Deputado presente (chip bool), sem busca textual nem multi-seleção; estado do filtro segue na URL (reload/share consistentes); "Link de import" desktop mora no **header do app**, não na toolbar; mobile abre o mesmo diálogo como **sheet**; sem regressão de criação inline (C91), giros, revogação de feeds, leader lockdown.
- **O que reavaliar (hipóteses da intenção):**
  - A intenção sugere "ActivityAgendaFilters.tsx vira o adaptador do combobox" — confirmado, mas ele vira a **toolbar inteira** (combobox + ícones trailing), não apenas o adaptador.
  - A intenção sugere "slot no header vs renderizar no shell pela rota — executor decide". Decidir: **slot via contexto de chrome** (reusável por C95), não render por rota no shell.
  - A intenção não decide o que fazer com **"Link de import" no FAB quando não há filtros** (hoje o botão fica desabilitado). Decidir: abrir o sheet e explicar dentro (em vez de tile morta).

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph AgendaPage[AGENDA PAGE · server]
    S[searchParams] --> P[CalendarFeedDialogProvider<br/>feeds · createFeed(state) · revokeFeed · canGenerate]
  end
  P -->|registra| H[SetCampaignHeaderAction id=calendar-feed]
  H -->|lê| DH[CampaignDesktopHeader · agenda-contextual]
  P -->|setContext openCalendarFeed| QK[CampaignQuickActionContext]
  QK --> resolveActivityQuickActions['list' + import-calendar onAction]
  QK --> FAB[FAB drawer · mobile]
  AF[ActivityAgendaFilters → tool bar omnibox] -->|trailing desktop| ICON[ícone carrinho giro + ícone + nova]
  AF --> URN[useCampaignListFilterNavigation → buildActivityAgendaHref]
```

**Opções consideradas (combobox):** A) omnibox chassis existente (`CampaignListOmnibox` B127) | B) `StrictCombobox`/combobox mobile avulso | C) manter selects nativos.
**Recomendação:** A — reusa o chassis já estabelecido nas listas; o adaptador segue o padrão `activityOmnibox.ts` (chips/sugestões puros + tests B128).
**Rejeitadas:** B (chassis não tem chips/teclado do omnibox — duplicaria); C (é exatamente a duplicação que a Issue quer eliminar).

**Opções consideradas (header "Link de import"):** A) slot por contexto de chrome (extender `CampaignPageChromeContext` com registro de ações de header) | B) renderizar no shell pela rota (`usePathname` no header + self-fetch de feeds/state via `useSearchParams`) | C) link simples para o dialog roteado.
**Recomendação:** A — "edit the owner": o contexto de chrome JÁ é o mecanismo por-página do shell; vira registro chaveado de `ReactNode` (reusável por C95 que precisa do mesmo header/slot). Mantém o conhecimento de domínio (feeds/state/action) na vertical de atividade.
**Rejeitadas:** B (acopla o shell compartilhado à URL/schema da agenda e exige `useSearchParams` no layout → Suspense; é o "renderizar na rota" que a intenção flagrou como risco); C (o diálogo não é rota; precisa de state).

**Opções consideradas (FAB "Link de import" mobile):** A) estender `CampaignQuickAction` com `onAction` + `openCalendarFeed` no contexto de quick actions | B) ação href para uma rota de wizzard | C) overlay próprio da agenda.
**Recomendação:** A — `CampaignHomeActionButton` JÁ suporta `onClick`; falta só o fio pelo overlay; o contexto de quick actions já é a ponte página→shell (precedente `CampaignQuickActionContextSync/Bridge`).
**Rejeitadas:** B (diálogo não é rota); C (duplica o drawer).

### Componentes / mudanças

- **`src/utilities/activityAgendaOmnibox.ts`** (novo): adaptador puro do omnibox para `ActivityAgendaState` — `buildActivityAgendaOmniboxChips`, `buildActivityAgendaOmniboxSuggestionSeeds` (grupos Município / Tag / "Deputado presente" chip bool), `applyActivityAgendaOmniboxSuggestion`, `removeActivityAgendaOmniboxChip`, `clearActivityAgendaOmnibox`. Mesmo shape de `activityOmnibox.ts` (não é twin — outro `State` com 3 dimensões e sem busca/Janela).
- **`ActivityAgendaFilters.tsx`** (reescrita): vira a toolbar — `<CampaignListOmnibox>` com chips/sugestões/`Limpar` (chassis tem clear built-in) + `trailing` com `[ícone carrinho: Planejar giro][ícone "+" : Nova atividade]` **`hidden md:inline-flex`** (mobile: zero botões no corpo). `id="agenda-omnibox"`, `label="Filtrar agenda"`, `placeholder` tipo "Filtrar por município, tag, deputado…". Navegação via `useCampaignListFilterNavigation` + `buildActivityAgendaHref`.
- **`agenda/page.tsx`**: remove o bloco de botões "Planejar giro"/"Nova atividade" (movem para a toolbar); envolve o conteúdo em `<CalendarFeedDialogProvider>` (com `feeds`, `createFeed(label)` = closure com `state`, `revokeFeed`, `canGenerate = hasFilters`); mantém `restrictActivityAgendaState`/redirects intocados.
- **`CalendarFeedDialog.tsx`** (extraído de `CalendarFeedButton.tsx`): diálogo nomear→copiar→revogar, **responsivo** (Dialog desktop / Drawer-sheet mobile via `useIsMobile`, igual ao `CampaignQuickActionsOverlay`); expõe `CalendarFeedDialogProvider` + `useCalendarFeedDialog()` (`{ open, canGenerate }`); quando `!canGenerate`, abre com aviso "Aplique filtros para gerar um link de import" e desabilita "Gerar link". O provider também injeta `openCalendarFeed` no `CampaignQuickActionContext` (merge funcional + cleanup).
- **`CampaignPageChromeContext.tsx`** (extender): adiciona `headerActions: Record<string, ReactNode>` + `setHeaderAction(key, node|null)`; novo componente `SetCampaignHeaderAction({ id, children }): null` (padrão `SetCampaignPageChrome`).
- **`CampaignDesktopHeader.tsx`**: renderiza `Object.values(headerActions)` no cluster à direita, ANTES do sino e do AI (ordem do gate: `[título …][Semana ▾ C95][Link de import][Notificações][IA]`).
- **`AgendaFeedHeaderButton.tsx`** (novo, client): botão-ícone `CalendarIcon`, `title`/tooltip, `disabled={!canGenerate}`, `onClick={open}` — registrado via `SetCampaignHeaderAction id="calendar-feed"` na página (desktop-only porque o `CampaignDesktopHeader` é `md:flex`).
- **Quick actions**: `CampaignQuickAction` ganha `onAction?: () => void`; `CampaignQuickActionsOverlay` repassa `onClick: action.onAction` para o `CampaignHomeActionStrip` (o botão já suporta); `CampaignQuickActionContext` ganha `openCalendarFeed?: () => void`; `resolveActivityQuickActions` (surface `list`) devolve `[new-activity, import-calendar(onAction), plan-tour]` — ordem da intenção.
- **Migration:** sem migration (nenhuma mudança de schema).
- **Access / Consent:** nenhuma mudança — agenda segue `gate: 'staff'`; nenhum opt-in novo (o feed é dado de staff, sem Consent).
- **UI:** Impeccable C/B — consolidar a toolbar seguindo o padrão de `ActivityFilters`/listas; shape → craft → critique → polish leve; tokens `data-theme='campaign'`.

### Dados → forma (se aplicável)

- Forma: chips + sugestões agrupadas (padrão omnibox do repo) — "não apresento dados novos, filtro = navegação/URL". Decidido pela intenção (pergunta 3: forma adiada para o padrão existente).

## Fases verificáveis

1. **Combobox (traço dominante)** — `activityAgendaOmnibox.ts` + unit tests (espelho de `listOmniboxB128`); reescrever `ActivityAgendaFilters` (omnibox + trailing desktop); página: remover botões avulsos. Verificar: URL canonical inalterada; e2e da agenda reescrito nos seletores (hoje `getByLabel('Município'|'Tag'|'Deputado presente')`).
2. **Feed dialog + header slot + FAB** — extrair `CalendarFeedDialog` (Dialog/sheet); provider + `useCalendarFeedDialog`; extender chrome context (`headerActions` + `SetCampaignHeaderAction`); `AgendaFeedHeaderButton` + header renderiza registrados; quick actions `onAction` + `openCalendarFeed` + `import-calendar`.
3. **Gates** — `pnpm gate:fast` na iteração; rebase em `origin/main`; e2e agenda (atualizar + rodar); `pnpm push` no fechamento.

## Rabbit holes / Não escopo (engenharia)

- **Omnibox de busca global da agenda** (texto livre, multi-município, presets de janela) — fora; só as 3 dimensões de hoje, sem `onCommitQuery`.
- **Refatorar `CampaignHomeActionStrip`/`CampaignHomeActionButton`** além do fio mínimo do `onAction` — não.
- **Migrar as outras listas para o omnibox** (municípios etc. já usam) — não.
- **Header vira barra de navegação** — mantém batch pequeno: só `headerActions` registrados + sino + IA.
- **C92/C93**: o ícone reflete apenas o estado habilitado/desabilitado; "gerar feed sem filtros" é a C93 (fora).
- **Não mudar o compose de giro nem o overlay inline (C91).**

## Riscos e mitigação

- **`useSearchParams` no layout** — evitado (slot por contexto; o header não lê URL). Não introduz Suspense.
- **Flash de registro do header** — `SetCampaignHeaderAction` usa `useLayoutEffect` (padrão do título); botão aparece ~1 frame após mount; aceitável nas rotas `/campanha/agenda` (nas demais o slot fica vazio → sem poluição).
- **Contexto `openCalendarFeed` undefined antes do mount** — o drawer só abre por gesto humano, bem depois do efeito; `import-calendar` é incluído sempre na surface `list` e abre o sheet mesmo sem filtro (dialog explica), então não há tile morta.
- **Colidir com C95 (Semana ▾ no header)** — registro chaveado por `id`; C94 usa `calendar-feed`, C95 usará outra chave; ordem fixa no header.
- **Regressão e2e** — a única e2e (linhas 120-122) troca selects por interação omnibox; ajustar junto da fase 1.
- **Branch atrás de main (4 commits, C92/B171)** — rebase em `origin/main` no início da execução (skill `rebase-on-main`).

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (3 pontos + anti-goals)
- [ ] Invariantes AGENTS/engineering-standards (staff gate, URL canonical, sem Consent novo)
- [ ] Testes de domínio: unit do adaptador de agenda (espelho B128); e2e agenda reescrito e verde; int/serviço de feed intocados
- [ ] `pnpm gate:fast`, tsc, lint, prettier, knip, check:cycles verdes
