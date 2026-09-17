# Escala/DRY: débitos do C188 (relatórios/dossiês sem truncamento)

Status: rascunho
Atualizado em: 2026-09-17
Issue: #1139 (C189)
Priority: P3
Kind: chore
Depends: #1136 (C188)
Appetite: ~0,5–1 dia eng
Impeccable: A — scripts-only, sem superfície de UI

## O débito (colhido no /simplify do C188)

Três resíduos de baixo risco no dono de texto/orçamento que o C188 acabou de
consolidar. Nenhum é bug funcional (a guarda fail-closed continua abortando);
são paridade e honestidade de mensagem.

1. **2-pass do dossiê mede toda página (O1).** `build-dossie-solla-cidade.mjs`
   mede `[data-page]` inteiro; a passada de ponteiro só reescreve o resumo. Uma
   página não-resumo estourada dispara um rebuild de ponteiro inútil e depois
   morre com log que diz "re-renderizando com ponteiro" — mentira de fluxo. O
   C163 mede só `[data-page="summary"]`. Paridade: chavear o gatilho do dossiê em
   `[data-page="resumo"]` e reportar a página ofensora direto no `die`.
2. **Ponteiros de escopo/região pouco honestos (O3 + R1).** O ponteiro municipal
   das duas listas de escopo manda "ver a tabela de evidências abaixo" — que é
   só regional. E o MD do `era.actions` ainda diz "tabela de respostas da era"
   (superfície que não existe no dossiê; o HTML irmão já diz "arquivo de pesquisa
   da era"). Declarar/alinhar os cortes escopo (5) × evidência (4) e usar a
   mesma copy no HTML e no MD.
3. **Paridade de helpers e da skill (O5 + S10b).** `moreItemsLabel`/
   `showingLabel` mantêm defaults de singular/plural que todo call site
   sobrescreve (generalidade especulativa). E a skill `relatorio-cidade` lista os
   itens de página 1 que precisam de `summary` e omite `vereadores`, que
   `buildWhoRows` imprime no resumo.

## Appetite e rabbit holes

- Tocar `build-dossie-solla-cidade.mjs` e `dossieRender.mjs` reusados pelo
  **C187 (#1135)** — coordenar: F1 pousa antes/junto do C187.
- Rabbit hole: transformar o ajuste de medição em refactor dos dois builders
  (NÃO unificar os loops; só alinhar o gatilho e a mensagem). Não abrir apêndice
  de respostas por era (ver Explicitamente fora).
- Sem schema, migration, URL pública, Consent/LGPD.

## Fases (ROI)

1. **F1 (O1)** — 2-pass do dossiê keyed em `[data-page="resumo"]`, com a página
   ofensora na mensagem do `die`.
2. **F2 (O3+R1)** — ponteiro municipal → "ver as páginas das eras"; alinhar
   escopo 5 × evidência 4 (ou declarar o corte duplo); MD `era.actions` →
   "arquivo de pesquisa da era".
3. **F3 (O5+S10b)** — singular/plural obrigatórios em `moreItemsLabel`/
   `showingLabel`; incluir `vereadores` na lista de `summary` da página 1 em
   `.agents/skills/relatorio-cidade/SKILL.md`.

## Já resolvido no simplify do C188 (não reabrir)

- Dono único `summarySurfaceText` (regra summary→answer→ponteiro) substituindo o
  geminado C163/C186; `summaryListText` + tetos de caractere para listas
  não-pesquisa; `region.evidence` + contadores de escopo no HTML e no MD;
  `capList` no `gapCallout`/`emendasIndicators`; comentários OPS120 obsoletos;
  nota do teto de coleta da Câmara no `eraMethod.C`; testes negativos de "…",
  invariante do boletim e caso ponteiro+summary.

## Explicitamente fora (defers do triage do C188)

- **Apêndice "respostas por era" no dossiê (O2).** `era.numbers`/`era.actions`
  continuam capados com contador, e o integral vive no JSON de pesquisa (não no
  PDF). É decisão de produto/design (layout novo, Impeccable C), fora do appetite
  do C188. **Gatilho:** quando um dossiê real perder um número/ação de era que a
  comunicação precise citar, ou quando o C187 institucional exigir o integral.
- **`factsTotal` no boletim (O4).** Mantido: é a âncora do invariante
  `highlights + moreItems + factsRemaining === factsTotal` do spec do boletim.
