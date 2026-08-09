# Impl: PWA iOS: tela ampliada e com as bordas cortadas desde o launch (zoom preso)

Status: aprovado
Atualizado em: 2026-08-09
Issue: #500
Intenção: docs/plans/pwa-ios-zoom-preso-bordas-cortadas.md
Appetite restante: ~0,5–1,5 dia eng (herdado; inclui verificação em aparelho)

## Leitura da intenção

- **Outcome:** ao abrir/retomar o PWA `/campanha` no iPhone, escala 100% e nenhuma borda cortada; após teclado, a tela volta sozinha; pinça continua funcionando; zero regressão em aba/desktop.
- **O que NÃO negociar:** pinça do usuário (anti-goal de acessibilidade); sem hack de tela cheia que esconda conteúdo; sem redesenho; bloqueio de escala só como fallback documentado (decisão do gate: A ou B, nunca C).
- **O que reavaliar:** a hipótese da intenção apontava "config de viewport / shell h-svh / statusBarStyle" como área provável. **Verificação no código (Next 15.4.11):** o meta viewport de hoje já é `width=device-width, initial-scale=1` **sem** `maximum-scale` nem `viewport-fit=cover` (default do App Router em `node_modules/next/dist/lib/metadata/default-metadata.js`; o layout exporta só `themeColor`), e o shell `h-svh`/`overflow-hidden` é coerente com o chrome que já trata safe-area. Não há política de escala que remover nem configuração que mude o sintoma: **não existe um "toggle" que conserte isso** — a causa é o visual viewport do standalone ficar com scale > 1 preso (família de bugs WebKit 237961 / regressões iOS 26), então a correção é **client-side: curar o estado preso**.

## Abordagem recomendada

```mermaid
flowchart LR
  A[Mount em (campaign) root layout] --> B[Engine lib/campaignIosViewportHeal]
  B --> C[Gate standalone-iOS]
  C --> D{scale > 1.02?}
  D -->|sim + sem input focado + sem pinça recente| E[Heal: scrollTo 0,0]
  E --> F[Re-measure nudge: html height]
  F --> G[Retry <=3x 250ms]
  G --> H[Debug global __campaignIosViewportHeal]
  D -->|não| I[No-op]
  C -->|não| I
```

**Opções consideradas:** A (heal client-side do visual viewport, standalone-iOS only) | B (`maximum-scale=1`/`user-scalable=no` seletivo no standalone) | C (`interactive-widget=resizes-content`) | D (depender do B183) | E (mexer em `viewport-fit`/statusBarStyle) | F (reload forçado)

**Recomendação:** A — ataca o sintoma (scale preso) em todas as origens (launch, resume/bfcache, pós-teclado) com o menor conjunto de medidas, é standalone-only (zero risco em aba/desktop), mantém a pinça (guards) e é verificável no aparelho via debug global. É a técnica validada pela família de reports (cederhook 2026-07 — "heal via forced re-measure"; west-wind — scrollTo + 16px como trigger fix).

**Rejeitadas:**

- B — mata a pinça (anti-goal de produto); vira **fallback documentado, off por default** via constante única: se a verificação no aparelho mostrar que o heal não cura, um deploy com a flag ligada ativa o `maximum-scale` seletivo só no standalone (decisão de produto B do gate, tradeoff WCAG conhecido).
- C — muda a semântica de layout do teclado do app inteiro (reflow do shell `h-svh` quando o teclado abre); risco alto de regressão de layout, não mira o zoom-de-launch.
- D — o B183 elimina o _trigger_ de input (fonte < 16px), mas o sintoma do launch/resume é independente de input; o aceite do B182 inclui o launch. O B183 reduz a frequência; não substitui.
- E — o meta de hoje não tem `maximum-scale` nem `cover`; não há política a ajustar; mexer no chrome (cover + status bar) altera métricas verticais de todas as telas sem tocar a causa do zoom.
- F — reload brutal, perde estado de navegação; só para crash-loop de diagnóstico.

### Componentes / mudanças

- **`campaignIosViewportHeal`** (`src/lib/campaignIosViewportHeal.ts`): motor profundo, testável (jsdom). Detecta standalone-iOS (`navigator.standalone === true` OU `matchMedia('(display-mode: standalone)')` + UA iOS), escuta `load`/`pageshow` (incl. `persisted`/bfcache)/`visibilitychange→visible`/`focusout`/`visualViewport.resize`, decide heal (`visualViewport.scale > 1.02` && !editable focado && !pinça recente — `gesturestart/change/end` + touch ≥2, janela 800 ms renovada durante o gesto) e executa em camadas: `scrollTo(0,0)` → re-measure nudge (`html.style.height` = `innerHeight px`, restore — reflow genérico; **não** re-resolve `svh` sozinho, verificação em aparelho decide se precisa estender ao scroll container) → retry ≤3 × 250 ms com **orçamento por episódio** (launch/resume/bfcache/teclado/resize — um episódio não esfomeia o próximo). **Heal imediato no install** (load/pageshow podem ter ocorrido antes da hidratação do React). `history.scrollRestoration = 'manual'` no standalone (evita o iOS restaurar estado bfcache ampliado). Expõe `window.__campaignIosViewportHeal = { state, healNow() }` (verificação em aparelho sem UI). Constante `CAMPAIGN_IOS_HEAL_MAXIMUM_SCALE_FALLBACK = false` (fallback B, documentado; opção `maximumScaleFallback` no install).
- **`CampaignIosViewportHeal`** (`src/components/campaign/shell/CampaignIosViewportHeal.tsx`): componente client que monta o motor em `useEffect` e retorna `null` — precedente: `RegisterServiceWorker`. `lib/` é client-safe (precedente: `campaignLastActedMunicipality`), então o motor pode viver lá.
- **`src/app/(campaign)/layout.tsx`**: montar o componente como sibling de `RegisterServiceWorker` — cobre login + `(app)` inteiro. **Sem migration, sem Access, sem Consent.**
- **UI:** Impeccable A — nenhuma UI nova; o único "afetado" visual é o usuário não ver mais a tela ampliada.

## Fases verificáveis

1. **Motor + mount** — `src/lib/campaignIosViewportHeal.ts` + `CampaignIosViewportHeal.tsx` + layout. Tracer bullet: heal no launch.
2. **Testes de domínio** — `tests/unit/campaignIosViewportHeal.unit.spec.ts` (jsdom): gate standalone (não-standalone = no-op), heal no launch (scale > 1 → scrollTo + nudge), skip com editable focado, skip com pinça recente, heal pós-teclado, retry com teto, debug global, fallback off.
3. **Gates** — `pnpm gate:fast` na iteração; `pnpm push` na entrega. Runbook de verificação em aparelho (checklist do debug global + B183) documentado no corpo do PR para o aceite de produto.

## Rabbit holes / Não escopo (engenharia)

- Polifill geral de teclado/keyboard-inset (fora de escopo da intenção).
- Caçar a família inteira de bugs WebKit standalone — curamos o sintoma do nosso app, com fallback documentado.
- Mudar `viewport-fit`/status bar/`interactive-widget` (opções rejeitadas E/C).
- Ajuste de fontes dos inputs (é o B183; pode ser executado em paralelo).

## Riscos e mitigação

- **Heal lutar contra pinça intencional do usuário** → guards: nunca heal com editable focado; janela de pinça renovada por `gesturestart/change/end` e touch ≥2 (cobre gestos longos); threshold 1.02 (zoom acidental de pinça costuma ser > 1.05). Após um zoom deliberado que termina, nenhum evento dispara novo heal — a pinça persiste.
- **`scrollTo(0,0)` pode não surtir no shell `overflow-hidden`** → segunda camada (re-measure nudge) + heal imediato no install; a verificação em aparelho decide — o debug global permite testar `healNow()` sem deploy. **Gatilho:** se no aparelho o heal não curar, estender `healDocument` para togglar o overflow do scroll container do shell antes de ligar o fallback B.
- **Regressão em aba/desktop** → gate standalone-iOS: no-op em qualquer outro contexto (o código nem roda `visualViewport` em não-standalone).
- **iOS 26 muda comportamento** → heal é conservador (só age com scale > 1.02) e idempotente; fallback B documentado como último recurso.

## Verificação em aparelho (aceite de produto)

A suíte unit prova a fiação (detecção, guards, retry), não a cura no WebKit. O aceite é visual, no iPhone com o PWA instalado (standalone):

1. **Launch (cold open):** fechar o app, abrir → escala 100%, nenhuma borda cortada. Se abrir ampliado: `window.__campaignIosViewportHeal.healNow()` no console — se curar, o heal funcionou e o bug era o launch sem trigger (o immediate heal no install cobre).
2. **Resume (bfcache):** abrir outro app, voltar → sem zoom.
3. **Teclado:** tocar na omnibox de uma lista, digitar, fechar o teclado → tela volta sozinha. (O trigger de 16px é o B183 — neste item o heal cura o estado preso caso o auto-zoom ainda dispare.)
4. **Pinça:** dar zoom por pinça → persiste (não é resetado); `state.lastSkippedReason === 'recent-pinch'` enquanto durar o gesto.
5. **Aba/desktop:** `isIosSafariStandalone` false → módulo é no-op (`state.standaloneIos === false`); nenhuma mudança perceptível.

Se 1–3 falharem no aparelho: flip da flag `maximumScaleFallback` (decisão B) ou extensão do `healDocument` ao scroll container (gatilho acima).

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (launch, resume, pós-teclado; pinça preservada; aba/desktop intactos)
- [ ] Invariantes AGENTS/engineering-standards (sem server-only em lib, sem UI nova, sem schema)
- [ ] Testes de domínio: `tests/unit/campaignIosViewportHeal.unit.spec.ts`
- [ ] Gates verdes: `gate:fast`, `tsc`, `lint` 0 warnings, `format:check`, `knip`, `check:cycles`, `pnpm test`, `pnpm build`
