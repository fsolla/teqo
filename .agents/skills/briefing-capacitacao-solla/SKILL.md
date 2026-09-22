---
name: briefing-capacitacao-solla
description: 'Gera o Briefing de capacitação Solla 1313 por recorte (cidade · instituição · tema): PDF A4 de até 4 páginas + companion .md, derivado do dossiê já pesquisado (sem segunda pesquisa factual), com essencial com fonte, roteiro do pedido de voto (vote 1313 + plano de voto + compromisso nomeado), perguntas prováveis × melhores respostas dos dois lados e o que evitar; aceita um recorte ou um lote separado por vírgula.'
---

# Briefing de capacitação Solla 1313 (C210)

Entrega, por recorte (**cidade · instituição · tema**), um **PDF A4 de até 4
páginas + companion `.md`** para quem vai **pedir o voto 1313** no recorte:
essencial com fato-âncora e fonte, o que Solla defende, **roteiro do pedido**
("vote 1313" + plano de voto + compromisso nomeado), **perguntas prováveis ×
melhores respostas** (ataques da direita **e** da esquerda) e **o que evitar**.
É **insumo interno de capacitação**: rótulo literal
`Insumo interno de capacitação — não publicar` em todas as folhas, sem CTA
público, sem marca publicável, artefato gitignored.

Ele **deriva do dossiê** daquele recorte — nunca faz segunda pesquisa factual:
os fatos vêm do ledger `bulletinFacts` (só item com fonte) e a lacuna é
declarada, não preenchida. É o **3º entregável** da família
`dossie-solla-{cidade,instituicao,tema}` (dossiê + boletim + briefing na mesma
invocação) e também roda sozinho. O layout vem do design hi-fi aprovado
`docs/plans/briefing-capacitacao-solla-ui-design.html` — o port é
classe-a-classe, sem improviso visual.

## Quando usar

- A coordenação pede "o briefing de <recorte>" para quem vai panfletar/pedir
  voto — ou vários numa invocação.
- O fluxo do dossiê (`/dossie-solla-cidade`, `/dossie-solla-instituicao`,
  `/dossie-solla-tema`) entrega o briefing junto do dossiê e do boletim, com a
  mesma skill/build — nunca um segundo pipeline.
- Quem executa são o **orquestrador** (agente principal) + **um sub-agente
  autor por recorte** + o script `build-dossie-solla-briefing.mjs` (local,
  offline). O detalhe está em "Pipeline (etapas)".

## Lote (recortes)

A invocação aceita **um** recorte ou **vários**, separados por **vírgula**, cada
token prefixado pelo recorte:

```text
/briefing-capacitacao-solla cidade:Miguel Calmon                  # N=1
/briefing-capacitacao-solla cidade:Ilheus, instituicao:UFBA, tema:Saude   # lote misto
```

Parsing (orquestrador, **antes** de qualquer redação):

- separa por `,`; aplica `trim`; descarta vazio; o token é
  `<recorte>:<valor>` com recorte em `cidade | instituicao | tema`;
- **cidade** resolve como na skill irmã (`isMunicipalitySlug` /
  `resolveMunicipalityName` → `municipalityCatalogEntriesForCity`; `Salvador` é
  ambíguo = peça o slug da zona `salvador-ze-N`);
- **instituicao** resolve no catálogo (`isInstitutionSlug` /
  `resolveInstitutionName` → `src/lib/institutionCatalog.ts`; ambíguo falha
  fechado);
- **tema** resolve na taxonomia fechada (`resolveSpeechTopic` sobre
  `SPEECH_TOPICS` de `src/lib/speechFacets.ts`; aceita valor `saude` ou label
  `Saúde`);
- **dedupe após a resolução**, preservando a ordem; token inválido/ambíguo ou
  sem prefixo vira **falha isolada** com o motivo no summary final — **nunca**
  aborta o lote nem inventa slug.

Um recorte = um briefing (PDF + MD); **sem** índice/PDF agregado. Falha de um
recorte **não** cancela os demais (**sucesso parcial** explícito).

## Pipeline (etapas)

1. **Orquestrador (agente principal).** Parseia a lista (seção "Lote") e resolve
   os recortes nos catálogos das skills irmãs — sem pesquisa web aqui. Nunca
   retém o corpo de um `research.json`: só os recibos.
2. **Autor (sub-agente, 1 por recorte).**
   `.opencode/agent/briefing-capacitacao-solla.md` — lê os
   `data/dossie-solla-<recorte>/<slug>.{a,b,c}.research.json` e (quando houver)
   o `<slug>.narrative.json`, redige o `<slug>.briefing.json` no contrato abaixo
   **somente** a partir dos itens com fonte, e devolve só o recibo (seção
   "Recibo do autor"). Não faz pesquisa nova, não edita research, não roda
   build/ssh, não commita.
3. **Auditoria de citações (orquestrador).** Confere citação por citação (nome,
   data, valor, órgão, alcance) contra os `research.json`; todo item ancorado
   aponta um `factId` real e todo texto sem lastro é corrigido ou removido.
   Fato novo não entra: vira `gapReason`.
4. **Build local (por recorte), offline:**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-briefing.mjs \
     --unit=municipality \
     --snapshot=data/dossie-solla-cidade/<slug>.snapshot.json \
     --research-dir=data/dossie-solla-cidade \
     --out-dir=docs/research/dossie-solla-cidade
   ```
   `--unit=institution|theme` para os outros recortes (default `municipality`).
   O build valida o `briefing.json` **fechado** (âncora que não resolve em fato
   com fonte = erro; chave de cenário/staff-only = erro), renderiza as **4 folhas
   fixas**, mede cada folha e emite **1 PDF** com a guarda de teto de páginas
   (`emitHtmlSinglePdf`, `maxPages=4`). Saídas:
   `docs/research/dossie-solla-<recorte>/<slug>-<YYYY-MM-DD>-briefing.pdf` +
   `-briefing.md`; intermediários gitignored em `data/dossie-solla-<recorte>/`.
5. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · briefing (quando ok) · motivo (quando falha)`.

O teto de **4 páginas é rígido**: se uma folha estourar, o build **corta por
prioridade declarada** (`qa` até o mínimo de 4 com os dois lados → `defesas` →
`conferir` → `evitar` até o mínimo de 3) e **declara o resto na folha** ("e mais
N no briefing completo (.md)"); o companion `.md` carrega **tudo**. Essencial,
roteiro e identificação **nunca** são cortados; se nem o mínimo couber, o build
falha fechado apontando a lista a encurtar.

## Contrato do `<slug>.briefing.json`

Escrito pelo autor, validado pelo build (`scripts/lib/briefingContent.mjs`):

```jsonc
{
  "unitId": "municipality",                     // municipality | institution | theme
  "municipalitySlug": "miguel-calmon",          // chave = slugField da unidade (institutionSlug | themeSlug)
  "generatedAt": "2026-09-22T12:00:00.000Z",    // obrigatório
  "subtitle": "Piemonte da Diamantina · consulta antes e durante o contato", // opcional
  "lede": "≤380 chars — como usar o essencial",
  "essential": [                               // ≥3; cada item: factId XOR gapReason
    { "factId": "era_b_equipamentos", "title": "≤120", "note": "≤200" },
    { "gapReason": "sem fala própria localizada", "title": "…", "note": "…" }
  ],
  "defenses": [ { "factId": "…", "title": "…", "note": "…" } ], // opcional (C209); [] = linha de lacuna
  "script": { "steps": [ { "title": "≤90", "note": "≤220" } ] }, // ≥3 passos; o pedido é literal do renderer
  "qa": [                                       // ≥4, com ≥1 "direita" e ≥1 "esquerda"
    { "side": "direita|esquerda|entrega", "question": "≤180",
      "acknowledge": "≤200", "answer": "≤520", "close": "≤200",
      "factId": "era_b_sesab" /* XOR */ "gapReason": "sem registro localizado" }
  ],
  "avoid": [ { "title": "≤120", "note": "≤200" } ],             // ≥3
  "checklist": { "beforeAnswer": ["≤200"], "unsure": ["≤200"] } // ≥2 em cada; **negrito** no prefixo
}
```

Regras duras:

- `unitId` e o slug têm de casar com o recorte do build (outro recorte = erro);
- cada item de `essential`/`defenses`/`qa` exige **exatamente um** de
  `factId | gapReason`; `factId` tem de resolver num fato do ledger **com
  `sourceUrl`** — **sem fonte, o item não entra**;
- `qa` cobre os dois lados (≥1 `direita` e ≥1 `esquerda`); `entrega` é opcional;
- **proibido** qualquer chave de cenário/estimativa/staff-only
  (`estimatedVotes`, `scenario`, `projection`, `polls`, …) — o briefing não tem
  campo numérico; valor/fase vêm do fato-âncora no render;
- caps de texto acima do limite são **aviso** (o autor encurta); quem falha
  fechado é a guarda de fit/páginas;
- no `checklist`, o autor marca em `**negrito**` o prefixo que a folha imprime
  como palavra-chave de varredura (`"**Fonte e data** do fato…"`) — é o único
  marcador inline aceito.

O pedido é **literal do renderer** (não reescreva no JSON): "Posso contar com
você? Para deputado federal, **vote 1313, Jorge Solla**." — com plano de voto
(onde/quando/como) e compromisso nomeado nos passos do roteiro.

## Recibo do autor

Só este recibo curto (≤ ~15 linhas) volta ao orquestrador — nunca o corpo do
JSON:

```jsonc
{
  "recorte": "cidade",
  "slug": "miguel-calmon",
  "status": "ok",              // ou "failed"
  "briefingPath": "data/dossie-solla-cidade/miguel-calmon.briefing.json",
  "essentialCount": 4,
  "qaCount": 5,
  "sides": ["direita", "esquerda"],
  "anchoredFactIds": ["era_b_equipamentos", "era_b_programas", "era_c_atuacao"],
  "gapCount": 3,               // itens com gapReason + lacunas do recorte
  "failureReason": "…"         // opcional (só quando status = failed)
}
```

`status: "failed"` não escreve arquivo parcial; o orquestrador agrega o motivo
no summary final. Arquivo ausente = o build falha com o ponteiro para esta
skill (não há fallback determinístico: o briefing é redação, não consolidação).

## Conteúdo do briefing (4 folhas fixas)

- **Folha 1 — O essencial do recorte** (`data-page="essencial"`): identificação
  do recorte + lede ("como usar") + fatos-âncora com fonte ou lacuna declarada +
  regra do recorte (esfera/fase) no rodapé.
- **Folha 2 — Defesas e pedido** (`data-page="defesas"`): "o que Solla defende"
  (C209 quando existir; sem registro = linha de lacuna, nunca proposta genérica)
  + roteiro do pedido com o literal do voto 1313 + 3–5 passos (relação → fato →
  pedido explícito → plano de voto → compromisso nomeado).
- **Folha 3 — Perguntas prováveis × melhores respostas** (`data-page="qa"`):
  régua visível (reconhecer → fato local verificável → fechar no pedido) + Q&A
  dos dois lados; resposta ancorada num fato-âncora ou declarada como lacuna ("o
  dossiê não sustenta; vou conferir").
- **Folha 4 — O que evitar + conferência + limites** (`data-page="evitar"`):
  anti-padrões (confronto, humilhação, repetir o ataque, broadcast impessoal,
  prometer sem lastro), "o que conferir no dossiê", "se você não souber" e os
  limites/defeso (inclusive: evidência internacional orienta o método, não mede
  o Brasil).

## Guardrails de produto (não negociáveis)

- **Rótulo literal** `Insumo interno de capacitação — não publicar` em **todas**
  as folhas; sem CTA público, sem marca de campanha, sem peça publicável.
- **Teto rígido de 4 páginas A4**: corte por prioridade declarada, resto sempre
  contado na folha e completo no `.md`; nenhuma folha é cortada em silêncio
  (`.sheet{overflow:hidden}` esconde o corte — as guardas de contagem e de
  altura falham fechado).
- **Sem segunda pesquisa factual**: só fatos do dossiê; âncora obrigatória com
  fonte; lacuna explícita em vez de inferência.
- **Sem cenário eleitoral/estimativa/staff-only** (nada de `estimatedVotes`,
  projeção, pesquisa); o briefing não promete efeito.
- **Empenho ≠ pagamento**; esfera explícita nunca somada; leitura relativa
  (nunca % estadual absoluto); PII mínima (telefone/e-mail nunca entram).
- **Voz com dono único**: reusa `.opencode/skills/solla-comunicacao/SKILL.md` +
  `referencia/tom-e-exemplos.md` (rebates e fórmula de resposta a crítica) — não
  gema tom.
- **Falha isolada** por recorte não cancela o lote (**sucesso parcial**).
- **Artefato gitignored** (repo público): PDF/MD/JSON nunca são commitados.
- **Sem schema/migration/DB write/rota** — o build é offline (JSON + Chromium).

## Troubleshooting

- **`briefing.json` ausente**: rode a etapa do autor (sub-agente) e repita; o
  build não inventa redação.
- **`factId` não resolve em fato com fonte**: o item não existe no dossiê ou
  está sem fonte — troque por um `factId` real ou declare `gapReason`; nunca
  "aproxime" o texto.
- **Folha estourou**: o build corta por prioridade e declara o resto; se a
  mensagem disser que nem o mínimo cabe, **encurte as listas** (QA/essencial),
  não o layout.
- **`unitId`/slug de outro recorte**: o build recusa o par — pare e regenere o
  `briefing.json` para o recorte certo.
- **Sem C209 (defesas)**: `defenses: []` é válido e imprime a linha de lacuna;
  não complete por memória.
- **Cenário/staff-only no JSON**: o build falha com a chave no erro — remova-a;
  cenário eleitoral é de outro fluxo (C163), não do briefing.
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.

## Referências

- Intenção: `docs/plans/briefing-capacitacao-solla.md`; impl:
  `docs/plans/briefing-capacitacao-solla-impl.md`.
- Design hi-fi (fonte de verdade do port):
  `docs/plans/briefing-capacitacao-solla-ui-design.html`.
- Scripts: `scripts/build-dossie-solla-briefing.mjs`,
  `scripts/lib/briefingContent.mjs` (contrato/shed),
  `scripts/lib/briefingRender.mjs` (4 folhas + `.md`),
  `scripts/lib/buildPdf.mjs` (`emitHtmlSinglePdf`/guarda de páginas),
  `scripts/lib/dossieBlocks.mjs` (`bulletinFacts`), `scripts/lib/dossieUnit.mjs`.
- Skills irmãs (dossiê + boletim): `.agents/skills/dossie-solla-cidade/SKILL.md`,
  `.agents/skills/dossie-solla-instituicao/SKILL.md`,
  `.agents/skills/dossie-solla-tema/SKILL.md`.
- Voz/rebates: `.opencode/skills/solla-comunicacao/SKILL.md`,
  `.opencode/skills/solla-comunicacao/referencia/tom-e-exemplos.md`.
- Evidência de mobilização citada no treinamento: Nickerson & Rogers 2010;
  Gerber & Green 2000; Kalla & Broockman 2018/2020; Schein et al. 2021;
  Michelson et al. 2024; Nickerson 2008; Gerber & Rogers 2009; Gerber, Green &
  Larimer 2008; Cialdini & Goldstein 2004; Broockman & Kalla 2016; Grimmer,
  Messing & Westwood 2012; Wood & Porter 2019; Lau, Sigelman & Rovner 2007;
  Ecker et al. 2022; Debunking Handbook 2020.
