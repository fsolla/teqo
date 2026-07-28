# docs/research — embasamento de produto (campanha DF-BA)

Artefatos do ciclo de discovery "literatura → persona → entrevista → docs de produto" (2026-07-21). Servem de embasamento teórico para decisões de produto do `/campanha` — em especial métricas territoriais, o Mapa das Praças e o programa de inteligência.

| Artefato                                                                                   | O quê                                                                                                                    | Status                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| [`literatura-campanha-deputado-federal-ba.md`](literatura-campanha-deputado-federal-ba.md) | Compêndio da literatura (5 eixos + cartografia/métricas + agregações + alienação eleitoral), ~67 fontes e implicações    | aprovado 2026-07-21                |
| [`persona-cientista-politico-campanha-ba.md`](persona-cientista-politico-campanha-ba.md)   | Persona especialista sintética (Prof. Helena Rocha) grounded no compêndio                                                | aprovado 2026-07-21                |
| [`roteiro-entrevista-persona-campanha.md`](roteiro-entrevista-persona-campanha.md)         | Roteiro Mom Test/JTBD/Lean Analytics para a entrevista sintética                                                         | aprovado 2026-07-21                |
| [`relatorio-entrevista-persona-campanha.md`](relatorio-entrevista-persona-campanha.md)     | Relatório da entrevista (6 rodadas): kernel, rankings, playbook dado→decisão (25 padrões), OST, anti-goals + transcrição | **aprovado 2026-07-21 — canônico** |
| [`sources/README.md`](sources/README.md)                                                   | Fila pause-and-fetch de obras sem acesso aberto (depósito legal de PDFs/EPUBs, gitignored)                               | ativa                              |

**Consumo pelo produto:** o relatório alimentou o programa **Inteligência de campanha** (E8–E15, B13, C12) — plano-mestre em [`docs/plans/inteligencia-campanha.md`](../plans/inteligencia-campanha.md), itens no [roadmap](../roadmap.md).

**Limitação metodológica:** a entrevista é sintética (persona construída a partir da literatura). Achados são **hipóteses de literatura/persona**, não fato de campo. A validação empírica é a sessão com o coordenador real (ver `docs/CUSTOMER.md`).

## Ciclo 2 — Discovery de finanças de campanha (2026-07-28)

Mesmo método (literatura → personas → entrevistas sintéticas → relatório → validação real), aplicado à **gestão financeira** de uma campanha de DF na Bahia, sob três ângulos (financeiro-operacional, jurídico, político). Notebook do projeto: `.cursor/rules/projects/financas-campanha.mdc`.

| Artefato                                                                                         | O quê                                                                                                                                                 | Status                              |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| [`literatura-financas-campanha-df-ba.md`](literatura-financas-campanha-df-ba.md)                 | Compêndio dos 3 eixos (regras 2026: Res. 23.752/2026, Conta+JE, FEFC/cotas; operação do dinheiro; economia política), 48 fontes                       | rascunho 2026-07-28                 |
| [`persona-financas-contadora-eleitoral.md`](persona-financas-contadora-eleitoral.md)             | Persona sintética "Márcia Anunciação" — contadora eleitoral (ângulo financeiro-operacional)                                                           | rascunho 2026-07-28                 |
| [`persona-financas-advogado-eleitoral.md`](persona-financas-advogado-eleitoral.md)               | Persona sintética "Dr. Rafael Guimarães" — advogado eleitoralista (ângulo jurídico)                                                                   | rascunho 2026-07-28                 |
| [`persona-financas-tesoureiro-politico.md`](persona-financas-tesoureiro-politico.md)             | Persona sintética "Tonho Bastos" — tesoureiro político de campanha (ângulo político)                                                                  | rascunho 2026-07-28                 |
| [`roteiro-entrevista-financas-personas.md`](roteiro-entrevista-financas-personas.md)             | Roteiro Mom Test adaptado (blocos A–F + sondas por persona), aplicado às 3 personas em subagents isolados                                             | rascunho 2026-07-28                 |
| [`relatorio-entrevistas-financas-personas.md`](relatorio-entrevistas-financas-personas.md)       | Relatório consolidado: kernel (2 gargalos em série), 12 dores ranqueadas, spec do "registro seguro", OST draft, anti-goals, 12 apostas + transcrições | rascunho 2026-07-28 — **a validar** |
| [`roteiro-entrevista-gestora-financeira-real.md`](roteiro-entrevista-gestora-financeira-real.md) | Roteiro Mom Test da sessão real com a gestora financeira da campanha (confirmar/derrubar as apostas; artefato-first)                                  | **agendada — 2026-07-29**           |

**Limitação metodológica (ciclo 2):** as três personas bebem do MESMO compêndio — convergência entre elas não é evidência independente. Nada entra no roadmap antes da entrevista real com a gestora e da revisão do advogado da campanha (o compêndio não é parecer jurídico).

**Decisão 2026-07-28 (origem do discovery: pedido do candidato):** não complicar o Teqo sem uma dificuldade real validada — módulo financeiro completo descartado para o ciclo 2026; a avaliação pré-validação (P0–P2 + condições de morte/vida da trilha) está no notebook do projeto e será confrontada com a entrevista real de 2026-07-29.
