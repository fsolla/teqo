---
name: dossie-solla-cidade
description: 'Gera o dossiê Solla por cidade (PDF A4 + .md, tudo o que Solla fez pela cidade/região por era) e o Boletim Informativo modelo de 1 página, a partir da base Teqo read-only + pesquisa web datada + fontes oficiais; aceita um município ou um lote separado por vírgula.'
---

# Dossiê Solla por cidade + boletim modelo (C186)

Entrega, por município, um **par PDF A4 datado + companion `.md`** com tudo o que
**Jorge Solla fez pela cidade e por seu recorte regional ao longo da carreira**
(epidemiologista/SESAB, Secretaria Municipal de Saúde de Vitória da Conquista,
Secretaria de Atenção à Saúde do MS, SESAB 2007–2014 e Câmara 2015–2027) — toda
afirmação não trivial com **URL + data**, tudo sem fonte vira **lacuna
explícita** — **e** o **Boletim Informativo modelo** (1 página A4, linguagem de
eleitor, sem declaração de fontes). Os dois layouts vêm dos artefatos hi-fi
aprovados pelo `designer`.

## Quando usar

- A comunicação pede "o dossiê de <cidade>" e/ou o "boletim modelo de <cidade>"
  — ou várias numa invocação (`/dossie-solla-cidade Ilheus, Itacare, Una`).
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

Uma cidade = um dossiê (PDF+MD) + **um** boletim PDF; **sem** índice/PDF
agregado. Falha de uma cidade/era **não** cancela as demais (**sucesso
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
7. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · dossiê/boletim (quando ok) · motivo (quando falha)`.

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
      "summary": "opcional — versão curta, completa e auto-contida do answer, redigida para caber no resumo/boletim (C188)",
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
  `era_a_sas_ms`.
- **B:** `era_b_sesab`, `era_b_equipamentos`, `era_b_programas`, `era_b_obras`.
- **C:** `era_c_discursos`, `era_c_proposicoes`, `era_c_emendas`,
  `era_c_titulos`, `era_c_atuacao`.

Item sem `sourceUrl`/`sourceDate`, item ausente ou item de outra era vira
**lacuna** (`Não pesquisado.` / `Sem fonte: …`); `sphere` inválida vira lacuna
(`Esfera inválida`). `phase` ∈ `autorizado|empenhado|liquidado|pago|restos`
(default `nao_informado`). O `bulletinFacts` (ledger do boletim) só é populado
por item **com fonte** — o boletim não introduz fato novo.

**`summary` (C188):** o resumo de uma olhada e o boletim **nunca cortam texto no
meio**. Essas superfícies imprimem o `summary` do item quando existe; sem ele,
imprimem o `answer` integral e, se a página não couber, o builder re-renderiza
apontando o aprofundamento (as páginas das eras, que sempre guardam
`answer`/`details` integrais) — **sem "…"**. Escreva `summary` curto e
auto-contido para os itens que viram entrega/gancho no resumo; é a única forma de
o texto que você redigiu aparecer no resumo. Listas capadas (entregas, ganchos,
números, itens regionais, fatos do boletim) sempre exibem o contador `e mais N` /
`Mostrando X de Y` — nenhum item some em silêncio. `summary` e `brief` coexistem:
o `brief` é a copy reformulada que o PDF imprime nas páginas de era/cartões; o
`summary` alimenta as superfícies de resumo do dossiê e o ledger do boletim.

**`brief` (copy reformulada, sem reticências).** As páginas A4 têm altura fixa:

**`<slug>.narrative.json` (opcional; escrito pelo redator, auditado pelo
orquestrador):

```jsonc
{
  "municipalitySlug": "ilheus",               // obrigatório
  "generatedAt": "2026-09-18T00:26:19.000Z",  // obrigatório
  "title": "O que Jorge Solla fez por Ilhéus",
  "opening": ["parágrafo", "parágrafo", "parágrafo"],
  "eras": { "A": "parágrafo", "B": "parágrafo", "C": "parágrafo" }
}
```

Sem o arquivo (ou com `municipalitySlug` diferente do snapshot), o builder **não
falha**: a abertura repete a leitura dos números e cada era usa a consolidação
determinística. `opening` e `eras` só podem conter fatos dos itens com fonte —
nenhum número, data, nome ou órgão novo.

`brief` (copy reformulada, sem reticências).** As páginas A4 têm altura fixa:
em vez de cortar o texto com `…`, cada item publicado traz um `brief` **reescrito
para caber** (`title` ≤80 / `note` ≤120) preservando o essencial (o quê, onde,
valor + fase) — nunca inventa fato, nunca sugere exclusividade municipal para
item `regiao`/`polo` e nunca troca a fase (empenho ≠ pagamento). O cartão/linha
do PDF imprime `brief.title`/`brief.note`; o `answer`/`details` integrais ficam
no registro e no companion `.md`. Sem `brief`, o renderer cai no texto integral e
a guarda de fit A4 do builder **falha fechado** (não corta em silêncio). Tabelas
longas (lacunas, notícias) não usam `brief`: são **paginadas** em folhas de
continuação com o texto inteiro.


## Conteúdo do dossiê

- **Capa** — série municipal, "INSUMO INTERNO", território, região/polo adotado,
  data, "como usar", escopo/versão.
- **A contribuição (carta)** — redação de abertura sobre o que Solla fez pela
  cidade e pela região ao longo das eras, em prosa, com a nota "Como ler" (cada
  afirmação tem lastro em item datado; a redação não preenche por inferência).
- **Trajetória completa** — a linha do tempo da carreira.
- **Resumo de uma olhada** — identificação + entregas localizadas (badge de
  esfera + valor + badge de fase + fonte); ganchos; o que falta. Guarda:
  **autorizado ≠ empenhado ≠ liquidado ≠ pago**. É a única página com listas
  capadas — e o "e mais N" aponta para a seção onde a lista completa está.
- **Síntese** — leitura dos números com lastro (pontos por era e esfera,
  concentração relativa, itens com valor por fase, recursos por fase, temas,
  lacunas) + guardas de leitura; nada que não venha dos itens.
- **Gráficos consolidados** — recursos **com execução por ano** (empilhado por
  fase), **propostas/articulações sem fase informada** (lista com barra e valor),
  abrangência (município × região × polo), trajetória por ano, áreas e lacunas
  por era, painel do acervo. Valores sempre em R$ com a fase; recortes nunca
  somados.
- **Seção por era (A/B/C)** — parágrafo de consolidação ("O que esta era
  entrega", do `narrative.json` ou determinístico) + recorte e método + trilha de
  recuperação; tabela **Objeto/Valor/Ano/Fase/Esfera/Fonte**; cards "O que fez —
  item, alcance e lastro"; títulos/honrarias locais. **Sem cap**: a era flui por
  quantas folhas precisar (continuações com cabeçalho "continuação N"). Uma era
  sem evidência é omitida (nunca inventada).
- **Região / polo** — painel "Região não é cidade. Não some os dois recortes."
  com contagem por recorte (**nenhum total combinado**) e prévia; em seguida
  **as duas listas completas** em tabela (item/esfera/evidência/fonte), cada uma
  fluindo por quantas folhas precisar; gancho e lacuna prioritária.
- **Lacunas explícitas**, **Notícias e documentos consultados** e **Acervo
  interno** — tabelas/listas completas, também correntes (sem cap). O acervo é
  **amostra declarada** (as falas mais recentes com link, de N do recorte
  municipal) com painel do total; região/polo não entram nessa conta.
- **Fontes e limites** — limites de cobertura; regras para uso editorial; nota de
  defeso eleitoral 2026.
- **Nada some e nada é cortado:** o dossiê **não usa caps** — o builder mede a
  altura real de cada linha e pagina (grow/shrink) até a página ficar cheia sem
  estourar; listas continuam em folhas de continuação com o texto inteiro. O
  único "e mais N" é o do resumo e o da amostra do acervo, ambos apontando para
  onde o resto está.

## Conteúdo do Boletim modelo (1 página A4)

- Cabeçalho com município + rótulo **"Modelo — insumo interno"**; abertura
  "O que Jorge Solla fez por <cidade>"; **≤6 destaques** (eyebrow "Área ·
  cidade/região", número em destaque, título curto, nota); timeline de 4 passos
  da trajetória; **"E mais" com ≤14 itens** em duas colunas; rodapé com defeso.
- **Sem declaração de fontes** (as fontes vivem exclusivamente no dossiê), sem
  CTA de campanha; herda **apenas** fatos com fonte do dossiê.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem URL+data vira lacuna.
- **Redação e parágrafos com lastro**: a carta e o parágrafo de cada era só usam
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

## Troubleshooting

- **Folha do dossiê estourou**: o builder mede a altura real de cada linha e
  repagina (grow/shrink) até estabilizar; se uma folha continuar estourando, é
  porque **uma linha sozinha** não cabe — aperte a copy daquele item, nunca o
  layout. Página **não-packed** (carta, resumo, síntese, gráficos, fontes)
  estourando = corte copy ou reposicione o card.
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

- Intenção: `docs/plans/dossie-solla-cidade.md`; impl:
  `docs/plans/dossie-solla-cidade-impl.md`.
- Designs hi-fi (fonte de verdade do port): `docs/plans/dossie-solla-cidade-ui-design.html`
  e `docs/plans/dossie-solla-cidade-boletim-ui-design.html` — **desatualizados
  desde a revisão de 2026-09-18** (carta, síntese, gráficos e folhas correntes
  ainda não estão neles); um passe do `designer` precisa re-sincronizá-los.
- Precedente: `.agents/skills/relatorio-cidade/SKILL.md`,
  `.opencode/agent/relatorio-cidade.md`, `scripts/build-city-report.mjs`.
- Scripts: `scripts/build-dossie-solla-cidade.mjs`,
  `scripts/lib/dossiePack.mjs` (packing grow/shrink),
  `scripts/lib/buildPdf.mjs` (probe/medição/emit), `scripts/lib/dossie*.mjs`.
- Bio: `.opencode/skills/solla-comunicacao/referencia/perfil-e-posicoes.md`.
- Runbook de extração read-only: `docs/ops/teqo-1313-deploy.md` §C163.
