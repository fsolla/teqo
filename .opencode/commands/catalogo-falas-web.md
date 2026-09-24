---
description: Atualiza o catálogo de falas do acervo a partir da web — descobre o que apareceu desde a última execução, cura falsos positivos e entrega o lote à ingestão (C215), com recibo
---

Carregue a skill `catalogo-falas-web` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: leia o estado da última execução (`data/falas-web/last-run.json`; sem ele, varredura inicial completa), dispare o sub-agente de descoberta com a janela, cure os achados (falso positivo vira "revisar" e não ingere), monte o lote no contrato do C215 e rode `pnpm falas-web:import --findings`, leia o relatório e imprima o recibo (período, achados, novos, ignorados, falhas, custo/tempo), gravando o estado por último. A fonte canônica é `.agents/skills/catalogo-falas-web/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/catalogo-falas-web` (incremental) · `/catalogo-falas-web --limit <n>` (rodada limitada) · `/catalogo-falas-web revisar` · `/catalogo-falas-web aprovar <índice|sourceKey|url|todos>` · `/catalogo-falas-web descartar <índice|sourceKey|url|todos>`.

$ARGUMENTS
