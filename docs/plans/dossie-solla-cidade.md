# Dossiê Solla por cidade — o que ele fez pela cidade e pela região (skill → dossiê + boletim modelo)

Status: rascunho
Atualizado em: 2026-09-17
Issue: #1132
Priority: P2
Impeccable: C — fluxo novo (dossiê/relatório + boletim modelo por cidade)
Design UI: docs/plans/dossie-solla-cidade-ui-design.html + docs/plans/dossie-solla-cidade-boletim-ui-design.html
Appetite: ~3–4 dias eng; um outcome verificável — rodar `/dossie-solla-cidade <cidade>` e obter PDF+`.md` (seções por era, números com fonte, lacunas) **e** o PDF do Boletim Informativo modelo (1 página A4, público eleitor)
Responsável: —

## Intenção

A equipe de comunicação precisa montar **boletins informativos por município da Bahia** e hoje não tem de onde partir: para dizer "o que Solla fez por esta cidade", a pessoa garimpa memória, WhatsApp e notícia solta. A skill existente `/relatorio-cidade` não resolve isso — ela é um **briefing pré-viagem** do cenário eleitoral atual (quem manda, o que está quente, o que anunciar), não um levantamento da **obra de uma vida**. Este item cria uma skill nova que reúne, com fonte e data, **tudo o que Jorge Solla fez pela cidade e sua região ao longo de toda a carreira** — epidemiologista na SESAB, secretário municipal de Saúde de Vitória da Conquista, Secretário de Atenção à Saúde do Ministério da Saúde, secretário estadual de Saúde da Bahia e deputado federal. O `/relatorio-cidade` inspira o fluxo (skill + command + subagente, sub-agentes por etapa, build local de PDF), mas o conteúdo e o recorte são outros. Além do dossiê, a skill entrega um **Boletim Informativo modelo** — **uma página A4** com a síntese, em linguagem de **público eleitor**, de tudo o que Solla fez por aquela cidade e/ou região; o pessoal de comunicação parte do dossiê + desse modelo para produzir o boletim final.

## Persona e fluxo

- **Persona / contexto:** equipe de comunicação (`communicator`/assessoria), na mesa, montando um boletim por cidade para pauta de mandato; sem tempo de garimpo e obrigada a não publicar sem lastro.
- **Job principal:** numa invocação, obter (1) um dossiê **datado e com fonte** de tudo o que Solla entregou àquela cidade e região — com números sempre que existirem — e (2) um **boletim modelo de 1 página**, em linguagem de eleitor, sintetizando essas entregas, para basear o boletim final da cidade.
- **Fluxo desejado:** pede `/dossie-solla-cidade <cidade>` → o orquestrador resolve o slug, dispara pesquisadores (um por era da carreira) em paralelo, roda a extração read-only do acervo e monta os dois PDFs (+ `.md`) nos layouts já desenhados pelo `designer` → a comunicação lê a linha do tempo, escolhe tema/ângulo, confere as fontes e adapta o boletim modelo; lacunas ficam explícitas.
- **Anti-goals de produto:** publicar peça de campanha/propaganda pelo próprio pipeline (defeso 2026 — o boletim modelo sai rotulado como insumo interno); repetir o recorte do `/relatorio-cidade` (cenário eleitoral atual); inventar fato sem fonte; somar região/polo como se fosse da cidade; virar biografia oficial de vida inteira sem foco local; segundo cadastro de pessoa/dado.
- **Público do boletim modelo:** eleitores da cidade/região — linguagem simples, sem jargão técnico/orçamentário, números destacados e legíveis; **não** é documento de gestor.

### Esboço de fluxo (C)

```text
[pede: /dossie-solla-cidade Ilheus] → [orquestrador resolve slug canônico]
→ [1 researcher por era (A/B/C) por cidade, em paralelo] ─┐
→ [extração read-only do acervo (serializada, 1 cidade)]  ─┼→ [build local: HTML dos designers → PDF dossiê + .md]
→ [summary: ok|failed + recibo curto por cidade/era] ─────┘   [+ Boletim modelo 1×A4, público eleitor]
→ [comunicação escolhe tema/ângulo, confere fonte e adapta o boletim modelo; lacunas explícitas]
```

### Design UI (C)

- Design UI (gate) — dossiê: `docs/plans/dossie-solla-cidade-ui-design.html` — layout do **relatório A4** (página 1 "resumo de uma olhada" + seções por era, tabelas de números/fontes e a tabela de lacunas), produzido pelo `designer` **antes** da montagem final da skill e portado pelo build.
- Design UI (gate) — boletim modelo: `docs/plans/dossie-solla-cidade-boletim-ui-design.html` — layout do **Boletim Informativo modelo (1 página A4, público eleitor)**, também produzido pelo `designer` antes da montagem final e portado pelo build.

## Objetivo e aceite

- Com uma cidade, sai um par **PDF A4 datado + companion `.md`** com: resumo de uma olhada; linha do tempo da carreira (períodos + como cada um foi recuperado); seções por era **A** (carreira técnica/SESAB + Secretaria Municipal de Saúde de Vitória da Conquista + SAS/MS, até 2006), **B** (SESAB 2007–2014) e **C** (deputado federal 2015–2027); região/polo; títulos/honrarias e vínculos locais; ganchos para o boletim; fontes e limites; nota de defeso.
- Com a mesma cidade, sai também o **Boletim Informativo modelo**: **1 página A4**, em linguagem de público eleitor, **denso e direto ao ponto** (mais entregas por página, frases curtas), sintetizando o que Solla fez pela cidade/região, com os números em destaque e o rótulo de **insumo interno/modelo** (não é a peça final publicável). **Sem declaração de fontes** — as fontes vivem só no dossiê.
- **Toda afirmação não trivial do dossiê tem fonte visível** (URL + data); o que não foi achado vira **lacuna explícita** — nunca inferência. **Números sempre que a fonte informar.** O boletim modelo herda só fatos com fonte do dossiê — nunca introduz fato novo.
- Os layouts (dossiê e boletim modelo) vêm dos artefatos hi-fi do `designer` (fonte de verdade do port), não inventados na implementação.
- Pesquisa roda em **sub-agente por era, por cidade, em paralelo**; o orquestrador agrega **apenas recibos curtos** (nunca o corpo dos JSONs) e serializa a extração read-only.
- Guardrails de produto: "sem fonte, não publica"; **empenho ≠ pagamento** (separar autorizado/empenhado/liquidado/pago/restos); **esfera explícita** (município / região / polo — nunca somar); leitura relativa (nunca % estadual absoluto); atribuição de emenda de bancada/relator só com autoria checada; PII mínima; artefato **gitignored** (repo público); falha isolada no lote não cancela as demais.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o dossiê é documento de dados (números com fonte, séries e tabelas de lacunas) e o boletim modelo destaca números legíveis ao eleitor.
- **Decisões desbloqueadas:** a comunicação escolhe **qual entrega/tema** vira o boletim da cidade; em que **ângulo** (por era, por área — saúde/obras/emendas); **o que entra na 1 página do boletim modelo** (o recorte que fala com o eleitor); e **qual lacuna** buscar antes de publicar.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: esfera rotulada em cada linha; empenho nunca tratado como pago; sem % estadual absoluto; lacuna explícita em vez de silêncio; ruído eleitoral fora.

## Dados da decisão (literais)

**Boletim Informativo modelo (literais de produto):** **1 página A4**; público-alvo **eleitores** (linguagem simples, sem jargão orçamentário); síntese **densa e direta** do que Solla fez pela cidade/região (mais entregas na página, frases curtas) com **números destacados** quando houver; **sem declaração de fontes** (as fontes ficam exclusivamente no dossiê — o boletim pode citar o dossiê como origem); rótulo **"modelo — insumo interno"** + nota de defeso; **sem CTA/propaganda** (o CTA é decisão da peça final da campanha, fora deste item); `NEEDS ASSET` para foto/selo/clipping. Herda **apenas fatos já com fonte** do dossiê.

**Linha do tempo da carreira (carregar verbatim; incertezas ficam marcadas, nunca inventadas):**

| Período                   | Papel                                                                                                                                                      | Como recuperar                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1985–1987                 | Residência em Medicina Social (UFBA/INAMPS)                                                                                                                | Biografia Câmara                                                                                |
| 1989/1990–1998            | SESAB (epidemiologista no Distrito Sanitário de Itapagipe; sanitarista no nível central — PACS/PSF/DEPAS; cedido à SMS Salvador; apoio a Amargosa 1997–98) | Pronunciamento dele 03/01/2007 (saude.ba.gov.br); biografia Câmara. **[INCERTO: 1989 vs 1990]** |
| 1995–1999                 | Consultor do Ministério da Saúde (Brasília)                                                                                                                | Biografia Câmara                                                                                |
| 1998                      | Professor (Escola Bahiana de Medicina) + pesquisador ISC/UFBA                                                                                              | Biografia Câmara / PT-BA                                                                        |
| **1999–2002**             | **Secretário Municipal de Saúde de Vitória da Conquista** (prefeito Guilherme Menezes)                                                                     | Biografia Câmara (oficial), PT-BA                                                               |
| **2003–2005**             | **Secretário de Atenção à Saúde do Ministério da Saúde** (ministro Humberto Costa)                                                                         | Biografia Câmara; discurso 2007. **[INCERTO: 2005 vs 2006 — fonte oficial Câmara = 2005]**      |
| 2006–2009                 | Doutorado em Clínica Médica (UFRJ)                                                                                                                         | Biografia Câmara                                                                                |
| **01/01/2007–18/01/2014** | **Secretário Estadual de Saúde da Bahia (SESAB)** — governo Jaques Wagner                                                                                  | Wikipedia com refs + notícias SESAB                                                             |
| **2015–2019**             | Deputado Federal, 55ª legislatura (125.159 votos)                                                                                                          | API Câmara `/deputados/178857`                                                                  |
| **2019–2023**             | Deputado Federal, 56ª legislatura (135.657 votos)                                                                                                          | idem                                                                                            |
| **2023–2027**             | Deputado Federal, 57ª legislatura (128.968 votos)                                                                                                          | idem                                                                                            |

- **Outros literais:** nascimento **11/04/1961** (Salvador-BA) — **não** 1962; Câmara deputy id **178857**; **nunca** foi deputado estadual; Comenda Dois de Julho (ALBA, 2013); Cidadão Ilheense / Santamarense.
- **Comissões 57ª:** Comissão de Saúde (titular), CFFC (suplente), PEC 014/21 agentes de saúde, Vice-líder da Federação Brasil da Esperança desde 02/06/2026. **56ª:** Comissão de Saúde; relator da renovação do Mais Médicos (2018). **55ª:** coordenador da bancada do PT na Comissão de Seguridade Social e Família (2016).
- **APIs/portais (documentar no SKILL):** Câmara dados abertos v2 (sem auth) `https://dadosabertos.camara.leg.br/api/v2` — `/deputados/178857`, `/deputados/178857/discursos?dataInicio=&dataFim=` (**default 7 dias!**), `/deputados/178857/orgaos|frentes`, `/proposicoes?idDeputadoAutor=178857` (itens=100; ~3.338), `/proposicoes/{id}/tramitacoes` (relatorias saem daqui — `/relatorias` **não existe**, 405), `/votacoes`, `/eventos`; site `https://www.camara.leg.br/deputados/178857`.
- **Portal da Transparência (CGU):** base `https://api.portaldatransparencia.gov.br/api-de-dados`, header `chave-api-dados`, env `PORTAL_TRANSPARENCIA_API_KEY`; `/emendas` (params `codigoEmenda,numeroEmenda,nomeAutor,tipoEmenda,ano,codigoFuncao,codigoSubfuncao,pagina` — **não filtra por município**; parsear `localidadeDoGasto`); `/emendas/documentos/{codigo}`; **`/convenios` este sim** filtra por `codigoIBGE`/`uf`. **Anos do mandato: 2015–2026.**
- **Siga Brasil (Senado)** painel de emendas por autor/ano/município; **TCU – Painel de Execução de Emendas** (por município e parlamentar).
- **DATASUS:** OpenDataSUS CKAN `https://opendatasus.saude.gov.br/api/3/action/package_list`; TabNet `http://tabnet.datasus.gov.br/` (CNES/SIH/SIA, export CSV); **CNES** `https://cnes.datasus.gov.br/`; **SIOPS** `http://siops.datasus.gov.br/` (gasto público em saúde — chave para provar gestão municipal/estadual).
- **IBGE:** `https://servicodados.ibge.gov.br/api/v1/localidades/estados/BA/municipios`; malhas v3; SIDRA `https://apisidra.ibge.gov.br/values/t/{tabela}/n6/{codigoIBGE}/v/{var}/p/{ano}`.
- **TSE:** `https://dadosabertos.tse.jus.br/` datasets "Votação nominal por município e zona" (CSV); CDN `cdn.tse.jus.br/estatistica/sead/odsele/...` (pode 403).
- **Diário Oficial:** DOU `https://www.in.gov.br/consulta` (dados abertos grátis desde 2020); DOE-BA **DOOL** `https://dool.egba.ba.gov.br/` (desde 30/06/2007); acervo histórico EGBA desde 1915 (sem API); **Transparência Bahia** `https://www.transparencia.ba.gov.br/` (FIPLAN).
- **Acervo de falas (Teqo, interno, read-only):** collections `Speech`/`SpeechSegment`/`SpeechCut`; filtros `src/utilities/speech/speechListFilters.ts`; facetas `src/lib/speechFacets.ts` (18 temas); cobre 54ª–57ª legislaturas (2011+) — **não cobre a carreira pré-2011**; extração read-only no homeserver como no `/relatorio-cidade`.
- **Estratégia de busca web:** `"Jorge Solla" <cidade>` / `<tema>`; recorte por data `after:YYYY-MM-DD before:YYYY-MM-DD`; `site:` por veículo (atarde.com.br, correio24horas.com.br, bahianoticias.com.br, metro1.com.br, bnews.com.br, bahia.ba, acordacidade.com.br, g1.globo.com/ba, camara.leg.br, ptnacamara.org.br, ptbahia.org.br, saude.ba.gov.br, jorgesolla.com.br); **excluir ruído de campanha 2026** (`-eleição -candidato -voto -coligação -pesquisa`) e preferir verbos de entrega (emenda, recurso, repassado, hospital, UPA, SAMU, obra, inaugura, audiência, relator); templates por período (1999–2002 Conquista; 2003–2005 MS; 2007–2014 SESAB; 2015–2026 Câmara).
- **Decomposição (intenção):** orquestrador (parse do lote, catálogo `src/lib/municipalityCatalog.ts`, Salvador = `salvador-ze-N`, fan-out, agrega só recibos, extração read-only serializada 1 cidade por vez, build local) + **um researcher sub-agent por era (A/B/C) por cidade, em paralelo**; cada um escreve `<slug>.<era>.research.json` com `{item, answer, numbers, sourceUrl, sourceDate}` e devolve **recibo curto** (status, path, itemCount, gapCount, gaps[]) no padrão do `/relatorio-cidade`. Guarda de concorrência para lotes grandes (não estourar limite).

## Direção no codebase (hipótese)

- **Áreas prováveis:** skill `.agents/skills/dossie-solla-cidade/SKILL.md`, command `.opencode/commands/dossie-solla-cidade.md`, subagente `.opencode/agent/dossie-solla-cidade.md`; build reusando `scripts/build-city-report.mjs` + `scripts/lib/cityReport*.mjs` (dossiê) e um build irmão de 1 página para o boletim; fetch Câmara `scripts/lib/camaraFetch.mjs`/`camaraSpeeches.mjs` (`SOLLA_DEPUTY_ID=178857`) e emendas `scripts/lib/portalTransparenciaEmendas.mjs` (match `localidadeDoGasto`, fail-closed → lacuna).
- **Precedente a olhar:** `.agents/skills/relatorio-cidade/SKILL.md` (lote, recibo, guardrails), `.opencode/agent/relatorio-cidade.md`, `.agents/skills/plan-issue/ui-design-html.md` (artefato hi-fi do `designer`), `scripts/build-solla-ceuci-salvador-report.mjs` (narrativa PDF), `.opencode/skills/solla-comunicacao/referencia/perfil-e-posicoes.md` (bio).
- **Risco de acoplamento:** extração read-only à produção (guard de confirmação + `default_transaction_read_only=on`); NÃO duplicar o `/relatorio-cidade` — compartilhar scripts/lib quando fizer sentido; território = Território de Identidade (`src/lib/municipalityCatalog.ts`, `bahiaTerritories.ts`); acervo cobre só 2011+.

## Dependências

- **Nenhuma dura** — o `/relatorio-cidade` (skill+command+agent), o acervo de falas e o molde de PDF já existem; o `designer` produz o layout do relatório.
- Soft: `PORTAL_TRANSPARENCIA_API_KEY` para emendas (sem chave → lacuna); a API de emendas não atribui ao município — aqui o match é por `localidadeDoGasto` e degrada para lacuna.

## Fora de escopo

- Redigir/aprovar/veicular a **peça final publicável** do boletim — a skill entrega o dossiê + o **boletim modelo** (1 página); a versão final, aprovada e veiculada, é da comunicação/campanha.
- Publicar/distribuir (site, redes, imprensa); qualquer peça de campanha eleitoral; CTA de campanha no boletim modelo.
- Persistir dados novos na base, segundo cadastro, ou qualquer schema/migration.
- Índice/PDF agregado de lote (uma cidade = um par PDF+MD).
- Alterar o `/relatorio-cidade`; reconstruir a carreira pré-2011 fora do acervo (surge como lacuna, não invenção).
- Design gráfico/arte final do boletim — só o layout do relatório hi-fi.

## Rabbit holes de produto

- **"Cobrir a vida inteira vira biografia oficial."** Se alguém "só completar": dossiê de 60 páginas sem foco local. **Corte neste item:** eras fixas A/B/C, foco cidade+região, teto por seção.
- **"IA plausível sem fonte."** Se alguém "só completar": texto bonito sem lastro. **Corte neste item:** sem fonte não publica; lacuna explícita; números só com URL+data.
- **"Somar região/polo como da cidade."** Se alguém "só completar": inflar a entrega local. **Corte neste item:** esfera rotulada (`município`/`região`/`polo`), nunca somada.
- **"Vira peça de campanha."** Se alguém "só completar": publicidade institucional no defeso, ou o boletim modelo ser veiculado como peça final sem revisão. **Corte neste item:** dossiê + boletim modelo rotulados como insumo interno gitignored + nota de defeso; sem CTA; a peça final é da comunicação.
- **"Boletim modelo vira fact-oide sem fonte."** Se alguém "só completar": síntese bonita para o eleitor sem lastro. **Corte neste item:** o boletim modelo herda apenas fatos já com fonte do dossiê e traz a linha de fontes; número sem fonte não entra.
- **"Fan-out infinito de sub-agentes."** Se alguém "só completar": N cidades × N eras × N buscas. **Corte neste item:** pesquisador por era por cidade + guarda de concorrência; extração serializada.

## Questões em aberto (produto)

- **Nome da skill?** **Opções:** A) `dossie-solla-cidade` | B) `boletim-solla-cidade` | C) `realizacoes-solla-cidade`. **Recomendação:** A — "dossiê" descreve o artefato interno (insumo), não promete a peça final "boletim"; B pode confundir com o boletim pronto. _(assumido — validar com a comunicação)_
- **Recorte das eras?** **Opções:** A) 3 eras (até 2006 / 2007–2014 / 2015–2027) | B) por cargo (6+ blocos) | C) por área. **Recomendação:** A — equilibra fan-out e coerência narrativa (técnica+MS / SESAB / Câmara). _(assumido)_
- **Salvador?** **Opções:** A) exigir `salvador-ze-N` como no `/relatorio-cidade` | B) aceitar "Salvador" e agregar as 19 zonas. **Recomendação:** A — consistência com o catálogo; B vira produto novo. _(assumido)_
- **Lote de cidades?** **Opções:** A) só 1 cidade no v1 | B) lote por vírgula já no v1. **Recomendação:** B — o lote e o fan-out são o motivo do appetite; herdar o contrato do `/relatorio-cidade`, com falha isolada. _(assumido)_
- **Destino do artefato?** **Opções:** A) gitignored (`docs/research/…`) | B) commitado. **Recomendação:** A — dado sensível/defeso em repo público; só skill/scripts/changelog entram no git. _(assumido)_
- **Teto do relatório?** **Opções:** A) resumo + seções por era com teto de itens | B) sem teto. **Recomendação:** A — leitura de bolso; detalhe na tabela de fontes/lacunas. _(assumido)_
- **Boletim modelo tem CTA de campanha?** **Opções:** A) sem CTA (só informativo, rótulo de modelo) | B) com CTA "vote 1313". **Recomendação:** A — em ano de defeso o pipeline não entrega peça de campanha; o CTA é decisão da peça final da campanha. _(assumido)_
- **Boletim modelo traz fontes?** **Opções:** A) **sem fontes** no boletim (as fontes vivem só no dossiê) | B) com linha de fontes. **Recomendação:** A — decisão do produto (2026-09-17): o boletim vai direto ao ponto para o eleitor; a conferência de fonte fica no dossiê, que o acompanha. _(decidido pelo humano)_
- **Boletim modelo é 1 por cidade?** **Opções:** A) 1 página por cidade, sempre | B) emitir só quando houver conteúdo suficiente. **Recomendação:** A — entrega previsível; se faltar conteúdo, a página sai com o que há e lacunas explícitas. _(assumido)_
- **Densidade do boletim?** **Opções:** A) mais entregas por página, frases curtas, direto ao ponto | B) poucos destaques grandes. **Recomendação:** A — direção do produto (2026-09-17): o boletim deve carregar o máximo de informação útil ao eleitor sem virar documento técnico. _(decidido pelo humano)_

## Referências

- GitHub Issue #1132; skill inspiradora: `.agents/skills/relatorio-cidade/SKILL.md` e `docs/plans/relatorio-cidade-viagem.md` + `ops118-relatorio-cidade-lote-municipios-sub-agentes.md`.
- Design UI (gate) — dossiê: `docs/plans/dossie-solla-cidade-ui-design.html` (+ `docs/plans/dossie-solla-cidade-ui-design-assets/` se houver SVG próprio).
- Design UI (gate) — boletim modelo: `docs/plans/dossie-solla-cidade-boletim-ui-design.html` (+ `docs/plans/dossie-solla-cidade-boletim-ui-design-assets/` se houver SVG próprio).
- Padrão a espelhar: `.opencode/commands/relatorio-cidade.md`, `.opencode/agent/relatorio-cidade.md`; build `scripts/build-city-report.mjs`, `scripts/lib/cityReport*.mjs`, `scripts/extract-city-report-snapshot.mjs`, `scripts/cityReportSnapshot.mjs`.
- Fontes/APIs: `scripts/lib/camaraFetch.mjs`, `scripts/lib/camaraSpeeches.mjs`, `scripts/lib/portalTransparenciaEmendas.mjs`; `src/lib/municipalityCatalog.ts`, `src/lib/bahiaTerritories.ts`, `src/lib/speechFacets.ts`, `src/utilities/speech/speechListFilters.ts`, `src/collections/Speech.ts`.
- Bio: `.opencode/skills/solla-comunicacao/referencia/perfil-e-posicoes.md`; narrativa PDF: `scripts/build-solla-ceuci-salvador-report.mjs`, `docs/plans/relatorio-cidade-viagem-a4-draft.html`.
- Testes a espelhar: `tests/unit/opencodeCommands.unit.spec.ts`, `tests/unit/cityReportBatchSkill.unit.spec.ts`, `tests/unit/cityReport*.unit.spec.ts`; changelog: `docs/changelog/2026-09-17-c186.md`.
- `AGENTS.md` — regras de defeso, PII mínima, artefato gitignored e "edite o dono, não gema um irmão".
