---
description: Gera o relatório de cidade pré-viagem (PDF A4 + .md) para um município ou um lote separado por vírgula
---

Carregue a skill `relatorio-cidade` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: o orquestrador parseia a lista (`$ARGUMENTS`, separada por vírgula), resolve os slugs canônicos, dispara um researcher por cidade, roda a extração read-only e o build por cidade e fecha o summary. A fonte canônica é `.agents/skills/relatorio-cidade/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: /relatorio-cidade <Cidade> [<Cidade>, ...] — ex.: `/relatorio-cidade Ilhéus, Itacaré, Una`. Uma cidade = um par PDF+MD (`<slug>-<YYYY-MM-DD>`).

$ARGUMENTS
