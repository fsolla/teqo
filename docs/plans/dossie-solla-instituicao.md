# Dossiê Solla por instituição + Boletim modelo (skill → dossiê + boletim)

Status: rascunho
Atualizado em: 2026-09-17
Issue: #1135
Priority: P2
Impeccable: C — fluxo novo (dossiê institucional + Boletim modelo; mesma família visual do C186)
Design UI: docs/plans/dossie-solla-instituicao-ui-design.html + docs/plans/dossie-solla-instituicao-boletim-ui-design.html
Appetite: ~3–4 dias eng; um outcome verificável — rodar `/dossie-solla-instituicao UFBA` e obter PDF A4 + companion `.md` (seções por era, números com fonte, lacunas) **e** o PDF do Boletim modelo (1 página A4, público eleitor)
Responsável: —

## Intenção

A equipe de comunicação/mandato precisa preparar **agendas institucionais** (visita, audiência, homenagem, articulação) com lastro — e hoje só existe o recorte por município (`/dossie-solla-cidade`, C186). Para uma universidade, uma empresa pública, uma autarquia, um conselho/entidade de classe ou uma categoria profissional, não há de onde partir: a pessoa garimpa memória, WhatsApp e notícia solta. Este item cria uma skill **irmã** da C186 — mesmo pipeline, mesmo rigor de fonte — cujo recorte é a **instituição** em vez do município. Primeiro uso: **UFBA**; reutilizável para **Correios**, **Enfermagem** e demais instituições, em lote de 1 ou N. Além do dossiê, entrega o **Boletim Informativo modelo**: **1 página A4** com a síntese, em linguagem de **público eleitor**, do que Solla fez pela instituição — o pessoal de comunicação parte do dossiê + desse modelo para produzir a peça final. O `/relatorio-cidade` e o `/dossie-solla-cidade` inspiram o fluxo (skill + command + subagente, sub-agentes por era, extração read-only, build local de PDF), mas o conteúdo e o recorte são outros.

## Persona e fluxo

- **Persona / contexto:** equipe de comunicação/mandato de Solla, na mesa, preparando material para uma agenda institucional; sem tempo de garimpo e obrigada a não afirmar sem lastro.
- **Job principal:** numa invocação, obter (1) um **dossiê datado e com fonte** de tudo o que Solla fez por/na/com aquela instituição ao longo da carreira — com números sempre que existirem e lacunas explícitas — e (2) um **boletim modelo de 1 página**, em linguagem de eleitor, sintetizando essas entregas.
- **Fluxo desejado:** pede `/dossie-solla-instituicao UFBA` (ou lote) → o orquestrador resolve o token no catálogo de instituições, dispara pesquisadores (um por era da carreira) em paralelo, roda a extração read-only do acervo e monta os PDFs (+ `.md`) nos layouts desenhados pelo `designer` → a comunicação lê a linha do tempo, escolhe o que entra na fala/o que vira boletim, confere as fontes; lacunas ficam explícitas; falha de uma instituição não cancela o lote.
- **Anti-goals de produto:** virar recorte territorial (reintroduzir município); inventar fato/slug sem fonte; publicar/veicular peça pelo próprio pipeline (defeso 2026); tratar empenho como recurso entregue; persistir dado novo na base (segundo cadastro); segundo pipeline irmão em vez de estender o dono C186; somar setor/rede como se fosse a instituição; o boletim introduzir fato que o dossiê não tem com fonte.

### Esboço de fluxo (C)

```text
[pede: /dossie-solla-instituicao UFBA, Correios] → [orquestrador resolve o catálogo]
→ token desconhecido → fail-closed (alias/entrada ou --slug/--name one-off)
→ [1 researcher por era (A/B/C) por instituição, em paralelo] ─┐
→ [extração read-only do acervo (serializada, 1 instituição)]  ─┼→ [build local: HTML do designer → PDF dossiê + .md]
→ [summary: ok|failed + recibo curto por instituição/era] ─────┘
→ [comunicação escolhe o que entra na fala, confere fonte; lacunas explícitas]
```

### Design UI (C)

- Design UI (gate) — dossiê: `docs/plans/dossie-solla-instituicao-ui-design.html` (+ assets em `docs/plans/dossie-solla-instituicao-ui-design-assets/` se houver SVG próprio) — layout do **dossiê A4 institucional** (página 1 "resumo de uma olhada" + seções por era, tabelas de números/fontes, tabela de lacunas, nota de defeso), produzido pelo `designer` **antes** do build e portado pela implementação. Mesma família visual do dossiê C186; seções próprias de instituição.
- Design UI (gate) — boletim modelo: `docs/plans/dossie-solla-instituicao-boletim-ui-design.html` (+ assets) — layout do **Boletim Informativo modelo (1 página A4, público eleitor)**, também produzido pelo `designer` antes do build e portado pela implementação.

## Objetivo e aceite

- Com uma instituição, sai um par **PDF A4 datado + companion `.md`** com: identificação da instituição (nome, tipo, esfera, abrangência); vínculo histórico de Solla com ela por **era A** (até 2006 — formação/SESAB/Conquista/SAS-MS), **B** (SESAB 2007–2014) e **C** (deputado federal 2015–2027); resumo de uma olhada; o que Solla fez pela/na instituição (emendas e recursos, proposições/relatorias, projetos, articulação/audiências, cargos/parcerias/homenagens) em tabelas **Objeto/Valor/Ano/Fase/Fonte**; abrangência (instituição × setor × rede); fontes e limites; nota de defeso.
- Com a mesma instituição, sai também o **Boletim Informativo modelo**: **1 página A4**, em linguagem de público eleitor, denso e direto (mais entregas por página, frases curtas), com os números em destaque e o rótulo de **insumo interno/modelo** (não é a peça final publicável). **Sem declaração de fontes** — as fontes vivem só no dossiê — e **sem CTA/propaganda**. Herda **apenas fatos já com fonte** do dossiê.
- **Toda afirmação não trivial tem fonte visível** (URL + data); o que não foi achado vira **lacuna explícita** — nunca inferência. **Números sempre que a fonte informar**, sempre com a fase.
- Lote de 1+N instituições funciona; **falha de uma não cancela as demais** (sucesso parcial explícito).
- Token fora do catálogo **falha fechado** com mensagem acionável (adicionar alias/entrada, ou escape `--slug`/`--name`), nunca slug inventado.
- Pesquisa roda em **sub-agente por era, por instituição, em paralelo**; o orquestrador agrega **apenas recibos curtos** (nunca o corpo dos JSONs) e serializa a extração read-only.
- O layout vem do artefato hi-fi do `designer` (fonte de verdade do port), não inventado na implementação.
- **Nenhum texto some por não caber:** nada de corte mecânico com "…" e nada de item descartado em silêncio — quando não couber, o texto é **reformulado para caber** (campo `summary` do researcher) ou o **campo/orçamento é ampliado** enquanto a guarda de fit permitir; lista truncada sempre declara o resto ("e mais N"). O dono dessa regra é o C188 (ver Dependências) — o C187 nasce já sob ela.
- Guardrails de produto: "sem fonte, não publica"; **empenho ≠ pagamento** (autorizado/empenhado/liquidado/pago/restos); **abrangência explícita** (`instituicao`/`setor`/`rede` — nunca somar); leitura relativa (nunca % estadual absoluto); atribuição de emenda só com autoria checada; PII mínima; artefato **gitignored** (repo público); falha isolada no lote.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o dossiê é documento de dados (números com fonte, séries por era e tabela de lacunas).
- **Decisões desbloqueadas:** a comunicação escolhe **o que entra na fala/agenda** com a instituição; **qual vínculo/entrega** priorizar; onde há **entrega documentada × só intenção**; **qual lacuna** buscar antes do encontro.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: fase rotulada por valor; abrangência rotulada em cada linha; empenho nunca tratado como pago; sem % estadual absoluto; lacuna explícita em vez de silêncio; ruído eleitoral fora.

## Dados da decisão (literais)

**Nome e artefatos (verbatim):** skill `.agents/skills/dossie-solla-instituicao/SKILL.md`; command `.opencode/commands/dossie-solla-instituicao.md`; subagente `.opencode/agent/dossie-solla-instituicao.md`; build entry + libs reusando o dono C186 (`scripts/build-dossie-solla-cidade.mjs`, `scripts/lib/dossie*.mjs`, `scripts/lib/reportText.mjs`).

**Definição de "instituição" (ampla):** universidade, instituto, empresa pública, autarquia, órgão público, conselho/entidade de classe, **categoria profissional**, movimento, rede.

**Eras (verbatim, reusar as do C186 — não criar eras novas):** **A** até 2006 (formação/residência/SESAB/consultoria MS/Secretaria Municipal de Saúde de Vitória da Conquista 1999–2002/SAS-MS 2003–2005); **B** 2007–2014 (Secretário Estadual de Saúde da Bahia, 01/01/2007–18/01/2014); **C** 2015–2027 (deputado federal). Carreira literal de apoio: 1985–1987 residência Medicina Social (UFBA/INAMPS); 1989/90–1998 SESAB; 1995–1999 consultor MS; 1998 professor Escola Bahiana de Medicina + pesquisador ISC/UFBA; 2006–2009 doutorado UFRJ; nascimento 11/04/1961; Comenda Dois de Julho (ALBA, 2013); **nunca** foi deputado estadual.

**Catálogo de instituições (v1):** arquivo novo (local exato decidido na implementação); entrada com `slug`, `name`, `aliases`, `kind` (`universidade | instituto_federal | empresa_publica | autarquia | orgao_publico | conselho_classe | entidade_classe | categoria_profissional | movimento | rede | outro`), `sphere` (`federal | estadual | municipal | nao_governamental`), `scope` (`nacional | BA`). Seed mínimo: **UFBA** (universidade/federal/BA), **Correios** (empresa_publica/federal/nacional), **Enfermagem** (categoria_profissional; âncoras ABEn-BA/COFEN/Coren-BA; federal/nacional). Token desconhecido → **fail-closed** acionável; escape `--slug=<x> --name="<Nome>"` para one-off; dedup após resolução; falha isolada.

**Abrangência/esfera (literais):** `instituicao` (a entidade como um todo) | `setor` (categoria/área; ex.: Enfermagem dentro da Saúde) | `rede` (entidades correlatas/colegiadas). **Nunca somar** setor/rede como se fosse a instituição (mesmo guardrail C163/C186).

**Fases de valor (verbatim):** `autorizado | empenhado | liquidado | pago | restos` (default `nao_informado`).

**Boletim modelo (literais de produto):** **1 página A4**; público-alvo **eleitores** (linguagem simples, sem jargão orçamentário); síntese **densa e direta** com **números destacados** quando houver; **≤6 destaques** + **≤14 itens** em "E mais" (todo item herdado carrega fonte no dossiê); timeline da trajetória; **sem declaração de fontes** (as fontes ficam exclusivamente no dossiê); rótulo **"Modelo — insumo interno"** + nota de defeso; **sem CTA/propaganda**; `NEEDS ASSET` para foto/selo/clipping. Herda **apenas** fatos já com fonte do dossiê (ledger), nunca introduz fato novo.

**Fontes de dados (verbatim):**
- Câmara dados abertos v2 (sem auth) `https://dadosabertos.camara.leg.br/api/v2`; deputy id **178857**; `/deputados/178857/discursos?dataInicio=&dataFim=` (**default 7 dias — sempre passar janela**); `/proposicoes?idDeputadoAutor=178857`; relatorias saem de `/proposicoes/{id}/tramitacoes`.
- Portal da Transparência CGU `https://api.portaldatransparencia.gov.br/api-de-dados`, header `chave-api-dados`, env `PORTAL_TRANSPARENCIA_API_KEY`; `/emendas` (**não filtra por município/instituição**; sem atribuição → **lacuna**, nunca zero silencioso); anos do mandato **2015–2026**. Complemento: Siga Brasil (Senado) e TCU – Painel de Execução de Emendas.
- Acervo interno Teqo **read-only** (homeserver): `Speech`/`SpeechSegment`/`SpeechCut`; facetas `src/lib/speechFacets.ts` (18 temas). **Mapa instituição→tema(s)** é fonte-chave do recorte institucional (ex.: Enfermagem→Saúde; UFBA→Educação/Ciência e Tecnologia); extração serializada com guard de confirmação (como C163/C186).
- IBGE/SIDRA/DATASUS só quando a instituição tiver recorte territorial (não obrigatório).
- Busca web datada: `"Jorge Solla" <instituição>` + `<tema>`; `site:` por fontes institucionais/oficiais (ufba.br, correios.com.br, cofen.gov.br, camara.leg.br, ptbahia.org.br, jorgesolla.com.br); excluir ruído de campanha 2026 (`-eleição -candidato -voto -coligação -pesquisa`); preferir verbos de entrega (emenda, recurso, convênio, parceria, projeto, relatoria, audiência, homenagem, repassado).

**Guarda de concorrência:** `MAX_RESEARCHERS_IN_FLIGHT` (referência C186) + extração read-only serializada 1 instituição por vez.

## Direção no codebase (hipótese)

- **Áreas prováveis:** skill `.agents/skills/dossie-solla-instituicao/`, command `.opencode/commands/`, subagente `.opencode/agent/`; catálogo de instituições novo (local a decidir); build entry reusando/generalizando `scripts/build-dossie-solla-cidade.mjs` + `scripts/lib/dossie*.mjs` (`reportText.mjs`, `dossieCareer`, `dossieCamara`, infra Chromium/`page.pdf`).
- **Precedente a olhar:** `.agents/skills/dossie-solla-cidade/SKILL.md` (lote, eras, recibo, guardrails), `.agents/skills/relatorio-cidade/SKILL.md`, `.opencode/agent/dossie-solla-cidade.md`, `scripts/lib/reportText.mjs`.
- **Risco de acoplamento:** **"edite o dono, não gema um irmão"** — estender o pipeline C186 para uma "unidade" plugável (município | instituição) em vez de fork paralelo; extração read-only à produção (guard + `default_transaction_read_only=on`); acervo cobre só 2011+ (pré-2011 = lacuna); PII mínima; defeso; registrar o command em `tests/unit/opencodeCommands.unit.spec.ts` e o mapa em `scripts/lib/test-affected-core.mjs`.

## Dependências

- **Hard:** nenhuma — pipeline C186, `reportText.mjs` e infra Chromium/PDF já existem; o `designer` produz o layout.
- **Soft:** **C188 (`relatorios-sem-truncamento`)** — o dossiê institucional deve nascer sem corte mecânico/sem descarte silencioso; o C188 conserta o dono que o C187 reusa (`docs/plans/relatorios-sem-truncamento.md`).
- **Soft:** `PORTAL_TRANSPARENCIA_API_KEY` (sem chave → emendas viram lacuna); acesso read-only ao acervo Teqo (guard de confirmação); catálogo de instituições (novo, seed mínimo).

## Fora de escopo

- Redigir/aprovar/veicular a **peça final** do boletim — a skill entrega o dossiê + o **boletim modelo** (1 página); a versão final, aprovada e veiculada, é da comunicação/campanha.
- Persistir dado novo na base, schema ou migration; segundo cadastro.
- Publicar/veicular a peça; qualquer peça de campanha/propaganda (defeso).
- Alterar `/dossie-solla-cidade` ou `/relatorio-cidade`; UI in-app de campanha; índice/PDF agregado de lote.
- Reconstruir a carreira pré-2011 fora do acervo (surge como lacuna, não invenção).

## Rabbit holes de produto

- **"Cobrir a instituição inteira vira escopo infinito."** Se alguém "só completar": instituição difusa (Correios no país todo) sem recorte. **Corte neste item:** eras fixas A/B/C + foco por fonte verificável + teto por seção.
- **"Categoria profissional vira a entidade."** Se alguém "só completar": somar ABEn/COFEN/Coren como se fossem a mesma coisa que "Enfermagem". **Corte neste item:** `kind`/abrangência explícitos (`instituicao`/`setor`/`rede`), nunca somados.
- **"IA plausível sem fonte."** **Corte neste item:** sem fonte não publica; lacuna explícita; número só com URL+data e fase.
- **"Vira recorte territorial."** **Corte neste item:** remover catálogo de municípios, IBGE por `ibgeCode` e esfera `municipio|regiao|polo` do caminho institucional.
- **"Empenho = entregue à instituição."** **Corte neste item:** fase por valor; empenho nunca tratado como pago.
- **"Fan-out infinito."** **Corte neste item:** 1 researcher por era por instituição + guarda de concorrência; extração serializada.

## Questões em aberto (produto)

- **Nome/slug?** **Opções:** A) `dossie-solla-instituicao` | B) `dossie-solla-orgao` | C) `dossie-solla-entidade`. **Recomendação:** A — casa com o escopo amplo (inclui categoria/rede). _(assumido — validar com a comunicação)_
- **Boletim no v1?** **Opções:** A) incluir | B) deixar de fora. **Recomendação:** A — _decidido pelo humano (2026-09-17): incluir o Boletim modelo no v1, com paridade com o C186._ Classe C, com hi-fi próprio.
- **Catálogo fail-closed ou livre?** **Opções:** A) fail-closed + escape one-off | B) livre. **Recomendação:** A — evita slug inventado/duplicado e mantém o catálogo como fonte de verdade. _(assumido)_
- **Taxonomia de "instituição"?** **Opções:** A) ampla, incl. categoria profissional | B) só entes formais. **Recomendação:** A — cobre "Enfermagem", caso de uso real declarado. _(assumido)_
- **Abrangência `instituicao|setor|rede`?** **Opções:** A) adotar os três | B) só `instituicao`. **Recomendação:** A — preserva o guardrail de não somar. _(assumido)_
- **Novo hi-fi ou reuso do layout C186?** **Opções:** A) novo, mesma família visual | B) reusar o HTML C186 direto. **Recomendação:** A — seções próprias de instituição exigem port novo; manter família. _(assumido)_
- **Destino do artefato?** **Opções:** A) gitignored (`docs/research/…` + `data/…`) | B) commitado. **Recomendação:** A — dado interno/defeso em repo público; só skill/scripts/testes/changelog entram no git. _(assumido)_

## Referências

- GitHub Issue #<N> (após `pnpm agent:register`)
- Débito/regra de texto: `docs/plans/relatorios-sem-truncamento.md` (C188) — sem "…" e sem descarte silencioso
- Skill-modelo (C186, #1132): `.agents/skills/dossie-solla-cidade/SKILL.md`; `docs/plans/dossie-solla-cidade.md` + `-impl.md`; `docs/changelog/2026-09-17-c186.md`
- `.opencode/commands/dossie-solla-cidade.md`, `.opencode/agent/dossie-solla-cidade.md`; padrão de lote OPS118: `docs/plans/ops118-relatorio-cidade-lote-municipios-sub-agentes.md`
- Builder: `scripts/build-dossie-solla-cidade.mjs`, `scripts/lib/dossie{Research,Blocks,Render,Bulletin,BulletinRender,Camara,Career,HealthData}.mjs`, `scripts/lib/reportText.mjs`
- Testes a espelhar: `tests/unit/dossie*.unit.spec.ts`, `tests/unit/dossieBatchSkill.unit.spec.ts`, `tests/unit/opencodeCommands.unit.spec.ts`; mapa `scripts/lib/test-affected-core.mjs`
- Design UI (gate) — dossiê: `docs/plans/dossie-solla-instituicao-ui-design.html` (+ `docs/plans/dossie-solla-instituicao-ui-design-assets/`)
- Design UI (gate) — boletim modelo: `docs/plans/dossie-solla-instituicao-boletim-ui-design.html` (+ assets); precedente `docs/plans/dossie-solla-cidade-boletim-ui-design.html`
- `src/lib/speechFacets.ts`; `src/collections/Organization.ts` (CRM operacional — **não** é acervo do dossiê)
- `AGENTS.md` — defeso, PII mínima, artefato gitignored e "edite o dono, não gema um irmão"
