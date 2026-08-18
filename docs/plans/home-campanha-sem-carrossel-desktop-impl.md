# Impl: S6 — Home de campanha sem carrossel no desktop

Status: aprovado
Atualizado em: 2026-08-18
Issue: #34
Intenção: docs/plans/home-campanha-sem-carrossel-desktop.md
Appetite restante: herdado (~0,5–1 dia eng; só layout, sem dados novos)

## Leitura da intenção

- **Outcome:** no desktop (≥1024px) as seções "Por que essa eleição importa" (3 cards) e
  "Nossa caminhada" (6 cards) mostram todo o conteúdo de uma vez — grade estática, sem
  auto-avanço, sem rolagem oculta, sem indicadores/chips; mobile (<1024px) 100% preservado.
- **O que NÃO negociar:** mobile intocado (comportamento e geometria); mesma copy/imagens/ordem;
  sem redesenho de cards; seção "Acompanhe de perto" (S1) fora do escopo; zero schema/migration/
  Consent/dados.
- **Questões em aberto da intenção (assumidas, validar no gate):** chips somem no desktop (A);
  cards de bandeira com altura por conteúdo e respiro (A); breakpoint `lg` = 1024px (A); a seção
  dos 6 cards é "Nossa caminhada" (confirmado — eyebrow atual no site).
- **O que reavaliar:** a hipótese "variante estática em `lg` dentro do `CampaignCarousel`" —
  **rejeitada**: o `CampaignCarousel` é o módulo pinado à geometria Penpot de auto-avanço
  (precedente S1: "not a variant of `CampaignCarousel`"); o padrão consagrado no repo para
  "bento/grid no desktop + carrossel no mobile" é renderização-irmã com toggle CSS (`hidden md:grid`
  - `md:hidden` em `CampaignContentSection`). Ver Decisão 1.

## Abordagem recomendada

```mermaid
flowchart LR
  subgraph page[page.tsx — server]
    A[problemItems/flagItems] --> B[Grade estática desktop<br/>hidden lg:grid]
    A --> C[Carrossel mobile existente<br/>lg:hidden]
  end
  B --> D[CampaignProblemCard / CampaignFlagCard<br/>components presentacionais compartilhados]
  C --> D
  E[styles.css<br/>@media min-width 64rem<br/>.campaign-flags height recalibrada] --> B
```

**Opções consideradas:** A | B | C | D
**Recomendação:** **A — renderizações-irmãs no `page.tsx`** (grade estática server-rendered
`hidden lg:grid` + carrossel atual embrulhado em `lg:hidden`), com os dois cards extraídos para
components presentacionais compartilhados — exatamente o padrão S1 (`CampaignContentSection` +
`CampaignArticleCard`).
**Rejeitadas:**

- **B) track único vira grade via CSS dentro do `CampaignCarousel`** (`lg:grid lg:overflow-visible`
  - matchMedia para suprimir JS/a11y no desktop). O S1 já rejeitou estender esse módulo para um
    layout diferente ("pinned to the Penpot auto-advancing geometry"); a troca de semântica a11y
    (`aria-roledescription="carrossel"`, "N de M") não é expressável em CSS — exigiria estado de
    matchMedia com flip pós-hidratação — e o componente é pinado por unit + e2e de swipe.
- **C) desmontar o carrossel no desktop** (wrapper client com matchMedia). Custo: componente
  wrapper novo + dupla renderização pós-hidratação para matar um timer invisível de ~1 re-render/
  4s numa subárvore `display:none` — o mesmo custo que o S1 já aceita (carrossel montado oculto
  no desktop, sem timer por não ter auto-avanço). Não vale o movimento.
- **D) duplicar o JSX dos cards inline no `page.tsx`** (grade copiada, carrossel intocado).
  Cria duas fontes de verdade do markup do card (~50 linhas) com risco de drift em qualquer
  mudança visual futura. O S1 extraiu o card (`CampaignArticleCard`) — a extração é o dono do
  concern.

### Componentes / mudanças

- **`CampaignProblemCard`** (`src/components/CampaignProblemCard.tsx`, server/presentacional):
  o artigo do card `problem` (imagem `fill`/`imageFrame`, gradiente, título+corpo overlay) —
  extraído verbatim do `li` do carrossel; recebe `item` (`CampaignCarouselItem`).
- **`CampaignFlagCard`** (`src/components/CampaignFlagCard.tsx`, server/presentacional): o artigo
  do card `flags` (título+corpo) — extraído verbatim; recebe `item` + prop `size: 'compact' |
'spacious'` (padding `px-3.5 py-2.5` no carrossel — mobile intocado — e `p-4` na grade,
  conforme o rascunho UI aprovado).
- **`CampaignCarousel`** (`src/components/CampaignCarousel.tsx`): SÓ re-roteia o markup dos cards
  para os dois components extraídos; classes, estado, timers e a11y byte-idênticos. Unit tests
  existentes permanecem sem mudança.
- **`page.tsx`** (`src/app/(frontend)/(home)/page.tsx`): dentro de cada wrapper absoluto existente
  (`.campaign-problem-carousel` / `.campaign-flags-carousel`), renderiza:
  - grade desktop: `<div class="hidden lg:block px-(--campaign-carousel-inset)">` →
    `<ol data-grid="problem|flags" class="grid grid-cols-3 gap-[21px]|gap-[14px]">` com os
    components de card (li `h-[437px]` no problem; altura por conteúdo no flags);
  - carrossel: wrapper `<div class="lg:hidden">` → `CampaignCarousel` inalterado.
- **`styles.css`** (`src/app/(frontend)/styles.css`): sob `@media (min-width: 64rem)` recalibra
  **apenas** `.campaign-flags { height: clamp(…) }` — a grade problem mantém a geometria atual
  (top 191 + 437 + 31px de respiro já existentes). A altura do flags vira clamp fluido entre
  âncoras medidas no browser (pior caso ~1024px: corpos de 3 linhas; caso largo: 2 linhas);
  o mobile (<64rem) fica intacto.
- **Migration:** sem migration. **Access/Consent:** n/a. **UI:** Impeccable B — shape → craft
  (browser, viewports 1024/1280/1440/1920) → critique (agente design-vision sobre screenshots) →
  polish.

### Dados → forma

- Sem dados novos — itens já existem (`problemItems`/`flagItems`). Forma: grade estática com os
  mesmos cards; sem contadores, sem elementos novos (restrição da intenção).

## Fases verificáveis

1. **Extração dos cards (tracer/refactor neutro)** — criar `CampaignProblemCard`/
   `CampaignFlagCard`, re-rotear o `CampaignCarousel` para usá-los; `pnpm test` (unit
   `campaignCarousel` verde, sem diff de comportamento) prova a neutralidade.
2. **Grades no `page.tsx` + toggle CSS** — wrappers `hidden lg:block`/`lg:hidden`, `data-grid`,
   grids `grid-cols-3`; verificação visual no browser (dev server da worktree).
3. **Altura do flags em desktop** — medir a grade (2 linhas) em 1024/1280/1440/1920 no browser,
   fixar o clamp fluido em `styles.css`; conferir respiro ≥ 24px em todas as larguras.
4. **e2e** — reescrever `auto-advances and keeps carousel controls synchronized`
   (tests/e2e/frontend.e2e.spec.ts): no viewport desktop → grade estática (3 cards numa linha,
   6 cards 3×2), sem `aria-current`, chips/carrossel ocultos; resize mobile → auto-avanço e
   chips sincronizados continuam. Teste novo de geometria desktop (respiro bottom ≥ 24, sem
   overflow horizontal em 1024/1280/1920). Swipe mobile e demais testes intocados.
5. **Gates** — `pnpm gate:fast` na iteração; `pnpm push` + changelog OPS44 na entrega.

## Rabbit holes / Não escopo (engenharia)

- Não redesenhar o card problem no desktop (draft mostra card redesenhado com imagem 280px +
  texto abaixo — é esboço; a intenção corta "redesenho de cards"; mantém o overlay atual).
- Não mexer em hero/prova social/S1; não tocar na geometria mobile das seções.
- Não desmontar o carrossel no desktop via wrapper client (Decisão 1-C rejeitada) — o guard de
  `display:none` no auto-avanço já elimina o churn do timer oculto sem mover o componente.

## Riscos e mitigação

- **Regressão mobile:** componente e CSS mobile intocados + pinos existentes (mobileSpacing @430,
  swipe @430, spacing tests) verificam.
- **Altura do flags errada no desktop:** âncoras medidas no browser (não chutadas) + e2e de
  respiro asserta o invariante (bottom ≥ 24) em vez de pixels fixos; clamp com folga.
- **Cards problem estreitos em 1024 (≈207px de coluna):** tradeoff assumido da intenção
  ("cards preenchendo a coluna"); texto é overlay absoluto no bottom do card fixo 437px — sem
  clip; verificado visualmente na craft.
- **Duplicação de DOM (grade + carrossel oculto):** mesma que o S1 já aceita; o carrossel oculto
  fica fora da árvore a11y (`display:none`), sem foco, sem movimento visível. O timer de
  auto-avanço do carrossel oculto foi morto por guard de `display:none` no effect (pós-simplify).

## Pós-simplify (3 reviewers) — aplicado

- `lg:` órfãos removidos do `CampaignCarousel` (o carrossel nunca renderiza ≥1024px agora).
- Grade duplicada extraída em `CampaignCardGrid` local no `page.tsx` (fonte única do contrato).
- `overflow: hidden` na seção flags ≥64rem — zoom de texto ≥125% clipa na banda em vez de pintar
  sobre o footer.
- Guard de `display:none` no auto-avanço do carrossel (jsdom não computa `display:none` — unit
  tests preservados).
- e2e: `document.fonts.ready` antes das medições; eixo x no grid problem; pino
  `scrollHeight ≤ clientHeight` (sem rolagem oculta); comentário do clamp com âncoras.

## Débitos (triage autônoma)

- **Registrado:** Issue #58 (S6-FOLLOWUP, kind defect, `depends: [S6]`) — a CLI do Playwright
  1.58.2 ignora `--grep`/posicionais e `pnpm test:e2e:affected` roda a suíte completa
  silenciosamente (plano: `docs/plans/s6-followup-playwright-filtros-cli-ignorados.md`).
- **Defer (gatilho):** literais de gap da grade (`gap-[21px]`/`gap-[14px]`) não referenciam a
  geometria do carrossel — gatilho: recalibração Penpot da geometria do carrossel.
- **Descartado:** contratos de tipo dos cards (armadilha knip; structural typing ok), aria-labels
  duplicados (copy pinada no e2e), DOM duplicado sem CSS (tradeoff S1 consagrado), tablet
  768–1023 sem pino e2e (S6 não tocou <1024).

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (grade desktop, mobile 100% preservado)
- [x] Invariantes AGENTS/engineering-standards (sem migration/Consent; identificadores em inglês;
      copy pt-BR intocada)
- [x] Unit `campaignCarousel` verde sem edição; e2e frontend reescrito cobre grade desktop +
      carrossel mobile; `pnpm test`, `pnpm test:e2e`, lint/format/tsc/knip/cycles verdes
- [x] Changelog OPS44 (`docs/changelog/2026-08-18-s6.md` + `pnpm changelog:build`)

Self-score decision-quality: **4/5** — opções explícitas com razões + precedente do repo;
rejeitadas documentadas; fases verificáveis; único salto medido (altura do flags) fica
pinned por e2e de invariante em vez de pixel mágico.
