---
target: /campanha/pracas overview Votos estimados no conjunto
total_score: 20
p0_count: 0
p1_count: 3
p2_count: 2
p3_count: 1
timestamp: 2026-07-23T21-29-20Z
slug: src-components-campaign-plazalistoverview-tsx
---
Method: dual-agent (A: c0c0346d-83f2-4aa7-b728-c883635b063e · B: 104c4dcf-5d13-4351-b6fe-db8d2d632179)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Número muda com filtros, mas nunca diz que é o cenário Média; mapa pode divergir |
| 2 | Match System / Real World | 2 | “Faixa” e “no conjunto” não nomeiam pessimista–otimista nem o recorte filtrado |
| 3 | User Control and Freedom | 3 | Agregado read-only correto; filtros controlam o conjunto; sem seletor de cenário no strip |
| 4 | Consistency and Standards | 2 | Dashboard: “Votos estimados” + célula própria p/ sem estimativa; lista empacota no meio |
| 5 | Error Prevention | 2 | `—` quando total=0; faixa some se falta um extremo (pós-backfill só central) |
| 6 | Recognition Rather Than Recall | 1 | Exige lembrar A10: default=média; Faixa=P–O; conjunto=filtrado |
| 7 | Flexibility and Efficiency | 2 | Denso p/ Alex; cenário só no mapa / Popover da linha |
| 8 | Aesthetic and Minimalist Design | 3 | Field Desk limpo; ênfase justificada; leve hero-KPI |
| 9 | Error Recovery | 2 | Qualidade do total (`sem estimativa`) enterrada em Declarações |
| 10 | Help and Documentation | 1 | Sem microcopy “Média” / “Pessimista–Otimista” |
| **Total** | | **20/40** | **Acceptable — craft visual ok; informação do cenário fraca** |

## Anti-Patterns Verdict

**LLM assessment:** Não é slop SaaS genérico (sem purple, side-stripe, card grid). Field Desk se lê: stone, Inter, priority lift permitido. Resíduo de **hero-metric template**: número grande enfatizado + detalhe tipográfico fraco, sem o vocabulário A10 (Média / Pessimista / Otimista) que forms e mapa já usam.

**Deterministic scan:** CLI `detect.mjs` em `PlazaListOverview.tsx` + `CampaignMetricStrip.tsx` → **exit 0, `[]`** (0 findings).

**Visual overlays:** Login wall em `/campanha/pracas` → overlay só no login (2 warnings fora de escopo: `flat-type-hierarchy`, `nested-cards` shadcn). Strip autenticado não inspecionado ao vivo. Screenshot: `.impeccable/assessment-b-campanha-pracas-login.png`.

## Overall Impression

O strip está certo em *estrutura* A10 (média grande + faixa secundária, não três KPIs) e no lugar certo (acima da tabela, no recorte filtrado). Falha em *rotular a semântica*: o número hero não diz “Média”, “Faixa” não diz pessimista–otimista, e o mapa acima pode mostrar outro cenário sem o strip confessar o lock em `central`. Em reunião, Marcos não sabe se está olhando chão, caso-base ou teto.

## What's Working

1. **Priority strip 3 células** — overview acima da lista, não card grid; lift alinhado a DESIGN.md.
2. **Rollup filtrado** — `rollupPlazaStaffVotes` torna “conjunto” funcionalmente o recorte, mesmo com label mole.
3. **Restrição de produto** — sem % estadual, sem gauge, sem três KPIs; absolute votos + tabular nums.

## Priority Issues

### [P1] Número grande sem rótulo “Média”
- **Why:** Default A10 é `central`; a UI só diz “Votos estimados no conjunto”. Coordenação pergunta “isso é o otimista?”.
- **Fix:** Label ou detail explícito: “Média” / “Cenário média (padrão)”.
- **Suggested command:** `/impeccable clarify`

### [P1] “Faixa X–Y” sem pessimista–otimista
- **Why:** Pode ser CI, meta ou goals; conflita com vocabulário A10 já nos forms/mapa.
- **Fix:** “Pessimista X · Otimista Y” ou mini `VoteEstimateScenarioStrip` endpoints.
- **Suggested command:** `/impeccable clarify`

### [P1] Mapa Cenário vs strip dessincronizado
- **Why:** Mapa (acima) troca P/M/O; strip fica em central sem cue — duas verdades na mesma scroll.
- **Fix:** Âncora explícita (“sempre média”) **ou** strip segue o cenário do mapa (estado local compartilhado).
- **Suggested command:** `/impeccable layout`

### [P2] `sem estimativa` enterrado em Declarações
- **Why:** Qualidade do hero number some no meio da célula; dashboard já tem célula própria.
- **Fix:** Footnote sob o total ou alinhar layout ao dashboard.
- **Suggested command:** `/impeccable layout`

### [P2] “No conjunto” subespecificado
- **Why:** Não diz “Praças filtradas”; fácil ler como estadual/escopo total.
- **Fix:** “Média nas Praças filtradas” (resolve P1+P2 de naming).
- **Suggested command:** `/impeccable clarify`

### [P3] Linguagem visual ≠ linhas da tabela
- **Why:** Linhas usam ScenarioStrip; overview só tipografia.
- **Fix:** Strip compacto endpoints no detail.
- **Suggested command:** `/impeccable polish`

## Persona Red Flags

**Alex (CG):** Usa o número no briefing sem notar mapa em pessimista vs strip em média.

**Jordan (assessor novo):** “Faixa” + “conjunto” + número sem “Média” → confunde com `voteGoals`.

**Sam (a11y):** Detail em `<p>` solto; nomes de cenário ausentes do summary falado do hero.

**Marcos (CG em reunião):** Precisa chão/caso-base/teto num glance; recebe KPI absoluto + faixa críptica.

## Minor Observations

- Chrome duplo (section priority + dl card) um pouco pesado.
- Dashboard vs lista: labels e packing de `missingEstimateCount` divergem.
- `staffVoteTotal > 0 ? format : '—'` trata zero como vazio.
- Pós-backfill só-central: some a faixa e o número parece mais certo do que é.
- Agregado read-only correto (edit na linha) — sem violação Edit-where-you-see.

## Questions to Consider

- O strip é âncora fixa de caso-base ou gêmeo esquecido do seletor do mapa?
- Trocar “Faixa” por “Pessimista · Otimista” ensina o modelo sem custar density?
- “Média nas Praças filtradas” aposenta três ambiguidades de uma vez?
- `sem estimativa` deveria ser footnote do hero, não do meio?
