# Impl: B166 — Largura padrão do chat Sollinha com teto no desktop

Status: aprovado
Atualizado em: 2026-08-08
Issue: #414
Intenção: docs/plans/largura-padrao-chat-sollinha.md
Appetite restante: ~0,25–0,5 dia eng (mantido; sem migration)

## Leitura da intenção

- **Outcome:** no desktop de `/campanha`, o chat Sollinha abre — sozinho (carregamento) ou pelo botão do header — com `min(25% da janela, 360 px)` quando não há tamanho salvo; depois de aberto o resize é livre (sem teto superior, piso ~280 px mantido); o último tamanho escolhido pelo usuário é lembrado nas próximas aberturas; mobile (drawer full-screen) e demais superfícies intactos.
- **O que NÃO negociar:** teto de 360 px vale **só** para a abertura padrão (sem tamanho salvo); resize do usuário **sem máximo**; persistir **só o tamanho** (não as conversas); piso ~280 px; mobile drawer intacto.
- **O que reavaliar:** a “Direção no codebase” apontava `CampaignAISidebarShell.tsx` (Panel: `defaultSize="25"`, `minSize="280px"`, `maxSize="50"`, `collapsible`) — **confirmado como dono**. O mecanismo de persistência era aberto (“o executor escolhe”) — escolho persistência **própria em px** no `localStorage`, não `useDefaultLayout` do `react-resizable-panels` (razões abaixo).

## Abordagem recomendada

```mermaid
flowchart LR
  A[CampaignAISidebarShell] -->|Group elementRef + onLayoutChanged isUserInteraction| B[save px → localStorage]
  A -->|useIsMobile + resize(): PanelImperativeHandle| C[open size = saved ?? min 25%,360]
  C --> D[remove maxSize=50 → resize livre]
  B --> E[próxima abertura restaura px]
```

**Opções consideradas:** A | B | C | D
**Recomendação:** **A** — persistência própria em **px** + aplicação pontual no `useLayoutEffect`, porque casa com o aceite em unidades reais (px), persiste **apenas o tamanho** (hoje a abertura sozinha em `/campanha` é parte do comportamento — não se muda), e expressa o default `min(25%, 360 px)` sem depender de proporções do layout.
**Rejeitadas:**

- **B — `useDefaultLayout` do `react-resizable-panels`** (persistência de layout por %, `onlySaveAfterUserInteractions`): persiste o layout **inteiro, incluindo collapse/expand** → um usuário que fechou o chat o encontraria fechado no próximo load, o que muda o “abre sozinho ao carregar `/campanha`” que a intenção descreve como comportamento atual a preservar; além disso, o default `min(25%, 360)` exigiria medição do grupo de qualquer forma, e salvar % re-escala com a janela em vez de lembrar o tamanho em px escolhido.
- **C — teto via CSS (`max-width`/cap no Panel)**: travaria **também o resize do usuário** (produto diz “sem teto depois de aberto”) e briga com a matemática flex do library.
- **D — persistir % em vez de px**: drift com largura da janela; o aceite é explícito em px (“480–640 px hoje”, “teto de 360 px”, “o tamanho escolhido é lembrado”).

### Componentes / mudanças

- **`src/lib/sollinhaChatPanelWidth.ts`** (novo — puro, client-safe; referencia `campaignLastActedMunicipality.ts`): storage key `teoq:campaign:sollinha-chat-width-px`, leitura/escrita seguras (guard `typeof window`, try/catch private-mode), e a função pura `resolveChatPanelWidthPx(groupWidthPx, savedPx)` → `savedPx` válido (clampeado a `[CHAT_MIN_PX, groupWidthPx]`) **ou** `min(25% × groupWidth, 360 px)` (também clampeado). Move `CHAT_MIN_PX` (280) da shell para cá (fonte única; `minSize` do Panel e clamp do resolver passam a compartilhar).
- **`src/components/campaign/shell/ai/CampaignAISidebarShell.tsx`** (editar — dono do Group/Panel):
  - Chat `Panel`: **remove `maxSize="50"`** (resize livre até o limite natural), mantém `minSize={CHAT_MIN_PX}`, `collapsible`, `collapsedSize={0}`, `defaultSize={CHAT_DEFAULT_PCT}` como valor inicial do library.
  - `Group`: adiciona `elementRef` (medir largura do grupo) e `onLayoutChanged` — quando `meta.isUserInteraction` e o painel **não** estiver `isCollapsed()` e `inPixels >= CHAT_MIN_PX`, grava `Math.round(inPixels)` no storage.
  - `useLayoutEffect` (client), gate por `useIsMobile()` + guardas: aplica `resolveChatPanelWidthPx(...)` via `panelRef.current.resize(px)` **uma vez** quando o painel está visível no desktop e **não** está colapsado e o usuário ainda **não** mexeu na sessão (ref `hasUserSized`). Re-executa só quando o eixo mobile→desktop cruza (load mobile-first cresce para desktop), para o default capado valer também aí.
  - Separator/resize handle: intocado (já `md:flex`, existe).
- **Migration:** sem migration (zero schema).
- **Access / Consent:** nenhum (client-only; sem chave nova).
- **UI:** Impeccable **B** — encaixe no comportamento de abertura (sem redesign visual; o handle de resize já existe); shape→craft→critique→polish resumem-se a verificar o comportamento real em dev.

### Dados → forma (se aplicável)

- N/A — nenhum número novo apresentado; é ajuste de largura de painel.

## Fases verificáveis

1. **Tracer / server+schema:** nada de schema. Implementar `src/lib/sollinhaChatPanelWidth.ts` + unit spec (`tests/unit/sollinhaChatPanelWidth.unit.spec.ts`, espelhando `campaignLastActedMunicipality.unit.spec.ts`: leitura inválida/not-json, gravação, clear, e casos do `resolveChatPanelWidthPx` — grupo 1920 → default 360; grupo 1280 → 320; salvo 520 → 520 mesmo acima de 360; salvo longo clampeado ao grupo; salvo inválido → default).
2. **UI/wire:** editar `CampaignAISidebarShell.tsx` (remover `maxSize`, medir + aplicar, salvar em `onLayoutChanged`). Verificar em `pnpm dev` (porta 3266): abertura fresca em 1920 ≤360 px; arrastar para 520 px → reload restaura 520; fechar/reabrir mantém o da sessão; piso 280; mobile drawer intacto; painel colapsado (fechado pelo X) não reabre sozinho.
3. **Gates:** `pnpm gate:fast` na iteração; `pnpm push` na entrega. E2e `campaignMunicipalityResponsiveColumns` (condicional do `Fechar` no chat) deve continuar verde — comportamento de “abrir/colapsar muda colunas” inalterado (a largura default em 1600 px segue < 360 px). Avaliar se vale um e2e dedicado de persistência (barato em Playwright) — decidir na execução conforme appetite.

## Rabbit holes / Não escopo (engenharia)

- Persistir **conversas** do chat — corte explícito da intenção (sessão nova a cada abertura).
- Mexer no piso (~280 px) ou na semântica mobile drawer — fora de escopo.
- Usar `useDefaultLayout`/persistência de % do library — rejeitado (mudaria aberto/fechado e re-escalaria).
- Não criar hook intermediário pass-through; a lógica cabe no shell + lib puro (depth check: reusa `panelRef`/`useIsMobile` existentes).

## Riscos e mitigação

- **Semântica do `resize()`/`onLayoutChanged` do library (4.12.2):** `meta.isUserInteraction` discrimina drag de usuário vs imperativo (confirmado no bundle); `resize` valida/clampeia contra min/max. Mitigação: salvar só quando `!isCollapsed()` (arrastar até colapsar não grava 0); `isCollapsed()+hasUserSized` nas guardas para **nunca** forçar abrir nem sobrescrever escolha da sessão.
- **Cruzamento mobile↔desktop no meio da sessão:** efeito chaveado em `useIsMobile()`; `resize()` sobre painel `hidden` (mobile) é inerte, e as guardas evitam reabrir painel colapsado.
- **Garbage no storage:** parse/validação na leitura (espelha padrão `campaignLastActedMunicipality`/`recentVisits`), retorna default.
- **e2e existente:** largura default em viewport 1600 continua < 360 px (grupo ≈ 1320 px → 25% ≈ 330 px) → sem mudança de estágio de coluna.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (default capado + resize livre + persistência de tamanho; mobile intacto)
- [ ] Invariantes AGENTS/engineering-standards (sem Local API/overrideAccess; client-only; identificadores em inglês)
- [ ] Testes de domínio previstos (unit do resolver/storage; e2e existente segue verde)
