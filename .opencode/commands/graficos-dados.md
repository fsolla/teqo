---
description: Gera um gráfico PNG pronto para o Instagram (1080×1350 feed, 1080×1080 quadrado ou 1080×1920 stories) a partir de dados em xlsx/csv/md/txt/texto colado, na marca e na paleta oficiais do kit 1313, com título-manchete e um único destaque de cor
---

Carregue a skill `graficos-dados` (ferramenta de skills, nome exato) e siga o fluxo dela de ponta a ponta: leia os `$ARGUMENTS` (arquivo apontado ou números colados no comando), inspecione a matriz com `--inspect`, classifique a relação dos dados (comparação, tempo, número único), proponha o tipo e a manchete/fonte, gere o PNG no tamanho pedido com o builder local (`node scripts/build-chart-from-data.mjs`) e confira com a pessoa. A fonte canônica é `.agents/skills/graficos-dados/SKILL.md` — não a transcreva nem recrie o fluxo.

Uso: `/graficos-dados <arquivo-ou-dados>` — ex.: `/graficos-dados data/graficos-instagram/votos.csv` ou `/graficos-dados Ilhéus 84, Itabuna 68, Porto Seguro 53`. Dado ambíguo/faltando → pergunte; nunca invente.

$ARGUMENTS
