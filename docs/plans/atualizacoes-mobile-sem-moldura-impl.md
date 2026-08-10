# Impl: C106 — Atualizações mobile: feed sem moldura (omnibox sticky sem label, criar no header, cards edge-to-edge)

Status: em execução
Atualizado em: 2026-08-09
Issue: #517
Intenção: docs/plans/atualizacoes-mobile-sem-moldura.md
Appetite restante: herdado (~0,5–1 dia eng; um encaixe em página existente)

## Leitura da intenção

- **Outcome:** no mobile, o feed `/campanha/atualizacoes` perde o chrome: label do filtro some, filtro fica sem moldura e sempre visível (sticky sob a top bar, separado do feed por uma linha), "Nova atualização" vira icon no header (mesmo modal), cards sem borda/arredondamento edge-to-edge separados por uma linha. Desktop e demais listas inalterados.
- **O que NÃO negociar:** chips continuam dentro da omnibox (mesmo comportamento); modal de criação inalterado (mesmo conteúdo/fluxo, só muda o trigger); desktop do feed inalterado; demais listas `/campanha` inalteradas (B184 é pedido próprio); sem redesenho de shell.
- **O que reavaliar:** a hipótese "prop/variant ou estilo local no chassis" da intenção. **Em `main` o mecanismo irmão já existe** (C101 agenda, `ActivityAgenda.css`): CSS de página com classe própria no wrapper do filtro + `:has()` zerando o padding-top do scroll container + sticky/edge-to-edge em media query — sem prop no chassis. Seguimos esse mecanismo real; o chassis ganha só um hook estável.

## Abordagem recomendada

```mermaid
flowchart LR
  P[atualizacoes/page.tsx] --> F[CampaignUpdatesFilters]
  F --> S[.campaign-updates-filter-strip<br/>wrapper do form]
  S --> O[CampaignListOmnibox<br/>data-slot hook no campo]
  F --> H[SetCampaignHeaderAction<br/>icon + md:hidden]
  F --> M[CampaignUpdatesCreateModal<br/>inalterado]
  P --> L[CampaignUpdatesFeed<br/>cards edge-to-edge]
  S -. CSS novo .-> C[CampaignUpdatesFeed.css<br/>media query mobile]
```

**Opções consideradas:** A) CSS escopado de página + hook `data-slot` no chassis (padrão C101); B) prop `variant="frameless"` no `CampaignListOmnibox`; C) chassis sem moldura global.
**Recomendação:** A — o padrão do app em `main` é CSS de página (C101 `activity-agenda-filter-strip`); zero risco para as outras listas (aceite exige); o toque no chassis é 1 linha sem mudança de comportamento, reutilizável pelo B184.
**Rejeitadas:** B — duplica a decisão visual em cada lista (cada uma teria que lembrar do prop) e diverge do mecanismo que o C101 já estabeleceu; C — muda o mobile das outras listas, viola o aceite.

### Componentes / mudanças

- **`CampaignListOmnibox`** (`src/components/campaign/shared/CampaignListOmnibox.tsx`): adicionar `data-slot="campaign-omnibox-field"` ao div da caixa do campo (hook estável para o CSS de página; sem mudança de comportamento).
- **`CampaignUpdatesFeed.css`** (novo, `src/components/campaign/municipality/`): media query `max-width: 767px` —
  - `[data-slot='campaign-content-scroll']:has(.campaign-updates-filter-strip) { padding-top: 0 }` (receita C101 — sem isso o clamp do sticky pinaria 1rem abaixo da top bar);
  - `.campaign-updates-filter-strip`: `position: sticky; top: 0; z-index: 20; margin-inline: -1rem; margin-bottom: -2rem; background: var(--background); border-bottom: 1px solid var(--border)` (a linha = separador do feed; `-2rem` compensa o `gap-8` do shell — **não** mexemos no gap do shell para desktop ficar intacto; o C101 usou gap-6+`-1.5rem`, aqui a página mantém o default);
  - label do omnibox → visually hidden (sr-only mantido no a11y tree);
  - `.campaign-omnibox-field`: `border: none; box-shadow: none` (mantém `focus-within:ring` — a11y);
  - lista/cards do feed: edge-to-edge + sem moldura (ver item abaixo).
- **`CampaignUpdatesFilters`** (`src/components/campaign/municipality/CampaignUpdatesFilters.tsx`):
  - import do CSS;
  - form envolvido por `<div className="campaign-updates-filter-strip">`;
  - `SetCampaignHeaderAction id="campaign-updates-create"` com `Button variant="ghost" size="icon"` `className="size-11 shrink-0 md:hidden"` + estilo do mobile top bar (`text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground`), `aria-label="Nova atualização"`, `onClick={() => setCreateOpen(true)}` — o modal fica onde está (estado `createOpen` continua aqui);
  - trailing "Nova atualização" atual: `className="... hidden md:inline-flex"` (desktop-only).
- **`CampaignUpdatesFeed`** (`src/components/campaign/municipality/CampaignUpdatesFeed.tsx`):
  - ul: `-mx-4 flex flex-col divide-y divide-border md:mx-0 md:gap-4 md:divide-y-0` (edge-to-edge mobile, linha entre cards; desktop = gap de hoje);
  - li: `rounded-none border-0 p-4 md:rounded-xl md:border` (desktop idêntico a hoje);
  - empty state: copy única "Ajuste o filtro ou registre um novo fato de campo." (descreve a ação, funciona nas duas resoluções).
- **Migration:** nenhuma. **Access/Consent:** nenhum. **UI:** Impeccable B — shape→craft direto, critique no gate; reusa slot de header action (C94/C95), chassis B127, `CampaignListResults`.

### Decisões de engenharia

1. **Mecanismo mobile sem moldura:** A) CSS de página + hook `data-slot` (padrão C101) | B) prop no chassis | C) chassis global sem moldura. **→ A** (razões acima).
2. **Trigger de criar no mobile:** A) `SetCampaignHeaderAction` + `md:hidden` (CSS-only) | B) gate JS `useIsMobile()` | C) FAB/quick action (padrão agenda). **→ A** — reusa o slot C94/C95; gate de resolução é CSS puro (sem flash de hidratação); o pedido é explicitamente "icon no header", não FAB.
3. **Copy do empty state:** A) copy única sem referência a botão | B) copy mobile-aware. **→ A** — recomendação da própria intenção; descreve a ação em vez do trigger.
4. **"Limpar" no mobile:** permanece como está (a intenção não pede o X circular do B184). O strip = o form inteiro, então "Limpar" fica na região sticky junto do filtro — coerente com "o filtro permanece visível o tempo todo".
5. **Shell gap:** manter `gap-8` da página (não seguir o `gap-6` do C101) e compensar com `margin-bottom: -2rem` no strip — honra "desktop inalterado".

### Dados → forma

N/A — item de acabamento visual; nenhum dado/KPI/mapa muda.

## Fases verificáveis

1. **Tracer** — `data-slot` no chassis + `CampaignUpdatesFeed.css` + wrapper do strip; validar sticky/frameless/edge-to-edge no viewport mobile no dev server.
2. **UI completa** — header icon + trailing desktop-only + classes dos cards + copy do empty state.
3. **E2E + gates** — `campaignUpdatesMobile.e2e.spec.ts` (padrão `campaignAgendaMobile.e2e.spec.ts`, fixture `CampaignE2EFixture`): mobile = label oculta, botão texto oculto, icon no header abre o bottom sheet, cards sem borda, filtro visível após scroll; desktop = regressão (label e botão presentes, sem icon no header). `pnpm gate:fast`; push via `pnpm push`; PR `--base main` + `Closes #517` + auto-merge + `gh pr checks --watch --required`.

## Rabbit holes / Não escopo (engenharia)

- "Já que é sem moldura, melhora as outras listas" (B184 é o irmão; demais = pedido próprio).
- Remover/trocar o "Limpar" (isso é o B184, com X circular — não pedido aqui).
- Redesenhar chips/sugestões do omnibox; mudar conteúdo/fluxo do modal.
- `MunicipalityUpdateFeed` (feed do detalhe do município) — superfície diferente.
- Prop/variant novo no chassis; tocar no mecanismo C101 da agenda.

## Riscos e mitigação

- **Geometria do sticky** (pinar 1rem abaixo da top bar): receita C101 (`:has` + padding-top zero) já validada em prod — conferir visualmente no viewport mobile.
- **Regressão em outras listas:** CSS escopado por classe nova + media query; chassis só ganha `data-slot`; coberto por e2e desktop da própria superfície e gates.
- **`isPending`/transição da lista** interage com o sticky: sem mudança de comportamento (o wrapper não altera o fluxo); o e2e cobre rolagem com filtro visível.
- **Icon duplicado no desktop:** `md:hidden` no header action + `hidden md:inline-flex` no botão — exatamente um visível por resolução.

## Achados da execução (registrados)

- **Leak da base `ul` editorial no campaign:** `@layer base` do styles.css aplica `my-6 ml-6 list-disc [&>li]:mt-2` a todo `ul` — o feed de atualizações é a única lista campaign em `<ul>`, então o leak só aparecia aqui (margem esquerda de 24px + 8px por li). O feed agora neutraliza na própria lista (`my-0 list-none [&>li]:mt-0`); o `[data-theme='campaign'] p { margin-top: 0 }` já era o precedente desse patch pontual. Efeito colateral no desktop: feed alinhado ao filtro (o indent de 24px era artefato do leak, não desenho).
- **Artefato transitório de streaming (`#S:0` hidden):** páginas dinâmicas (searchParams awaitado) podem exibir temporariamente uma cópia hidden da página durante o stream; some sozinho (~1–5s). Não é regressão (existe só no build de produção, pré-existente no padrão de streaming). Os e2e esperam o stream assentar antes de assertar (`settleStream`).

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (7 bullets: label oculta; filtro sem moldura/sticky/linha separadora; chips dentro da omnibox; criar vira icon no header com o mesmo modal; cards edge-to-edge com linha; desktop inalterado; empty state coerente)
- [ ] Invariantes AGENTS/engineering-standards (nenhuma escrita/access/PII; copy pt-BR; identificadores em inglês)
- [ ] Testes: e2e mobile + desktop da superfície; gates completos (`pnpm gate:fast`)

Self-score decision-quality: 4,5/5 (decisões caras com rejeitadas ✓ · cabe no appetite ✓ · rabbit holes nomeados ✓ · depth check: reusa C101/slot C94-C95/chassis B127 ✓ · intenção preservada ✓)
