# Impl: OPS120 — relatório de cidade: página 1 sob pesquisa cheia (C163)

Status: aprovado
Atualizado em: 2026-09-16
Issue: #1069
Intenção: docs/plans/ops120-relatorio-cidade-pagina-1-pesquisa-cheia.md
Appetite restante: herdado (~1 dia eng)

> Aprovado pelo próprio agente via `--auto` (modo autônomo do `work-issue`); a
> pausa do gate 3c virou apresentação-no-chat-sem-espera.

## Leitura da intenção

- **Outcome:** cidade com checklist de pesquisa cheio (9 itens) + notícias ≤90 dias gera PDF+MD com a página 1 dentro do guard (`PAGE_ONE_BUDGET_PX = 1001`), cortando por **teto/orçamento de conteúdo** (cap explícito + `totalCount`/`e mais N`, padrão E16) — sem espremer layout. O texto integral preservado segue acessível no aprofundamento (seções 2+). Cidade pequena/sem pesquisa não regride. Se ainda estourar, o erro continua fail-closed e acionável.
- **O que NÃO negociar:** não mexer em layout/CSS nem no orçamento do guard; não criar seção nova; não reaproveitar o corte para "esconder" fato com fonte (integral do checklist precisa sobreviver); atribuição de emenda a município (#1025) fica de fora; preservar proveniência/fonte na página 1; zero regressão para cidade sem pesquisa.
- **O que reavaliar:** a intenção lista "notícias e quem é quem com cap". A verificação no código mostra que **notícias não têm lista na página 1** (só `research.news.length` no KPI), então capar notícia na página 1 é inócuo — o que de fato infla são os `items[].answer` da pesquisa reusados na página 1 por `researchAnswerItem` (`buildWhoRows`, `buildAnnouncePair`, `buildRiskCards`, `buildEmendasEvidenceBlock`). O teto correto é sobre esses textos livres, não sobre notícias.

## Abordagem recomendada

```mermaid
flowchart LR
  R[research.json<br/>items[].answer] --> C[cityReportBlocks.buildPageOne<br/>caps PAGE_ONE_*]
  S[snapshot Teqo ro] --> C
  E[emendas.json] --> C
  C --> P1[Página 1 resumida<br/>excerpt + 'e mais N']
  C --> F[Seção fontes 2+<br/>tabela 'respostas integrais']
  P1 --> H[build-city-report.mjs<br/>scrollHeight > 1001?]
  F --> H
  H -->|não| PDF[PDF + MD]
  H -->|sim| D[die fail-closed acionável]
```

**Opções consideradas:** A — capar os textos livres da página 1 (excerpt + `e mais N`) e preservar o texto integral numa tabela dentro da seção `fontes` existente | B — remover a linha de fonte por item da página 1 (~52px) | C — capar/omitir linhas inteiras do "Quem é quem" (row-cap E16).

**Recomendação:** A. É o único caminho que ataca a causa real (textos livres da pesquisa) sem tirar proveniência nem empobrecer silenciosamente: os caps de excerpt reduzem a altura de forma previsível (cada linha do "Quem é quem" custa ~17px), o `e mais N` mantém a contagem visível e o integral continua publicado no aprofundamento. Validado localmente em Chromium na mesma viewport/print do builder: fixture "itacaré" repro 1142px→978px e fixture "worst" (respostas 400 chars, 5 assessores, 6 dobradinhas, 6 riscos, 30 notícias) passa a guarda; as 9 cidades reais do lote OPS118 continuam passando com margem ≥ ~23px.

**Rejeitadas:**

- **B** — ganha altura mas remove a proveniência da página 1, contrariando "sem fonte, não publica"; o mecanismo prescrito pela intenção é teto de conteúdo, não restruturar layout de fonte.
- **C** — cortar linhas inteiras do "Quem é quem" mudaria o conteúdo de página 1 fixado na intenção (prefeito/vice/relação/lideranças/dobradinhas/vereadores) e não há "full tab" equivalente para recuperar o restante, ao contrário do texto do checklist.

Self-score decision-quality: **4/5** — decisão ancorada em medição real (Chromium + fixtures + cidades reais) e causa-raiz confirmada no código; perde 1 ponto porque o teto de 90/30 chars é empírico, calibrado pela margem observada, e pode pedir reajuste se o layout mudar.

### Componentes / mudanças

- **`buildPageOne`** (`scripts/lib/cityReportBlocks.mjs`): compõe a página 1 (strip, grid "Conta eleitoral 2022" + "Quem é quem", KPIs, callout de emendas, par anunciar×não, cards de risco, gap callout, footer). É o ponto onde os tetos entram.
- **`researchAnswerItem(research, id, max = PAGE_ONE_ANSWER_MAX)`** (`scripts/lib/cityReportBlocks.mjs`): hoje devolve o texto livre cru; passa a capar com `excerpt`. Consumidores: `buildWhoRows` (prefeito/vice/relação/vereadores), `buildAnnouncePair` (relação de novo), `buildRiskCards` (disputa_local ?? quem_investe), `buildEmendasEvidenceBlock` (emendas_web).
- **`excerpt(text, max)`** e **`joinLimited(values, limit, max)`** (`scripts/lib/cityReportBlocks.mjs`): helpers puros de corte. `excerpt` corta com `…` explícito e deixa texto curto intacto; `joinLimited` mostra os `limit` primeiros, capa a `max` e **sempre** anexa `e mais N` para o total sobreviver. `Responsável`, `Dobradinhas` e `Riscos na base` usam `joinLimited`.
- **Constantes de orçamento** (`scripts/lib/cityReportBlocks.mjs`): `PAGE_ONE_ANSWER_MAX=90` (texto livre de largura total), `PAGE_ONE_WHO_MAX=30` (célula estreita de 2 colunas), `PAGE_ONE_RISK_MAX=70` (card de oposição, que ainda concatena o sufixo de fonte), `PAGE_ONE_LIST_LIMIT=2`, `PAGE_ONE_NAMES_MAX=20`. Bloco documentado como "content budget da página 1", no mesmo espírito dos caps do E16 (`src/utilities/municipality/municipalityDossierData.ts:45-48`) e dos caps de excerpt já existentes (`SIGNAL_EXCERPT_MAX`, `SPEECH_SUMMARY_MAX`, `SPEECH_MENTION_MAX`).
- **Tabela "Pesquisa — respostas integrais (texto completo)"** (`scripts/lib/cityReportBlocks.mjs`, dentro de `buildSourcesSection`): bloco `table` (Item | Resposta (texto integral) | Fonte) dentro da **seção existente** `fontes` ("Fontes e limites"), usando `sourcesOf`/`withInlineSources` para os links inline. Só é emitido quando `research.items.length > 0` — cidade sem pesquisa não ganha bloco.
- **Guarda fail-closed** (`scripts/build-city-report.mjs`): intocada. Continua medindo `[data-page="summary"].scrollHeight` e abortando com `die()` se > `PAGE_ONE_BUDGET_PX`.
- **Render** (`scripts/lib/cityReportRender.mjs`): nenhuma mudança — os blocos já renderizam `table` e o `data-page="summary"` continua no `<section class="summary">`.
- **SKILL.md** (`.agents/skills/relatorio-cidade/SKILL.md`): descreve a página 1 capada com `e mais N`, adiciona a tabela de respostas integrais em `14. Fontes e limites` e reescreve o troubleshooting "Página 1 estourou" para apontar os tetos `PAGE_ONE_*` e o texto integral no aprofundamento.

### Dados → forma

- `research.items[].answer` (texto livre, potencialmente longo) → página 1: `excerpt(answer, PAGE_ONE_ANSWER_MAX | PAGE_ONE_WHO_MAX)` → cabe no orçamento.
- Listas de nomes/textos (`conjuncture.risks`, responsáveis/dobradinhas) → `joinLimited(values, 2, max)` → `"A, B e mais N"`.
- `research.items` → seção `fontes`: tabela com o `answer` integral + fonte inline (fato com fonte nunca é perdido pelo corte).
- Sem pesquisa (`research.items` vazio ou ausente) → nenhuma tabela nova, nenhum cap aplicado a conteúdo inexistente → saída idêntica à atual.

## Fases verificáveis

1. **Medir e fixar tetos** — reproduzir a fixture do itacaré (base ubaitaba + respostas longas / mais assessores / riscos) e medir `scrollHeight` por bloco no Chromium com a mesma viewport/print do builder; confirmar que o callout de emendas e o card de oposição são os que mais crescem e que o grid é dominado pelo "Quem é quem"; calibrar `PAGE_ONE_ANSWER_MAX`/`PAGE_ONE_WHO_MAX`/`PAGE_ONE_LIST_LIMIT`/`PAGE_ONE_NAMES_MAX` até a fixture caber com folga. _(concluído: caps definidos em 90/30/2/20.)_
2. **Aplicar os tetos na composição** — introduzir `excerpt`/`joinLimited`, parametrizar `researchAnswerItem`, aplicar os caps em quem-é-quem/riscos/evidência/listas e adicionar a tabela de respostas integrais em `fontes` (condicionada a `research.items.length > 0`); guarda intacta.
3. **Prova local + gates** — fixtures plausível/itacaré e worst + as 9 cidades reais do lote OPS118 (margem ≥ ~23px); cidade sem pesquisa sem mudança; rodar unit (`tests/unit/cityReportBlocks.unit.spec.ts`, `cityReportRender.unit.spec.ts`, `cityReportResearch.unit.spec.ts`, `cityReportBatchSkill.unit.spec.ts`), o snapshot int (`tests/int/cityReportSnapshot.int.spec.ts`) e os gates do PR (lint/format/typecheck/knip/cycles/unit/int/build).

## Rabbit holes / Não escopo (engenharia)

- **Não** mexer em layout/CSS nem no `PAGE_ONE_BUDGET_PX`: proibido pela intenção; o problema é orçamento de conteúdo, não espaço.
- **Não** criar seção nova: a tabela de integrais vive dentro da seção `fontes` existente.
- **Não** capar notícias na página 1: não existe lista de notícias ali (só a contagem no KPI) — seria código morto.
- **Não** cortar linhas inteiras do "Quem é quem": quebraria o contrato de conteúdo da página 1 sem caminho de recuperação.
- **Não** tocar em atribuição de emenda a município (#1025), nem agregar lote (OPS118), nem em Schema/Access/Consent/PII.
- **Não** transformar os tetos em configuração externa/lote: manter constantes nomeadas no módulo até haver evidência de que variam por cidade.

## Riscos e mitigação

- **Cortar demais empobrece a página 1** → caps altos o bastante para o caso normal (texto curto passa intacto) e `e mais N` explícito; integral preservado na seção `fontes`.
- **Perder fato com fonte no corte** → todo `answer` reaparece integral na tabela de respostas integrais.
- **Teto empírico desalinhar com o layout futuro** → constantes nomeadas/documentadas (`PAGE_ONE_*`) e troubleshooting no SKILL.md apontando onde ajustar; guarda fail-closed continua sendo a rede.
- **Regressão em cidade pequena/sem pesquisa** → tabela condicionada a `research.items.length > 0`; manter os testes existentes verdes e um caso de "texto curto intacto".
- **Prova frágil por medição manual** → fixar fixtures + as 9 cidades reais como baseline de margem no aceite; unit cobre a saída.

## Aceite de engenharia

- [x] Cidade com checklist cheio (9 itens) + notícias ≤90 dias gera PDF+MD com `[data-page="summary"].scrollHeight ≤ 1001` (fixture plausível/itacaré e worst passam).
- [x] Caps aplicados aos textos da pesquisa na página 1 (`PAGE_ONE_ANSWER_MAX`, `PAGE_ONE_WHO_MAX`) com `excerpt` + `…`; listas com `PAGE_ONE_LIST_LIMIT` e `e mais N`.
- [x] Texto integral de cada item do checklist publicado na tabela "Pesquisa — respostas integrais" dentro da seção `fontes`, com fonte inline, só quando `research.items.length > 0`.
- [x] Cidade pequena/sem pesquisa: sem bloco novo e sem regressão.
- [x] Guarda fail-closed e `PAGE_ONE_BUDGET_PX` inalterados.
- [x] Unit atualizados: capa excerpt da página 1 + preserva integral no aprofundamento; texto curto intacto; `e mais N` sobrevive ao cap da lista.
- [x] `SKILL.md` atualizado.
- [x] Scripts puros do relatório + SKILL.md + testes apenas; nenhum schema/migração/access/Consent/PII.
- [x] Self-score decision-quality ≥ 4 registrado (4/5).

## Simplificação e débitos (triage 2026-09-16)

Aplicados na sessão (2 revisores + fixes): `joinLimited` sem default/branch
morto (`max` obrigatório); cap de oposição com constante nomeada
(`PAGE_ONE_RISK_MAX`) e sufixo de fonte preservado (não cortado); comentários de
seção stale removidos; coluna "Data" (não "Fonte"); `buildResearchAnswersTable`
extraída para o dono ser honesto; teste do cap sem acoplar ao literal;
formatação Prettier verde.

**Diferido com gatilho** (triage: todos score 2 → nenhuma Issue nova):

- **Estilos de truncamento divergentes no módulo** (`excerpt` com `…` ×
  `SIGNAL_EXCERPT_MAX`/`SPEECH_*` com `.slice()` sem reticências). Gatilho:
  próximo toque nos caps/excerpt do `cityReportBlocks.mjs`.
- **Tetos `PAGE_ONE_*` empíricos** (calibrados por medição Chromium). Gatilho:
  mudança de CSS/layout do PDF A4.
- **Corte de 30 chars no "Quem é quem"** é decisão de produto (sem perda de
  dado: integral em `fontes`). Gatilho: nova evidência de produto.
- **Tabela "respostas integrais" na seção `fontes`** (dono "fala de fontes, não
  de conteúdo"). Gatilho: quando seção própria for permitida.

**Já resolvido / descartado:** os achados médios/altos dos revisores entraram
como fixes acima; nada virou ruído puro fora do defer.
