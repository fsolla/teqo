---
name: dossie-solla-cidade
description: 'Gera o dossiê Solla por cidade (PDF A4 + .md, tudo o que Solla fez pela cidade/região por era) e o Boletim Informativo modelo de 1 página, a partir da base Teqo read-only + pesquisa web datada + fontes oficiais; aceita um município ou um lote separado por vírgula, e o Briefing de capacitação de até 4 páginas.'
---

# Dossiê Solla por cidade + boletim modelo (C186)

Entrega, por município, um **par PDF A4 datado + companion `.md`** com tudo o que
**Jorge Solla fez pela cidade e por seu recorte regional ao longo da carreira**
(epidemiologista/SESAB, Secretaria Municipal de Saúde de Vitória da Conquista,
Secretaria de Atenção à Saúde do MS, SESAB 2007–2014 e Câmara 2015–2027) — toda
afirmação não trivial com **URL + data**, tudo sem fonte vira **lacuna
explícita** — **e** o **Boletim Informativo modelo** (1 página A4, linguagem de
eleitor, sem declaração de fontes) **e** o **Briefing de capacitação** (3º
entregável: até 4 páginas para quem vai pedir o voto 1313, insumo interno). Os
layouts vêm dos artefatos hi-fi aprovados pelo `designer`.

## Quando usar

- A comunicação pede "o dossiê de <cidade>", o "boletim modelo de <cidade>"
  e/ou o **briefing de capacitação** de quem vai pedir voto — ou várias numa
  invocação (`/dossie-solla-cidade Ilheus, Itacare, Una`).
- O briefing também roda sozinho: `/briefing-capacitacao-solla cidade:<slug>`
  (skill `briefing-capacitacao-solla`, mesmo build).
- Quem executa são o **orquestrador** (agente principal) + um sub-agente
  **researcher por era, por cidade**, em paralelo + um sub-agente **redator**
  (redação de abertura e parágrafos por era) + os scripts (`extract` no
  homeserver, `build` local). O detalhe está em "Pipeline (etapas)".

## Lote (várias cidades)

A invocação aceita **um** município ou **vários**, separados por **vírgula**:

```text
/dossie-solla-cidade Ilheus                 # N=1
/dossie-solla-cidade Ilheus, Itacare, Una   # lote
```

Parsing (orquestrador, **antes** de qualquer pesquisa):

- separa por `,`; aplica `trim`; descarta vazio;
- cada token é aceito como **slug canônico** (`isMunicipalitySlug`) **ou** como
  **nome** (fold acento-insensível `resolveMunicipalityName`; `null` = nome
  desconhecido → token inválido) → `municipalityCatalogEntriesForCity`;
- **0 entradas** = token inválido; **>1 entrada** = ambíguo (ex.: `Salvador`
  resolve para 19 zonas `salvador-ze-N` — peça o slug da zona explícito);
- **dedupe após a resolução**, preservando a ordem;
- token inválido/ambíguo vira **falha isolada** com o motivo no summary final —
  **nunca** aborta o lote nem inventa slug.

Uma cidade = um dossiê (PDF+MD) + **um** boletim PDF + **um** briefing
(PDF+MD); **sem** índice/PDF agregado. Falha de uma cidade/era **não** cancela as demais (**sucesso
parcial** explícito).

## Pipeline (etapas)

1. **Orquestrador (agente principal).** Parseia a lista (seção "Lote"), resolve
   os slugs no catálogo (`src/lib/municipalityCatalog.ts`, 435 unidades;
   Salvador = `salvador-ze-N`) e dispara **um researcher por era (A/B/C), por
   cidade** (Task), em paralelo, com guarda de concorrência
   (`MAX_RESEARCHERS_IN_FLIGHT = 6`). Não invente slug: confirme no catálogo.
   Nunca retém pesquisa web nem o corpo de um `research.json` — só os recibos.
2. **Researcher (sub-agente, ×3 por cidade, em paralelo).**
   `.opencode/agent/dossie-solla-cidade.md` — o **único** passo pesado de
   contexto. Faz a pesquisa web datada da sua era e escreve
   `data/dossie-solla-cidade/<slug>.<era>.research.json` (cada item com
   `sourceUrl` + `sourceDate`; sem fonte, **não escreva o item** — ele vira
   lacuna). Devolve **apenas o recibo curto** (seção "Recibo do researcher").
   Não roda ssh nem build.
3. **Redação (sub-agente, 1 por cidade).**
   `.opencode/agent/dossie-solla-cidade-redacao.md` — depois das eras
   pesquisadas, escreve `data/dossie-solla-cidade/<slug>.narrative.json`
   (redação de abertura + 1 parágrafo por era) **somente** a partir dos itens
   com fonte; devolve só o recibo (seção "Recibo do redator"). O orquestrador
   **audita citações** (nome, data, valor, órgão) contra os `research.json` e
   corrige ou descarta o trecho sem lastro — nunca aceita fato novo. Sem o
   arquivo, o builder cai na consolidação determinística dos números.
4. **Extração read-only no homeserver — serializada, 1 cidade por vez.** Reusa
   o extrator do relatório de cidade (`scripts/extract-city-report-snapshot.mjs`,
   `CITY_REPORT_CONFIRM=1`, `withReadOnlyDatabaseUrl`) e a mesma receita do
   runbook `docs/ops/teqo-1313-deploy.md` §"C163 — relatório de cidade"
   (`~/teqo-report`). O recorte do dossiê que vive na base Teqo é o **acervo de
   falas (2011+)**; o resto é API pública em tempo de build.
5. **Fontes oficiais em tempo de build (por cidade).** O builder busca emendas
   do autor (`--emendas=` para replay), a atividade da Câmara (proposições e
   discursos — janela sempre explícita) e o contexto IBGE/SIDRA; qualquer falha
   **degrada para lacuna datada**, nunca zero silencioso.
6. **Render local (por cidade):**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-cidade.mjs \
     --snapshot=data/dossie-solla-cidade/<slug>.snapshot.json \
     --research-dir=data/dossie-solla-cidade \
     --out-dir=docs/research/dossie-solla-cidade
   ```
   O builder pagina por medição (`scripts/lib/dossiePack.mjs`): render de prova
   → pack → **grow/shrink medido** por folha até estabilizar (nada de página
   pela metade, nada cortado), e só então emite o PDF com a guarda de A4.
   Saídas: `docs/research/dossie-solla-cidade/<slug>-<YYYY-MM-DD>-dossie.pdf` +
   `-dossie.md` + `-boletim.pdf`. Intermediários gitignored em
   `data/dossie-solla-cidade/` (HTML, JSONs, emendas, logs). Flags úteis:
   `--emendas=<json>` (replay sem rede), `--author=<nome>` (default
   `JORGE SOLLA`), `--generated-at=<ISO>`, `DOSSIER_STRICT=1` (falha o run se
   houver lacuna — conferência, não entrega).
   O **briefing de capacitação** (3º entregável) sai do mesmo fluxo — seção
   própria abaixo; o build é `scripts/build-dossie-solla-briefing.mjs`
   (`--unit=municipality`) e o autor é `.opencode/agent/briefing-capacitacao-solla.md`.
7. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · dossiê/boletim/briefing (quando ok) · motivo (quando falha)`.

## Briefing por era (A/B/C)

O researcher recebe **uma era** e usa o checklist da era (ver "Contrato dos
JSONs"). Recorte fixo do produto:

- **Era A (até 2006)** — formação/residência; SESAB (epidemiologista/sanitarista);
  consultoria no MS; Secretaria Municipal de Saúde de Vitória da Conquista;
  Secretaria de Atenção à Saúde do MS. O acervo interno de falas cobre 2011+:
  **pré-2011 é lacuna explícita**, não invenção.
- **Era B (2007–2014)** — gestão da SESAB; hospitais, UPAs e equipamentos;
  programas estaduais; obras e investimentos. Fontes: DOE-BA (DOOL), SESAB,
  Transparência Bahia, SIOPS/DATASUS.
- **Era C (2015–2027)** — pronunciamentos, proposições/relatorias, emendas,
  títulos/honrarias e vínculos locais, atuação regional. Fontes: API Câmara
  (deputy id `178857`; `/discursos` **default 7 dias** — sempre passe a janela;
  relatorias saem das tramitações), Portal da Transparência, Siga Brasil.

Templates de busca: `"Jorge Solla" <cidade>` + `<tema>`; recorte por data
`after:YYYY-MM-DD before:YYYY-MM-DD`; `site:` por veículo
(atarde.com.br, correio24horas.com.br, bahianoticias.com.br, metro1.com.br,
bnews.com.br, bahia.ba, acordacidade.com.br, g1.globo.com/ba,
camara.leg.br, ptnacamara.org.br, ptbahia.org.br, saude.ba.gov.br,
jorgesolla.com.br); excluir ruído de campanha 2026 (`-eleição -candidato -voto
-coligação -pesquisa`) e preferir verbos de entrega (emenda, recurso,
repassado, hospital, UPA, SAMU, obra, inaugura, audiência, relator).

## Recibo do researcher

O sub-agente devolve **só** este recibo curto (≤ ~15 linhas) — **nunca** o corpo
do `research.json` (`items[].answer/details`):

```jsonc
{
  "slug": "ilheus",
  "era": "C",
  "status": "ok",              // ou "failed"
  "researchPath": "data/dossie-solla-cidade/ilheus.c.research.json",
  "researchedAt": "2026-09-17T10:00:00.000Z",
  "itemCount": 5,              // itens da era com fonte
  "gapCount": 2,               // == gaps.length
  "newsCount": 3,
  "gaps": ["era_c_titulos", "…"],
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
  "slug": "ilheus",
  "status": "ok",              // ou "failed"
  "narrativePath": "data/dossie-solla-cidade/ilheus.narrative.json",
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
  "municipalitySlug": "ilheus",              // obrigatório
  "era": "C",                                 // obrigatório: A | B | C
  "researchedAt": "2026-09-17T10:00:00.000Z", // obrigatório
  "items": [
    {
      "id": "era_c_emendas",                  // id do checklist da era
      "answer": "registro integral; aceita {{fonte}} / {{fonte:N}} — vai para o .md e para o lastro",
      "position": "opcional — só em item `*_defesas`: rótulo curto da posição (ex. \"Ensino superior\")",
      "details": "opcional; aceita {{fonte}} / {{fonte:N}}",
      "brief": {                                // obrigatório no item publicado: copy reformulada, curta
        "title": "≤80 chars — manchete (o quê + onde)",
        "note": "≤120 chars — 1 frase de contexto; opcional"
      },
      "sphere": "municipio",                  // municipio | regiao | polo (default municipio)
      "numbers": [                             // opcional
        { "label": "Saúde", "value": "R$ 1,2 mi", "year": "2024", "phase": "empenhado" }
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
  `era_a_sas_ms`, `era_a_defesas`.
- **B:** `era_b_sesab`, `era_b_equipamentos`, `era_b_programas`, `era_b_obras`,
  `era_b_defesas`.
- **C:** `era_c_discursos`, `era_c_proposicoes`, `era_c_emendas`,
  `era_c_titulos`, `era_c_atuacao`, `era_c_defesas`.

Os itens `era_X_defesas` são a dimensão **"O que Solla defende"** (`kind:
defense`): `answer` = frase da posição, `details` = lastro identificado
(ato/proposição, "Notícia: veículo · data" ou trecho de fala) e
`sourceUrl`/`sourceDate` da fonte do lastro — **sem registro datado vira lacuna**,
nunca posição inferida. Os demais itens (`kind: evidence`) alimentam as eras, a
região e a síntese; itens de defesa **não** entram nessas listas.

Item sem `sourceUrl`/`sourceDate`, item ausente ou item de outra era vira
**lacuna** (`Não pesquisado.` / `Sem fonte: …`); `sphere` inválida vira lacuna
(`Esfera inválida`). `phase` ∈ `autorizado|empenhado|liquidado|pago|restos`
(default `nao_informado`). O `bulletinFacts` (ledger do boletim) só é populado
por item **com fonte** — o boletim não introduz fato novo.

**`<slug>.narrative.json` (opcional; escrito pelo redator, auditado pelo
orquestrador):

```jsonc
{
  "municipalitySlug": "ilheus",               // obrigatório
  "generatedAt": "2026-09-18T00:26:19.000Z",  // obrigatório
  "title": "O que Jorge Solla fez por Ilhéus",
  "opening": ["parágrafo", "parágrafo", "parágrafo"],
  "eras": { "A": "parágrafo", "B": "parágrafo", "C": "parágrafo" },
  "betweenEras": ["bullet", "bullet"]         // opcional — leitura entre eras
}
```

Sem o arquivo (ou com `municipalitySlug` diferente do snapshot), o builder **não
falha**: a abertura repete a leitura dos números, cada era usa a consolidação
determinística e a leitura entre eras é derivada dos registros. `opening`,
`eras` e `betweenEras` só podem conter fatos dos itens com fonte — nenhum número,
data, nome ou órgão novo.

**`brief` (copy reformulada, sem reticências).** As páginas A4 têm altura fixa:
em vez de cortar o texto com `…`, cada item publicado traz um `brief` **reescrito
para caber** (`title` ≤80 / `note` ≤120) preservando o essencial (o quê, onde,
valor + fase) — nunca inventa fato, nunca sugere exclusividade municipal para
item `regiao`/`polo` e nunca troca a fase (empenho ≠ pagamento). As folhas de era
imprimem `brief.title`/`brief.note`; o `answer`/`details` integrais ficam no
registro e no companion `.md`. Sem `brief`, o renderer cai no texto integral e a
guarda de fit A4 do builder **falha fechado** (não corta em silêncio). Tabelas
longas (lacunas, notícias) não usam `brief`: são **paginadas** em folhas de
continuação com o texto inteiro.

## Conteúdo do dossiê

- **Capa** — série municipal, "INSUMO INTERNO", território, região/polo adotado,
  data, "como ler", escopo/versão.
- **O essencial** — abre o documento: leitura do recorte (a redação de abertura),
  fatos-chave (pontos com fonte por era, abrangência sem soma, valores por fase,
  lacunas) e o **índice** com o número de página de cada seção. É a leitura antes
  do inventário.
- **Leitura entre eras** — bullets de concentração, instrumentos, continuidade,
  alcance e lacunas que pesam (`betweenEras` do `narrative.json` ou derivação
  determinística) + tabela **Era / Onde está a evidência / Como citar com
  segurança / Limite**.
- **Trajetória completa** — a linha do tempo da carreira em tabela
  (período/papel/como recuperar), incertezas na própria linha.
- **Seção por era (A/B/C)** — leitura da era ("Leitura da era", do
  `narrative.json` ou determinística) + tabela **Objeto/Valor/Ano/Fase/Esfera/
  Fonte** + lista **"O que fez · item — alcance — lastro"**. Fase e esfera são
  texto, nunca selo colorido. **Sem cap**: a era flui por quantas folhas precisar
  (continuações com cabeçalho "continuação N"). Uma era sem evidência é omitida
  como seção e aparece no índice e na leitura entre eras com a nota "sem
  evidência nominal suficiente; consulte as lacunas" — nunca inventada.
- **Região / polo** — callout "Não somar." + tabela de leitura lado a lado
  (**nenhum total combinado**) e, em seguida, **as duas listas completas** em
  tabela (item/esfera/evidência/fonte), cada uma fluindo por quantas folhas
  precisar.
- **O que Solla defende** — seção própria e indexável: leitura dos registros
  (não é opinião), lista de posições (`position-list`: rótulo da posição, leitura
  com lastro, fonte + data + era) e, para cada item `era_X_defesas` sem registro,
  a linha "Sem registro localizado" com a lacuna explícita. Só entra posição com
  ato, notícia datada ou fala identificada como lastro.
- **Lacunas explícitas**, **Notícias e documentos consultados** e **Acervo
  interno** — tabelas/listas completas, também correntes (sem cap). As notícias
  ganham a coluna "Uso no dossiê" (era) e o resumo datado; o acervo é **amostra
  declarada** (as falas mais recentes com link, de N do recorte municipal);
  região/polo não entram nessa conta.
- **Fontes e limites** — limites de cobertura; regras para uso editorial; nota de
  defeso eleitoral 2026.
- **Nada some e nada é cortado:** o dossiê **não usa caps** — o builder mede a
  altura real de cada linha e pagina (grow/shrink) até a página ficar cheia sem
  estourar; listas continuam em folhas de continuação com o texto inteiro. O
  único "e mais N" é o da amostra do acervo.

## Conteúdo do Boletim modelo (1 página A4)

- Cabeçalho com município + rótulo **"Modelo — insumo interno"**; título
  "O que Jorge Solla fez por <cidade>"; lede curta; **≤6 destaques** em lista
  (rótulo + texto, com o valor e a fase quando houver); **"O que Solla defende"**
  com **≤2 defesas curtas** com lastro do ledger (bloco omitido quando não há
  registro); trajetória em quatro períodos; **"E mais" com ≤14 itens** em lista;
  rodapé com defeso.
- **Sem declaração de fontes** (as fontes vivem exclusivamente no dossiê), sem
  CTA de campanha; herda **apenas** fatos com fonte do dossiê.

## Briefing de capacitação (3º entregável, C210)

- A mesma invocação entrega o **Briefing de capacitação** do recorte — PDF A4 de
  **até 4 páginas** + companion `.md`, para quem vai pedir o voto 1313 — além do
  dossiê e do boletim. A fonte canônica do fluxo é a skill
  `.agents/skills/briefing-capacitacao-solla/SKILL.md` (não a transcreva).
- Depois de o dossiê estar pesquisado, o orquestrador dispara o **autor**
  (`.opencode/agent/briefing-capacitacao-solla.md`) — que escreve
  `data/dossie-solla-cidade/<slug>.briefing.json` só a partir dos itens com fonte; **audita** as
  citações e **roda** o mesmo build da família:
  ```bash
  NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-briefing.mjs \
    --unit=municipality \
    --snapshot=data/dossie-solla-cidade/<slug>.snapshot.json \
    --research-dir=data/dossie-solla-cidade \
    --out-dir=docs/research/dossie-solla-cidade
  ```
  Saídas: `docs/research/dossie-solla-cidade/<slug>-<YYYY-MM-DD>-briefing.pdf` + `-briefing.md`
  (gitignored, insumo interno com rótulo literal; nunca publicar).
- Rótulo literal `Insumo interno de capacitação — não publicar` em todas as
  folhas; sem CTA público; sem cenário/estimativa/staff-only; só fatos com fonte
  do dossiê (**sem segunda pesquisa factual**). Teto rígido de **4 páginas** com
  corte por prioridade declarado (o resto fica contado na folha e completo no
  `.md`); essencial, roteiro e identificação nunca são cortados.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem URL+data vira lacuna.
- **Redação e parágrafos com lastro**: a leitura de abertura e o parágrafo de cada era só usam
  fatos dos itens com fonte; o orquestrador audita citação por citação (nome,
  data, valor, órgão) e remove o que não tiver lastro.
- **Dossiê sem caps**: o conteúdo flui por quantas páginas precisar; a página é
  preenchida por medição (grow/shrink), nunca por corte de texto.
- **Empenho ≠ pagamento**: cada valor acompanha sua fase
  (autorizado/empenhado/liquidado/pago/restos); nunca consolidar como
  equivalentes.
- **Esfera explícita** (`município`/`região`/`polo`): região/polo **nunca** é
  somado ao município.
- **Leitura relativa**: nunca % estadual absoluto.
- **Atribuição de emenda** de bancada/relator só com autoria checada; sem
  atribuição → lacuna.
- **Lacuna explícita** em vez de inferência; o acervo interno cobre 2011+
  (pré-2011 é lacuna).
- **PII mínima**: telefone/e-mail nunca entram.
- **Falha isolada** por era/cidade não cancela o lote (**sucesso parcial**).
- **Artefato gitignored** (repo público): PDF/MD/JSON nunca são commitados.
- **Defeso**: dossiê e boletim saem como insumo interno/modelo, sem CTA; a peça
  final publicável é da comunicação/campanha.
- **Briefing de capacitação (3º entregável)**: até **4 páginas**, rótulo literal `Insumo interno de capacitação — não publicar`, sem CTA público, sem cenário/estimativa/staff-only; deriva do dossiê (mesmo build), corte por prioridade declarado e o restante no `.md`.

## Troubleshooting

- **Folha do dossiê estourou**: o builder mede a altura real de cada linha e
  repagina (grow/shrink) até estabilizar; se uma folha continuar estourando, é
  porque **uma linha sozinha** não cabe — aperte a copy daquele item, nunca o
  layout. Página **não-packed** (O essencial, leitura entre eras, trajetória,
  defende, fontes) estourando = corte copy ou enxugue o índice.
- **Página pela metade**: o pack estabilizou? Confira o log (`pack estável`); se
  uma seção ficou rala, o problema é o custo medido (bloco novo) — não force cap,
  ajuste a copy do item que abre a seção.
- **Sem redação (`narrative.json`)**: a abertura repete a leitura dos números e
  as eras usam a consolidação determinística; não é falha, é degradação.
  `municipalitySlug` diferente do snapshot = erro (regenere).
- **Era sem pesquisa**: o builder sintetiza o arquivo da era com lacunas
  explícitas — não invente itens.
- **Câmara 429/500**: `getJsonWithBackoff` + paginação com teto; falha degrada
  para lacuna datada. Os discursos sempre passam janela (`dataInicio`/`dataFim`).
- **Sem chave do Portal da Transparência**: emendas viram lacuna (o dossiê sai).
- **Slug de pesquisa ≠ snapshot**: o builder recusa o par — regenere, nunca
  edite o JSON à mão para casar.
- **Token inválido/ambíguo no lote**: vira linha `failed` no summary com o
  motivo; `Salvador` é ambíguo (19 zonas).
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.

## Referências

- Briefing de capacitação (3º entregável): `.agents/skills/briefing-capacitacao-solla/SKILL.md`, `scripts/build-dossie-solla-briefing.mjs` e o design `docs/plans/briefing-capacitacao-solla-ui-design.html` (intenção/impl: `docs/plans/briefing-capacitacao-solla.md`).


- Intenção: `docs/plans/dossie-solla-cidade.md`; impl:
  `docs/plans/dossie-solla-cidade-impl.md`.
- Designs hi-fi (fonte de verdade do port): `docs/plans/dossies-sobrios-analiticos-ui-design.html`
  (C209 — cenas do dossiê e do boletim, um artefato da família). Os hi-fi antigos
  (`dossie-solla-cidade-ui-design.html` e `-boletim-ui-design.html`) ficam no repo
  como registro e estão **superados**.
- Precedente: `.agents/skills/relatorio-cidade/SKILL.md`,
  `.opencode/agent/relatorio-cidade.md`, `scripts/build-city-report.mjs`.
- Scripts: `scripts/build-dossie-solla-cidade.mjs`,
  `scripts/lib/dossiePack.mjs` (packing grow/shrink),
  `scripts/lib/buildPdf.mjs` (probe/medição/emit), `scripts/lib/dossie*.mjs`.
- Bio: `.opencode/skills/solla-comunicacao/referencia/perfil-e-posicoes.md`.
- Runbook de extração read-only: `docs/ops/teqo-1313-deploy.md` §C163.
