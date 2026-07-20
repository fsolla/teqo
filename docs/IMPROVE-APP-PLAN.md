# Improve App Plan

## Context

- **Started:** 2026-07-19
- **Surface in scope:** `/campanha` (web + PWA). Site público e `/admin` fora deste ciclo, salvo se o job apontar o contrário.
- **Product:** Teqo — ferramenta de campanha do deputado Jorge Solla (PT-BA); prova de valor em 2026 para depois servir candidaturas de esquerda com mais capital social que financeiro.
- **Job (intake, palavras do time):** Bahia enorme; votos em quase todos os municípios; ~45 dias; pouco recurso; dados fragmentados (cada assessor/liderança no próprio canal); precisa coletar dados, analisar com inteligência e executar ações precisas — e manter a equipe _voltando_ à ferramenta (falha histórica de outras plataformas).
- **Roughest feel:** telas confusas.
- **Evidence:** nenhuma ainda. Primeira semana de desenvolvimento. Primeiros testes com coordenador geral + assistente previstos ~quarta-feira (2026-07-22).
- **Platform:** web + PWA; sem app nativo em 2026.
- **Upsell / paywall in-app:** não.
- **Highest-risk leak (confirmado Fase 1):** Little Hire — emoção (confiança no quadro atualizado). Big Hire mitigado offline (onboarding presencial + seed). Assessores param de atualizar → WhatsApp/planilha → ferramenta defasada → abandono.
- **Existing docs:** `CUSTOMER.md` (Fase 1 + continuous-discovery); sem DESIGN / POSITIONING / PRODUCT / EXPERIMENTS ainda; planos técnicos + critique Field Desk (32/40) e FD2.- **Backlog canônico de produto/engenharia:** [`docs/roadmap.md`](roadmap.md) — ideias, pendências por trilha, Onda 0, âncoras do calendário eleitoral. Este journey **não substitui** o roadmap; experimentos e cortes de UX devem apontar de volta a itens do roadmap (ou abrir fill-ins lá) quando virarem trabalho de build.
- **Plano de fases:** confirmado pelo product owner em 2026-07-19 (com a nota do roadmap acima).

## Phase Status

| Phase | Skill                    | Status                                                                                                    | Artifact                              | Date       |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------- |
| 1     | jobs-to-be-done          | done                                                                                                      | CUSTOMER.md                           | 2026-07-19 |
| 2     | ux-heuristics            | deferred: após primeiros testes de quarta (~2026-07-22) — auditoria expert sem usuários seria especulação | DESIGN.md, EXPERIMENTS.md             | 2026-07-19 |
| 3     | design-everyday-things   | pending                                                                                                   | DESIGN.md, EXPERIMENTS.md             |            |
| 4     | refactoring-ui           | pending                                                                                                   | DESIGN.md, EXPERIMENTS.md             |            |
| 5     | microinteractions        | pending                                                                                                   | DESIGN.md, EXPERIMENTS.md             |            |
| 6     | made-to-stick            | pending                                                                                                   | POSITIONING.md, EXPERIMENTS.md        |            |
| 7     | influence-psychology     | skipped: sem paywall/upgrade/trial in-app                                                                 | —                                     | 2026-07-19 |
| 8     | high-perf-browser        | pending                                                                                                   | DESIGN.md, EXPERIMENTS.md             |            |
| 9     | steve-jobs-design-review | pending                                                                                                   | PRODUCT.md, DESIGN.md, EXPERIMENTS.md |            |
| opt   | continuous-discovery     | done (cadência + roteiro; evidência chega ~2026-07-22)                                                    | CUSTOMER.md                           | 2026-07-19 |
| opt   | improve-retention        | deferred: após Fase 1 + primeiros testes — risco é Little Hire                                            | PRODUCT.md                            |            |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Key Decisions

| Date       | Phase  | Decision                                    | Rationale                                                                                   |
| ---------- | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 2026-07-19 | Intake | Escopo = `/campanha` (não site público)     | Job e atrito são de operação de campanha                                                    |
| 2026-07-19 | Intake | Fase 7 skipped                              | Sem superfícies de upsell in-app                                                            |
| 2026-07-19 | Intake | continuous-discovery opcional recomendada   | Evidência = nenhuma; testes humanos esta semana                                             |
| 2026-07-19 | Intake | improve-retention deferred pós-Fase 1       | Sintoma clássico de abandono por dados defasados; método completo depois do job + evidência |
| 2026-07-19 | Intake | Plano de fases confirmado                   | Inclui `docs/roadmap.md` como registro vivo de ideias/pendências                            |
| 2026-07-19 | Intake | Roadmap = backlog de build                  | Findings deste journey → EXPERIMENTS + itens/planos no roadmap quando forem para build      |
| 2026-07-19 | 1      | Job = campanha dep. federal pela Bahia      | Abrangência estadual; cargo federal                                                         |
| 2026-07-19 | 1      | Pior dimensão = emocional                   | Confiança no quadro atualizado; risco de ansiedade com dados mortos                         |
| 2026-07-19 | 1      | Leak = Little Hire                          | Big Hire coberto por onboarding presencial + seed de dados iniciais                         |
| 2026-07-19 | 2      | Fase 2 deferred                             | Esperar testes com coordenador geral + assistente (~quarta) antes da auditoria heurística   |
| 2026-07-19 | opt CD | Outcome = Little Hire até 16/08             | Sinal: ≥1 update espontâneo em 7 dias pós-quarta                                            |
| 2026-07-19 | opt CD | Quarta = Mom Test 25 + observe 25           | História do passado + primeira sessão sem pitch                                             |
| 2026-07-19 | opt CD | Cadência presencial semanal + remoto ad hoc | Coordenador geral disponível remotamente quando necessário                                  |
| 2026-07-19 | opt CD | Sala = product + onboarding lead + CG       | CG é participante; interviewers = product + onboarding                                      |

## Next Actions

- [x] Confirmar este plano de fases com o product owner (2026-07-19)
- [x] Fase 1 → `docs/CUSTOMER.md` (2026-07-19)
- [x] Fase 2 deferred até evidência de quarta
- [x] continuous-discovery → cadência + OST + roteiro em `CUSTOMER.md` (2026-07-19)
- [ ] Rodar sessão de quarta (Mom Test + observe) → preencher Interview Evidence + Snapshot
- [ ] Medir sinal Little Hire: ≥1 update espontâneo em 7 dias (sem cobrar)
- [ ] Retomar Fase 2 (ux-heuristics) após quarta, com achados reais
- [ ] Cruzar findings com `docs/roadmap.md` (FD2, onboarding, Onda 0…)
- [ ] Não shipar polish visual (Fase 4) sem finding de Fases 1–3
