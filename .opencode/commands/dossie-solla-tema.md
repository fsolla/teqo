---
description: Gera o dossiê Solla por tema/área (PDF A4 + .md), o Boletim Informativo modelo de 1 página e o Briefing de capacitação (até 4 páginas) para uma área ou um lote separado por vírgula
---

Carregue a skill `dossie-solla-tema` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: o orquestrador parseia a lista (`$ARGUMENTS`, separada por vírgula), resolve os tokens na taxonomia canônica do acervo (`SPEECH_TOPICS`/`resolveSpeechTopic`), dispara um researcher por era (A/B/C) por área, dispara o redator (redação de abertura + parágrafos por era, auditados contra os itens), roda a extração read-only do acervo (por `Speech.topics`) e o build local (dossiê + boletim, folhas correntes sem caps), entrega o briefing de capacitação do recorte (mesma skill/build de briefing; até 4 páginas, insumo interno) e fecha o summary. A fonte canônica é `.agents/skills/dossie-solla-tema/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/dossie-solla-tema <Área> [<Área>, ...]` — ex.: `/dossie-solla-tema Educação, Saúde`. Uma área = dossiê (`<slug>-<YYYY-MM-DD>-dossie.pdf`/`.md`) + boletim (`-boletim.pdf`) + briefing (`-briefing.pdf`/`-briefing.md`). Token fora da taxonomia dos 18 temas falha fechado, listando as áreas canônicas; nunca invente slug.

$ARGUMENTS
