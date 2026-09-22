# Dossiês e boletins Solla sóbrios e analíticos — listas, análise (o que fez × o que defende) e consulta rápida (cidade · instituição · tema)

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1251
Priority: P2
Impeccable: C — redesenho de superfície existente (três variantes da mesma família, dossiê + boletim), sem fluxo novo; design hi-fi obrigatório no gate
Design UI: docs/plans/dossies-sobrios-analiticos-ui-design.html
Appetite: ~4–5 dias eng; uma linguagem visual nova para dossiês e boletins, com a dimensão "o que defende" e consulta rápida
Responsável: —

## Intenção

O humano achou o layout dos dossiês exagerado: quadrados um do lado do outro, cartões, selos coloridos, seção de gráficos. Quer um documento sóbrio, fácil de ler, organizado em listas, com mais análise do conteúdo, para que o leitor encontre rápido a informação sobre Jorge Solla de que precisa. O pedido é repaginar o design dos dossiês **do zero** — e o **boletim modelo** entra junto (decisão do gate, 2026-09-22). Além disso, o dossiê deve analisar não só o que Solla **fez**, mas o que ele **fala e defende** para aquele recorte: derivado dos registros, com pesquisa extra de notícias datadas e trechos do acervo de falas sobre o que ele defende ali. Hoje o dossiê é um inventário visual; a prioridade inverte: primeiro a leitura (o que fez, o que defende, o que se destaca, o que falta), depois a evidência completa, sempre com fonte.

## Persona e fluxo

- **Persona / contexto:** assessoria, gabinete e comunicação, na mesa ou em viagem, consultando no celular ou no notebook antes de uma fala, de uma resposta pública ou de um texto.
- **Job principal:** em segundos, achar o que Jorge Solla fez **e o que defende** naquele recorte, com fonte e fase, e saber o que não foi encontrado.
- **Fluxo desejado:** abre o dossiê, lê "O essencial" e entende o recorte em uma página; desce por era com a mesma anatomia; consulta a tabela quando quer o item exato; lê o que ele defende e confere a fonte; fecha sabendo as lacunas.
- **Anti-goals de produto:** não virar peça de campanha nem material publicável; não virar dashboard, infográfico ou relatório de vaidade; não virar inventário sem leitura; não preencher análise com inferência; não atribuir a Solla uma defesa que não tem registro.

### Esboço de fluxo (C)

```text
[abre o dossiê] → [capa + índice] → [O essencial: leitura do recorte (fez + defende)]
→ [era A/B/C: leitura + tabela Objeto/Valor/Ano/Fase/Esfera/Fonte + o que defende com lastro]
→ [região · lacunas · notícias · acervo · fontes] → [achou o dado com fonte e fase] | [confirmou a lacuna]
```

### Design UI (C)

- Design UI (gate): `docs/plans/dossies-sobrios-analiticos-ui-design.html` — cenas do dossiê (três variantes) **e** do boletim modelo sóbrio, no mesmo artefato (decisão do gate: um hi-fi da família).

## Objetivo e aceite

- Um só desenho para as três variantes (cidade, instituição, tema): mesma linguagem visual e mesma anatomia de leitura, no dossiê **e no boletim modelo**.
- Listas e tabelas são a espinha — sem grade de quadrados lado a lado, cartões decorativos, selos coloridos (esfera e fase viram texto/coluna) ou a seção de "Gráficos consolidados".
- O dossiê abre pela análise: "O essencial" (o que Solla fez, o que defende, o que se destaca, o que falta) + leitura por era + leitura entre eras (concentração, instrumentos, continuidade/ruptura, lacunas que pesam), sempre leitura dos registros com fonte — nunca inferência nem fato novo.
- **Dimensão nova "o que Solla defende"**: posições, prioridades e compromissos para o recorte, derivados de itens com fonte + **pesquisa extra** de notícias datadas e **trechos do acervo de falas** (fala/trecho identificado); análise derivada, com a mesma régua de lastro — sem registro, é lacuna.
- **Boletim modelo** no mesmo redesenho: 1 página A4, linguagem de público eleitor, sóbrio e list-based, mantendo rótulo "Modelo — insumo interno", sem declaração de fontes e sem CTA; herda apenas fatos com fonte do dossiê e **ganha um bloco "O que Solla defende"** (1–2 defesas curtas com lastro, exibidas como os fatos do boletim — sem linha de fonte).
- Consulta rápida: índice e âncoras no PDF e no companion `.md`, anatomia constante por era, cabeçalho corrente com seção e folha; o `.md` espelha a estrutura.
- Nada some e os guardrails seguem intactos: sem fonte não publica; fase por valor (autorizado/empenhado/liquidado/pago/restos); esfera explícita e nunca somada; leitura relativa; atribuição de emenda só com autoria checada; PII mínima; artefato gitignored; defeso (insumo interno, sem CTA).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o dossiê é leitura de registros com fonte.
- **Decisões desbloqueadas:** a comunicação escolhe o que citar e priorizar na fala/texto; escolhe o que falta buscar (lacuna vira pauta de pesquisa); a coordenação vê a cobertura do recorte para decidir onde investir levantamento.
- **Forma:** _adiada ao plano de implementação_ — restrições aqui: leitura relativa/local (nunca % estadual absoluto); valor sempre com fase; esfera explícita por item, recortes nunca somados; números em tabelas e na prosa, sem gráficos decorativos; toda análise (fez e defende) rastreável a item/trecho com URL+data.

## Dados da decisão (literais)

- ID C209 · slug `dossies-sobrios-analiticos` · arquivo `docs/plans/dossies-sobrios-analiticos.md`.
- Donos da engine (o redesenho acontece neles, sem fork): `scripts/lib/dossieUnit.mjs`, `scripts/lib/dossieBlocks.mjs`, `scripts/lib/dossieRender.mjs`, `scripts/lib/dossiePack.mjs`, `scripts/lib/dossieCareer.mjs`; builders finos `scripts/build-dossie-solla-cidade.mjs`, `scripts/build-dossie-solla-instituicao.mjs`, `scripts/build-dossie-solla-tema.mjs`; PDF via `scripts/lib/buildPdf.mjs`.
- **Boletim agora em escopo:** `scripts/lib/dossieBulletin.mjs` e `scripts/lib/dossieBulletinRender.mjs`; os três hi-fi de boletim antigos (`docs/plans/dossie-solla-{cidade,instituicao,tema}-boletim-ui-design.html`) ficam no repo como registro e são superados pelo novo artefato.
- **Boletim × defende (literal):** o bloco "O que Solla defende" do boletim traz 1–2 defesas curtas derivadas de item/notícia/trecho com lastro; sem registro = bloco omitido (nunca inventa); sem linha de fonte visível e sem CTA (regras do boletim).
- Redação e skills: `.opencode/agent/dossie-solla-{cidade,instituicao,tema}-redacao.md`; seções "Conteúdo do dossiê" de `.agents/skills/dossie-solla-cidade/SKILL.md`, `.agents/skills/dossie-solla-instituicao/SKILL.md`, `.agents/skills/dossie-solla-tema/SKILL.md`.
- **Dimensão "o que defende" (literais de produto):** derivada de itens com fonte + notícias datadas + trechos do acervo de falas sobre o recorte; todo trecho de fala entra com identificação (título/data ou id do trecho); sem notícia datada/trecho identificado = lacuna explícita; nunca atribuir defesa sem registro; a análise é leitura dos registros, não opinião do pipeline.
- Design novo (gate; supersede os hi-fi de dossiê e boletim antigos, que ficam no repo como registro): `docs/plans/dossies-sobrios-analiticos-ui-design.html`.
- Âncoras/seções a preservar (renomear só o que o design exigir): capa, carta, trajetória, resumo, síntese, era A/B/C, região, lacunas, notícias, acervo, fontes; nas variantes, abrangência e títulos/honrarias; **nova**: "o que defende". "Gráficos consolidados" deixa de existir.
- Regras fixas do desenho: sem marca de campanha (documento institucional neutro); sem imagens nem placeholders de imagem; fase e esfera como texto/coluna, nunca selo colorido.

## Direção no codebase (hipótese)

- **Áreas prováveis:** os módulos `scripts/lib/dossie*.mjs` (conteúdo, render, paginação), os três builders, os três agentes de redação e as três SKILLs; precedentes de conteúdo em `docs/plans/dossie-solla-{cidade,instituicao,tema}-impl.md` e no dossiê real de Miguel Calmon. O relatório de cidade (C163) é precedente de documento sóbrio, sem copiar o dono.
- **"O que defende" reusa a pesquisa existente:** o checklist por era ganha itens de posições/defesas e o acervo já é extraído por recorte nos três pipelines — a análise deriva dos mesmos JSONs, sem segundo pipeline de pesquisa.
- **Risco de acoplamento:** o boletim lê só o ledger de fatos do dossiê e tem folhas próprias — agora redesenhado, mas sem herdar análise/fatos novos; os specs que fixam o layout atual (render, instituição, tema, pack, blocks, bulletin e skills de lote) precisam ser atualizados pelo impl; a guarda de fit A4 e a paginação ficam como estão.

## Dependências

- Nenhuma dura. **Soft com C210** (`briefing-capacitacao-solla`): o briefing consome o dossiê — inclusive a dimensão "o que defende" que nasce aqui; C210 não bloqueia este item.
- **Coordenação de arquivos com C210:** os dois itens tocam as três SKILLs de dossiê e os specs de lote — C209 reescreve as seções de conteúdo; C210 adiciona o ponteiro para a skill de briefing. Rebase esperado; sem bloqueio (a ordem de merge segue a prioridade: C210 é P1).
- Soft/registro: Issue #1139 (C189, bloqueada) — se o redesenho eliminar caps, o débito da C188 pode ficar moot; anotar, não bloquear.

## Fora de escopo

- **Briefing de capacitação (C210)** — entregável novo, item próprio; é o C210 que liga o briefing ao fluxo das skills de dossiê. Este item só garante que o dossiê tem os fatos e as defesas que ele consome.
- Relatório de cidade (C163); qualquer schema, migration ou escrita em banco; qualquer mudança de URL público.
- Campanha, publicação, peça publicável e kit de marca 1313.

## Rabbit holes de produto

- **"Só falta um gráfico".** Completar com charts devolve o que o humano rejeitou e puxa dependência nova. **Corte:** números em tabela e prosa; se algo só se entende visualmente, decide o design, não a engine.
- **"Já que sobrou espaço, busca mais dado / faz um hi-fi por variante".** Vira nova pesquisa e família rachada. **Corte:** lê os registros existentes (o "defende" usa notícia datada + acervo); um hi-fi da família com cenas por variante.
- **"Reescreve o paginador" e "aplica a marca da campanha".** Otimização de engine disfarçada de design e peça de campanha em defeso. **Corte:** mecanismo de medição/paginação atual; documento neutro.
- **"O que defende" vira opinião editorial.** Elogio/inferência de posição sem registro. **Corte:** defesa só com notícia datada ou trecho identificado; sem registro, lacuna.

## Questões em aberto (produto)

- **Onde mora "o que defende" no dossiê?** **Opções:** A) seção própria (leitura + lista de posições/trechos com fonte), destacada também no essencial | B) diluído dentro de cada era. **Recomendação:** A — é a nova leitura que o humano pediu e precisa de lugar próprio e indexável. _(assumido — validar no design)_
- *(decidido no gate, 2026-09-22: o boletim **ganha** "O que Solla defende" — 1–2 defesas curtas com lastro, sem linha de fonte.)*
- **Nome da seção?** **Opções:** A) "O que Solla defende" | B) "O que ele diz" | C) "Posições e defesas". **Recomendação:** A — direto e fiel ao pedido.
- *(decididos no gate 2026-09-22: um item design+análise; boletim incluído; gráficos fora; documento neutro sem marca; um hi-fi da família; índice + âncoras.)*

## Referências

- Dossiê real de exemplo: `docs/research/dossie-solla-cidade/miguel-calmon-2026-09-21-dossie.pdf` + companion `.md` (checkout principal); páginas atuais em `/tmp/opencode/dossie-mc/pg-*.png`.
- Planos da família: `docs/plans/dossie-solla-cidade.md`, `docs/plans/dossie-solla-cidade-impl.md` e os pares de instituição e tema.
- Acervo de falas: `src/collections/Speech.ts`, `src/lib/speechFacets.ts` (18 áreas), `src/utilities/speech/speechListFilters.ts`; extração read-only do recorte pelo extrator do C163.
- `AGENTS.md` (artefato gitignored, defeso); `.agents/skills/plan-issue/ui-design-html.md` (gate de design); GitHub Issue #1139; plano irmão `docs/plans/briefing-capacitacao-solla.md` (C210).

## Self-score (shaping, gate ≥4)

1. **Fatia = um outcome verificável?** Sim — a família de dossiês/boletins relida como documento sóbrio e analítico (fez + defende), com design novo no gate. — **5/5**
2. **Appetite declarado e a intenção cabe nele?** Sim — 4–5 dias para um motor/linguagem (não três), com cortes declarados (gráficos, C163, briefing em item próprio, busca nova). — **4/5** (o "defende" com lastro e o port do boletim são os trechos que mais consomem quota).
3. **Persona + job + aceite claros (sem jargão de stack)?** Sim — assessoria/comunicação, "achar em segundos o que fez e o que defende, com fonte e lacuna", aceite por seções e guardrails. — **5/5**
4. **Direção no codebase é hipótese (não contrato técnico)?** Sim — caminhos como pista; forma de render/paginação adiada ao impl. — **4/5** (a lista de donos e âncoras orienta o port sem prescrever solução).
5. **Zero decisões duras de engenharia no plano?** Sim — sem schema, sem nomes de função, sem stack de chart; os literais são valores de produto/arquivo. — **5/5**

**Total 23/25 (média 4,6/5) — passa o gate ≥4/5.**
