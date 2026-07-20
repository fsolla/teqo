---
target: /campanha
total_score: 32
p0_count: 0
p1_count: 0
p2_count: 3
p3_count: 2
timestamp: 2026-07-20T00-01-43Z
slug: src-app-campaign-campanha
---
Method: dual-agent (A: 22ac0b39-b0f9-4111-b890-4c4125d1218b · B: bacccead-08e1-4dce-9b0d-4fe7984b1853)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | KPIs têm `CampaignDataFreshness`; filas não mostram idade do item na linha |
| 2 | Match System / Real World | 4 | Linguagem de núcleo/fila encaixa; `LeadershipStatusCard` contextualiza status |
| 3 | User Control and Freedom | 4 | `RecentlyVisitedCard` com `aria-label` no limpar; liderança tem CTA no empty |
| 4 | Consistency and Standards | 3 | Dashboard `geral` alinhado ao grid coordenador; empty de eventos ainda é `<p>` solto |
| 5 | Error Prevention | 3 | Dashboard read-only; sem riscos destrutivos nesta tela |
| 6 | Recognition Rather Than Recall | 4 | `ChoroplethLegend` + visitados recentes; glossário ainda só em `title` |
| 7 | Flexibility and Efficiency | 2 | Fila prioritária ainda é um clique por núcleo; sem triagem em lote |
| 8 | Aesthetic and Minimalist Design | 3 | Top row 3:2:1 funciona; dois `CampaignMetricStrip` + mapa sem header |
| 9 | Error Recovery | 3 | Empty de liderança com CTA; coordenador sem próximo passo |
| 10 | Help and Documentation | 2 | Status de apoio e estimativa sem affordance touch (`?`/Popover) |
| **Total** | | **32/40** | **Good — fundação sólida; flexibilidade e ajuda ainda abaixo do ideal** |

## Anti-Patterns Verdict

**LLM assessment:** Não é slop de SaaS genérico. Field Desk se lê: stone desk, Inter, vermelho como sinal, mapa da Bahia, copy de campo em pt-BR. O ciclo pós-critique fechou os P1 visuais (grid desktop, filas vazias, legenda do mapa, card de lideranças, recentes). O que resta é produto/ops (bulk, glossário), não estética de template.

**Deterministic scan:** **0 findings** em `src/app/(campaign)/campanha` + `src/components/campaign` (~164 arquivos). Nenhum side-stripe, gradient text, ou eyebrow detectado no estático.

**Browser evidence:** Dev server ativo. Playwright capturou login em 1440px e 1920px — card centrado, margens amplas esperadas. Dashboard autenticado não capturado (gate de login). Overlay Impeccable conectou no login e reportou **1× `nested-cards`** em runtime — provável falso positivo (heurística de borda/radius em subcomponentes shadcn; HTML estático tem um único `data-slot="card"`).

## Overall Impression

O dashboard `geral` saiu da pilha vertical ingênua para um desk operacional: fila prioritária à esquerda, eventos e recentes no topo, KPIs + mapa abaixo. A sensação agora é de ferramenta de coordenação, não de relatório empilhado. O teto atual é **eficiência** (Alex ainda faz retail na fila) e **onboarding** (Jordan não decodifica badges sem hover). Score **27 → 32** no eixo dashboard; o próximo salto vem do backlog FD2, não de mais polish visual.

## What's Working

1. **`GeneralDashboardTopRow` 3:2:1** — Filas (3) | Próximos eventos (2) | Recentes (1), com reflow 4:2 quando não há visitas. Prioridade visual correta sem monólito vertical.

2. **`ActionQueuesCard` all-clear** — Um único “Tudo em dia” substitui três subseções com badge “0”. Tom positivo quando não há pendência.

3. **`LeadershipStatusCard` + `ChoroplethLegend`** — Lideranças ganharam título, descrição, CTA e grid com ênfase em engajado; mapa decodificável com barra rose→vermelho e rótulos 0/máx.

## Priority Issues

### [P2] Triagem em lote ainda ausente na fila prioritária
- **Why:** Cada item “Sem coordenador” é um link isolado; 15 núcleos = 15 idas e voltas.
- **Fix:** Multi-select só em `withoutCoordinator` + barra “Atribuir coordenador (N)” reutilizando shell de designação existente.
- **Suggested command:** `/impeccable layout`

### [P2] Jargão de domínio opaco no touch
- **Why:** `SupportStatusBadge`, estimativa confirmada vs proposta, métricas do mapa dependem de `title` (hover) — inútil no celular.
- **Fix:** `CampaignGlossaryHint` com gatilho `?` (`min-h-11`) em badges e labels de KPI.
- **Suggested command:** `/impeccable clarify`

### [P2] Outline de headings pula `h2` em Filas
- **Why:** `h1` → `CardTitle` Filas (não heading) → `h3` nas subfilas → depois `h2` Indicadores — ordem invertida para leitores de tela.
- **Fix:** Promover “Filas de ação” a `h2` semântico (`id="action-queues"` já existe).
- **Suggested command:** `/impeccable audit`

### [P3] Empty do coordenador sem CTA
- **Why:** Texto explica o bloqueio mas não oferece ação (liderança já tem “Ver meu perfil”).
- **Fix:** Espelhar `LeadershipDashboard` empty com `EmptyContent` + CTA.
- **Suggested command:** `/impeccable onboard`

### [P3] Recentes compactos escondem timestamp
- **Why:** Modo `compact` põe idade só em `sr-only`; Alex não distingue visita recente de antiga.
- **Fix:** Mostrar `text-xs text-muted-foreground` truncado no modo compacto.
- **Suggested command:** `/impeccable polish`

## Persona Red Flags

**Alex (power user / geral):** Fila ainda retail; timestamps ocultos em Recentes compacto; `max-w-screen-2xl` deixa margem morta em ultra-wide (aceitável, mas não usa monitor inteiro).

**Jordan (first-timer):** Grid de status colorido sem glossário inline; “Nenhum evento agendado” não sugere criar plano; mapa legível mas métrica “estimativa confirmada” não explicada na UI.

**Casey (mobile / campo):** Alvos `min-h-11` ok; fila é tocável; sem cue de offline até fallback PWA; tooltips de status inacessíveis no touch.

**Marcos (coordenador):** Empty sem CTA após “peça que te incluam”; dashboard dele não ganhou o top-row 3:2:1 do geral (só `RecentlyVisited` + cards).

## Minor Observations

- `LeadershipDashboard` empty ainda usa `AlertTriangleIcon` — tom alarmista para “aguardando acesso”.
- `UpcomingActionPlansCard` empty é `<p>`; vizinhos usam `Empty`.
- Mapa em `Card` sem `CardHeader` — vizinhos têm título explícito.
- Dois `CampaignMetricStrip` poderiam ser um grid 2×3 em `lg:`.
- Reflow do top row quando primeira visita é gravada (3:2:1 → 4:2).

## Questions to Consider

- O mapa é instrumento de triagem (clique filtra núcleos) ou painel de contexto read-only?
- Quando tudo está “Tudo em dia”, o dashboard deveria promover mobilização (eventos) acima dos KPIs?
- Recentes em `localStorage` é feature (privacidade) ou footgun (troca de dispositivo)?
