---
description: Executa uma Issue já claimada de ponta a ponta com supervisão humana (plano de implementação → pausa → execução → simplify → débitos → PR)
---

Carregue a skill `work-issue` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta. A fonte canônica é `.agents/skills/work-issue/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: /work-issue --issue <N> [--auto]. Com `--auto`, a skill marca o impl plan como aprovado e executa até o PR sem pausa; sem ela, a pausa do GATE vale.

$ARGUMENTS
