---
name: dossie-solla-instituicao
description: 'Gera o dossiê Solla por instituição (PDF A4 + .md, tudo o que Solla fez pela/na/com a instituição por era) e o Boletim Informativo modelo de 1 página, a partir da base Teqo read-only + pesquisa web datada + fontes oficiais; aceita uma instituição ou um lote separado por vírgula.'
---

# Dossiê Solla por instituição + boletim modelo (C187)

Entrega, por instituição (universidade, instituto, empresa pública, autarquia,
órgão, conselho/entidade de classe, categoria profissional, movimento, rede), um
**par PDF A4 datado + companion `.md`** com tudo o que **Jorge Solla fez por, na
e com a instituição ao longo da carreira** — toda afirmação não trivial com
**URL + data**, tudo sem fonte vira **lacuna explícita** — **e** o **Boletim
Informativo modelo** (1 página A4, linguagem de eleitor, sem declaração de
fontes). Skill irmã da `dossie-solla-cidade` (C186): mesmo pipeline, recorte
institucional. O layout vem dos artefatos hi-fi aprovados pelo `designer`.

O dossiê institucional **não usa caps**: cada seção (eras, abrangência, títulos,
lacunas, notícias, acervo) flui por quantas páginas precisar, com quebra só entre
linhas — o orquestrador não decide o corte, o builder mede e pagina. Sobre essa
base vêm **O essencial** (redação de abertura + fatos-chave + índice), a
**leitura entre eras**, a abrangência e o **O que Solla defende**, e cada era
abre com a **leitura da era**.

## Quando usar

- A comunicação pede "o dossiê da <instituição>" e/ou o "boletim modelo da
  <instituição>" — ou várias numa invocação (`/dossie-solla-instituicao UFBA,
  Correios`).
- Quem executa são o **orquestrador** (agente principal) + um sub-agente
  **researcher por era, por instituição**, em paralelo + um sub-agente
  **redator** (redação de abertura e parágrafos por era) + os scripts (`extract`
  no homeserver, `build` local). O detalhe está em "Pipeline (etapas)".

## Lote (várias instituições)

A invocação aceita **uma** instituição ou **várias**, separadas por **vírgula**:

```text
/dossie-solla-instituicao UFBA                  # N=1
/dossie-solla-instituicao UFBA, Correios        # lote
```

Parsing (orquestrador, **antes** de qualquer pesquisa):

- separa por `,`; aplica `trim`; descarta vazio;
- cada token é aceito como **slug canônico** (`isInstitutionSlug`) **ou** como
  **nome** (fold acento-insensível `resolveInstitutionName`; `null` = nome
  desconhecido → token inválido) → entrada do catálogo;
- **0 entradas** = token inválido; **>1 entrada** = ambíguo (peça o slug
  canônico explícito) — o token **falha fechado** com mensagem acionável
  (adicionar alias/entrada em `src/lib/institutionCatalog.ts` ou usar o escape
  one-off `--slug=<x> --name="<Nome>"`), **nunca** inventa slug;
- **dedupe após a resolução**, preservando a ordem;
- token inválido/ambíguo vira **falha isolada** com o motivo no summary final —
  **nunca** aborta o lote.

Uma instituição = um dossiê (PDF+MD) + **um** boletim PDF; **sem** índice/PDF
agregado. Falha de uma instituição/era **não** cancela as demais (**sucesso
parcial** explícito).

## Pipeline (etapas)

1. **Orquestrador (agente principal).** Parseia a lista (seção "Lote"), resolve
   as entradas no catálogo (`src/lib/institutionCatalog.ts`) e dispara **um
   researcher por era (A/B/C), por instituição** (Task), em paralelo, com guarda
   de concorrência (`MAX_RESEARCHERS_IN_FLIGHT = 6`). Não invente slug: confirme
   no catálogo ou use o escape one-off. Nunca retém pesquisa web nem o corpo de
   um `research.json` — só os recibos.
2. **Researcher (sub-agente, ×3 por instituição, em paralelo).**
   `.opencode/agent/dossie-solla-instituicao.md` — o **único** passo pesado de
   contexto. Faz a pesquisa web datada da sua era e escreve
   `data/dossie-solla-instituicao/<slug>.<era>.research.json` (cada item com
   `sourceUrl` + `sourceDate`; sem fonte, **não escreva o item** — ele vira
   lacuna). Devolve **apenas o recibo curto** (seção "Recibo do researcher").
   Não roda ssh nem build.
3. **Redação (sub-agente, 1 por instituição).**
   `.opencode/agent/dossie-solla-instituicao-redacao.md` — depois das eras
   pesquisadas, escreve `data/dossie-solla-instituicao/<slug>.narrative.json`
   (redação de abertura + 1 parágrafo por era) **somente** a partir dos itens
   com fonte; devolve só o recibo (seção "Recibo do redator"). O orquestrador
   **audita citações** (nome, data, valor, órgão) contra os `research.json` e
   corrige ou descarta o trecho sem lastro — nunca aceita fato novo. Sem o
   arquivo, o builder cai na consolidação determinística dos números.
4. **Extração read-only no homeserver — serializada, 1 instituição por vez.**
   `scripts/extract-institution-snapshot.mjs` (`INSTITUTION_REPORT_CONFIRM=1`,
   sessão read-only) lê o acervo interno de falas por **tema→instituição**
   (`topics` da entrada do catálogo; o acervo cobre 2011+ e não tem campo
   instituição) e grava
   `data/dossie-solla-instituicao/<slug>.institution.snapshot.json`.
5. **Fontes oficiais em tempo de build.** O Portal da Transparência **não filtra
   por instituição** e a Câmara tampouco; emendas/proposições institucionais
   entram como **itens de pesquisa** (com fase e fonte). Sem atribuição → lacuna,
   **nunca zero silencioso**. O builder **não** busca emendas/Câmara/IBGE.
6. **Render local (por instituição):**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-instituicao.mjs \
     --snapshot=data/dossie-solla-instituicao/<slug>.institution.snapshot.json \
     --research-dir=data/dossie-solla-instituicao \
     --out-dir=docs/research/dossie-solla-instituicao
   ```
   O builder pagina por medição (`scripts/lib/dossiePack.mjs`): render de prova
   → pack → **grow/shrink medido** por folha até estabilizar (nada de página
   pela metade, nada cortado), e só então emite o PDF com a guarda de A4.
   Saídas: `docs/research/dossie-solla-instituicao/<slug>-<YYYY-MM-DD>-dossie.pdf`
   + `-dossie.md` + `-boletim.pdf`. Intermediários gitignored em
   `data/dossie-solla-instituicao/` (HTML, JSONs, logs). Flags úteis:
   `--generated-at=<ISO>`, `DOSSIER_STRICT=1` (falha o run se houver lacuna —
   conferência, não entrega).
7. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · dossiê/boletim (quando ok) · motivo (quando falha)`.

## Briefing por era (A/B/C)

O researcher recebe **uma era** e usa o checklist da era (ver "Contrato dos
JSONs"). As eras são as mesmas da C186 (não criar eras novas):

- **Era A (até 2006)** — formação/residência/pesquisa com vínculo nominal;
  SESAB; consultoria no MS; gestão municipal; Secretaria de Atenção à Saúde do
  MS; vínculo institucional documentado. O acervo interno de falas cobre 2011+:
  **pré-2011 é lacuna explícita**, não invenção.
- **Era B (2007–2014)** — gestão da SESAB com a instituição; equipamentos;
  programas; obras; convênios/termos. Fontes: DOE-BA (DOOL), SESAB/instituição,
  Transparência Bahia.
- **Era C (2015–2027)** — pronunciamentos; proposições/relatorias de interesse;
  emendas; títulos/honrarias; atuação; parcerias/audiências. Fontes: API Câmara
  (deputy id `178857`; `/discursos` **default 7 dias** — sempre passe a janela;
  relatorias saem das tramitações), Portal da Transparência, Siga Brasil.

Templates de busca: `"Jorge Solla" <instituição>` + `<tema>`; recorte por data
`after:YYYY-MM-DD before:YYYY-MM-DD`; `site:` por fonte institucional/oficial
(ufba.br, correios.com.br, cofen.gov.br, camara.leg.br, ptbahia.org.br,
jorgesolla.com.br); excluir ruído de campanha 2026 (`-eleição -candidato -voto
-coligação -pesquisa`) e preferir verbos de entrega (emenda, recurso, convênio,
parceria, projeto, relatoria, audiência, homenagem, repassado).

## Recibo do researcher

O sub-agente devolve **só** este recibo curto (≤ ~15 linhas) — **nunca** o corpo
do `research.json` (`items[].answer/details`):

```jsonc
{
  "slug": "ufba",
  "era": "C",
  "status": "ok",              // ou "failed"
  "researchPath": "data/dossie-solla-instituicao/ufba.c.research.json",
  "researchedAt": "2026-09-17T10:00:00.000Z",
  "itemCount": 5,              // itens da era com fonte
  "gapCount": 2,               // == gaps.length
  "newsCount": 3,
  "gaps": ["era_c_parcerias", "…"],
  "failureReason": "…"         // opcional (só quando status = failed)
}
```

`status: "failed"` carrega o motivo e **não** escreve corpo parcial; o
orquestrador agrega os recibos no summary final — é o único dado de pesquisa que
cruza para ele.

## Recibo do redator

O sub-agente da redação devolve **só** este recibo curto — **nunca** os
parágrafos:

```jsonc
{
  "slug": "ufba",
  "status": "ok",              // ou "failed"
  "narrativePath": "data/dossie-solla-instituicao/ufba.narrative.json",
  "paragraphs": 3,             // parágrafos de abertura
  "eraParagraphs": 3,          // eras com parágrafo (A/B/C)
  "wordCounts": { "opening": [127, 146, 140], "A": 119, "B": 119, "C": 118 },
  "failureReason": "…"         // opcional (só quando status = failed)
}
```

O orquestrador **audita** cada citação factual (nome, data, valor, órgão) contra
os `research.json` antes de aceitar o arquivo; trecho sem lastro é corrigido ou
removido. `status: "failed"` não escreve arquivo parcial — o builder segue com a
consolidação determinística.

## Contrato dos JSONs

`<slug>.<era>.research.json` (um arquivo por era; `era` ∈ `A|B|C`):

```jsonc
{
  "institutionSlug": "ufba",                 // obrigatório
  "era": "C",                                 // obrigatório: A | B | C
  "researchedAt": "2026-09-17T10:00:00.000Z", // obrigatório
  "items": [
    {
      "id": "era_c_emendas",                  // id do checklist da era
      "answer": "R$ 5,0 milhões para estrutura de ensino e pesquisa",
      "position": "opcional — só em item `*_defesas`: rótulo curto da posição (ex. \"Financiamento\")",
      "details": "opcional; aceita {{fonte}} / {{fonte:N}}",
      "sphere": "instituicao",                // instituicao | setor | rede (default instituicao)
      "numbers": [                             // opcional
        { "label": "Emenda", "value": "R$ 5,0 mi", "year": "2024", "phase": "empenhado" }
      ],
      "sourceUrl": "https://…",                // obrigatório no item publicado
      "sourceDate": "2026-09-15",              // obrigatório
      "extraSources": [{ "label": "…", "url": "https://…", "date": "2026-09-01" }],
      "consultedAt": "2026-09-17T09:00:00.000Z"
    }
  ],
  "news": [
    { "title": "…", "outlet": "…", "publishedAt": "2024-06-01", "url": "https://…", "summary": "…" }
  ],
  "gaps": [{ "id": "…", "label": "…", "reason": "…" }]
}
```

Checklist por era (ids):

- **A:** `era_a_formacao`, `era_a_sesab`, `era_a_consultor_ms`, `era_a_conquista`,
  `era_a_sas_ms`, `era_a_vinculo`, `era_a_defesas`.
- **B:** `era_b_sesab`, `era_b_equipamentos`, `era_b_programas`, `era_b_obras`,
  `era_b_convenios`, `era_b_defesas`.
- **C:** `era_c_discursos`, `era_c_proposicoes`, `era_c_emendas`,
  `era_c_titulos`, `era_c_atuacao`, `era_c_parcerias`, `era_c_defesas`.

Os itens `era_X_defesas` são a dimensão **"O que Solla defende"** (`kind:
defense`): `answer` = frase da posição, `details` = lastro identificado
(ato/proposição, "Notícia: veículo · data" ou trecho de fala) e
`sourceUrl`/`sourceDate` da fonte do lastro — **sem registro datado vira lacuna**,
nunca posição inferida. Os demais itens (`kind: evidence`) alimentam as eras, a
abrangência e a síntese; itens de defesa **não** entram nessas listas.

A **abrangência** (`sphere`) é `instituicao` | `setor` | `rede`; `setor` e `rede`
não são a instituição e **nunca são somados** a ela (cada linha informa sua
abrangência). Item sem `sourceUrl`/`sourceDate`, item ausente ou item de outra
era vira **lacuna** (`Não pesquisado.` / `Sem fonte: …`); abrangência inválida
vira lacuna. `phase` ∈ `autorizado|empenhado|liquidado|pago|restos` (default
`nao_informado`; empenho **não** é pagamento). O `bulletinFacts` (ledger do
boletim) só é populado por item **com fonte** — o boletim não introduz fato novo.

`<slug>.narrative.json` (opcional; escrito pelo redator, auditado pelo
orquestrador):

```jsonc
{
  "institutionSlug": "ufba",                  // obrigatório
  "generatedAt": "2026-09-18T00:26:19.000Z",  // obrigatório
  "title": "O que Jorge Solla fez pela e na UFBA",
  "opening": ["parágrafo", "parágrafo", "parágrafo"],
  "eras": { "A": "parágrafo", "B": "parágrafo", "C": "parágrafo" },
  "betweenEras": ["bullet", "bullet"]         // opcional — leitura entre eras
}
```

Sem o arquivo (ou com `institutionSlug` diferente do snapshot), o builder **não
falha**: a abertura repete a leitura dos números, cada era usa a consolidação
determinística e a leitura entre eras é derivada dos registros. `opening`,
`eras` e `betweenEras` só podem conter fatos dos itens com fonte — nenhum número,
data, nome ou órgão novo.

## Conteúdo do dossiê

- **Capa** — série institucional, "INSUMO INTERNO — defeso 2026", identificação
  (nome/tipo/esfera/alcance em tabela), data, "como usar", escopo/versão.
- **O essencial** — abre o documento: leitura do recorte (a redação de abertura),
  identificação da instituição, fatos-chave (pontos com fonte por era,
  abrangência sem soma, valores por fase, lacunas) e o **índice** com o número de
  página de cada seção.
- **Leitura entre eras** — bullets de concentração, instrumentos, continuidade,
  alcance e lacunas que pesam (`betweenEras` do `narrative.json` ou derivação
  determinística) + tabela **Era / Onde está a evidência / Como citar com
  segurança / Limite**.
- **Trajetória completa** — a linha do tempo da carreira em tabela
  (período/papel/como recuperar), incertezas na própria linha.
- **Seção por era (A/B/C)** — leitura da era ("Leitura da era", do
  `narrative.json` ou determinística) + tabela **Objeto/Valor/Ano/Fase/
  Abrangência/Fonte** + lista **"O que fez · item — alcance — lastro"**. Fase e
  abrangência são texto, nunca selo colorido. **Sem cap**: a era flui por quantas
  folhas precisar (continuações com cabeçalho "continuação N"). Uma era **sem
  evidência** vira **página de lacuna explícita** (nunca seção em branco nem
  "zero").
- **Abrangência: instituição × setor × rede** — callout "Não somar." + tabela de
  leitura lado a lado (**nenhum total combinado**) e, em seguida, **as três
  listas completas** em tabela (item/abrangência/evidência/fonte), cada uma
  fluindo por quantas folhas precisar.
- **Títulos, honrarias e vínculos** — tabela data/natureza/registro/fonte, com a
  regra de leitura (vínculo não prova resultado).
- **O que Solla defende** — seção própria e indexável: leitura dos registros
  (não é opinião), lista de posições (`position-list`: rótulo da posição, leitura
  com lastro, fonte + data + era) e, para cada item `era_X_defesas` sem registro,
  a linha "Sem registro localizado" com a lacuna explícita. Só entra posição com
  ato, notícia datada ou fala identificada como lastro.
- **Lacunas explícitas**, **Notícias e documentos consultados** e **Acervo
  interno** — tabelas/listas completas, também correntes (sem cap). As notícias
  ganham a coluna "Uso no dossiê" (era) e o resumo datado; o acervo é **amostra
  declarada** (as falas mais recentes com link, de N do recorte temático); o
  recorte é por tema, não nominal.
- **Fontes e limites** — limites de cobertura; regras para uso editorial; nota de
  defeso eleitoral 2026.
- **Nada some e nada é cortado:** o dossiê institucional **não usa caps** — o
  builder mede a altura real de cada linha e pagina (grow/shrink) até a página
  ficar cheia sem estourar; listas continuam em folhas de continuação com o texto
  inteiro. O único "e mais N" é o da amostra do acervo.

## Conteúdo do Boletim modelo (1 página A4)

- Cabeçalho com o nome da instituição + rótulo **"Modelo — insumo interno"**;
  título "O que Jorge Solla fez pela e na <instituição>"; lede curta; **≤6
  destaques** em lista (rótulo + texto, com o valor e a fase quando houver);
  **"O que Solla defende"** com **≤2 defesas curtas** com lastro do ledger (bloco
  omitido quando não há registro); trajetória em quatro períodos; **"E mais" com
  ≤14 itens** em lista; rodapé com controle editorial e defeso. Com **poucos
  fatos**, a página termina com espaço — sem preencher por inferência nem
  inventar número.
- **Sem declaração de fontes** (as fontes vivem exclusivamente no dossiê), sem
  CTA de campanha; herda **apenas** fatos com fonte do dossiê.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem URL+data vira lacuna.
- **Redação e parágrafos com lastro**: a leitura de abertura e o parágrafo de cada era só usam
  fatos dos itens com fonte; o orquestrador audita citação por citação (nome,
  data, valor, órgão) e remove o que não tiver lastro.
- **Empenho ≠ pagamento**: cada valor acompanha sua fase; nunca consolidar.
- **Abrangência explícita** (`instituição`/`setor`/`rede`): setor e rede
  **nunca** são somados como se fossem a instituição.
- **Dossiê sem caps**: o conteúdo flui por quantas páginas precisar; a página é
  preenchida por medição (grow/shrink), nunca por corte de texto.
- **Leitura relativa**: nunca % estadual absoluto.
- **Atribuição de emenda** de bancada/relator só com autoria checada; sem
  atribuição → lacuna (o Portal não filtra por instituição).
- **Lacuna explícita** em vez de inferência; o acervo interno cobre 2011+.
- **PII mínima**: telefone/e-mail nunca entram.
- **Falha isolada** por era/instituição não cancela o lote (**sucesso parcial**).
- **Artefato gitignored** (repo público): PDF/MD/JSON nunca são commitados.
- **Defeso**: dossiê e boletim saem como insumo interno/modelo, sem CTA; a peça
  final publicável é da comunicação/campanha. **Sem schema/migration/DB write.**

## Troubleshooting

- **Folha do dossiê estourou**: o builder mede a altura real de cada linha e
  repagina (grow/shrink) até estabilizar; se uma folha continuar estourando, é
  porque **uma linha sozinha** não cabe — aperte a copy/caps daquele item, nunca
  o layout. Página **não-packed** (O essencial, leitura entre eras, trajetória,
  títulos, defende, fontes) estourando = corte copy ou enxugue o índice.
- **Página pela metade**: o pack estabilizou? Confira o log (`pack estável`); se
  uma seção ficou rala, o problema é o custo medido (bloco novo) — não force
  cap, ajuste a copy do item que abre a seção.
- **Era sem pesquisa**: o builder sintetiza o arquivo da era com lacunas
  explícitas — e a era sai como página de lacuna, não inventada.
- **Sem redação (`narrative.json`)**: a abertura repete a leitura dos números e
  as eras usam a consolidação determinística; não é falha, é degradação.
  `institutionSlug` diferente do snapshot = erro (regenere).
- **Câmara 429/500**: `getJsonWithBackoff` + paginação com teto; falha degrada
  para lacuna datada. Os discursos sempre passam janela (`dataInicio`/`dataFim`).
- **Sem chave do Portal da Transparência**: emendas institucionais viram lacuna
  (o dossiê sai).
- **Slug de pesquisa ≠ snapshot**: o builder recusa o par — regenere, nunca
  edite o JSON à mão para casar.
- **Token desconhecido no lote**: vira linha `failed` no summary com o motivo.
  Use `--slug=<x> --name="<Nome>"` para uma instituição fora do catálogo.
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.

## Referências

- Intenção: `docs/plans/dossie-solla-instituicao.md`; impl:
  `docs/plans/dossie-solla-instituicao-impl.md`.
- Designs hi-fi (fonte de verdade do port): `docs/plans/dossies-sobrios-analiticos-ui-design.html`
  (C209 — cenas do dossiê e do boletim, um artefato da família). Os hi-fi antigos
  (`dossie-solla-instituicao-ui-design.html` e `-boletim-ui-design.html`) ficam no
  repo como registro e estão **superados**.
- Skill irmã (dona do pipeline): `.agents/skills/dossie-solla-cidade/SKILL.md` —
  o ramo cidade segue com caps; a adoção do fluxo corrente é decisão de produto.
- Scripts: `scripts/build-dossie-solla-instituicao.mjs`,
  `scripts/extract-institution-snapshot.mjs`, `scripts/institutionSnapshot.mjs`,
  `scripts/lib/dossiePack.mjs` (packing grow/shrink),
  `scripts/lib/buildPdf.mjs` (probe/medição/emit),
  `scripts/lib/dossie*.mjs`, `scripts/lib/readOnlyExtract.mjs`.
- Catálogo: `src/lib/institutionCatalog.ts`, `src/lib/institutionNameAliases.ts`.
- Runbook de extração read-only: `docs/ops/teqo-1313-deploy.md` §C163.
