---
name: briefing-capacitacao-solla
description: 'Gera o Briefing de capacitação Solla 1313 por recorte (cidade · instituição · tema): PDF A4 de até 4 páginas + companion .md, derivado do dossiê já pesquisado (sem segunda pesquisa factual), todo de recorte — princípios/crenças e defesas de Solla com fonte, fatos-âncora e o pedido literal do voto 1313, e perguntas prováveis × melhores respostas dos dois lados; aceita um recorte ou um lote separado por vírgula.'
---

# Briefing de capacitação Solla 1313 (C210)

Entrega, por recorte (**cidade · instituição · tema**), um **PDF A4 de até 4
páginas + companion `.md`** para quem vai **pedir o voto 1313** no recorte.
Depois do replanejamento (2026-09-23), o briefing é **todo do recorte** — não tem
capa, manual genérico, roteiro de passos, anti-padrões nem limites:

1. **O que Solla defende** — princípios/crenças do recorte (abertura) + posições
   com lastro (fonte e data);
2. **O essencial do recorte** — fatos-âncora com **fase junto ao valor** e o
   **pedido literal** do voto + **uma linha** de plano;
3. **Perguntas prováveis × melhores respostas (1/2 e 2/2)** — as perguntas reais
   do recorte, metade do documento, com os dois lados.

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
   aponta um `factId` real que **lastreia a nota** (o ledger resolve o id pelo
   primeiro item daquele id) e todo texto sem lastro é corrigido ou removido.
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
   fixas do recorte** (`defesas → essencial + pedido → qa 1/2 → qa 2/2`), mede
   cada folha e emite **1 PDF** com a guarda de teto de páginas
   (`emitHtmlSinglePdf`, `maxPages=4`). Saídas:
   `docs/research/dossie-solla-<recorte>/<slug>-<YYYY-MM-DD>-briefing.pdf` +
   `-briefing.md`; intermediários gitignored em `data/dossie-solla-<recorte>/`.
5. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · briefing (quando ok) · motivo (quando falha)`.

O teto de **4 páginas é rígido**: se uma folha estourar, o build **corta por
prioridade** (`qa` até o mínimo de 4 com os dois lados → `defesas` até esvaziar)
e **declara o resto na folha** ("e mais N no briefing completo (.md)"); o
companion `.md` carrega **tudo**. O essencial (fatos-âncora), o **pedido** e a
identificação **nunca** são cortados; se nem o mínimo couber, o build falha
fechado apontando a lista a encurtar.

## Contrato do `<slug>.briefing.json`

Escrito pelo autor, validado pelo build (`scripts/lib/briefingContent.mjs`):

```jsonc
{
  "unitId": "municipality",                     // municipality | institution | theme
  "municipalitySlug": "miguel-calmon",          // chave = slugField da unidade (institutionSlug | themeSlug)
  "generatedAt": "2026-09-23T12:00:00.000Z",    // obrigatório
  "subtitle": "Piemonte da Diamantina · consulta antes e durante o contato", // opcional
  "lede": "≤380 chars — princípios e crenças do recorte (abre a folha 1)",
  "defenses": [                                 // posições com lastro (folha 1); [] = linha de lacuna
    { "factId": "era_b_defesas", "sourceUrl": "https://…", "title": "≤120", "note": "≤200" }
  ],
  "essential": [                                // ≥3; fatos-âncora (folha 2); cada item: factId XOR gapReason
    { "factId": "era_b_equipamentos", "sourceUrl": "https://…", "title": "≤120", "note": "≤200" },
    { "gapReason": "sem fala própria localizada", "title": "…", "note": "…" }
  ],
  "plan": "≤220 chars — uma linha de plano de voto/compromisso nomeado",  // obrigatório
  "qa": [                                       // ≥4, com ≥1 "direita" e ≥1 "esquerda"
    { "side": "direita|esquerda|entrega", "question": "≤180",
      "acknowledge": "≤200", "answer": "≤520", "close": "≤200",
      "factId": "era_b_sesab", "sourceUrl": "https://…" /* XOR */ "gapReason": "sem registro localizado" }
  ]
}
```

Regras duras:

- `unitId` e o slug têm de casar com o recorte do build (outro recorte = erro);
- cada item de `defenses`/`essential`/`qa` exige **exatamente um** de
  `factId | gapReason`; `factId` tem de resolver num fato do ledger **com
  `sourceUrl`** — **sem fonte, o item não entra**;
- o id de checklist **se repete** entre itens do research e o ledger resolve o
  `factId` puro pelo **primeiro item** daquele id; para ancorar outro item, o
  autor copia o `sourceUrl` do item do research no campo `sourceUrl` do âncora
  (o par `factId` + `sourceUrl` precisa bater — par errado falha fechado);
- `qa` cobre os dois lados (≥1 `direita` e ≥1 `esquerda`); `entrega` é opcional;
- **proibido** qualquer chave de cenário/estimativa/staff-only
  (`estimatedVotes`, `scenario`, `projection`, `polls`, …) — o briefing não tem
  campo numérico; valor/fase vêm do fato-âncora no render;
- caps de texto acima do limite são **aviso** (o autor encurta); quem falha
  fechado é a guarda de fit/páginas;
- a folha 1 abre com `lede` (princípios/crenças) e a lista `defenses` — o autor
  deve trazer **6–10 defesas** para encher a folha; a folha 3–4 acomoda **8–10
  perguntas** (o build divide a lista ao meio).

O pedido é **literal do renderer** (não reescreva no JSON): "Posso contar com
você? Para deputado federal, **vote 1313, Jorge Solla**." — o `plan` é a única
linha de orientação que o autor escreve.

## Recibo do autor

Só este recibo curto (≤ ~15 linhas) volta ao orquestrador — nunca o corpo do
JSON:

```jsonc
{
  "recorte": "cidade",
  "slug": "miguel-calmon",
  "status": "ok",              // ou "failed"
  "briefingPath": "data/dossie-solla-cidade/miguel-calmon.briefing.json",
  "essentialCount": 5,
  "defensesCount": 8,
  "qaCount": 9,
  "sides": ["direita", "esquerda", "entrega"],
  "anchoredFactIds": ["era_b_equipamentos", "era_b_programas", "era_c_atuacao"],
  "gapCount": 3,               // itens com gapReason + lacunas do recorte
  "failureReason": "…"         // opcional (só quando status = failed)
}
```

`status: "failed"` não escreve arquivo parcial; o orquestrador agrega o motivo
no summary final. Arquivo ausente = o build falha com o ponteiro para esta
skill (não há fallback determinístico: o briefing é redação, não consolidação).

## Conteúdo do briefing (4 folhas fixas, todas do recorte)

- **Folha 1 — O que Solla defende** (`data-page="defesas"`): princípios/crenças
  do recorte (o `lede`) e as posições (`defenses`) com título, leitura e
  `fonte · data`. Sem registro = linha de lacuna, nunca posição genérica.
- **Folha 2 — O essencial do recorte + O pedido** (`data-page="essencial"`):
  fatos-âncora com **fase junto ao valor** e fonte (sem trajetória de formação) e
  o bloco do pedido com a frase literal + a linha de `plan`.
- **Folha 3 — Perguntas prováveis × melhores respostas (1/2)** (`data-page="qa"`):
  régua curta (reconhecer → fato com fonte → fechar no pedido) e a primeira
  metade do Q&A (pergunta + reconhecer/fato/fechar), dois lados.
- **Folha 4 — Perguntas prováveis × melhores respostas (2/2)**
  (`data-page="qa-2"`): continuação com a segunda metade do Q&A e o "e mais N"
  quando houver corte.

**Fora do briefing** (replanejamento 2026-09-23): capa/objetivo, trajetória,
roteiro de passos, justificativa científica, "o que evitar", "o que conferir",
"se você não souber" e "limites e defeso" — o rótulo interno em todas as folhas
já carrega o aviso de insumo.

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
  mensagem disser que nem o mínimo cabe, **encurte as listas** (Q&A/defesas),
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
