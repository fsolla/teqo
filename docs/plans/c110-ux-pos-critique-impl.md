# Impl: C110+ — UX pós-critique: refinamentos do preview do arrasto da agenda (chevron, dots do mês, gradiente)

Status: aprovado
Atualizado em: 2026-08-10
Issue: #618
Intenção: docs/plans/c110-ux-pos-critique.md
Appetite restante: ~0,5 dia eng fill-in (herdado; o lote cabe com folga)

## Leitura da intenção

- **Outcome:** colher os débitos pós-/simplify do C110 que ficaram abaixo do limiar de Issue individual, agrupados na superfície do preview do arrasto: (1) validar a leitura do chevron "direção da mudança" vs. canvas; (2) dots do mês ancorados ao box do frame (não ao bloco cheio do conteúdo); (3) deduplicar o gradiente de colunas de 14.285% via custom property — **somente se o lote já mexer nesse CSS** (senão descartar).
- **O que NÃO negociar:** aceite do C110 intacto (grid segue o dedo; preview aproximado — não é pixel-perfect; direção do gesto travada no claim; transform imperativo no hook); nada de redesenho do preview (Opção 2 do aceite — só seta — é rabbit hole); animar mais superfícies da agenda é anti-goal; desktop/FC intactos.
- **O que reavaliar:** o item 2 fala só em "dots do mês", mas as **barras day/week têm exatamente o mesmo defeito** (posicionam contra o content box, que inclui chevron+label — um evento das 07:00 renderiza sobre o rótulo). Corrigir pelo mesmo container posicionado único é grátis (mesma estrutura) e corrige o mesmo bug — decisão de escopo documentada abaixo (Opção A inclui, B restringe a dots).

## Abordagem recomendada

```mermaid
flowchart LR
  A[ActivityAgendaSwipePreview: container posicionado único .scene] --> B[frame + dots/bars ancoram no box do frame]
  B --> C[--swipe-frame-columns deduplica gradiente]
  D[chevron: decisão de produto no gate] --> E[manter canvas (recomendado) ou flip 1 linha]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — um container posicionado único `.activity-agenda-swipe-scene` (flex: 1, position: relative, filho do content após chevron/label) envolve o frame **e todos os indicadores posicionados** (dots do mês + bars day/week); os percentuais passam a resolver contra o box do frame, matando o desalinhamento vertical dos dots da primeira fileira e, de graça, o mesmo defeito das bars. Gradiente: custom property `--swipe-frame-columns` no `.activity-agenda-swipe-frame` (2 call sites reais, mesmo seletor-family, ~2 linhas — o lote mexe nesse bloco CSS ao introduzir o scene).
**Rejeitadas:** B — envolver só head+frame+dots (literal da intenção) e deixar as bars contra o content: mantém o mesmo bug nas bars day/week com dois sistemas de ancoragem no mesmo content (mais complexo que o fix completo); C — não fazer nada (deixar débitos registrados): a intenção é o lote, o custo é trivial.

### Componentes / mudanças

- **`ActivityAgendaSwipePreview.tsx`** (`src/components/campaign/activity/`): introduz `.activity-agenda-swipe-scene` como wrapper posicionado único contendo o frame e os indicadores posicionados (dots/bars); list rows continuam no fluxo do content (não são posicionadas). Chevron: **decisão do gate** (ver abaixo) — se flip, `ChevronRight`/`ChevronLeft` trocam de lado (1 linha cada).
- **`ActivityAgenda.css`**: `.activity-agenda-swipe-scene { position: relative; flex: 1; min-height: 0 }`; frame passa de `flex: 1` para `width: 100%; height: 100%` (o scene é o flex item agora); `--swipe-frame-columns` declarada no `.activity-agenda-swipe-frame` e consumida na base + `[data-view='month']`.
- **Migration:** sem migration. **Access/Consent:** nenhum.
- **UI:** Impeccable B — encaixe na superfície já entregue, sem shape novo (a intenção já classificou assim); verificação no browser do alinhamento dots×frame no mês.

### Dados → forma

- N/A — nenhuma mudança de dados; a "forma" (frame skeleton, dots, bars) já foi aceita no C110.

## Fases verificáveis

1. **Estrutura + CSS** — scene wrapper + ancoragem de dots/bars + `--swipe-frame-columns`; verificação visual no browser (mês: dots na fileira 1 não tocam o rótulo; day/week: bars alinhadas às faixas do frame).
2. **Chevron (se flip aprovado)** — troca de ícone; e2e não asserta direção (só visibilidade do `svg.activity-agenda-swipe-chevron`), então sem mudança de teste.
3. **Unit test estrutural do preview** — spec novo pequeno (`activityAgendaSwipePreview.unit.spec.tsx`): render com view=month → dots são descendentes do `.activity-agenda-swipe-scene`; chevron esquerda/direita conforme `direction`; pina a correção contra regressão.
4. **Gates** — `pnpm gate:fast` na iteração; `pnpm push` na entrega.

## Rabbit holes / Não escopo (engenharia)

- Redesenho do preview (Opção 2 do aceite); compensar a borda de 1px do frame nos offsets dos dots (ruído de `calc` para 1px num preview assumidamente aproximado — gatilho de revisita: se a crítica visual apontar); medir/animar mais superfícies; qualquer mudança no hook/gesto.

## Débitos deferidos (pós-/simplify; nenhum registra Issue)

- **Barras do week todas na coluna "Seg"** (`left: 0`, sem o dia da semana — enganoso com o head de 7 colunas; fix barato: `left: weekdayIndex * 14.285%`). **Gatilho:** se a crítica visual apontar as barras da semana na coluna errada (S6).
- **Dots do mês ignoram o offset do 1º dia** (`dayIndex % 7`, o grid real usa `firstDay=1` — a semana 1 fica ~1 banda acima). Dentro da aproximação aceita. **Gatilho:** se o preview do mês ganhar mais uso no mobile ou a crítica visual apontar o desalinhamento (S7).
- **Borda de 1px do frame vs indicadores em 0%** — decisão registrada (sem compensação; gatilho de revisita se a crítica visual apontar).
- **Validação da leitura do chevron com usuário da persona** — decisão de produto do gate: manter a leitura do canvas (aponta para o lado revelado), convenção de carousel; flip é 1 linha se a validação futura apontar o contrário.

## Riscos e mitigação

- **Overflow do scene no flex**: `min-height: 0` evita estourar o content quando o frame é `height: 100%`.
- **e2e existente** (`campaignAgendaMobile.e2e.spec.ts`): asserta `svg.activity-agenda-swipe-chevron` visível e `.activity-agenda-swipe-event` count > 0 — ambos sobrevivem intactos à reestruturação (classes não mudam).
- **Mudança visual das bars day/week** (alinhamento ao frame em vez do content): é a correção do mesmo bug, mas altera o look — mitigação: verificação no browser na fase 1 antes de fechar.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (chevron validado/decidido; dots ancoram no frame; gradiente deduplicado)
- [ ] Invariantes AGENTS/engineering-standards (sem migration/sem prod/sem Consent novo; copy pt-BR / identificadores em inglês; sem twin de componentes)
- [ ] Testes: unit estrutural do preview (fase 3); e2e existente da agenda mobile verde; gate:fast e gate:push verdes

## Decisões de engenharia

- **Container posicionado único inclui bars (não só dots)** — Opções: A (scene com frame+dots+bars) | B (só dots) | C (nada). Recomendação: A — mesmo defeito, mesmo fix, zero custo incremental, um único sistema de ancoragem. Rejeitadas: B (deixa bug idêntico nas bars, dois sistemas de ancoragem); C (débito não colhido, contra a intenção do lote).
- **Gradiente via `--swipe-frame-columns`** — a intenção condicionava a custom property a "se o lote já mexer nesse CSS"; o lote mexe no mesmo bloco (scene/frame) → condição satisfeita; 2 call sites reais.
- **Sem compensação da borda de 1px** — barata de reverter; preview é aproximado por aceite.
