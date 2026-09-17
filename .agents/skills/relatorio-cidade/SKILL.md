---
name: relatorio-cidade
description: 'Gera o relatório de cidade pré-viagem (PDF A4 + .md) a partir da base Teqo read-only + pesquisa web datada + emendas oficiais; aceita um município ou um lote separado por vírgula.'
---

# Relatório de cidade pré-viagem (C163)

Entrega um **PDF A4 datado + companion `.md`** por município, cruzando a base de
produção do Teqo (**read-only**, snapshot do momento) com pesquisa web (data +
URL por item) e emendas lidas da fonte oficial **em tempo de geração**. Página 1
= resumo de uma olhada; páginas 2+ = aprofundamento; tudo sem fonte vira
**lacuna explícita** — nunca inferência.

## Quando usar

- O candidato/CG pede "o relatório de <cidade>" antes de uma viagem — ou de
  várias numa invocação (`/relatorio-cidade Ilheus, Itacare, Una`).
- Quem executa são o **orquestrador** (agente principal) + um sub-agente
  **researcher** por cidade + os dois scripts (`extract` no homeserver, `build`
  local). O PDF sai para leitura de bolso; o detalhe das etapas está em
  "Pipeline (etapas)".

## Lote (várias cidades)

A invocação aceita **um** município (caso de sempre) ou **vários**, separados por
**vírgula** — a lista é o argumento, não um novo comando:

```text
/relatorio-cidade Feira de Santana          # N=1 — caminho atual, sem regressão
/relatorio-cidade Ilheus, Itacare, Una      # lote
```

Parsing (orquestrador, **antes** de qualquer pesquisa):

- separa por `,`; aplica `trim`; descarta vazio;
- cada token é aceito como **slug canônico** (`isMunicipalitySlug`) **ou** como
  **nome** (fold acento-insensível `resolveMunicipalityName`; `null` = nome
  desconhecido → token inválido) → `municipalityCatalogEntriesForCity`;
- **0 entradas** = token inválido; **>1 entrada** = ambíguo (ex.: `Salvador`
  resolve para 19 zonas `salvador-ze-N` — peça o slug da zona explícito);
- **dedupe após a resolução**, preservando a ordem — duas grafias do mesmo
  município (`Ilheus, ilheus`) geram **um** artefato, não dois;
- token inválido/ambíguo vira **falha isolada** com o motivo no summary final —
  **nunca** aborta o lote nem inventa slug.

Uma cidade = um par PDF+MD (`<slug>-<YYYY-MM-DD>`); **sem** índice/PDF agregado.

## Pipeline (etapas)

1. **Orquestrador (agente principal).** Parseia a lista (seção "Lote"), resolve os
   slugs no catálogo (`src/lib/municipalityCatalog.ts`, 435 unidades; Salvador =
   `salvador-ze-N`) e dispara **um researcher por cidade em paralelo** (Task).
   Não invente slug: confirme no catálogo (`pnpm exec tsx -e` ou a lista em
   `/campanha/municipios`). Nunca retém pesquisa web nem o corpo de um
   `research.json` — só os recibos.
2. **Researcher (sub-agente, ×N, em paralelo).** `.opencode/agent/relatorio-cidade.md`
   — o **único** passo pesado de contexto. Faz a pesquisa web datada e escreve
   `data/relatorios-cidade/<slug>.research.json`: cada item do checklist com
   `sourceUrl` + `sourceDate`; sem fonte, **não escreva o item** (ele vira
   lacuna). Notícias: janela ≤90 dias. Devolve **apenas o recibo curto** (seção
   "Recibo do researcher") — nunca o corpo. Não roda ssh nem build.
3. **Extração read-only no homeserver — serializada.** Um município por vez: o
   checkout `~/teqo-report` é compartilhado e ssh concorrente colide. Receita
   completa no runbook
   `docs/ops/teqo-1313-deploy.md` §"C163 — relatório de cidade":
   ```bash
   ssh homeserver
   source ~/.nvm/nvm.sh
   cd ~/teqo-report && git fetch origin main && git checkout main && git pull --ff-only
   [ -d node_modules/tsx ] || pnpm install --prod=false
   set -a; source ~/stack/teqo-1313.env; set +a
   export DATABASE_URL="${DATABASE_URL/@postgres:5432/@127.0.0.1:5433}"
   export CITY_REPORT_CONFIRM=1
   NODE_OPTIONS="--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs" \
     node scripts/extract-city-report-snapshot.mjs \
       --municipality=<slug> --out=data/relatorios-cidade/<slug>.snapshot.json
   ```
   Depois `scp homeserver:~/teqo-report/data/relatorios-cidade/<slug>.snapshot.json data/relatorios-cidade/`.
   Crie `data/relatorios-cidade/logs/` e redirecione a saída para
   `logs/<slug>.extract.log 2>&1`; retenha só o status + o caminho — o log não
   entra no contexto do orquestrador.
   O `~/teqo-report` é checkout de **scratch** — não use `~/teqo-deploy` (deploy
   em andamento no mesmo host). O SHA do extrator e do builder devem ser o mesmo.
4. **Render local (por cidade):**
   ```bash
   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-city-report.mjs \
     --snapshot=data/relatorios-cidade/<slug>.snapshot.json \
     --research=data/relatorios-cidade/<slug>.research.json \
     --out-dir=docs/research/relatorios-cidade
   ```
   Saídas: `docs/research/relatorios-cidade/<slug>-<YYYY-MM-DD>.pdf` + `.md`
   (companion revisável em diff). Intermediários gitignored em
   `data/relatorios-cidade/` (HTML, JSONs de emendas, `logs/`). Também
   redirecione a saída do builder para `logs/<slug>.build.log`.
   Flags úteis: `--emendas=<json>` (replay sem rede), `--author=<nome>`
   (default `JORGE SOLLA`), `--generated-at=<ISO>` (reprodutibilidade),
   `CITY_REPORT_STRICT=1` (falha o run se houver lacuna de pesquisa — para
   conferência, não para entrega).
5. **Summary final.** Uma linha por entrada, na ordem da lista: `entrada · status
   (ok|failed) · PDF/MD (quando ok) · motivo (quando falha)` — `entrada` é o slug
   resolvido ou, quando o token falha antes de resolver, o próprio token cru.
   Falha de uma cidade **não** cancela as demais (sucesso parcial explícito); a
   cidade que falha é pulada nas etapas seguintes.

## Recibo do researcher

O sub-agente por cidade devolve **só** este recibo curto (≤ ~15 linhas) — **nunca**
o corpo do `research.json` (`items[].answer/details`, `news[].summary`,
`approach`, `leaders`, …):

```jsonc
{
  "slug": "ilheus",
  "status": "ok",              // ou "failed"
  "researchPath": "data/relatorios-cidade/ilheus.research.json",
  "researchedAt": "2026-09-16T10:00:00.000Z",
  "itemCount": 6,              // itens do checklist com fonte
  "gapCount": 3,               // == gaps.length (checklist + blocos de pesquisa)
  "gaps": ["prefeito", "vice", "disputa_local"],
  "newsCount90d": 4,           // notícias na janela ≤90 dias
  "weakSourceCount": 1,        // item cujo único apoio é fonte de região/polo
  "failureReason": "…"         // opcional (só quando status = failed)
}
```

`itemCount` + `gapCount` cobrem o checklist fixo; `gapCount` conta também os
blocos de pesquisa sem fonte. `status: "failed"` carrega o motivo e **não** escreve
corpo parcial. O orquestrador agrega os recibos no summary final — é o único dado
de pesquisa que cruza para ele.

## Contrato dos JSONs

`research.json`:

```jsonc
{
  "municipalitySlug": "feira-de-santana",       // tem de bater com o snapshot
  "researchedAt": "2026-09-15T10:00:00.000Z",   // obrigatório
  "items": [
    {
      "id": "prefeito",             // id do checklist (abaixo)
      "answer": "Nome (Partido), situação",
      "details": "opcional",
      "sourceUrl": "https://…",     // obrigatório em item publicado
      "sourceDate": "2026-09-10",   // obrigatório
      "extraSources": [             // opcional; cada uma exige url+date
        { "label": "Polo regional", "url": "https://…", "date": "2026-09-01" }
      ],
      "consultedAt": "2026-09-15T09:00:00.000Z" // opcional
    }
  ],
  "news": [
    {
      "title": "…", "outlet": "…",
      "publishedAt": "2026-09-01T00:00:00.000Z", // janela ≤90 dias do researchedAt
      "url": "https://…", "summary": "…"
    }
  ],
  "approach": [                    // sugestões das personas; tema+texto+fonte
    {
      "persona": "Ciência política",   // ou "Coordenação de campanha"
      "topic": "Saúde regional (polo)",
      "suggestion": "…",
      "sourceUrl": "https://…", "sourceDate": "2026-04-07"
    }
  ],
  "preCandidates": [               // prováveis candidatos do campo do prefeito em 2026
    {
      "name": "…", "office": "Deputado federal", "party": "PSDB",
      "support": "Campo do prefeito …",
      "sourceUrl": "https://…", "sourceDate": "2026-04-18"
    }
  ],
  "leaders": [                     // últimos prefeitos/vices, vereadores mais votados
    {
      "name": "…", "role": "Ex-prefeito", "party": "PSDB", "period": "2017–2024",
      "sourceUrl": "https://…", "sourceDate": "2024-08-14"
    }
  ],
  "leaderAgenda": [                // pauta provável por liderança (rede + mesmo campo)
    {
      "name": "…",
      "field": "Aliado (prefeito) | Aliado (federação PT/PCdoB) | Rede da campanha (base) | …",
      "topics": "Saúde (hospital municipal)",                  // pauta provável (hipótese)
      "hook": "Gancho recente publicado (o que a fonte diz)",  // topics OU hook obrigatório
      "sourceUrl": "https://…", "sourceDate": "2026-08-31"
    }
  ],
  "demography": [                  // cor/raça e poder aquisitivo (Censo 2022)
    {
      "topic": "Cor/raça (Censo 2022)", "detail": "Parda 73,1% …",
      "sourceUrl": "https://sidra.ibge.gov.br/tabela/9605", "sourceDate": "2026-09-15"
    }
  ],
  "economy": [                     // PIB, emprego, atividades (IBGE/RAIS e imprensa)
    { "topic": "PIB e perfil", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "transport": [                   // rodovias, aeroporto, portos, ferrovia
    { "topic": "Rodovia federal (BR-101)", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "opposition": [                  // o que a oposição fez de errado na região (fato com fonte)
    { "topic": "Emenda sob investigação (PF)", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "alliances": [                   // dobradinhas: com quem somar na cidade
    { "topic": "Dobradinha estadual (PT)", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "investments": [                 // investimentos/obras de Solla, do estado e do federal (município e região)
    { "topic": "Obra federal — saúde", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "emendasIndicators": [           // indícios de emenda, um por autor (página 1; esfera explícita)
    {
      "author": "Zé Neto",         // obrigatório
      "sphere": "municipio",       // obrigatório: municipio | regiao | polo
      "value": "R$ 1 mi",          // opcional (como a fonte informa)
      "purpose": "Ambulância do TFD", // opcional (o que beneficia)
      "year": "2026",              // opcional
      "sourceUrl": "https://…", "sourceDate": "2026-08-24"
    }
  ],
  "gaps": [{ "id": "…", "label": "…", "reason": "…" }] // lacunas que o agente já sabe
}
```

Checklist (`id`s): `prefeito`, `vice`, `relacao_campo`, `vereadores`,
`disputa_local`, `quem_investe`, `noticias`, `imprensa_local`, `emendas_web`.
Item sem `sourceUrl`/`sourceDate` é convertido em lacuna pelo validador; item
ausente também. `approach`, `preCandidates`, `leaders`, `leaderAgenda` e
`emendasIndicators` são
listas de pesquisa: cada entrada sem fonte vira lacuna (`abordagem_sem_fonte`,
`precandidato_sem_fonte`, `lideranca_sem_fonte`, `agenda_lideranca_sem_fonte`,
`emenda_indicio_sem_fonte`; `emendasIndicators` ainda exige `author` e `sphere`
— sem eles, `emenda_indicio_incompleto`) e
não entra no PDF. Campos de texto livre (`detail`, `hook`, `suggestion`,
`support`, `answer`) aceitam os **tokens de fonte inline** `{{fonte}}` /
`{{fonte:N}}`, resolvidos para `(fonte)` no ponto exato da citação (ver "Links
clicáveis / fonte inline" adiante).

**`leaderAgenda` — pauta provável das lideranças (rede + mesmo campo):** para
cada liderança que importa na visita, registre o que ela tende a priorizar
(Saúde, Educação, Infraestrutura…) e o **gancho recente publicado** que ancora a
leitura, sempre com URL+data. `name` é obrigatório; exige `topics` **ou** `hook`;
sem fonte, não entra. Priorize (a) a **rede da campanha** (as lideranças na base
Teqo, com `supportStatus`) e (b) o **mesmo campo** de Solla — é onde há margem
de conversa. É **hipótese a validar na conversa, não declaração do líder**: o
bloco "Pauta das lideranças (pesquisa)" (seção 3) sai com essa ressalva. Liderança
de rede **sem rastro público** não vira item: fica como tarefa de ativação
(cadastrar/atualizar `supportStatus`), não como pauta inventada.

**`emendas_web` — indícios de emenda (município, região ou polo):** quando a
fonte oficial não atribui emenda ao município, pesquise artigos, falas e
indicações de emenda para (a) o município, (b) a região/Território de
Identidade e (c) a maior cidade próxima (polo regional — cidades pequenas usam
serviços do polo). Registre a síntese em `emendas_web` (answer/details +
`extraSources`) e, principalmente, **cada indício como uma linha de
`emendasIndicators`** — `author`, `sphere` (`municipio`/`regiao`/`polo`), valor,
finalidade, ano e fonte+data. É essa lista estruturada que a página 1 imprime
(autor — o que beneficia · valor · esfera, com link); o texto corrido só entra
quando não há lista (fallback). Sem uma das linhas com fonte, o indício vira
lacuna (`emenda_indicio_sem_fonte`) — nunca some em silêncio. O PDF mostra o
bloco como "Emendas — indícios web" na página 1 e as URLs na seção de fontes.
**Nunca somar** indício de região/polo como emenda da cidade.

**Demografia, economia e transporte (pesquisa):** `demography`, `economy` e
`transport` são listas de `{topic, detail, sourceUrl, sourceDate}` (sem fonte →
lacuna). Pesquise: **cor/raça e rendimento** (Censo 2022 — SIDRA 9605 e 10295;
IBGE Cidades para salário médio); **economia** (PIB e PIB per capita — IBGE
Cidades; composição setorial e emprego formal — RAIS/CAGED e perfis regionais;
café, pecuária e comércio no caso do Extremo Sul); **transporte** (rodovias
federais/estaduais que cortam o município e obras novas/reformadas — DNIT,
Seinfra; aeroporto mais próximo em operação e o do polo, com situação; portos e
ferrovia da região — FIOL/Porto Sul, deixando claro quando não serve
diretamente a cidade). O enquadramento é "onde falta × onde o estado e a União
têm acertado" — o candidato é da base.

**Frente de oposição (pesquisa):** `opposition` é uma lista de
`{topic, detail, sourceUrl, sourceDate}` (sem fonte → lacuna) com **fatos
publicados e datados sobre o que a oposição fez de errado na região** — PF/MP em
emendas, obras paradas, anúncio sem entrega, escândalos do campo adversário.
Regras: (1) cada linha é fato publicado, **nunca** inferência de culpa — atribua
à fonte ("segundo a PF / o jornal") e diferencie acusação de condenação; (2)
priorize o **local** (operadores da oposição no município/região, ex.: emendas
investigadas) sobre o ataque frontal ao líder estadual; (3) marque temas de
**mão dupla** (casos que também citam o campo da base) para a coordenação não
entrar desprevenida; (4) **não** recomende ataque pessoal nem onde a marca do
adversário domina — o relatório é insumo ancorado, não roteiro de ataque. O item
entra na seção 2 (junto aos concorrentes) e a seção 14 lista as URLs.

**Dobradinhas e investimentos (pesquisa):** `alliances` é a lista de
`{topic, detail, sourceUrl, sourceDate}` com **com quem Solla soma na cidade**
(estadual/federal, chapa e lideranças que transferem voto) — insumo direto da
`approach`, exibido como bloco "Dobradinhas (pesquisa)" na seção 3 (rede).
`investments` lista **investimentos e obras de Solla, do governo do estado e do
federal no município e na região**, com fase/valor quando a fonte informar
(**empenho ≠ pagamento**), exibido como bloco "Investimentos e obras (pesquisa)"
na seção 4 (conjuntura). Sem fonte, cada item vira lacuna; nenhuma das duas
listas é obrigatória.

**Emendas oficiais:** sem `--emendas`, o builder consulta o Portal da
Transparência (`PORTAL_TRANSPARENCIA_API_KEY` no ambiente; sem chave → lacuna).
A API oficial **não filtra por município** (só UF/Nacional/Múltiplo na
`localidadeDoGasto`); o builder casa pela localidade com o nome do município e,
sem linha atribuível, degrada para lacuna (Issue #1025). O resultado fica
cacheado em `data/relatorios-cidade/<base>.emendas.json` para replay.

## Conteúdo do relatório

- **Página 1 (uma olhada):** identificação/prioridade/classe/nível, conta
  eleitoral 2022 (votos, % do próprio voto, rank/435) **+ expectativa de votos
  (cenário central com pessimista/otimista)** — a meta de cadeira e a cobertura
  de pledges **saíram** da página 1; quem é quem (prefeito, vice, relação com o
  campo, lideranças, dobradinhas, vereadores), o que Solla entregou (emendas
  oficiais com fase, acervo de falas, notícias ≤90 dias), **emendas — indícios
  web** quando a fonte oficial não atribui ao município (uma linha por autor:
  o que beneficia · valor · **esfera explícita** `município`/`região`/`polo`, com
  link), **O que anunciar agora** (a relação local com fonte + os compromissos
  que a campanha cumpre) com a advertência de defeso, riscos e pontos sem
  leitura. O painel fixo "O que NÃO anunciar" **saiu** da página 1 (copy
  invariante; o guardrail de defeso permanece na nota do painel de anúncio). Os
  textos livres da pesquisa entram **capados** (teto/orçamento de conteúdo, não
  layout espremido) e as listas mostram `e mais N` — o texto integral de cada
  item fica no aprofundamento (ver "respostas integrais" em `14. Fontes e
  limites`).
- **Seções 2+:** `1. Conta eleitoral` · `2. Concorrentes no município (federal
  e estadual)` — top 5 por votos de 2022 na base TSE, com série 2014/2018/2022
  e os prováveis candidatos do campo do prefeito (pesquisa), além da **frente de
  oposição** quando pesquisada (fatos com fonte) · `3. Rede e
  lideranças` — inclui as lideranças locais pesquisadas (ex-prefeitos/vices,
  vereadores mais votados, com partido) e a **Pauta das lideranças (pesquisa)**:
  pauta provável + gancho recente por liderança da rede/mesmo campo, marcada
  como hipótese · `4. Conjuntura` · `5. Sinais` · `6.
  Demandas e visitas` · `7. Demografia` — IBGE Censo 2022 do artefato +
  **complemento pesquisado** (cor/raça e poder aquisitivo) · `8. Atividade
  econômica (pesquisa)` · `9. Transporte e conexões (pesquisa)` · `10. Acervo
  de falas` — cada fala com "O que é" (sumário oficial) e "Menção ao município"
  (passagem que cita a cidade ou, se o nome não aparece nos trechos, a marcação
  do acervo com o nº de municípios), mais **Vídeo** (YouTube no trecho da fala
  — `youtubeExcerptStartSeconds` = época do trecho (`excerptTMs`) − início da
  sessão, calibrado contra o vídeo real: o da sessão de 13/03/2018 começa ~37s
  depois do `eventStartAt`, então 645s viram `t=608s` (`YOUTUBE_VIDEO_OFFSET_SECONDS`);
  o `speechAt` da API é o horário do slot, não o início real; fallback para o
  VOD da Câmara, que é o clipe do próprio trecho) e **Transcrição** (PDF do
  Diário) quando existirem · `11. Notícias e imprensa` ·
  `12. Panorama regional` · `13. Abordagem sugerida (personas)` · `14. Fontes e
  limites` — lista as fontes e, antes delas, a tabela **"Pesquisa — respostas
  integrais"** com o texto completo de cada item do checklist (o que a página 1
  capou).
- **Acervo por região e tema:** como cidade pequena quase nunca tem fala
  própria, a seção 10 mostra três recortes **não sobrepostos**: falas do
  município (quando existem), **menções à região** (demais municípios do mesmo
  Território de Identidade) e **falas por tema regional** (temas-chave do
  interior). Região/polo **nunca** é somado como fala da cidade — o bloco diz
  isso explicitamente. Fonte: `speeches.region` e `speeches.topics` do snapshot
  (extraídos read-only no homeserver; ausentes nos snapshots antigos → seção
  degrada para a busca por município sem quebrar). **Cada recorte diz por que a
  fala entrou:** a tabela do município mostra "Menção a <cidade>"; a da região
  mostra "Município da região citado"; a de tema mostra a coluna **"Tema"** —
  porque essas falas foram selecionadas por tema, **não** por menção ao
  município/região (não rotular como "marcada com o município" o que só foi
  escolhido por tema).
- **Links clicáveis / fonte inline:** todo URL no PDF é um link (`<a href>`):
  células de tabela, fontes por linha e a seção de fontes. Nos textos de pesquisa
  (oposição, dobradinhas, investimentos, pauta das lideranças, abordagem,
  demografia…), o `(fonte)` com hyperlink entra **inline no próprio texto, logo
  após o trecho que cita o fato verificado** — não numa coluna. Um mesmo texto
  pode citar mais de uma fonte: use `{{fonte}}` para a fonte principal
  (`sourceUrl`) e `{{fonte:2}}`, `{{fonte:3}}`… para cada entrada de
  `extraSources`; o renderer resolve os tokens em `(fonte)` / `(fonte N)` e o
  companion `.md` vira `[(fonte)](url)`. Se o texto não tiver token, o builder
  acrescenta a(s) fonte(s) no fim do trecho. A coluna **Fonte** fica só com a
  data e o link completo continua listado abaixo da tabela (`> Fontes:`).
- **Numeração dinâmica e omissão de seções vazias:** o builder numera as seções
  depois de montá-las (o `id` é estável; o número é posicional). As seções
  **Sinais recentes** e **Demandas e visitas** são **omitidas quando não há
  dado na base** (mostrar um callout de "nada aqui" só gastaria página); as
  seções de pesquisa (`opposition`, `alliances`, `investments`, demografia,
  economia, transporte) mantêm a lacuna explícita quando o item falta. Nunca
  referencie seção por número fixo — use o nome/`id`.
- **Tabela de notícias com larguras fixas:** `Data 9 · Veículo 14 ·
  Título 49 · Link 28` (%). As larguras explícitas tornam a tabela `table-fixed`
  (a URL longa/crua quebra em vez de inflar a coluna) e dão ao **Título** — o
  texto mais longo — a maior fatia. Sem largura, a URL sem espaços domina o
  layout automático e espreme/estoura a tabela.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem data+URL não entra.
- **Empenho ≠ pagamento** (defeso/ano eleitoral): o bloco de emendas mostra a
  fase (empenhada, liquidada, paga, restos) e a advertência de defeso acompanha o
  painel "O que anunciar agora".
- **Leitura relativa**: % do próprio voto, rank, LQ — nunca % estadual absoluto.
- **PII mínima**: contatos completos (telefone/e-mail) nunca entram; nomes de
  lideranças entram porque o produto pede "quem é quem".
- **Completo para o candidato**: estimativas e nível N0–N4 entram no PDF, sem
  marca de restrição; o que não sai é para o palanque.
- **Indício regional não é emenda da cidade**: emendas do município, da região
  ou do polo entram rotuladas na evidência web e **nunca somadas**; a fonte
  oficial ausente continua lacuna explícita.
- **Abordagem é análise ancorada**: as sugestões das personas (governo do PT na
  região, projetos futuros, prioridades locais) saem do `approach` com fonte por
  item — sem fonte, não entra; o PDF deixa claro que é análise, não fato novo.
- **Frente de oposição é fato, não ataque**: `opposition` só recebe fato publicado
  com URL + data; o PDF **não** afirma culpa, **não** infere dolo e **não** orienta
  ataque pessoal. Prioriza o local (operadores na região) sobre o líder estadual e
  sinaliza temas de mão dupla; onde a marca do adversário domina, o insumo é para
  contraste, não para confronto frontal.
- **Falha isolada no lote**: cidade que falha (token inválido/ambíguo, pesquisa
  sem fonte suficiente, snapshot×research mismatch) não cancela as demais; o
  summary final diz explicitamente o que saiu e o que falhou (sucesso parcial
  visível).
- **Artefato gitignored**: o repo é público; o PDF/MD com dado interno nunca é
  commitado (só a skill/scripts/changelog).

## Troubleshooting

- **Página 1 estourou**: o builder aborta com `scrollHeight > útil` e o erro é
  açãoável. A página 1 já aplica tetos de conteúdo aos textos da pesquisa
  (`PAGE_ONE_*_MAX` em `scripts/lib/cityReportBlocks.mjs`) e preserva o texto
  integral no aprofundamento; se ainda estourar, **aperte o teto da pesquisa ou
  corte copy do resumo — nunca mexa no layout para "espremer"**.
- **`tsx` ausente no homeserver**: `pnpm install --prod=false`.
- **API de emendas 429/erro**: o builder degrada para lacuna com URL+motivo;
  reexecute depois (o cache só é escrito com resultado utilizável).
- **Emenda sem atribuição oficial**: é o comportamento esperado (a API não
  expõe o município). Pesquise os indícios web (município/região/polo) no item
  `emendas_web`; sem indício, a lacuna fica explícita — nunca zero silencioso.
- **Chromium**: vem do `@playwright/test`; se faltar binário,
  `pnpm exec playwright install chromium`.
- **Snapshot de outro município**: o builder recusa (`municipalitySlug` ≠
  snapshot) — regenere, nunca edite o JSON à mão para "casar".
- **Token inválido/ambíguo no lote**: vira linha `failed` no summary com o
  motivo; `Salvador` é ambíguo (19 zonas) e exige o slug da zona
  (`salvador-ze-N`) — nunca expanda nem adivinhe.
- **Extração ssh em paralelo**: não faça — o `~/teqo-report` é compartilhado
  (`git fetch/checkout/pull` + `pnpm install`); serialize a extração por cidade.

## Referências

- Intenção: `docs/plans/relatorio-cidade-viagem.md`; impl:
  `docs/plans/relatorio-cidade-viagem-impl.md`.
- Lote + sub-agentes: `docs/plans/ops118-relatorio-cidade-lote-municipios-sub-agentes.md`
  e `-impl.md`.
- Precedente de PDF: `scripts/build-solla-ceuci-salvador-report.mjs` (C157).
- Runbook: `docs/ops/teqo-1313-deploy.md` §C163.
