# Impl: Agenda mobile — affordance do "voltar ao hoje" + navegação por teclado (pós-C101)

Status: rascunho
Atualizado em: 2026-08-09
Issue: #C101-ux
Intenção: docs/plans/c101-agenda-mobile-calendario-nativo.md
Appetite: ~0,5 dia eng (fill-in pós-entrega)

## Leitura do lote

- **Outcome:** no mobile da agenda, (1) usuários de teclado/AT conseguem navegar entre períodos mesmo com a toolbar do FullCalendar escondida (C101), e (2) o tap no título do header ("voltar ao hoje") tem uma pista visual — hoje só existe `title` (hover), invisível no toque.
- **O que NÃO negociar:** desktop intacto (toolbar continua mandando lá); swipe continua sendo o gesto primário; C91 (tap cria inline) e C15 (arrasto de remanejo) intactos; nada de segunda barra de controles.
- **O que reavaliar:** se o FullCalendar já entrega navegação por setas no grid focado (FC tem seleção por teclado interna) — talvez baste expor/focar o grid, sem handler próprio.

## Fases verificáveis

1. **a11y (primeiro):** teclado no mobile — ArrowLeft/ArrowRight navegam dia/semana/mês conforme a vista. Investigar o teclado interno do FC antes de criar handler próprio; se FC já navega com o grid focado, garantir que o foco chegue lá (o container tem `tabIndex`?). Teste unitário + e2e com `page.keyboard`.
2. **UX:** pista visual do tap-no-título — opções: chip "Hoje" discreto ao lado do título no top bar (só na agenda mobile) | ícone de calendário | nada além do affordance de botão. Validar no gate (Impeccable B/C).
3. **Gates:** `pnpm gate:fast` na iteração; `pnpm push` na entrega.

## Rabbit holes / Não escopo

- Redesenhar a top bar; mudar o swipe; segunda barra; desktop; outras listas.

## Riscos e mitigação

- Handler próprio de teclado pode conflitar com o teclado interno do FC (seleção de célula) — verificar primeiro; se conflitar, restringir o handler a quando o foco está fora do grid.
- Chip "Hoje" no top bar disputa espaço com [Semana ▾][sino] — medir no browser antes.

## Já resolvido no simplify (não reabrir)

- Contrato `onTitleClick: { action, hint }` no chrome compartilhado (copy da agenda não vaza para o componente genérico).
- Helper compartilhado de rótulos de período (`tests/e2e/helpers/agendaPeriodLabels.ts`).
- Sticky real do strip; suppress do dateClick no claim; guarda de resize; anchor civil do mês (incl. bug de parse UTC).
- Robustez do e2e (poll, tolerâncias, scroller ancorado, stubMatchMedia).

## Explicitamente fora (descartes + defers com gatilho deste triage)

- **Defer:** validação do interplay pan-y × pointercancel em device real — gatilho: antes de qualquer evolução do gesto de swipe (o e2e CDP cobre o caminho Chromium, não o Safari/WebKit).
- Descartados: variável CSS do budget de altura (P3); flash de hidratação do título (padrão B167 existente); nota de meia-noite nos e2e (documentada); side-effect do harness de teste (P3).

## Aceite de engenharia

- [ ] Teclado navega períodos no mobile sem conflitar com a seleção interna do FC
- [ ] Tap no título comunica a ação sem depender de hover
- [ ] Desktop, swipe, C91 e C15 intactos; gates verdes
