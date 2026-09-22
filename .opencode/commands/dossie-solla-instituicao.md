---
description: Gera o dossiê Solla por instituição (PDF A4 + .md), o Boletim Informativo modelo de 1 página e o Briefing de capacitação (até 4 páginas) para uma instituição ou um lote separado por vírgula
---

Carregue a skill `dossie-solla-instituicao` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: o orquestrador parseia a lista (`$ARGUMENTS`, separada por vírgula), resolve os slugs canônicos no catálogo de instituições, dispara um researcher por era (A/B/C) por instituição, dispara o redator (redação de abertura + parágrafos por era, auditados contra os itens), roda a extração read-only do acervo (por tema→instituição) e o build local (dossiê + boletim, folhas correntes sem caps), entrega o briefing de capacitação do recorte (mesma skill/build de briefing; até 4 páginas, insumo interno) e fecha o summary. A fonte canônica é `.agents/skills/dossie-solla-instituicao/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/dossie-solla-instituicao <Instituição> [<Instituição>, ...]` — ex.: `/dossie-solla-instituicao UFBA, Correios`. Uma instituição = dossiê (`<slug>-<YYYY-MM-DD>-dossie.pdf`/`.md`) + boletim (`-boletim.pdf`) + briefing (`-briefing.pdf`/`-briefing.md`). Token fora do catálogo falha fechado; use o escape one-off `--slug=<x> --name="<Nome>"`.

$ARGUMENTS
