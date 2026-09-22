---
description: Gera o Briefing de capacitação Solla 1313 por recorte (cidade · instituição · tema) — até 4 páginas para quem vai pedir voto — para um recorte ou um lote separado por vírgula
---

Carregue a skill `briefing-capacitacao-solla` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: o orquestrador parseia os recortes (`$ARGUMENTS`, prefixados `cidade:`/`instituicao:`/`tema:` e separados por vírgula), resolve os slugs nos catálogos das skills irmãs, dispara um sub-agente autor por recorte (escreve o `briefing.json` só a partir dos itens com fonte), audita as citações, roda o build local offline (4 folhas fixas com âncora de página, teto rígido, resto declarado no PDF e completo no `.md`) e fecha o summary. A fonte canônica é `.agents/skills/briefing-capacitacao-solla/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/briefing-capacitacao-solla cidade:<Município>[, instituicao:<Instituição>, tema:<Área>]` — ex.: `/briefing-capacitacao-solla cidade:Ilheus, instituicao:UFBA`. Um recorte = briefing (`<slug>-<YYYY-MM-DD>-briefing.pdf` + `-briefing.md`), insumo interno de capacitação.

$ARGUMENTS
