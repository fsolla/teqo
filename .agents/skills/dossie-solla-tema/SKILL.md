---
name: dossie-solla-tema
description: 'Gera o dossiê Solla por tema/área (PDF A4 + .md, tudo o que Solla fez pela área por era) e o Boletim Informativo modelo de 1 página, a partir da base Teqo read-only + pesquisa web datada + fontes oficiais; aceita uma área da taxonomia do acervo ou um lote separado por vírgula.'
---

# Dossiê Solla por tema/área + boletim modelo (C190)

Entrega, por **área de política** (as 18 áreas canônicas do acervo — Saúde,
Educação, Cultura, Esporte, …), um **par PDF A4 datado + companion `.md`** com
tudo o que **Jorge Solla fez pela área ao longo da carreira** — toda afirmação
não trivial com **URL + data**, tudo sem fonte vira **lacuna explícita** — **e**
o **Boletim Informativo modelo** (1 página A4, linguagem de eleitor, sem
declaração de fontes). Skill irmã da `dossie-solla-cidade` (C186) e da
`dossie-solla-instituicao` (C187): mesmo pipeline, recorte por área. O layout
vem dos artefatos hi-fi aprovados pelo `designer`.

O recorte da área é **nativo do acervo**: cada fala já é classificada por tema
(`Speech.topics`, taxonomia `SPEECH_TOPICS`, C153/C154), então aqui o acervo é
evidência de primeira classe — não uma ponte nominal. A taxonomia é **fechada**:
token fora dos 18 canônicos **falha fechado**, nunca vira slug inventado.

O dossiê temático **não usa caps**: cada seção (eras, abrangência, lacunas,
notícias, acervo) flui por quantas páginas precisar, com quebra só entre linhas
— o orquestrador não decide o corte, o builder mede e pagina. Sobre essa base
vêm a **redação de abertura** (carta), a **síntese** dos números e os **gráficos
consolidados**, e cada era abre com um **parágrafo de consolidação** do que ela
entrega.

## Quando usar

- A comunicação pede "o dossiê da <área>" e/ou o "boletim modelo da <área>" — ou
  várias numa invocação (`/dossie-solla-tema Educação, Saúde`).
- Quem executa são o **orquestrador** (agente principal) + um sub-agente
  **researcher por era, por área**, em paralelo + um sub-agente **redator** +
  os scripts (`extract` no homeserver, `build` local). O detalhe está em
  "Pipeline (etapas)".

## Lote (várias áreas)

A invocação aceita **uma** área ou **várias**, separadas por **vírgula**:

```text
/dossie-solla-tema Educação                  # N=1
/dossie-solla-tema Educação, Saúde           # lote
```

Parsing (orquestrador, **antes** de qualquer pesquisa):

- separa por `,`; aplica `trim`; descarta vazio;
- cada token é resolvido pela taxonomia canônica do acervo
  (`resolveSpeechTopic` sobre `SPEECH_TOPICS`): aceita o **valor** (`educacao`)
  ou o **label pt-BR** (`Educação`), fold acento/caixa-insensível;
- **0 entradas** = token desconhecido; o token **falha fechado** listando as 18
  áreas canônicas e **nunca** inventa slug (a taxonomia é fechada — não há
  escape one-off);
- **dedupe após a resolução**, preservando a ordem;
- token inválido vira **falha isolada** com o motivo no summary final —
  **nunca** aborta o lote.

Uma área = um dossiê (PDF+MD) + **um** boletim PDF; **sem** índice/PDF agregado.
Falha de uma área/era **não** cancela as demais (**sucesso parcial** explícito).

## Pipeline (etapas)

1. **Orquestrador (agente principal).** Parseia a lista (seção "Lote"), resolve
   os tokens na taxonomia (`resolveSpeechTopic` de `src/lib/speechFacets.ts`) e
   dispara **um researcher por era (A/B/C), por área** (Task), em paralelo, com
   guarda de concorrência (`MAX_RESEARCHERS_IN_FLIGHT = 6`). Não invente slug:
   token fora dos 18 falha fechado. Nunca retém pesquisa web nem o corpo de um
   `research.json` — só os recibos.
2. **Researcher (sub-agente, ×3 por área, em paralelo).**
   `.opencode/agent/dossie-solla-tema.md` — o **único** passo pesado de
   contexto. Faz a pesquisa web datada da sua era e escreve
   `data/dossie-solla-tema/<slug>.<era>.research.json` (cada item com
   `sourceUrl` + `sourceDate`; sem fonte, **não escreva o item** — ele vira
   lacuna). Devolve **apenas o recibo curto** (seção "Recibo do researcher").
   Não roda ssh nem build.
3. **Redação (sub-agente, 1 por área).**
   `.opencode/agent/dossie-solla-tema-redacao.md` — depois das eras
   pesquisadas, escreve `data/dossie-solla-tema/<slug>.narrative.json` (redação
   de abertura + 1 parágrafo por era) **somente** a partir dos itens com fonte;
   devolve só o recibo (seção "Recibo do redator"). O orquestrador **audita
   citações** (nome, data, valor, órgão) contra os `research.json` e corrige ou
   descarta o trecho sem lastro — nunca aceita fato novo. Sem o arquivo, o
   builder cai na consolidação determinística dos números.
4. **Extração read-only no homeserver — serializada, 1 área por vez.**
   `scripts/extract-theme-snapshot.mjs` (`THEME_REPORT_CONFIRM=1`, sessão
   read-only) lê o acervo interno de falas **pelo tema direto**
   (`Speech.topics = valor canônico`; o acervo cobre 2011+) e grava
   `data/dossie-solla-tema/<slug>.theme.snapshot.json`.
5. **Fontes oficiais em tempo de build.** O Portal da Transparência e a Câmara
   **não filtram por área**; emendas/proposições/relatorias por área entram como
   **itens de pesquisa** (com fase e fonte). Sem atribuição → lacuna, **nunca
   zero silencioso** nem inferência por palavra-chave na ementa. O builder
   **não** busca emendas/Câmara/IBGE nem dados de saúde.
6. **Render local (por área):**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-tema.mjs \
     --snapshot=data/dossie-solla-tema/<slug>.theme.snapshot.json \
     --research-dir=data/dossie-solla-tema \
     --out-dir=docs/research/dossie-solla-tema
   ```
   O builder pagina por medição (`scripts/lib/dossiePack.mjs`): render de prova
   → pack → **grow/shrink medido** por folha até estabilizar (nada de página
   pela metade, nada cortado), e só então emite o PDF com a guarda de A4.
   Saídas: `docs/research/dossie-solla-tema/<slug>-<YYYY-MM-DD>-dossie.pdf`
   + `-dossie.md` + `-boletim.pdf`. Intermediários gitignored em
   `data/dossie-solla-tema/` (HTML, JSONs, logs). Flags úteis:
   `--generated-at=<ISO>`, `DOSSIER_STRICT=1` (falha o run se houver lacuna —
   conferência, não entrega).
7. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · dossiê/boletim (quando ok) · motivo (quando falha)`.

## Briefing por era (A/B/C)

O researcher recebe **uma era** e usa o checklist da era (ver "Contrato dos
JSONs"). As eras são as mesmas da C186 (não criar eras novas):

- **Era A (até 2006)** — formação/residência/pesquisa na área; SESAB;
  consultoria no MS; gestão municipal; Secretaria de Atenção à Saúde do MS;
  atuação documentada na área (pesquisa, conselho, docência). O acervo interno
  de falas cobre 2011+: **pré-2011 é lacuna explícita**, não invenção.
- **Era B (2007–2014)** — gestão da SESAB com a área; políticas/programas
  estaduais; investimentos/equipamentos; convênios/termos; articulação regional
  e setorial. Fontes: DOE-BA (DOOL), SESAB, Transparência Bahia, SIOPS/DATASUS.
- **Era C (2015–2027)** — pronunciamentos; proposições; relatorias; emendas;
  programas federais; audiências; títulos/honrarias. Fontes: API Câmara (deputy
  id `178857`; `/discursos` **default 7 dias** — sempre passe a janela;
  relatorias saem das tramitações), Portal da Transparência, Siga Brasil.

Templates de busca: `"Jorge Solla" <área>` + `<tema>`; recorte por data
`after:YYYY-MM-DD before:YYYY-MM-DD`; `site:` por fonte oficial/setorial
(camara.leg.br, saude.ba.gov.br, educacao.ba.gov.br, inep.gov.br, ptbahia.org.br,
jorgesolla.com.br); excluir ruído de campanha 2026 (`-eleição -candidato -voto
-coligação -pesquisa`) e preferir verbos de entrega (emenda, recurso, convênio,
programa, projeto, relatoria, audiência, homenagem, repassado).

## Recibo do researcher

O sub-agente devolve **só** este recibo curto (≤ ~15 linhas) — **nunca** o corpo
do `research.json` (`items[].answer/details`):

```jsonc
{
  "slug": "educacao",
  "era": "C",
  "status": "ok",              // ou "failed"
  "researchPath": "data/dossie-solla-tema/educacao.c.research.json",
  "researchedAt": "2026-09-18T10:00:00.000Z",
  "itemCount": 5,              // itens da era com fonte
  "gapCount": 2,               // == gaps.length
  "newsCount": 3,
  "gaps": ["era_c_relatorias", "…"],
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
  "slug": "educacao",
  "status": "ok",              // ou "failed"
  "narrativePath": "data/dossie-solla-tema/educacao.narrative.json",
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
  "themeSlug": "educacao",                    // obrigatório
  "era": "C",                                 // obrigatório: A | B | C
  "researchedAt": "2026-09-18T10:00:00.000Z", // obrigatório
  "items": [
    {
      "id": "era_c_emendas",                  // id do checklist da era
      "answer": "R$ 5,0 milhões para a rede de ensino",
      "summary": "opcional — versão curta, completa e auto-contida do answer, redigida para caber no resumo/boletim (C188)",
      "details": "opcional; aceita {{fonte}} / {{fonte:N}}",
      "brief": {                               // obrigatório no item publicado: copy reformulada, curta
        "title": "≤80 chars — manchete (o quê + onde)",
        "note": "≤120 chars — 1 frase de contexto; opcional"
      },
      "sphere": "area",                        // area | segmento | rede (default area)
      "numbers": [                             // opcional
        { "label": "Emenda", "value": "R$ 5,0 mi", "year": "2024", "phase": "empenhado" }
      ],
      "sourceUrl": "https://…",                // obrigatório no item publicado
      "sourceDate": "2026-09-15",              // obrigatório
      "extraSources": [{ "label": "…", "url": "https://…", "date": "2026-09-01" }],
      "consultedAt": "2026-09-18T09:00:00.000Z"
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
  `era_a_sas_ms`, `era_a_vinculo`.
- **B:** `era_b_sesab`, `era_b_politicas`, `era_b_investimentos`,
  `era_b_convenios`, `era_b_articulacao`.
- **C:** `era_c_discursos`, `era_c_proposicoes`, `era_c_relatorias`,
  `era_c_emendas`, `era_c_programas`, `era_c_audiencias`, `era_c_titulos`.

A **abrangência** (`sphere`) é `area` | `segmento` | `rede`; `segmento` e `rede`
não são a área e **nunca são somados** a ela (cada linha informa sua
abrangência). Item sem `sourceUrl`/`sourceDate`, item ausente ou item de outra
era vira **lacuna** (`Não pesquisado.` / `Sem fonte: …`); abrangência inválida
vira lacuna. `phase` ∈ `autorizado|empenhado|liquidado|pago|restos` (default
`nao_informado`; empenho **não** é pagamento). O `bulletinFacts` (ledger do
boletim) só é populado por item **com fonte** — o boletim não introduz fato novo.

**`brief` (copy reformulada, sem reticências) e `summary` (C188).** As páginas
A4 têm altura fixa: o `brief` é a copy que o PDF imprime nas páginas de era, nas
listas de abrangência e nos cartões do boletim (o `answer`/`details` integrais
ficam no `.md` e no lastro); sem ele o builder imprime o texto integral e a
página pode estourar. Escreva `brief.title` ≤ 80 e `brief.note` ≤ 120 chars para
**todo item publicado**; o `summary` alimenta as superfícies de resumo. O
boletim de uma página **mede e reduz por medição**: o painel do acervo (falas
com link) entra no contador "e mais N fatos com fonte", nunca nos destaques; se
ainda não couber, o builder re-renderiza com menos fatos impressos e declara o
resto — sem truncar texto e sem descarte silencioso.

`<slug>.narrative.json` (opcional; escrito pelo redator, auditado pelo
orquestrador):

```jsonc
{
  "themeSlug": "educacao",                    // obrigatório
  "generatedAt": "2026-09-18T00:26:19.000Z",  // obrigatório
  "title": "O que Jorge Solla fez pela Educação",
  "opening": ["parágrafo", "parágrafo", "parágrafo"],
  "eras": { "A": "parágrafo", "B": "parágrafo", "C": "parágrafo" }
}
```

Sem o arquivo (ou com `themeSlug` diferente do snapshot), o builder **não
falha**: a abertura repete a leitura dos números e cada era usa a consolidação
determinística. `opening` e `eras` só podem conter fatos dos itens com fonte —
nenhum número, data, nome ou órgão novo.

## Conteúdo do dossiê

- **Capa** — série temática, "INSUMO INTERNO — defeso 2026", identificação da
  área (label `Educação` + valor canônico `educacao` + nota da taxonomia), data,
  "como usar", escopo/versão.
- **A contribuição (carta)** — redação de abertura sobre o que Solla fez pela
  área ao longo das eras, em prosa, com a nota "Como ler" (cada afirmação tem
  lastro em item datado; a redação não preenche por inferência).
- **Resumo de uma olhada** — identificação (área/token/origem/filtro) + linha do
  tempo documentada do vínculo; principais entregas localizadas (badge de
  abrangência + valor + badge de fase + fonte); gancho para a agenda; o que
  falta. Guarda: **autorizado ≠ empenhado ≠ liquidado ≠ pago**. É a única página
  com listas capadas — e o "e mais N" aponta para a seção onde a lista completa
  está.
- **Síntese** — leitura dos números com lastro (pontos por era e abrangência,
  concentração relativa, itens com valor por fase, recursos por fase, temas,
  lacunas) + guardas de leitura; nada que não venha dos itens.
- **Gráficos consolidados** — recursos **com execução por ano** (empilhado por
  fase), **propostas/articulações sem fase informada**, abrangência, trajetória
  por ano, áreas e lacunas por era, painel do acervo. Valores sempre em R$ com a
  fase; recortes nunca somados.
- **Seção por era (A/B/C)** — parágrafo de consolidação ("O que esta era
  entrega") + recorte e método + trilha de recuperação; tabela
  **Objeto/Valor/Ano/Fase/Abrangência/Fonte**; cards "Papéis e iniciativas com
  evidência visível". **Sem cap**: a era flui por quantas folhas precisar
  (continuações com cabeçalho "continuação N"). Uma era **sem evidência** vira
  **página de lacuna explícita** (nunca seção em branco nem "zero").
- **Abrangência: área × segmento × rede** — painel "Segmento/rede não é a área.
  Não some os recortes." com contagem por recorte (**nenhum total combinado**) e
  prévia; em seguida **as três listas completas** em tabela
  (item/abrangência/evidência/fonte), cada uma fluindo por quantas folhas
  precisar; gancho e lacuna prioritária.
- **Lacunas explícitas**, **Notícias e documentos consultados** e **Acervo
  interno por tema** — tabelas/listas completas, também correntes (sem cap). O
  acervo é **amostra declarada** (as falas mais recentes com link, de N do
  recorte `Speech.topics = <valor>`) com painel do total e do universo.
- **Fontes e limites** — limites de cobertura; regras para uso editorial; nota de
  defeso eleitoral 2026.
- **Nada some e nada é cortado:** o dossiê temático **não usa caps** — o builder
  mede a altura real de cada linha e pagina (grow/shrink) até a página ficar
  cheia sem estourar; listas continuam em folhas de continuação com o texto
  inteiro. O único "e mais N" é o do resumo e o da amostra do acervo, ambos
  apontando para onde o resto está.

## Conteúdo do Boletim modelo (1 página A4)

- Cabeçalho com o nome da área + identity pills + rótulo **"Modelo — insumo
  interno"**; faixa de **defeso** ("sem CTA · sem propaganda"); abertura "O que
  Jorge Solla fez na área de <área>"; **≤6 destaques** (eyebrow "Área ·
  abrangência", número em destaque, título curto, nota); timeline de 4 passos da
  trajetória; **"E mais" com ≤14 itens** em duas colunas; rodapé com controle
  editorial e defeso. Com **poucos fatos**, usa a variação de lacuna (não cria
  cards vazios para chegar a seis). O painel do acervo **não ocupa vaga de
  destaque**: entra no contador "e mais N fatos com fonte"; se os fatos
  impressos ainda estourarem a folha, o builder mede e reduz o conjunto
  impresso até caber, declarando o resto — nunca corta texto.
- **Sem declaração de fontes** (as fontes vivem exclusivamente no dossiê), sem
  CTA de campanha; herda **apenas** fatos com fonte do dossiê.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem URL+data vira lacuna.
- **Redação e parágrafos com lastro**: a carta e o parágrafo de cada era só usam
  fatos dos itens com fonte; o orquestrador audita citação por citação (nome,
  data, valor, órgão) e remove o que não tiver lastro.
- **Empenho ≠ pagamento**: cada valor acompanha sua fase; nunca consolidar.
- **Abrangência explícita** (`área`/`segmento`/`rede`): segmento e rede
  **nunca** são somados como se fossem a área.
- **Atribuição temática só com fonte**: emenda/proposição/relatoria por área não
  é filtrada pelo Portal/Câmara; sem fonte que a ligue à área → lacuna (nunca
  zero silencioso nem match por palavra-chave).
- **Taxonomia fechada**: token fora dos 18 `SPEECH_TOPICS` falha fechado —
  nunca slug inventado.
- **Dossiê sem caps**: o conteúdo flui por quantas páginas precisar; a página é
  preenchida por medição (grow/shrink), nunca por corte de texto.
- **Leitura relativa**: nunca % estadual absoluto.
- **Lacuna explícita** em vez de inferência; o acervo interno cobre 2011+.
- **PII mínima**: telefone/e-mail nunca entram.
- **Falha isolada** por era/área não cancela o lote (**sucesso parcial**).
- **Artefato gitignored** (repo público): PDF/MD/JSON nunca são commitados.
- **Defeso**: dossiê e boletim saem como insumo interno/modelo, sem CTA; a peça
  final publicável é da comunicação/campanha. **Sem schema/migration/DB write.**

## Troubleshooting

- **Folha do dossiê estourou**: o builder mede a altura real de cada linha e
  repagina (grow/shrink) até estabilizar; se uma folha continuar estourando, é
  porque **uma linha sozinha** não cabe — aperte a copy/caps daquele item, nunca
  o layout. Página **não-packed** (carta, resumo, síntese, gráficos, fontes)
  estourando = corte copy ou reposicione o card.
- **Página pela metade**: o pack estabilizou? Confira o log (`pack estável`); se
  uma seção ficou rala, o problema é o custo medido (bloco novo) — não force
  cap, ajuste a copy do item que abre a seção.
- **Era sem pesquisa**: o builder sintetiza o arquivo da era com lacunas
  explícitas — e a era sai como página de lacuna, não inventada.
- **Sem redação (`narrative.json`)**: a abertura repete a leitura dos números e
  as eras usam a consolidação determinística; não é falha, é degradação.
  `themeSlug` diferente do snapshot = erro (regenere).
- **Token desconhecido no lote**: vira linha `failed` no summary com a lista das
  18 áreas canônicas; não há escape — a taxonomia é fechada.
- **Slug de pesquisa ≠ snapshot**: o builder recusa o par — regenere, nunca
  edite o JSON à mão para casar.
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.

## Referências

- Intenção: `docs/plans/dossie-solla-tema.md`; impl:
  `docs/plans/dossie-solla-tema-impl.md`.
- Designs hi-fi (fonte de verdade do port):
  `docs/plans/dossie-solla-tema-ui-design.html` e
  `docs/plans/dossie-solla-tema-boletim-ui-design.html` — variantes da família
  C187; um passe do `designer` os mantém sincronizados com a revisão corrente.
- Skills irmãs: `.agents/skills/dossie-solla-cidade/SKILL.md` (dona do pipeline)
  e `.agents/skills/dossie-solla-instituicao/SKILL.md` (segundo recorte).
- Scripts: `scripts/build-dossie-solla-tema.mjs`,
  `scripts/extract-theme-snapshot.mjs`, `scripts/themeSnapshot.mjs`,
  `scripts/lib/dossiePack.mjs` (packing grow/shrink),
  `scripts/lib/buildPdf.mjs` (probe/medição/emit),
  `scripts/lib/dossie*.mjs`, `scripts/lib/readOnlyExtract.mjs`.
- Taxonomia/recorte: `src/lib/speechFacets.ts` (`SPEECH_TOPICS`,
  `resolveSpeechTopic`), `src/utilities/speech/speechListFilters.ts` (`topics`).
- Runbook de extração read-only: `docs/ops/teqo-1313-deploy.md` §C163.
