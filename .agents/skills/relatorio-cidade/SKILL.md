# Skill: relatorio-cidade

# Relatório de cidade — mobilização do 2º turno (C163)

Entrega um **PDF A4 datado + companion `.md`** por município, cruzando a base de
produção do Teqo (**read-only**, snapshot do momento) com pesquisa web (data +
URL por item) e os **números oficiais do 2º turno** do artefato TSE 2026
commitado. Página 1 = resumo de uma olhada (**só mobilização**); páginas 2+ =
aprofundamento; tudo sem fonte vira **lacuna explícita** — nunca inferência.

## Quando usar

- O candidato/CG pede "o relatório de <cidade>" para uma visita — ou de várias
  numa invocação (`/relatorio-cidade Ilheus, Itacare, Una`).
- Quem executa são o **orquestrador** (agente principal) + um sub-agente
  **researcher** por cidade + os dois scripts (`extract` no homeserver, `build`
  local). O PDF sai para leitura de bolso; o detalhe das etapas está em
  "Pipeline (etapas)".

## Missão — 2º turno (Lula × Flávio — 25/10/2026)

A partir de 08/10/2026 o relatório **é uma ferramenta de mobilização do 2º
turno**: cada visita serve à eleição de Lula. O produto carrega o recorte
oficial do 1º turno de 2026 (TSE por seção, agregado à unidade) e organiza a
leitura em torno de quatro perguntas: **onde Lula perdeu/ganhou, qual o papel
da cidade, quem mobiliza e o que está quente agora**.

- **Números oficiais por unidade** (município ou ZE de Salvador, na mesma
  geografia do catálogo): Lula 2022→2026, adversário (Bolsonaro→Flávio), Solla
  1313, comparecimento, abstenção, brancos+nulos e o cenário **X₁/X₂** do
  `/potencial` — a MESMA fórmula da página pública, nunca uma segunda conta.
  Fonte: artefato commitado `src/lib/electionAggregates/bahia-second-round-2026.json`
  (loader `src/lib/bahiaSecondRound.ts`), gerado por `pnpm build:second-round` a
  partir do TSE 2026 por seção + da análise 2º turno
  (`analise-eleicoes-2026/nota-solla-2turno`), com os totais da BA pinados.
- **Papel da cidade** (determinístico, `src/lib/secondRoundRole.ts`):
  `prioridade` (Lula caiu, Solla cresceu com base ≥200 votos — agenda conjunta e
  contato pessoal), `mobilizacao` (mesmo quadro, base menor), `defesa` (os dois
  caíram — comparecimento e contenção, sem vitrine), `expansao` (Lula não caiu —
  presença).
- **Movimento local (pesquisa):** o researcher preenche o item de checklist
  `segundo_turno` (atos, palanques, posições de lideranças locais, o que o 2º
  turno move na cidade), sempre com `sourceUrl` + `sourceDate`; sem fonte vira
  lacuna explícita.

Doutrina (de `PERSONA.md` e da nota): **interior = conversão (presença e
proteção); Salvador = comparecimento (mobilização)**; persuasão em eleição geral
tem efeito médio ~0 — o papel de Solla é **mobilizar, proteger e dar voz**, não
converter. `X₁`/`X₂` são **votos em jogo, não transferência garantida**; o
cenário de 2º turno é hipotético e o PDF diz isso. Operação: redutos/vitrine
(onde Solla é a marca), cinturão do PT local, ZE de Salvador 19/15/9/12
(mobilização) e contenção em 16/4.

Regras duras da missão:

- os números oficiais (Lula, Flávio, Solla, X₁/X₂) vêm do **artefato** — o
  researcher **não** os pesquisa; ele pesquisa só o movimento local e o palanque.
- não infira comportamento individual (falácia ecológica) nem prometa conversão;
  o relatório informa **onde mobilizar/proteger**, com a incerteza declarada.
- **fora de escopo desde o refactor de 2026-10-10** (a federal foi decidida em
  04/10): conta eleitoral/cadeira de Solla, concorrentes e pré-candidatos,
  emendas e "o que Solla entregou", acervo de falas da Câmara, panorama
  regional (TI) e sinais/demandas/visitas **não entram no relatório** — não
  reintroduza sem decisão de produto. Demografia, economia e transporte seguem
  como contexto da visita.

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
   `data/relatorios-cidade/` (HTML, JSONs, `logs/`). Também redirecione a saída
   do builder para `logs/<slug>.build.log`.
   Flags úteis: `--generated-at=<ISO>` (reprodutibilidade);
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
      "summary": "opcional — versão curta, completa e auto-contida do answer, redigida para caber na página 1 (C188)",
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
  "opposition": [                  // o que o campo adversário fez de errado na região (fato com fonte)
    { "topic": "Emenda sob investigação (PF)", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "alliances": [                   // dobradinhas: com quem somar na cidade
    { "topic": "Dobradinha estadual (PT)", "detail": "…", "sourceUrl": "https://…", "sourceDate": "…" }
  ],
  "gaps": [{ "id": "…", "label": "…", "reason": "…" }] // lacunas que o agente já sabe
}
```

Checklist (`id`s): `prefeito`, `vice`, `relacao_campo`, `vereadores`,
`disputa_local`, `segundo_turno`, `noticias`, `imprensa_local`.
Item sem `sourceUrl`/`sourceDate` é convertido em lacuna pelo validador; item
ausente também. `approach`, `leaders`, `leaderAgenda` são
listas de pesquisa: cada entrada sem fonte vira lacuna (`abordagem_sem_fonte`,
`lideranca_sem_fonte`, `agenda_lideranca_sem_fonte`) e
não entra no PDF. Campos de texto livre (`detail`, `hook`, `suggestion`,
`support`, `answer`) aceitam os **tokens de fonte inline** `{{fonte}}` /
`{{fonte:N}}`, resolvidos para `(fonte)` no ponto exato da citação (ver "Links
clicáveis / fonte inline" adiante).

**`segundo_turno` — movimento local da disputa Lula × Flávio:** atos, palanques,
posições de lideranças locais e o que o 2º turno move na cidade, com URL+data.
Os números oficiais do bloco 2º turno (Lula/Flávio/Solla, X₁/X₂) vêm do
**artefato** (`pnpm build:second-round`) — **não** os pesquise nem os estime; a
pesquisa é só o movimento local. Sem fonte, vira lacuna explícita na seção.

**`leaderAgenda` — pauta provável das lideranças (rede + mesmo campo):** para
cada liderança que importa na visita, registre o que ela tende a priorizar
(Saúde, Educação, Infraestrutura…) e o **gancho recente publicado** que ancora a
leitura, sempre com URL+data. `name` é obrigatório; exige `topics` **ou** `hook`;
sem fonte, não entra. Priorize (a) a **rede da campanha** (as lideranças na base
Teqo, com `supportStatus`) e (b) o **mesmo campo** de Solla — é onde há margem
de conversa. É **hipótese a validar na conversa, não declaração do líder**: o
bloco "Pauta das lideranças (pesquisa)" sai com essa ressalva. Liderança
de rede **sem rastro público** não vira item: fica como tarefa de ativação
(cadastrar/atualizar `supportStatus`), não como pauta inventada.

**Demografia, economia e transporte (pesquisa):** `demography`, `economy` e
`transport` são listas de `{topic, detail, sourceUrl, sourceDate}` (sem fonte →
lacuna). Pesquise: **cor/raça e rendimento** (Censo 2022 — SIDRA 9605 e 10295;
IBGE Cidades para salário médio); **economia** (PIB e PIB per capita — IBGE
Cidades; composição setorial e emprego formal — RAIS/CAGED e perfis regionais);
**transporte** (rodovias federais/estaduais que cortam o município e obras
novas/reformadas — DNIT, Seinfra; aeroporto mais próximo em operação e o do
polo, com situação; portos e ferrovia da região, deixando claro quando não serve
diretamente a cidade). O enquadramento é "onde falta × onde o estado e a União
têm acertado" — o candidato é da base.

**Frente de oposição (pesquisa):** `opposition` é uma lista de
`{topic, detail, sourceUrl, sourceDate}` (sem fonte → lacuna) com **fatos
publicados e datados sobre o que o campo adversário fez de errado na região** —
PF/MP, obras paradas, anúncio sem entrega, escândalos. Regras: (1) cada linha é
fato publicado, **nunca** inferência de culpa — atribua à fonte ("segundo a PF /
o jornal") e diferencie acusação de condenação; (2) priorize o **local**
(operadores do campo adversário no município/região) sobre o ataque frontal ao
líder estadual; (3) marque temas de **mão dupla** (casos que também citam o
campo da base) para a coordenação não entrar desprevenida; (4) **não** recomende
ataque pessoal nem onde a marca do adversário domina — o relatório é insumo
ancorado, não roteiro de ataque. O item entra na seção de conjuntura e a seção
de fontes lista as URLs.

**Dobradinhas (pesquisa):** `alliances` é a lista de
`{topic, detail, sourceUrl, sourceDate}` com **com quem Solla soma na cidade**
(estadual/federal, chapa e lideranças que transferem voto) — insumo direto da
`approach`, exibido como bloco "Dobradinhas (pesquisa)" na seção de rede. Sem
fonte, cada item vira lacuna; a lista não é obrigatória.

## Conteúdo do relatório

- **Página 1 (uma olhada, só mobilização):** identificação (território,
  prioridade, nível, responsável), o par de células **"2º turno — Lula ×
  Flávio"** (KPIs oficiais: Lula em 2026 com Δ p.p., X₁/X₂ e Solla 2026 + o
  **papel** da cidade com a orientação de um a dois parágrafos) e **"Quem
  mobiliza"** (prefeito, vice, relação com o campo, lideranças na base,
  dobradinhas, vereadores/dobradas — com a fonte da pesquisa por linha),
  **Movimento local do 2º turno (pesquisa)** em callout, **Riscos —
  oposição/disputa local** em cards, **O que pedir e falar** (o pedido Lula 13,
  a relação local confirmada e o guardrail de que X₁/X₂ são votos em jogo), os
  pontos sem leitura e a nota de rodapé. Sempre com a advertência de que o
  cenário de 2º turno é hipotético.
  Os textos livres da pesquisa **nunca são cortados no meio** (C188): a página 1
  imprime o `summary` do item quando existe; sem ele, imprime o `answer`
  integral e, se a página não couber, o builder re-renderiza apontando o
  aprofundamento — **sem "…"**. Por isso, escreva `summary` curto e
  auto-contido para os itens que aparecem na página 1 (`prefeito`, `vice`,
  `relacao_campo`, `vereadores`, `disputa_local`, `segundo_turno`): é a única
  forma de a página 1 manter o texto que você redigiu.
- **Seções 2+:** `1. 2º turno no município (Lula × Flávio)` — números oficiais
  do artefato, papel da cidade, a conta 2022 → 2026 em tabela e o movimento
  local pesquisado, com o cenário rotulado como hipotético · `2. Rede e
  lideranças` — a rede da base, os responsáveis, os pledges, as lideranças
  locais pesquisadas (ex-prefeitos/vices, vereadores mais votados, com partido)
  e a **Pauta das lideranças (pesquisa)** (hipótese a validar) + dobradinhas ·
  `3. Conjuntura` — tendência política, forças, riscos, dobradinhas, próximos
  passos e a **frente de oposição** quando pesquisada (fatos com fonte) ·
  `4. Demografia` — IBGE Censo 2022 do artefato + complemento pesquisado
  (cor/raça e poder aquisitivo) · `5. Atividade econômica (pesquisa)` ·
  `6. Transporte e conexões (pesquisa)` · `7. Notícias e imprensa local` ·
  `8. Abordagem sugerida (pesquisa)` · `9. Fontes e limites` — lista as fontes
  e, antes delas, a tabela **"Pesquisa — respostas integrais"** com o texto
  completo de cada item do checklist (o que a página 1 capou).
- **Numeração dinâmica:** o builder numera as seções depois de montá-las (o
  `id` é estável; o número é posicional). Nunca referencie seção por número
  fixo — use o nome/`id`.
- **Links clicáveis / fonte inline:** todo URL no PDF é um link (`<a href>`):
  células de tabela, fontes por linha e a seção de fontes. Nos textos de
  pesquisa (oposição, dobradinhas, pauta das lideranças, abordagem,
  demografia…), o `(fonte)` com hyperlink entra **inline no próprio texto, logo
  após o trecho que cita o fato verificado** — não numa coluna. Um mesmo texto
  pode citar mais de uma fonte: use `{{fonte}}` para a fonte principal
  (`sourceUrl`) e `{{fonte:2}}`, `{{fonte:3}}`… para cada entrada de
  `extraSources`; o renderer resolve os tokens em `(fonte)` / `(fonte N)` e o
  companion `.md` vira `[(fonte)](url)`. Se o texto não tiver token, o builder
  acrescenta a(s) fonte(s) no fim do trecho. A coluna **Fonte** fica só com a
  data e o link completo continua listado abaixo da tabela (`> Fontes:`).
- **Tabela de notícias com larguras fixas:** `Data 9 · Veículo 14 ·
  Título 49 · Link 28` (%). As larguras explícitas tornam a tabela `table-fixed`
  (a URL longa/crua quebra em vez de inflar a coluna) e dão ao **Título** — o
  texto mais longo — a maior fatia.

## Guardrails de produto (não negociáveis)

- **Sem fonte, não publica**: afirmação não trivial sem data+URL não entra.
- **2º turno é cenário, não promessa**: X₁/X₂ são votos em jogo (fórmula do
  `/potencial`), nunca transferência garantida; a parte determinística vem do
  TSE oficial no artefato e o PDF declara a incerteza. Não se infere
  comportamento individual (falácia ecológica) nem se propõe persuasão onde a
  evidência diz efeito ~0: o papel de Solla é **mobilizar, proteger e dar voz**.
- **Leitura relativa**: delta e participação no recorte da unidade (nunca
  número absoluto do estado apresentado como se fosse da cidade).
- **PII mínima**: contatos completos (telefone/e-mail) nunca entram; nomes de
  lideranças entram porque o produto pede "quem é quem".
- **Completo para o candidato**: nível N0–N4 e a leitura da base entram no PDF,
  sem marca de restrição; o que não sai é para o palanque.
- **Abordagem é análise ancorada**: as sugestões das personas saem do
  `approach` com fonte por item — sem fonte, não entra; o PDF deixa claro que é
  análise, não fato novo.
- **Frente de oposição é fato, não ataque**: `opposition` só recebe fato
  publicado com URL + data; o PDF **não** afirma culpa, **não** infere dolo e
  **não** orienta ataque pessoal. Prioriza o local e sinaliza temas de mão
  dupla; onde a marca do adversário domina, o insumo é para contraste, não para
  confronto frontal.
- **Falha isolada no lote**: cidade que falha (token inválido/ambíguo, pesquisa
  sem fonte suficiente, snapshot×research mismatch) não cancela as demais; o
  summary final diz explicitamente o que saiu e o que falhou (sucesso parcial
  visível).
- **Artefato gitignored**: o repo é público; o PDF/MD com dado interno nunca é
  commitado (só a skill/scripts/changelog).

## Troubleshooting

- **Seção 2º turno saiu como lacuna**: a unidade não está no artefato oficial —
  rode `pnpm build:second-round -- --analysis-dir=<pasta da análise 2º turno>`
  (o comando valida totais e versões) e verifique `municipalityCatalog` ×
  artefato (o teste `tests/unit/bahiaSecondRound.unit.spec.ts` cobre o catálogo).
- **Movimento local "Não pesquisado."**: o researcher não preencheu o item
  `segundo_turno`; é lacuna de pesquisa, não falha do build — repita a pesquisa
  com fonte datada.
- **Página 1 estourou**: o builder aborta com `scrollHeight > útil` e o erro é
  açãoável. A página 1 já aplica tetos de conteúdo aos textos da pesquisa
  (`PAGE_ONE_*` em `scripts/lib/cityReportBlocks.mjs`) e preserva o texto
  integral no aprofundamento; se ainda estourar, **encurte os `summary` da
  pesquisa ou os itens de lista — nunca mexa no layout para "espremer"**. O
  conteúdo determinístico (KPIs e papel do 2º turno) não encolhe no fallback de
  texto.
- **`tsx` ausente no homeserver**: `pnpm install --prod=false`.
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

- Intenção (histórica, pré-refactor): `docs/plans/relatorio-cidade-viagem.md`;
  impl: `docs/plans/relatorio-cidade-viagem-impl.md`.
- Lote + sub-agentes: `docs/plans/ops118-relatorio-cidade-lote-municipios-sub-agentes.md`
  e `-impl.md`.
- Refactor de mobilização do 2º turno: `docs/changelog/2026-10-10-relatorio-cidade-mobilizacao-2turno.md`.
- Precedente de PDF: `scripts/build-solla-ceuci-salvador-report.mjs` (C157).
- Runbook: `docs/ops/teqo-1313-deploy.md` §C163.
