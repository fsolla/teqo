# OPS118 — relatorio-cidade: lote de municípios + sub-agentes por etapa

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1065
Priority: P2
Impeccable: A — N/A (skill/ferramenta de agentes, sem superfície de produto)
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng; contrato de lote na skill + decomposição em sub-agentes + prova
Responsável: —

## Intenção

Hoje a skill `/relatorio-cidade` é estritamente single-city: o "Pipeline (3 passos)" (`.agents/skills/relatorio-cidade/SKILL.md:20-59`) usa **um** `<slug>` para tudo — resolução (`:22-25`), pesquisa web → `data/relatorios-cidade/<slug>.research.json` (`:26-28`), extração read-only → `<slug>.snapshot.json` (`:29-45`) e render local → `docs/research/relatorios-cidade/<slug>-<YYYY-MM-DD>.pdf|.md` (`:46-59`). Não há loop nem lote em lugar nenhum, e o subagente `.opencode/agent/relatorio-cidade.md` repete os 4 papéis (slug → pesquisa → ssh → build) sempre no singular. Pedir "Salvador, Ilheus, Itacare" hoje exige 3 execuções manuais. Pior: a **pesquisa web é o sugador de contexto** (SKILL `:26-28`) e roda no mesmo agente que depois carrega logs de ssh e de build — o contexto do orquestrador incha à toa. Este item entrega (a) um contrato de **lote** e (b) a quebra do fluxo em **sub-agentes por etapa**, sem tocar no produto nem no layout do PDF.

## Persona e fluxo

- **Persona / contexto:** quem invoca a skill (candidato/CG antes de uma agenda, ou o agente principal preparando um giro por várias cidades).
- **Job principal:** pedir N municípios numa invocação e receber N PDFs+MDs, cada um com o mesmo contrato de hoje.
- **Fluxo desejado:** `/relatorio-cidade Salvador, Ilheus, Itacare` → slugs canônicos resolvidos → cada cidade pesquisada/extraída/gerada **em paralelo** → ao fim, uma lista de saídas (PDF+MD por cidade) e um resumo curto de sucesso/falha por cidade.
- **Anti-goals de produto:** não gerar um PDF agregado único; não inflar o contexto do agente principal com research ou logs; não paralelizar o que não é seguro (checkout compartilhado); não mudar o conteúdo/layout do relatório.

## Objetivo e aceite

- A skill aceita **vários** municípios numa única invocação e produz, por cidade, o par `docs/research/relatorios-cidade/<slug>-<YYYY-MM-DD>.pdf|.md` — mesmo contrato de um único município hoje.
- A pesquisa web (etapa cara de contexto) roda em **sub-agente por cidade**, isolada do orquestrador; o orquestrador retém apenas um recibo curto por cidade.
- **Falha isolada:** cidade com erro não cancela as demais; o resultado final reporta explicitamente o que saiu e o que falhou (sucesso parcial visível).
- A invocação de lote é documentada de forma literal (vírgula como separador), preservando o caso single-city sem regressão.
- Guardrails da skill intactos: sem fonte não publica, empenho ≠ pagamento, leitura relativa, PII mínima, artefato gitignored.

## Dados (intenção)

- **Vou apresentar dados?** Não — mudança de contrato de ferramenta de agentes.
- **Decisões desbloqueadas:** quem pede o relatório de uma agenda inteira decide com N PDFs em um passo, em vez de N invocações.
- **Forma:** _adiada ao plano de implementação_.

## Dados da decisão (literais)

- **Invocação de lote (proposta):** `/relatorio-cidade Salvador, Ilheus, Itacare` — lista separada por **vírgula**; cada token é resolvido a slug canônico. Single-city (`/relatorio-cidade Feira de Santana`) permanece válido.
- **Slug canônico:** `src/lib/municipalityCatalog.ts` (435 unidades; Salvador = `salvador-ze-N`).
- **Artefatos por cidade (inalterados):** `data/relatorios-cidade/<slug>.research.json`, `data/relatorios-cidade/<slug>.snapshot.json`, `docs/research/relatorios-cidade/<slug>-<YYYY-MM-DD>.pdf` + `.md`.
- **Scripts (chamados em loop por cidade):** `scripts/extract-city-report-snapshot.mjs:63-78` (`--municipality=<slug> --out=<json>`), `scripts/cityReportSnapshot.mjs:259-266` (`composeCityReportSnapshot({payload, actor, slug, …})`), `scripts/build-city-report.mjs:49-62` (`--snapshot` + `--research`; mismatch guard `:94-98`).
- **Recibo do sub-agente por cidade:** `slug`, contagem de itens de pesquisa, `gaps`, nº de notícias ≤90 dias, flags de baixa confiança — **nunca** o corpo do `research.json`.
- **Sem índice agregado neste item:** uma saída PDF+MD por cidade, como hoje.

## Análise de decomposição em sub-agentes

- **Recomendado — fan-out por cidade:**
  - **Orchestrator (agente principal):** parseia a lista, resolve slugs canônicos (leitura barata do catálogo), dispara os sub-agentes, coleta caminhos de saída + recibo curto, faz a validação/summary final. **Nunca** segura pesquisa web nem corpos de JSON.
  - **Researcher+analyst por cidade (×N, paralelo):** o único passo pesado de contexto. Produz o `research.json` completo (fatos do checklist + blocos interpretativos `approach`, `preCandidates`, `leaders`, `leaderAgenda`, `opposition`, `alliances`, `investments`, `demography`, `economy`, `transport`) e devolve só o recibo curto.
  - **Extract + build determinísticos:** comandos por cidade mantidos **fora** do researcher (não devem carregar log de ssh/build). Baixo contexto para o modelo.
- **Rejeitado/condicional — collector + analyst separados:** um sub-agente só de fatos crus e outro só de blocos interpretativos adiciona um handoff do fact-set inteiro; como o analista ingere tudo de qualquer forma, o ganho de contexto é marginal. **Só vale** se o fact-set de uma única cidade ficar gigante; recomendação: manter pesquisa+análise em **um** agente por cidade.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/relatorio-cidade/SKILL.md` (contrato de lote + delegação por etapa), `.opencode/agent/relatorio-cidade.md` (subagente por cidade), possivelmente um novo subagente/role de pesquisa.
- **Precedente a olhar:** `docs/plans/relatorio-cidade-viagem.md` + `-impl.md` (C163, Issue #1007) escolheu skill + subagente (opção A, `-impl.md:152-155`), linguagem no singular ("chamar com um município", `:11`/`:105`), sem lote.
- **Risco de acoplamento:** a extração ssh roda no checkout de **scratch** `~/teqo-report` (SKILL `:29-45`) — cidades concorrentes podem colidir; a extração pode precisar de serialização ou isolamento por cidade (decisão de engenharia, mas a restrição fica registrada). O SHA do extrator e do builder deve continuar sendo o mesmo (`:45`).

## Dependências

- **#1025 (suave, não bloqueia):** a API de emendas não atribui emenda ao município (P2/defect) — relação frouxa, não é pré-requisito.
- **C163 / #1007 (histórico):** skill + subagente já existem; este item estende, não recria.

## Fora de escopo

- PDF agregado/índice de lote (recomendado **não** fazer aqui).
- Mudar conteúdo, seções ou layout do relatório (seguem como estão).
- Atribuição de emenda ao município (#1025).
- Escrever na base de produção ou commitar artefatos (gitignored em `.gitignore:83-84`).

## Rabbit holes de produto

- **"Já que é lote, gera um sumário estadual."** Vira novo produto (agregação, ranking, mapa) fora do appetite. **Corte neste item:** uma saída por cidade; sumário só na resposta do orquestrador.
- **"Divide tudo em muitos sub-agentes."** Cada handoff carrega contexto e some latência. **Corte neste item:** um researcher por cidade; extract/build fora dele.
- **"Paraleliza o ssh também."** Colisão no `~/teqo-report` compartilhado. **Corte neste item:** paralelismo de pesquisa é seguro; extração pode ser serializada.

## Questões em aberto (produto)

- **Sintaxe do lote?** **Opções:** A) vírgula (`,`) como separador canônico; B) ponto-e-vírgula; C) espaço livre. **Recomendação:** A — vírgula é legível, não colide com nomes compostos ("Feira de Santana", "Salvador, Ilheus") e dispensa parsing ambíguo. _(assumido — validar no gate)_
- **Índice agregado do lote?** **Opções:** A) não ter; B) um `.md` de índice com links por cidade. **Recomendação:** A — fora do appetite; o resumo na resposta do orquestrador cobre a conferência. _(assumido — validar no gate)_

## Fases (ordem de entrega)

1. **F1 — Contrato de lote:** documentar o parsing da lista + resolução de slugs em `.agents/skills/relatorio-cidade/SKILL.md`, com o caso single-city preservado.
2. **F2 — Decomposição:** separar pesquisa (sub-agente por cidade) de extract/build no contrato da skill e no `.opencode/agent/relatorio-cidade.md`; definir o recibo curto.
3. **F3 — Prova:** rodar um lote pequeno (2–3 municípios) com 1 cidade falhando de propósito; conferir saídas por cidade e falha isolada; `pnpm format:check`.

## Verificação

- Um lote de 2–3 municípios produz um par PDF+MD por cidade, com nomes `<slug>-<YYYY-MM-DD>`.
- Cidade inválida/sem fonte falha isolada; as demais entregam (sucesso parcial reportado).
- Recibo do sub-agente não contém corpo de `research.json`; orquestrador não carrega pesquisa web.
- Single-city segue funcionando sem regressão; guards da skill intactos.

## Riscos

- **Colisão do checkout compartilhado (`~/teqo-report`).** Mitigação: serializar a extração por cidade ou isolar o checkout.
- **Mismatch snapshot × research.** O guard do builder (`scripts/build-city-report.mjs:94-98`) continua fail-closed — nunca casar JSON à mão.
- **Regressão do single-city.** Mitigação: manter o caminho atual como caso de lote com N=1 e cobrir na prova.
- **Contexto vazando para o orquestrador.** Mitigação: recibo curto por contrato; revisão da skill na verificação.

## Referências

- GitHub Issue #1065 · relação suave: #1025
- `.agents/skills/relatorio-cidade/SKILL.md:20-59,210-215` · `.opencode/agent/relatorio-cidade.md`
- `scripts/extract-city-report-snapshot.mjs:63-78` · `scripts/cityReportSnapshot.mjs:259-266` · `scripts/build-city-report.mjs:49-62,94-98,116-120`
- `src/lib/municipalityCatalog.ts` — catálogo de 435 unidades; `docs/plans/relatorio-cidade-viagem.md` + `-impl.md:152-155`
- `docs/ops/teqo-1313-deploy.md` §C163 · `.gitignore:83-84` · `AGENTS.md`
