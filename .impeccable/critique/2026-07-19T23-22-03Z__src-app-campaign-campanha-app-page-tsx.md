---
target: /campanha dashboard
total_score: 27
p0_count: 0
p1_count: 2
p2_count: 3
timestamp: 2026-07-19T23-22-03Z
slug: src-app-campaign-campanha-app-page-tsx
---
Method: dual-agent (A: design review · B: detector + Playwright screenshots)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | KPIs têm `CampaignDataFreshness`; filas não mostram idade dos itens |
| 2 | Match System / Real World | 3 | Linguagem de núcleo/fila encaixa; **"Lideranças" sem contexto** |
| 3 | User Control and Freedom | 3 | **"Limpar"** em Visitados é ghost sem ícone nem `aria-label` claro |
| 4 | Consistency and Standards | 2 | **Lista de núcleos usa `lg:grid-cols-2`; dashboard geral não** |
| 5 | Error Prevention | 3 | Dashboard read-only; sem riscos destrutivos aqui |
| 6 | Recognition Rather Than Recall | 3 | Visitados ajuda recall; **cores do mapa não são decodificáveis** |
| 7 | Flexibility and Efficiency | 2 | **Coluna única + `max-w-screen-2xl`** desperdiça desktop largo |
| 8 | Aesthetic and Minimalist Design | 2 | **Três subseções vazias nas filas**; cards com muito respiro interno |
| 9 | Error Recovery | 3 | N/A nesta tela |
| 10 | Help and Documentation | 2 | Status de apoio e escala do mapa sem glossário/legenda visual |
| **Total** | | **27/40** | **Acceptable — melhorias significativas antes de sentir "pronto"** |

## Anti-Patterns Verdict

**LLM assessment:** Não é slop genérico de SaaS (sem hero-metric grid, copy em português de campo, mapa da Bahia). Mas o layout do dashboard `geral` parece uma versão anterior do produto: pilha vertical única enquanto outras telas `geral` já usam grid de duas colunas. Padrão "card stack" com muito espaço morto dentro das seções.

**Deterministic scan:** 0 findings em `CampaignDashboard.tsx`, `RecentlyVisited.tsx`, `ChoroplethMapPanel.tsx`, `CampaignPageShell.tsx`. Nenhum side-stripe, gradient text, ou eyebrow detectado.

**Browser evidence (Playwright, 1440px e 1920px):** Shell limitado a 1536px com `mr-auto` — em ultra-wide sobra faixa vazia à direita. Filas vazias mostram três blocos com badge "0" e texto de confirmação. Legenda do mapa é só texto "Escala: 0 → N". Overlay do detector não renderizou (live-server); inspeção visual manual.

## Overall Impression

O dashboard tem ingredientes certos para o Field Desk (fila prioritária, faixa de KPIs, mapa territorial), mas a **arquitetura de layout desktop** não acompanha a densidade que coordenadores precisam. A maior oportunidade é reorganizar em grid responsivo e tratar estados "tudo em dia" como celebração compacta, não como três parágrafos repetidos.

## What's Working

1. **Fila prioritária** — `campaignPrioritySurfaceClassName` + prefixo "Prioridade ·" sinaliza corretamente por onde começar.
2. **`CampaignMetricStrip`** — KPIs escaneáveis com barras de progresso sem cair no grid de cards idênticos.
3. **Mapa com defaults sensatos** — território + estimativa confirmada; ancorado na geografia da Bahia.

## Priority Issues

### [P1] Desktop não aproveita largura; ultra-wide deixa vazio à direita
- **Why:** `CampaignPageShell` usa `flex-col gap-8` sem breakpoint grid; `mr-auto max-w-screen-2xl` prende conteúdo à esquerda em monitores largos.
- **Fix:** Reflow `GeneralDashboard` em `lg:grid` (ex.: filas + KPIs à esquerda, mapa sticky + eventos à direita), espelhando `NucleusListOverview`. Considerar `mx-auto` ou remover cap em `xl:` quando houver grid de 2 colunas.
- **Suggested command:** `/impeccable layout`

### [P1] Filas de ação vazias ocupam espaço sem valor
- **Why:** `QueueSection` sempre renderiza; com tudo zerado o usuário lê três mensagens + três badges "0".
- **Fix:** Se todas as filas vazias, um único estado positivo ("Nada pendente — filas em dia"); renderizar subseções só quando `items.length > 0`.
- **Suggested command:** `/impeccable quieter`

### [P2] Escala do mapa sem cores
- **Why:** `choroplethFillColor` implementa gradiente rose→vermelho; UI só mostra números em `ChoroplethMapControls`.
- **Fix:** Barra de legenda com swatches usando o mesmo ramp; rótulos 0 e máximo.
- **Suggested command:** `/impeccable clarify`

### [P2] "Lideranças" sem framing
- **Why:** Linha solta com badges de status + contagem; não fica claro que são contatos de liderança em todos os núcleos por status de apoio.
- **Fix:** Card com título + descrição; link para lista filtrada; tooltip/glossário nos status.
- **Suggested command:** `/impeccable clarify`

### [P2] Visitados recentemente — bullets e botão Limpar
- **Why:** `<ul>` sem `list-none` (padrão do projeto em outras listas); "Limpar" ghost compete com o título sem affordance de ação destrutiva/secundária.
- **Fix:** `list-none m-0 p-0`; botão outline ou ícone + `aria-label="Limpar histórico de visitas"`.
- **Suggested command:** `/impeccable polish`

## Persona Red Flags

**Alex (power user / geral):** Scroll longo para ver filas + mapa + eventos; não vê triagem territorial de relance; três zeros nas filas são ruído.

**Jordan (first-timer):** "Lideranças" e badges coloridos sem explicação; cores do mapa opacas; "Limpar" ambíguo.

**Marcos (coordenador de campo):** Dashboard de coordenador já usa `lg:grid-cols-2` nos cards; visão geral parece produto diferente, menos maduro.

## Minor Observations

- Mapa fora de `Card` enquanto vizinhos estão em Card — quebra de registro visual.
- Dois `CampaignMetricStrip` empilhados poderiam ser um grid 2×3 em `lg:`.
- `QueueSection` `<ul>` também sem `list-none`.
- Heading outline: `h2` Indicadores depois de `h3` nas filas.

## Questions to Consider

- Se `NucleusListOverview` já tem o layout "adulto", por que o home ainda é pilha vertical?
- Quando tudo está em dia, o dashboard deve celebrar ou manter tom de "quadro de pendências"?
- O mapa é ferramenta de triagem (legenda P1) ou decoração (considere snapshot estático)?
