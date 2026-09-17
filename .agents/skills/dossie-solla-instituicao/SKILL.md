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
institucional. Os dois layouts vêm dos artefatos hi-fi aprovados pelo `designer`.

## Quando usar

- A comunicação pede "o dossiê da <instituição>" e/ou o "boletim modelo da
  <instituição>" — ou várias numa invocação (`/dossie-solla-instituicao UFBA,
  Correios`).
- Quem executa são o **orquestrador** (agente principal) + um sub-agente
  **researcher por era, por instituição**, em paralelo + os scripts (`extract` no
  homeserver, `build` local). O detalhe está em "Pipeline (etapas)".

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
3. **Extração read-only no homeserver — serializada, 1 instituição por vez.**
   `scripts/extract-institution-snapshot.mjs` (`INSTITUTION_REPORT_CONFIRM=1`,
   sessão read-only) lê o acervo interno de falas por **tema→instituição**
   (`topics` da entrada do catálogo; o acervo cobre 2011+ e não tem campo
   instituição) e grava
   `data/dossie-solla-instituicao/<slug>.institution.snapshot.json`.
4. **Fontes oficiais em tempo de build.** O Portal da Transparência **não filtra
   por instituição** e a Câmara tampouco; emendas/proposições institucionais
   entram como **itens de pesquisa** (com fase e fonte). Sem atribuição → lacuna,
   **nunca zero silencioso**. O builder **não** busca emendas/Câmara/IBGE.
5. **Render local (por instituição):**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-dossie-solla-instituicao.mjs \
     --snapshot=data/dossie-solla-instituicao/<slug>.institution.snapshot.json \
     --research-dir=data/dossie-solla-instituicao \
     --out-dir=docs/research/dossie-solla-instituicao
   ```
   Saídas: `docs/research/dossie-solla-instituicao/<slug>-<YYYY-MM-DD>-dossie.pdf`
   + `-dossie.md` + `-boletim.pdf`. Intermediários gitignored em
   `data/dossie-solla-instituicao/` (HTML, JSONs, logs). Flags úteis:
   `--generated-at=<ISO>`, `DOSSIER_STRICT=1` (falha o run se houver lacuna —
   conferência, não entrega).
6. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
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
  `era_a_sas_ms`, `era_a_vinculo`.
- **B:** `era_b_sesab`, `era_b_equipamentos`, `era_b_programas`, `era_b_obras`,
  `era_b_convenios`.
- **C:** `era_c_discursos`, `era_c_proposicoes`, `era_c_emendas`,
  `era_c_titulos`, `era_c_atuacao`, `era_c_parcerias`.

A **abrangência** (`sphere`) é `instituicao` | `setor` | `rede`; `setor` e `rede`
não são a instituição e **nunca são somados** a ela (cada linha informa sua
abrangência). Item sem `sourceUrl`/`sourceDate`, item ausente ou item de outra
era vira **lacuna** (`Não pesquisado.` / `Sem fonte: …`); abrangência inválida
vira lacuna. `phase` ∈ `autorizado|empenhado|liquidado|pago|restos` (default
`nao_informado`; empenho **não** é pagamento). O `bulletinFacts` (ledger do
boletim) só é populado por item **com fonte** — o boletim não introduz fato novo.

## Conteúdo do dossiê

- **Capa** — série institucional, "INSUMO INTERNO — defeso 2026", identificação
  (tipo/esfera/alcance em badges), data, "como usar", escopo/versão.
- **Resumo de uma olhada** — identificação + linha do tempo documentada do
  vínculo; principais entregas localizadas (badge de abrangência + valor + badge
  de fase + fonte); gancho para a agenda; o que falta. Guarda: **autorizado ≠
  empenhado ≠ liquidado ≠ pago**.
- **Seção por era (A/B/C)** — recorte e método + trilha de recuperação; tabela
  **Objeto/Valor/Ano/Fase/Abrangência/Fonte**; cards "Papéis com evidência";
  títulos/honrarias. Uma era **sem evidência** vira **página de lacuna
  explícita** (nunca seção em branco nem "zero").
- **Abrangência: instituição × setor × rede** — painel "Setor/rede não é a
  instituição. Não some os recortes."; três listas com contagem por recorte
  (**nenhum total combinado**); tabela de evidência de alcance; gancho e lacuna
  prioritária.
- **Títulos, honrarias e vínculos** — tabela reconhecimento/natureza/fonte.
- **Fontes e limites** — tabela de lacunas; notícias/documentos consultados
  (larguras fixas 12/13/47/28%); limites de cobertura; regras para uso editorial;
  nota de defeso eleitoral 2026.
- **Nada some por não caber:** listas capadas declaram o resto ("e mais N") e a
  reformulação fica no `summary` do researcher — nunca "…" silencioso (regra
  C188 aplicada no dono).

## Conteúdo do Boletim modelo (1 página A4)

- Cabeçalho com o nome da instituição + identity pills + rótulo **"Modelo —
  insumo interno"**; faixa de **defeso** ("sem CTA · sem propaganda"); abertura
  "O que Jorge Solla fez pela e na <instituição>"; **≤6 destaques** (eyebrow
  "Área · abrangência", número em destaque, título curto, nota); timeline de 4
  passos da trajetória; **"E mais" com ≤14 itens** em duas colunas; rodapé com
  controle editorial e defeso. Com **poucos fatos**, usa a variação de lacuna
  (não cria cards vazios para chegar a seis).
- **Sem declaração de fontes** (as fontes vivem exclusivamente no dossiê), sem
  CTA de campanha; herda **apenas** fatos com fonte do dossiê.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem URL+data vira lacuna.
- **Empenho ≠ pagamento**: cada valor acompanha sua fase; nunca consolidar.
- **Abrangência explícita** (`instituição`/`setor`/`rede`): setor e rede
  **nunca** são somados como se fossem a instituição.
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

- **Página do dossiê / boletim estourou**: o builder aborta com a altura medida.
  **Aperte o teto de conteúdo/corte copy — nunca mexa no layout para espremer.**
- **Era sem pesquisa**: o builder sintetiza o arquivo da era com lacunas
  explícitas — e a era sai como página de lacuna, não inventada.
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
- Designs hi-fi (fonte de verdade do port):
  `docs/plans/dossie-solla-instituicao-ui-design.html` e
  `docs/plans/dossie-solla-instituicao-boletim-ui-design.html`.
- Skill irmã (dona do pipeline): `.agents/skills/dossie-solla-cidade/SKILL.md`.
- Scripts: `scripts/build-dossie-solla-instituicao.mjs`,
  `scripts/extract-institution-snapshot.mjs`, `scripts/institutionSnapshot.mjs`,
  `scripts/lib/dossie*.mjs`, `scripts/lib/buildPdf.mjs`,
  `scripts/lib/readOnlyExtract.mjs`.
- Catálogo: `src/lib/institutionCatalog.ts`, `src/lib/institutionNameAliases.ts`.
- Runbook de extração read-only: `docs/ops/teqo-1313-deploy.md` §C163.
