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

| Phase | Skill                    | Status                                                                                                                   | Artifact                              | Date       |
| ----- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ---------- |
| 1     | jobs-to-be-done          | done                                                                                                                     | CUSTOMER.md                           | 2026-07-19 |
| 2     | ux-heuristics            | pending — evidência de uso 2026-07-29 (O9–O11; above-the-fold; ação-primeiro). Mirar fluxos do delta do dia, não polish. | DESIGN.md, EXPERIMENTS.md             | 2026-07-29 |
| 3     | design-everyday-things   | pending                                                                                                                  | DESIGN.md, EXPERIMENTS.md             |            |
| 4     | refactoring-ui           | pending                                                                                                                  | DESIGN.md, EXPERIMENTS.md             |            |
| 5     | microinteractions        | pending                                                                                                                  | DESIGN.md, EXPERIMENTS.md             |            |
| 6     | made-to-stick            | pending                                                                                                                  | POSITIONING.md, EXPERIMENTS.md        |            |
| 7     | influence-psychology     | skipped: sem paywall/upgrade/trial in-app                                                                                | —                                     | 2026-07-19 |
| 8     | high-perf-browser        | pending                                                                                                                  | DESIGN.md, EXPERIMENTS.md             |            |
| 9     | steve-jobs-design-review | pending                                                                                                                  | PRODUCT.md, DESIGN.md, EXPERIMENTS.md |            |
| opt   | continuous-discovery     | done (cadência + roteiro; evidência chega ~2026-07-22)                                                                   | CUSTOMER.md                           | 2026-07-19 |
| opt   | improve-retention        | deferred: após Fase 1 + primeiros testes — risco é Little Hire                                                           | PRODUCT.md                            |            |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Key Decisions

| Date       | Phase  | Decision                                     | Rationale                                                                                                                                                                                         |
| ---------- | ------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-19 | Intake | Escopo = `/campanha` (não site público)      | Job e atrito são de operação de campanha                                                                                                                                                          |
| 2026-07-19 | Intake | Fase 7 skipped                               | Sem superfícies de upsell in-app                                                                                                                                                                  |
| 2026-07-19 | Intake | continuous-discovery opcional recomendada    | Evidência = nenhuma; testes humanos esta semana                                                                                                                                                   |
| 2026-07-19 | Intake | improve-retention deferred pós-Fase 1        | Sintoma clássico de abandono por dados defasados; método completo depois do job + evidência                                                                                                       |
| 2026-07-19 | Intake | Plano de fases confirmado                    | Inclui `docs/roadmap.md` como registro vivo de ideias/pendências                                                                                                                                  |
| 2026-07-19 | Intake | Roadmap = backlog de build                   | Findings deste journey → EXPERIMENTS + itens/planos no roadmap quando forem para build                                                                                                            |
| 2026-07-19 | 1      | Job = campanha dep. federal pela Bahia       | Abrangência estadual; cargo federal                                                                                                                                                               |
| 2026-07-19 | 1      | Pior dimensão = emocional                    | Confiança no quadro atualizado; risco de ansiedade com dados mortos                                                                                                                               |
| 2026-07-19 | 1      | Leak = Little Hire                           | Big Hire coberto por onboarding presencial + seed de dados iniciais                                                                                                                               |
| 2026-07-19 | 2      | Fase 2 deferred                              | Esperar testes com coordenador geral + assistente (~quarta) antes da auditoria heurística                                                                                                         |
| 2026-07-19 | opt CD | Outcome = Little Hire até 16/08              | Sinal: ≥1 update espontâneo em 7 dias pós-quarta                                                                                                                                                  |
| 2026-07-19 | opt CD | Quarta = Mom Test 25 + observe 25            | História do passado + primeira sessão sem pitch                                                                                                                                                   |
| 2026-07-19 | opt CD | Cadência presencial semanal + remoto ad hoc  | Coordenador geral disponível remotamente quando necessário                                                                                                                                        |
| 2026-07-19 | opt CD | Sala = product + onboarding lead + CG        | CG é participante; interviewers = product + onboarding                                                                                                                                            |
| 2026-07-23 | opt CD | Sessão âncora realizada e processada         | Mom Test 7/7 no Bloco A; evidência em CUSTOMER.md (Interview Evidence + Snapshot); Bloco B perdido no áudio — usabilidade (O2/O3/O4) segue sem evidência                                          |
| 2026-07-23 | opt CD | OST: O1/O5 confirmadas; O6–O8 novas          | Dossiê pré-agenda, registro datado de deltas de voto, ilhas de comunicação — histórias reais (Cairu, Amélia Rodrigues, Santa Inês, Salvador 10×)                                                  |
| 2026-07-23 | opt CD | Âncora de prioridade = % do voto do deputado | Derruba % do eleitorado local como critério da mesa; calibra E8/E10/B13 no roadmap                                                                                                                |
| 2026-07-23 | 2      | Fase 2 destravada (pending)                  | Evidência real disponível; auditoria heurística deve mirar os fluxos do delta-do-dia e da fila de prioridade                                                                                      |
| 2026-07-29 | opt CD | Bloco B / 1º hands-on observado              | Snapshot + transcrição; O2/O3/O7 em uso; O9–O11 novas; pivot: tabelas=bulk, operação=fluxos ação-primeiro (Nubank). Docs: CUSTOMER.md + plans/sessao-observada-coordenador-2026-07-29-snapshot.md |
| 2026-07-29 | 2/prod | “Edit where you see” falhou descoberta       | Células auto-save existem mas não foram achadas no livre; não jogar fora — embutir nos wizards. Mapa = briefing, não mesa. Prazo soft: manejável até 03/08                                        |

## Next Actions

- [x] Confirmar este plano de fases com o product owner (2026-07-19)
- [x] Fase 1 → `docs/CUSTOMER.md` (2026-07-19)
- [x] Fase 2 deferred até evidência de quarta
- [x] continuous-discovery → cadência + OST + roteiro em `CUSTOMER.md` (2026-07-19)
- [x] Rodar sessão âncora (Mom Test) → Interview Evidence + Snapshot preenchidos (2026-07-23; transcrição diarizada em `output/transcribe/general-coordinator-interview-20260723/`)
- [x] Bloco B / uso observado — sessão 2026-07-29 (substitui áudio perdido); snapshot em `docs/plans/sessao-observada-coordenador-2026-07-29-snapshot.md`; transcrição em `output/transcribe/general-coordinator-observed-use-20260729/`
- [ ] Cobrar o compromisso: planilha/tabela de prioridades prometida pelo coordenador geral ("Eu te passo em uma tabela")
- [ ] Little Hire: **não** medir no build atual — medir ≥1 update espontâneo nos 7 dias **após** o primeiro fluxo ação-primeiro em produção (meta soft: antes/na onda 03/08)
- [ ] Abrir item de roadmap + plano: **fluxos ação-primeiro** (O9–O11) — Início com ações; wizard contínuo “Ajustar votos” / “Ajustar liderança” / …; listas permanecem para bulk; mapa desce a briefing · **rascunho:** `docs/plans/fluxos-acao-primeiro-inicio.md` (UX-1 no roadmap)
- [ ] Bugs P0 sessão: comparação de candidatos no mapa; **filtro/busca município na lista (U11)**; **editar título de demanda (U10)**; overview do município sem edição in-place (U9)
- [ ] Rodar Fase 2 (ux-heuristics) sobre: above-the-fold (U1/O10), commit invisível (U4/O11), navegação fragmentada (U3/U5), jargão (O3), editar-onde-vê na ficha (U9)
- [ ] Cruzar findings com `docs/roadmap.md`: entrevista 23/07 reforça C12/E9/A10/E8; sessão 29/07 **reordena prioridade de IA** acima de mais inteligência (E15 etc.) até o chassis ação-primeiro existir
- [ ] Não shipar polish visual (Fase 4) sem finding de Fases 1–3 — e **não** empilhar mais células editáveis sem porta de entrada ação-primeiro
