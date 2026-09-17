---
description: Gera o dossiê Solla por cidade (PDF A4 + .md) e o Boletim Informativo modelo de 1 página para um município ou um lote separado por vírgula
---

Carregue a skill `dossie-solla-cidade` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: o orquestrador parseia a lista (`$ARGUMENTS`, separada por vírgula), resolve os slugs canônicos, dispara um researcher por era (A/B/C) por cidade, roda a extração read-only, busca as fontes oficiais e o build local (dossiê + boletim) e fecha o summary. A fonte canônica é `.agents/skills/dossie-solla-cidade/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/dossie-solla-cidade <Cidade> [<Cidade>, ...]` — ex.: `/dossie-solla-cidade Ilhéus, Itacaré, Una`. Uma cidade = dossiê (`<slug>-<YYYY-MM-DD>-dossie.pdf`/`.md`) + boletim (`-boletim.pdf`).

$ARGUMENTS
