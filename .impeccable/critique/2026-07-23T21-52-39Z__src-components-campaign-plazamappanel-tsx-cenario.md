---
target: /campanha/pracas Cenário selector + disclaimer
total_score: 18
p0_count: 0
p1_count: 2
p2_count: 2
p3_count: 1
timestamp: 2026-07-23T21-52-39Z
slug: src-components-campaign-plazamappanel-tsx-cenario
---

Method: dual-agent (A: c3613972-8d1f-41bb-b210-501b0ddc14c9 · B: 8ae72814-5de3-4010-9ebb-7c9d64d8ccec)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                           |
| --------- | ------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 1         | Ano default 2022: mudar Cenário não pinta o mapa; efeito no overview abaixo do fold |
| 2         | Match System / Real World       | 1         | “overview” / “preenchimento” ≠ linguagem de campo; toolbar diz “filtro do mapa”     |
| 3         | User Control and Freedom        | 3         | Três opções reversíveis; baixo risco                                                |
| 4         | Consistency and Standards       | 2         | Mesmo NativeSelect que Ano/Escala, mas escopo de página (não só mapa)               |
| 5         | Error Prevention                | 1         | Posição convida o modelo errado; disclaimer é pós-fato                              |
| 6         | Recognition Rather Than Recall  | 2         | Labels P/M/O ok; regra “só 2026” exige ler o rodapé                                 |
| 7         | Flexibility and Efficiency      | 2         | Sync global é eficiente se entendido; sem atalho Ano→2026                           |
| 8         | Aesthetic and Minimalist Design | 2         | Quarto controle + disclaimer xs no estado comum (Ano≠2026)                          |
| 9         | Error Recovery                  | 2         | Mapa “não fez nada” sem live region no overview                                     |
| 10        | Help and Documentation          | 2         | Hint existe; copy de engenheiro; sempre ligada no first paint                       |
| **Total** |                                 | **18/40** | **Poor — labels A10 ok; assento + disclaimer quebram o controle**                   |

## Anti-Patterns Verdict

**LLM assessment:** Não é slop SaaS. Padrão Field Desk (label + NativeSelect + min-h-11). Falha = **apology UI**: controle de escopo de página sentado na toolbar do mapa, coberto por nota de rodapé. “overview” / “preenchimento” soam PR comment, não Field Desk.

**Deterministic scan:** CLI `detect.mjs` em `PlazaMapPanel.tsx` + `PlazaEstimateScenarioContext.tsx` → **exit 0, `[]`**.

**Visual overlays:** Autenticado em `/campanha/pracas`. Overlay runtime 12 hits (maioria FP de shell/Leaflet/Inter). Disclaimer medido: 70 chars, wrap estreito ~176×84. Screenshot: `.impeccable/assessment-b-campanha-pracas.png`. Cenário + disclaimer visíveis com Ano≠2026.

## Overall Impression

A10 labels e sync via context estão certos. O bug de UX é estrutural: **Cenário mora na fila Ano/Escala/Comparar**, então promete pintar o mapa; no first paint (Ano=2022) só move overview/lista — e o disclaimer admite isso em jargão. Corrigir assento > alongar copy.

## What's Working

1. **Pessimista / Média / Otimista** — vocabulário A10 certo; default Média.
2. **Um cenário sincronizado** (context) — melhor que três toggles órfãos.
3. **Disclaimer admite o acoplamento** — honestidade > mentira silenciosa; o lugar da honestidade é o problema.

## Priority Issues

### [P1] Assento na toolbar do mapa implica choropleth quando Ano≠2026

- **Why:** First paint comum: muda Cenário → mapa igual → sensação de broken.
- **Fix:** Relocar ao overview; **ou** desabilitar/ghost + explicar; **ou** Cenário força Ano→2026; **ou** esconder no mapa quando ≠2026 _e_ hospedar o controle onde o efeito é visível.
- **Suggested command:** `/impeccable layout` (ou `/impeccable shape`)

### [P1] Disclaimer em português de engenheiro

- **Why:** “overview” não está na UI; “preenchimento” é jargão de mapa.
- **Fix:** Uma linha de resultado (“Muda os totais acima da lista. No mapa, só com Ano 2026.”) — ou matar a linha relocando o controle.
- **Suggested command:** `/impeccable clarify` / `/impeccable distill`

### [P2] Feel the action: efeito fora do viewport

- **Why:** Mapa acima; overview/lista abaixo. Em mobile parece no-op.
- **Fix:** Highlight/pending no overview; ou co-localizar o controle.
- **Suggested command:** `/impeccable animate` + layout

### [P2] Always-show na fila do mapa vs hide

- **Why:** Sync global é racional; _nesta_ fila treina o affordance errado.
- **Fix:** Não esconder sem relocação; se global, não vestir como filtro do mapa.
- **Suggested command:** `/impeccable shape`

### [P3] Densidade Ano / Escala / Cenário / Comparar

- **Why:** Quarto peer + disclaimer wrap em narrow (Casey).
- **Suggested command:** `/impeccable quieter`

## Persona Red Flags

**Alex:** Quer pessimista no footprint; mapa não muda → desconfiança.
**Jordan:** “overview” / “preenchimento” opacos.
**Casey:** Disclaimer engole vertical; efeito abaixo do mapa.
**Sam:** Disclaimer sem `aria-describedby`; sem live region nos totais.

## Minor Observations

- Hide em compare alinhado a Escala — ok.
- Readout 2026 já inclui cenário — forte quando Ano certo.
- Ordem Map → filtros → overview inverte o controle global no mapa.
- Polish anterior priorizou discoverability do sync às custas da honestidade do mapa.

## Questions to Consider

- Se o job é overview+lista, por que o controle vive na fila que pinta o mapa?
- Alex prefere perder o disclaimer ou perder Cenário da toolbar?
- Auto Ano→2026 é Feel the action ou sequestro da leitura histórica?
- Se o disclaimer é o estado comum do first paint, a IA default não está errada?
