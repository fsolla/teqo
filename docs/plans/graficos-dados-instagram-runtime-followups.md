# Runtime follow-ups C191 — cobertura do entry/PNG e parse ambíguo

Status: rascunho
Atualizado em: 2026-09-18
Issue: a registrar (`C191-runtime`, `depends: [1145]`)
Pai: #1145 / `docs/plans/graficos-dados-instagram-impl.md`
Appetite: ~0,5 dia eng (fill-in)
Impeccable: A (só backend/ferramenta; sem superfície de UI)

## Outcome

Fechar a cobertura de runtime da skill `graficos-dados` e tornar explícito o
único parsing hoje silencioso, sem mudar o comportamento entregue no C191.

## Fases (ordenadas por ROI)

1. **Parse ambíguo pt-BR (score 3).** `parseNumber('1.234')` hoje decide
   milhar × decimal em silêncio. Documentar e cobrir com unit a regra do
   separador único; se a decisão for por perguntar, expor no `issues` do
   `parseInput` (fail-closed), nunca adivinhar.
2. **Teste do entry (score 3).** Cobrir `scripts/build-chart-from-data.mjs`:
   `--inspect`, montagem do spec, `--spec` replay, `needsQuestion`, `--source`
   obrigatório e a linha de log por tamanho. Sem Chromium (injetar o emit ou
   mockar o browser).
3. **Smoke real do PNG (score 3).** Exercitar `screenshotHtmlPng` com Chromium
   real por tamanho (feed/quadrado/story), verificando dimensões exatas e o
   guard de 8 MB — hoje só há guard com browser fake.

## Já resolvido no simplify/critique (não reabrir)

- Perda silenciosa de linha com valor faltando (header heurístico) — corrigido
  e pinado (`chartData.unit.spec.ts`).
- `--size` inválido e `--highlight` inexistente agora falham fechado.
- `escapeHtml` gêmeo removido (usa `reportText.htmlEscape`).
- Padding de stories derivado de `SIZES.story.safe*`; cap de 5 pontos em stories.
- `proportionalPercent` com zero honesto (0 → 0%); typo de copy.

## Explicitamente fora (descartes e defers deste triage)

- `SIZES.*.label` sem consumidor no código — dobra no item de fronteira abaixo
  se `SIZES` for movido; não vira Issue.
- `SOLLA_PALETTE.ptRed` sem consumidor — contrato verbatim da intenção,
  intencional.
- Contexto extra em logs do entry — ENOENT/`--spec` inválido já embrulhados;
  valor marginal.
- **Adiado com gatilho:** mover `SIZES`/`RELATION_LABEL` para um módulo-folha
  sem `xlsx`/`csv-parse` (fronteira do renderer). Gatilho: um consumidor de
  `SIZES`/`RELATION_LABEL` sem parsers (renderer em bundle/browser).
- **Adiado com gatilho:** decompor `main()` do entry em `buildSpec`/`emitPng`.
  Gatilho: o entry ganhar modo lote/2ª saída ou passar de ~200 linhas.
