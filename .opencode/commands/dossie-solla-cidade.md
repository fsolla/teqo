---
description: Gera o dossiê Solla por cidade (PDF A4 + .md), o Boletim Informativo modelo de 1 página e o Briefing de capacitação (até 4 páginas) para um município ou um lote separado por vírgula
---

Carregue a skill `dossie-solla-cidade` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: o orquestrador parseia a lista (`$ARGUMENTS`, separada por vírgula), resolve os slugs canônicos, dispara um researcher por era (A/B/C) por cidade, dispara o redator (redação de abertura + parágrafos por era, auditados contra os itens), roda a extração read-only, busca as fontes oficiais e o build local (dossiê + boletim, folhas correntes sem caps), entrega o briefing de capacitação do recorte (mesma skill/build de briefing; até 4 páginas, insumo interno) e fecha o summary. A fonte canônica é `.agents/skills/dossie-solla-cidade/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/dossie-solla-cidade <Cidade> [<Cidade>, ...]` — ex.: `/dossie-solla-cidade Ilhéus, Itacaré, Una`. Uma cidade = dossiê (`<slug>-<YYYY-MM-DD>-dossie.pdf`/`.md`) + boletim (`-boletim.pdf`) + briefing (`-briefing.pdf`/`-briefing.md`).

$ARGUMENTS
