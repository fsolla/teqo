# Dossiê Solla por tema/área + Boletim modelo (skill → dossiê + boletim)

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1143
Priority: P2
Impeccable: C — fluxo novo (dossiê por área + Boletim modelo; mesma família visual dos dossiês C186/C187, com identificação de área própria)
Design UI: `docs/plans/dossie-solla-tema-ui-design.html` + `docs/plans/dossie-solla-tema-boletim-ui-design.html` — variante de área da família C187, a produzir pelo `designer`; se o gate julgar o delta pequeno, documentar o delta no par do C187 em vez de novos arquivos (decisão a confirmar no gate)
Appetite: ~2–3 dias eng; um outcome verificável — rodar `/dossie-solla-tema Educação` e obter PDF A4 + companion `.md` (seções por era, números com fonte, lacunas) **e** o PDF do Boletim modelo (1 página A4)
Responsável: —

## Intenção

A comunicação/mandato precisa preparar fala, artigo ou agenda por **área de política** — "o que Solla fez pela Educação", "o que fez pela Saúde" — e hoje só existem os recortes por município (`/dossie-solla-cidade`, C186) e por instituição (`/dossie-solla-instituicao`, C187). Para uma área não há de onde partir: o material está espalhado em memória, notícia solta e acervo de falas sem recorte. Este item cria a **terceira variante** da família — mesmo pipeline, mesmo rigor de fonte — cujo recorte é a **área/tema do acervo** em vez do lugar ou da entidade. É o recorte que o acervo interno serve nativamente (falas já classificadas por tema desde C153/C154), então aqui o acervo é evidência de primeira classe, não ponte. Primeiro uso: **Educação**; reusável para as demais áreas da taxonomia, em lote de 1 ou N. Além do dossiê, entrega o **Boletim Informativo modelo** (1 página A4, linguagem de eleitor) para a comunicação partir dele na peça final.

## Persona e fluxo

- **Persona / contexto:** equipe de comunicação/mandato de Solla, na mesa, preparando material de uma área (ex.: pronunciamento sobre Educação, agenda com o setor); sem tempo de garimpo e obrigada a não afirmar sem lastro.
- **Job principal:** numa invocação, obter (1) um **dossiê datado e com fonte** de tudo o que Solla fez pela área ao longo da carreira — com números sempre que existirem e lacunas explícitas — e (2) um **boletim modelo de 1 página**, em linguagem de eleitor, sintetizando essas entregas.
- **Fluxo desejado:** pede `/dossie-solla-tema Educação` (ou lote) → o orquestrador resolve o token nas áreas canônicas do acervo, dispara pesquisadores (um por era da carreira) em paralelo, roda a extração read-only do acervo **por tema direto** e monta os PDFs (+ `.md`) no layout desenhado pelo `designer` → a comunicação lê a linha do tempo, escolhe o que entra na fala/o que vira boletim, confere as fontes; lacunas ficam explícitas; falha de uma área não cancela o lote.
- **Anti-goals de produto:** inventar área/slug fora da taxonomia; inferir área de emenda/proposição sem fonte; virar dashboard de área; substituir ou duplicar os recortes cidade/instituição; somar temas ou segmentos como se fossem a área; publicar/veicular peça pelo pipeline (defeso 2026); persistir dado novo na base; segundo pipeline irmão em vez de estender o dono; o boletim introduzir fato que o dossiê não tem com fonte.

### Esboço de fluxo (C)

```text
[pede: /dossie-solla-tema Educação, Saúde] → [orquestrador resolve o token nas áreas do acervo]
→ token desconhecido → fail-closed (mensagem acionável ou --slug/--name one-off)
→ [1 researcher por era (A/B/C) por área, em paralelo] ───────┐
→ [extração read-only do acervo por Speech.topics (serializada)] ─┼→ [build local: HTML do designer → PDF dossiê + .md + boletim]
→ [summary: ok|failed + recibo curto por área/era] ───────────┘
→ [comunicação escolhe o que entra na fala, confere fonte; lacunas explícitas]
```

### Design UI (C)

- Design UI (gate) — dossiê: `docs/plans/dossie-solla-tema-ui-design.html` (variante de área da família `dossie-solla-instituicao-ui-design.html`) — capa/identificação da área (label + valor canônico), resumo, seções por era, tabelas e lacunas; produzido pelo `designer` **antes** do build e portado pela implementação.
- Design UI (gate) — boletim modelo: `docs/plans/dossie-solla-tema-boletim-ui-design.html` — variante de área do boletim de instituição (o mais completo da família), 1 página A4, público eleitor.

## Objetivo e aceite

- Com uma área, sai um par **PDF A4 datado + companion `.md`** com: identificação da área (label `Educação` + valor canônico `educacao` + nota da taxonomia do acervo); vínculo histórico de Solla com a área por **era A** (até 2006), **B** (2007–2014) e **C** (2015–2027); resumo de uma olhada; o que Solla fez pela área (emendas e recursos, proposições/relatorias, programas/projetos, articulação/audiências, títulos) em tabelas **Objeto/Valor/Ano/Fase/Abrangência/Fonte**; painel de abrangência; **evidência direta do acervo por tema** (`Speech.topics`); fontes e limites; nota de defeso.
- Com a mesma área, sai também o **Boletim Informativo modelo**: **1 página A4**, linguagem de público eleitor, **≤6 destaques** + **"E mais" com ≤14 itens** (teto de lista ajustado ao comprimento do rótulo, como no dono), rótulo **"Modelo — insumo interno"**, **sem declaração de fontes**, **sem CTA/propaganda**; herda **apenas fatos já com fonte** do dossiê.
- **Primeiro uso real é o aceite de produto:** `/dossie-solla-tema Educação` produz dossiê + boletim utilizáveis pela comunicação.
- **Toda afirmação não trivial tem fonte visível** (URL + data); o que não foi achado vira **lacuna explícita** — nunca inferência. **Números sempre que a fonte informar**, sempre com a fase.
- Lote de 1+N áreas funciona; **falha de uma não cancela as demais** (sucesso parcial explícito). Token fora da taxonomia **falha fechado** com mensagem acionável, nunca slug inventado.
- Pesquisa roda em **sub-agente por era, por área, em paralelo**; o orquestrador agrega **apenas recibos curtos** e serializa a extração read-only.
- O layout vem do artefato hi-fi do `designer` (fonte de verdade do port), não inventado na implementação.
- **Nada some e nada é cortado** (regra do dono, entregue no C188): folhas correntes sem caps, lista capada declara "e mais N", sem descarte silencioso.
- Guardrails de produto: "sem fonte, não publica"; **empenho ≠ pagamento**; **abrangência explícita e nunca somada**; leitura relativa (nunca % estadual absoluto); acervo cobre **2011+** (pré-2011 = lacuna); PII mínima; artefato **gitignored**; defeso; **sem schema/migration/DB write**.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — dossiê e boletim são documentos de dados (números com fonte, séries por era, painel do acervo, lacunas).
- **Decisões desbloqueadas:** a comunicação escolhe **o que entra na fala/agenda** da área; **qual entrega** priorizar; onde há **entrega documentada × só intenção**; **qual lacuna** buscar antes do compromisso.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: fase rotulada por valor; abrangência rotulada em cada linha; empenho nunca tratado como pago; sem % estadual absoluto; lacuna explícita em vez de silêncio; ruído eleitoral fora.

## Dados da decisão (literais)

- **Nome e artefatos (verbatim):** skill `.agents/skills/dossie-solla-tema/SKILL.md`; command `.opencode/commands/dossie-solla-tema.md`; subagentes `.opencode/agent/dossie-solla-tema.md` (researcher) + `dossie-solla-tema-redacao.md` (redator); build entry + libs reusando/estendendo o dono (`scripts/lib/dossieUnit.mjs`, `scripts/lib/dossie*.mjs`, `scripts/lib/reportText.mjs`).
- **Token canônico = área do acervo (verbatim, os 18 de `src/lib/speechFacets.ts:14`):** `saude`, `educacao`, `cultura`, `esporte`, `seguranca-publica`, `meio-ambiente`, `economia-trabalho`, `direitos-humanos`, `infraestrutura`, `ciencia-tecnologia`, `politica-instituicoes`, `agricultura`, `habitacao-cidades`, `comunicacao-midia`, `igualdade-racial`, `mulheres-genero`, `juventude`, `pessoa-deficiencia`; labels pt-BR correspondentes (ex.: **`educacao` → "Educação"**). Primeiro uso: **`educacao` / Educação**.
- **Recorte do acervo (verbatim):** por **`Speech.topics` direto** (filtro de acervo em `src/utilities/speech/speechListFilters.ts:43`) — **não** o mapa tema→instituição do C187; emendas/proposições por área: Câmara/Portal **não filtram por área** — atribuição **só com fonte**; sem atribuição → lacuna (nunca zero silencioso).
- **Eras (verbatim, reusar as do C186/C187):** **A** até 2006; **B** 2007–2014 (SESAB); **C** 2015–2027 (deputado federal). Acervo cobre 2011+; pré-2011 é lacuna explícita.
- **Fases de valor (verbatim):** `autorizado | empenhado | liquidado | pago | restos` (default `nao_informado`).
- **Abrangência (proposta — questão em aberto):** `area | segmento | rede` — `area` (a política como um todo), `segmento` (ex.: básica/superior/EJA/profissional), `rede` (entidades/escolas/universidades da área); default `area`; recortes **nunca somados**. Alternativa registrada: reusar `instituicao|setor|rede` do C187 (menos aderente).
- **Boletim modelo (literais):** **1 página A4**; **≤6 destaques** + **"E mais" ≤14 itens** (o dono ajusta o limite ao comprimento do rótulo: cidade 12, instituição 10); **sem fontes**; **sem CTA**; rótulo **"Modelo — insumo interno"**; nota de defeso; `NEEDS ASSET` para foto/selo/clipping.
- **Saídas (rotas):** `docs/research/dossie-solla-tema/<slug>-<YYYY-MM-DD>-dossie.pdf` + `-dossie.md` + `-boletim.pdf`; intermediários e JSONs de pesquisa em `data/dossie-solla-tema/`; **ambos gitignored** (blocos por recorte no `.gitignore`).
- **Lote (verbatim):** vírgula, `trim`, descarte de vazio, **dedup após resolução** preservando ordem; token inválido/ambíguo = falha isolada no summary; escape one-off `--slug=<x> --name="<Nome>"`; nunca slug inventado.
- **Guardrails (verbatim):** sem fonte não publica; empenho ≠ pagamento; abrangência explícita (nunca somar); leitura relativa; lacuna explícita; PII mínima; artefato gitignored; defeso 2026; sem schema/migration; falha isolada no lote.

## Direção no codebase (hipótese)

- **Áreas prováveis:** o seam de unidades `scripts/lib/dossieUnit.mjs` (terceira unidade, ao lado de município/instituição), `dossieResearch.mjs` (`CHECKLIST_BY_UNIT` por era orientada a área), dispatch em `dossieBlocks.mjs`, `dossieRender.mjs`/`dossieBulletin*.mjs` (identificação e copy da área), novo builder `scripts/build-dossie-solla-tema.mjs` reusando `buildPdf.mjs`/`dossiePack.mjs`; snapshot do acervo por tema reusando a receita read-only do dono (sem catálogo novo — o "catálogo" é `SPEECH_TOPICS`); `.agents/skills/`, `.opencode/commands|agent/`.
- **Precedente a olhar:** C186/C187 (`docs/plans/dossie-solla-instituicao.md` + `-impl.md`, skills/commands/agents irmãos, `scripts/lib/dossie*.mjs`); `src/lib/speechFacets.ts` + `src/utilities/speech/speechListFilters.ts` como resolução canônica do token.
- **Risco de acoplamento:** **"edite o dono, não gema um irmão"** — default município/instituição intactos, tudo unit-aware; registrar o command em `tests/unit/opencodeCommands.unit.spec.ts` e pinar os módulos novos em `scripts/lib/test-affected-core.mjs` (`SCRIPTS_SPEC_PINNED`); specs próprias espelhando `tests/unit/dossieInstitution*.spec.ts`; sem schema/migration; extração read-only à produção (guard).

## Dependências

- **Hard:** nenhuma — pipeline C186/C187 e infra Chromium/PDF já existem; o `designer` produz o layout.
- **Soft:** **C189 (#1139, OPEN/blocked)** — débitos de truncamento/paridade no **mesmo dono** que este item estende: se tocar o pipeline antes, não reintroduzir caps nem corte mecânico; a área nasce sob a regra do C188 ("nada some, nada é cortado").
- **Soft:** acesso read-only ao acervo Teqo (guard de confirmação); pesquisa web datada (sem `PORTAL_TRANSPARENCIA_API_KEY` — o Portal não filtra por área).

## Fora de escopo

- Redigir/aprovar/veicular a peça final — a skill entrega dossiê + **boletim modelo**.
- Dashboard/painel interativo de área; UI in-app de campanha; índice/PDF agregado de lote.
- Gerar as 18 áreas de uma vez; área composta (multi-tema num mesmo dossiê) — cada token é um dossiê.
- Substituir/alterar `/dossie-solla-cidade`, `/relatorio-cidade` ou `/dossie-solla-instituicao`.
- Persistir dado novo, schema ou migration; re-taxonomizar o acervo; inferir área de emendas/proposições sem fonte.

## Rabbit holes de produto

- **"Cobrir a área inteira vira escopo infinito."** Se alguém "só completar": Educação = tudo. **Corte neste item:** eras fixas A/B/C + checklist por era + foco em fonte verificável.
- **"Somar temas/segmentos como se fossem a área."** **Corte neste item:** abrangência explícita por linha, sem total combinado.
- **"IA plausível sem fonte."** **Corte neste item:** sem fonte não publica; lacuna explícita; número só com URL+data e fase.
- **"Emenda da área = zero silencioso."** **Corte neste item:** sem atribuição checada, vira lacuna — nunca zero nem soma estimada.
- **"Fan-out das 18 áreas."** **Corte neste item:** 1 token = 1 dossiê; lote só o pedido explicitamente.
- **"Vira recorte territorial/instituição."** **Corte neste item:** território e entidade não viram eixo de soma na área (menção fica na evidência/fonte).

## Questões em aberto (produto)

- **Nome da skill: `tema` ou `area`?** **Opções:** A) `dossie-solla-tema` | B) `dossie-solla-area`. **Recomendação:** A — alinha com a taxonomia existente do acervo (`SPEECH_TOPICS`/`Speech.topics`, "tema") e com o pedido do humano ("categoria/campo"). _(assumido — validar)_
- **Abrangência da área?** **Opções:** A) `area | segmento | rede` | B) reusar `instituicao | setor | rede` do C187 | C) só `area`. **Recomendação:** A — preserva o guardrail de não somar com vocabulário que faz sentido para área. _(assumido — validar)_
- **Incluir recorte territorial?** **Opções:** A) não como eixo (só menção na evidência) | B) painel por município. **Recomendação:** A — território é o recorte do `/dossie-solla-cidade`; evita eixo de soma duplicado.
- **Design: novo hi-fi ou delta documentado?** **Opções:** A) novo par `dossie-solla-tema-{ui,boletim-ui}-design.html`, variante da família instituição | B) delta documentado no par do C187. **Recomendação:** A — capa/identificação e boletim mudam; a variante evita arrastar labels de instituição; confirmar no gate se o delta for pequeno.
- **Área composta (ex.: Educação + Ciência e Tecnologia)?** **Opções:** A) fora (1 token = 1 dossiê; lote = vários) | B) permitir combinar. **Recomendação:** A — mantém o fail-closed e o recorte legível. _(assumido)_

## Referências

- GitHub Issue #1143
- Irmãos: `docs/plans/dossie-solla-instituicao.md` (C187, #1135) + `dossie-solla-instituicao-impl.md`; `docs/plans/dossie-solla-cidade.md` (C186, #1132); débitos `docs/plans/relatorios-sem-truncamento.md` (C188, #1136) e issue #1139 (C189, OPEN/blocked)
- Skills/commands/agents-modelo: `.agents/skills/dossie-solla-instituicao/SKILL.md`, `.opencode/commands/dossie-solla-instituicao.md`, `.opencode/agent/dossie-solla-instituicao.md` + `-redacao.md`
- Builder/libs donos: `scripts/build-dossie-solla-instituicao.mjs`, `scripts/lib/dossieUnit.mjs`, `scripts/lib/dossie{Research,Blocks,Render,Bulletin,BulletinRender,Pack}.mjs`, `scripts/lib/buildPdf.mjs`
- Taxonomia/recorte: `src/lib/speechFacets.ts` (18 temas), `src/utilities/speech/speechListFilters.ts` (`topics`), `src/utilities/speech/speechListUrl.ts`
- Designs hi-fi irmãos (fonte da variante): `docs/plans/dossie-solla-instituicao-ui-design.html` + `docs/plans/dossie-solla-instituicao-boletim-ui-design.html` — atualizados em `5644a9f9` (a nota "desatualizados" na SKILL do C187 está stale; não repetir o passe)
- Testes a espelhar: `tests/unit/dossieInstitution{,.unit,Research,BatchSkill}*.spec.ts`, `tests/unit/dossie*.unit.spec.ts`, `tests/unit/opencodeCommands.unit.spec.ts`; pino `scripts/lib/test-affected-core.mjs`
- `AGENTS.md` — defeso, PII mínima, artefato gitignored e "edite o dono, não gema um irmão"
