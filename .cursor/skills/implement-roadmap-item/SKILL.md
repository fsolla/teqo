---
name: implement-roadmap-item
description: Recebe o código (ex. A4, C2, D2) ou a descrição de um item do docs/roadmap.md do Teqo, revisa o estado do item no roadmap, analisa-o criticamente contra o estado atual do repositório, revisa o plano detalhado linkado em docs/plans/, produz um plano de implementação acionável (sempre com última fase de documentação da sessão) e — quando o usuário pede para implementar — executa o desenvolvimento com /impeccable nas superfícies de UI e atualiza notebook/plano/roadmap no fim. Usar quando o usuário pedir para implementar, planejar ou revisar um item do roadmap — "vamos fazer o A4", "planeja a implementação de", "revisa o plano do item X", "o que falta para o C2", "implementa o C5" — ou fornecer um ID de trilha do roadmap.
---

# Revisar item do roadmap e criar plano de implementação

Esta skill transforma um item do `docs/roadmap.md` em um plano de implementação confiável e, quando autorizado, em entrega. O ponto central: **o plano em `docs/plans/` foi escrito no passado e o repositório andou desde então** — a skill existe para auditar o plano contra o código real antes de qualquer implementação, não para reescrevê-lo cegamente nem para segui-lo cegamente.

Superfícies de UI deste item passam pelo fluxo **`/impeccable`** (skill anexada ou em `~/.claude/skills/impeccable`): **shape → craft → critique → polish** (obrigatório em B/C/D), alinhado a `PRODUCT.md` / `DESIGN.md` e aos design-refs do roadmap. **`harden` e `optimize` não entram no pipeline fixo** — só sob gatilho (Passo 8). Itens só de schema/server/utilitário **não** inventam UI via Impeccable — veja Passo 8.

**Qualidade de decisão:** ao auditar e fatiar, aplique [decision-quality.md](../roadmap-item/decision-quality.md) — caro vs barato, Opções+Recomendação+rejeitadas, appetite do plano, rabbit holes, depth/classitis, tracer bullet cedo. Sem jornada de `design-code-architecture`.

**Dados → decisão → apresentação:** ao auditar o plano e antes de craft de UI com métricas/mapas/listas analíticas, aplique [data-presentation.md](../roadmap-item/data-presentation.md). Se o plano omite a seção e o item claramente apresenta dados → marque **defasado** e complete no Passo 7. A forma escolhida (número / tabela / mapa / chart) é input do Impeccable — não trocar no polish sem reabrir a decisão.

## Checklist do fluxo

```
- [ ] 1. Localizar o item no roadmap e capturar seu estado completo
- [ ] 2. Verificar o estado real das dependências (roadmap E código)
- [ ] 3. Ler o plano detalhado linkado + fontes satélites
- [ ] 4. Auditar o plano contra o repositório, afirmação por afirmação (incl. Dados → decisão → apresentação)
- [ ] 5. Fechar as questões em aberto com evidência ou recomendação
- [ ] 6. Escrever o plano de implementação em fases verificáveis (incl. fases Impeccable se houver UI; última fase = documentação da sessão)
- [ ] 7. Atualizar docs/plans/ e roadmap se a auditoria achou divergência
- [ ] 8. Classificar superfície UI e preparar gate Impeccable
- [ ] 9. Parar e obter confirmação do plano (a menos que o usuário já tenha pedido implementação explícita)
- [ ] 10. Executar fases: schema/server → UI via /impeccable → verificação AGENTS.md + Aikido → documentação da sessão
```

**Escopo por pedido do usuário:**

| Pedido típico                      | Até onde ir                                   |
| ---------------------------------- | --------------------------------------------- |
| "revisa / planeja o item X"        | Passos 1–8 + resumo; **não** implementa       |
| "vamos fazer / implementa o X"     | Passos 1–10 (confirmação compacta no Passo 9) |
| "continua / segue a implementação" | Retoma no Passo 10 a partir da fase pendente  |

## Passo 1 — Localizar o item e capturar seu estado

Leia `docs/roadmap.md` **inteiro** (nunca só a linha do item). Resolva o input do usuário:

- **ID de trilha** (`A4`, `C2`...): procure na subgraph do grafo mermaid e nas tabelas de janela.
- **Descrição solta**: faça a correspondência por termos nas trilhas, Fill-ins, Bloqueadores, Site público e Admin Payload. Se houver mais de um candidato plausível, pergunte antes de prosseguir; item errado = plano inteiro errado.

Capture do roadmap, explicitamente:

| Dado                        | Onde está                                                                         |
| --------------------------- | --------------------------------------------------------------------------------- |
| Trilha, janela e ordem      | Tabelas "Sequência de execução por janela"                                        |
| Dependências duras e suaves | Grafo mermaid (cheias `-->` vs tracejadas `-.->`) + coluna "Depende de"           |
| Já entregue?                | Marca `✓` no grafo e nota "(entregue YYYY-MM-DD)" na tabela                       |
| Cortável ou não cortável    | Parágrafo "Cortes seguros"                                                        |
| Bloqueio externo            | Onda 0 (lote jurídico/Consent) e tabela "Bloqueadores atuais"                     |
| Design                      | Tabela "Referências de design" → par `.png`/`.html` em `docs/design-refs/latest/` |
| Link do plano               | Coluna "Plano" da tabela de janela                                                |

**Curto-circuitos:** item marcado `✓` entregue → reporte isso e pare (a menos que o usuário esteja pedindo revisão do que foi entregue). Item na seção "Fora de escopo" ou "Itens consolidados/removidos" → aponte onde foi absorvido/vetado e o racional; não crie plano.

## Passo 2 — Verificar o estado real das dependências

Não confie só na marca `✓` do roadmap — confirme no código:

- Dependência entregue por migration → o arquivo existe em `src/migrations/` e está no `index.ts`.
- Dependência entregue por collection/campo → existe em `src/collections/` e em `src/payload-types.ts`.
- Dependência entregue por utility/componente → existe em `src/utilities/` / `src/components/campaign/` com a assinatura que o plano assume.

Desfechos:

- **Dependência dura não entregue** → implementar agora está fora de ordem. Reporte e proponha: (a) implementar a dependência primeiro (aponte o plano dela), ou (b) corte de escopo explícito que remova a dependência — nunca ignore silenciosamente.
- **Dependência suave não entregue** → siga, mas registre no plano de implementação o que degrada e quando revisitar.
- **Bloqueio jurídico (Onda 0)** → a engenharia NÃO espera o jurídico (padrão do projeto: o app falha fechado sem a chave de `Consent`); só a ativação em produção espera. Deixe isso explícito no plano.

## Passo 3 — Ler o plano detalhado e as fontes satélites

Leia, nesta ordem:

1. **`docs/plans/<slug>.md`** linkado no item — inteiro. Anote a data de "Atualizado em" e o "Status": a distância entre essa data e o presente calibra o quanto desconfiar no Passo 4.
2. **`.cursor/rules/projects/nucleos-eleitorais.mdc`** (ou o notebook do projeto correspondente) — decisões e status posteriores ao plano costumam estar aqui.
3. **Design ref** (se a tabela do roadmap apontar uma): o `.html`/`.png` em `docs/design-refs/latest/`. A estrutura/UX vale; a paleta NÃO — usar tokens do tema `data-theme='campaign'` (`src/app/(frontend)/styles.css`) e componentes shadcn de `src/components/ui`.
4. **`PRODUCT.md` + `DESIGN.md`** (raiz do repo) — registro (`product`/`brand`), princípios e tokens já commitados. São âncoras do `/impeccable`; leia-os antes de qualquer fase de UI.
5. **AGENTS.md** — seções relevantes ao domínio do item (Campaign auth, Posts & Tags, migrations, convenções de naming).
6. **Planos vizinhos** citados nas seções "Dependências" e "Não escopo" — para saber onde o escopo deste item termina e o dos outros começa.
7. **Seção Dados → decisão → apresentação** do plano (ou ausência dela) — se o item toca KPI/mapa/série/ranking, e a seção falta ou está `N/A` indevido, trate como defasagem no Passo 4. Se preenche, use como contrato da fase de UI (forma + decisão + anti-goals). Inteligência territorial: cruzar com `docs/research/` quando o plano citar padrões dado→decisão.

Item sem plano detalhado (ex.: só design, como C5; ou fill-in "sem plano detalhado ainda"): primeiro crie o plano seguindo a skill `roadmap-item` (template em `.cursor/skills/roadmap-item/plan-template.md` — inclui classificação Impeccable A–D, brief compacto se B/C/D, e seção Dados), depois continue esta skill a partir do Passo 4. Se o plano já trouxer classe + brief, reutilize no Passo 8 em vez de reclassificar do zero; só reabra se o código/roadmap mostrar que a classe mudou.

## Passo 4 — Auditar o plano contra o repositório

Este é o passo que separa uma revisão competente de um "li o plano, parece bom". Para **cada afirmação verificável** do plano, cheque o código:

- **Caminhos de arquivo citados** existem? (Glob/Read). Arquivo renomeado/movido é a defasagem mais comum.
- **Utilities e componentes "a reusar"** ainda têm a assinatura/comportamento que o plano assume? Leia a assinatura real, não o nome.
- **Premissas de schema** batem com `src/payload-types.ts` e com as migrations em `src/migrations/`? (Ex.: plano escrito quando `cities` era escalar, hoje é array.)
- **Decisões travadas** foram supersedidas? Confronte com a seção "Itens consolidados/removidos" do roadmap, a nota do "Atualizado em" (linha 3 do roadmap) e o notebook do projeto. Precedente real: A2 foi redesenhado de auto-preenchimento forçado para chips opt-in — um plano antigo descreveria o comportamento errado.
- **Já existe implementação parcial?** Grep pelos identificadores que o plano propõe (nomes de collection, componente, action, rota). Se parte já existe, o plano de implementação parte dela, não do zero.
- **Não escopo / rabbit holes ainda válidos?** Itens delegados a outros planos podem já ter sido entregues; rabbit holes omitidos ou estourando appetite contam como defasagem de desenho.

Classifique cada achado e reporte-os ao usuário:

1. **Confirmado** — plano bate com o código; segue como está.
2. **Defasado** — fato objetivo mudou (caminho, assinatura, schema); corrija no plano (Passo 7) e ajuste a abordagem.
3. **Conflitante** — decisão de produto/arquitetura diverge (plano diz X, roadmap/notebook posterior diz Y). Adote a fonte mais recente, registre a substituição, e sinalize ao usuário se a divergência for material.
4. **Awaiting-evidence** — afirmação não verificável ainda (ex. métrica de prod, texto jurídico ausente); não invente — registre e prossiga com default explícito.

**Auditoria de desenho** (além de path/schema) — marque como _defasado_ ou _conflitante_ de design se o plano:

- inventa **cerimônia de boundary** (layers/adapters) sem volatilidade real;
- propõe **classitis** (pass-through raso) em vez de reusar módulo profundo existente;
- omite **Appetite** / **Rabbit holes** ou estoura o appetite sem corte;
- trata como cortável algo **caro de reverter** (access, Consent, unicidade);
- **apresenta dados** (KPI, mapa, série, ranking) mas omite [data-presentation.md](../roadmap-item/data-presentation.md) / seção no plano, ou escolhe chart/mapa sem decisão nomeável, ou viola anti-goals (`PRODUCT.md` §5: % estadual absoluto, vanity count, gauge SaaS).

## Passo 5 — Fechar as questões em aberto

Para cada item de "Questões em aberto" do plano:

- **Resolvível por evidência** (o código, o roadmap ou o notebook já responderam) → resolva e registre a resposta com fonte.
- **Decisão de produto pendente** → force o formato **Opções | Recomendação | Alternativas rejeitadas** ([decision-quality.md](../roadmap-item/decision-quality.md)); carregue a Recomendação como default no plano de implementação, marcada _(assumido — validar com produto)_. Nunca deixe pergunta sem posição, e nunca bloqueie o plano inteiro numa pergunta que tem default razoável.

## Passo 6 — Escrever o plano de implementação

O deliverable é um plano de execução em **fases pequenas e verificáveis**, em ordem de dependência (schema → server → UI → polish → **documentação da sessão**). Respeite o **Appetite** do plano em `docs/plans/` (ou declare um se estiver ausente): a soma das fases de engenharia deve caber; se não couber, corte rabbit holes — não estique. A fase final de documentação é obrigatória e **não** compete com o appetite de engenharia (quota típica 15–30 min à parte).

Para cada fase:

- **O que muda**: arquivos concretos (caminho real, criar vs editar), com uma linha do porquê.
- **Quota do appetite**: quanto desta fase consome (ex. `~0,5 dia` / `só server`).
- **Migration** (se houver mudança de schema): nome proposto para `pnpm migrate:create <nome>`, o que adiciona, se tem backfill. Seguir a skill `payload-migrations`; `push` é `false` sempre.
- **Como verificar a fase**: teste, tela, ou query específica — fase sem critério de verificação não é fase.
- **Fase de UI**: marque explicitamente `Impeccable: shape|craft|critique|polish` e, se o Passo 8 acionar, `+ harden` / `+ optimize` (ver Passo 8). Não misture schema e layout na mesma fase. Se a seção **Dados → decisão → apresentação** do plano ≠ N/A, a fase de UI **cita a forma escolhida** (número / tabela / mapa / chart) e verifica que a tela responde à decisão nomeada — não “adicionar um gráfico” no polish.

**Tracer bullet:** se o item for grande, a primeira fatia vertical real (schema mínimo → uma action → uma superfície UI) vem cedo — prova o wiring antes de polish paralelo ou fases cosméticas.

**Depth:** novas utilities/componentes só se esconderem complexidade; preferir estender `campaign*` / shells existentes a criar wrappers rasos. Para dados: preferir `CampaignMetricStrip` / lista / `BahiaMap` / tabela ao chart novo ([data-presentation.md](../roadmap-item/data-presentation.md)).

Guardrails que TODO plano de implementação deste repo inclui (cheque um a um contra o item):

- Pessoa = join com `Contact`; nunca cadastro paralelo.
- Opt-in/PII → `Consent` por chave estável, falhando fechado; texto novo entra no lote jurídico da Onda 0, nunca em rodada separada.
- Local API com `user` → `overrideAccess: false`; escrita multi-collection → transação com `req: { transactionID }`; hooks propagam `req`.
- Collection nova → `admin.group` consistente + hook de revalidação se backing de página pública.
- Identificadores em inglês; strings visíveis em pt-BR; valores de slug/enum em português são dados, não se traduzem.
- Superfície com métricas/mapa/série: três perguntas de [data-presentation.md](../roadmap-item/data-presentation.md) respondidas; anti-goals `PRODUCT.md` §5; sem chart por default.
- Verificação final = checklist do AGENTS.md: `pnpm generate:types`, `generate:importmap` (se componentes), `tsc --noEmit`, `lint`, `test`, `test:e2e`, `build` contra o banco local, scan Aikido dos arquivos editados.
- **Última fase obrigatória — Documentação da sessão:** todo plano gerado termina com uma fase explícita de atualizar a documentação do projeto com o que a sessão fez (não opcional; não misturar com schema/UI). Ver bloco abaixo.

### Fase final obrigatória — Documentação da sessão

Sempre inclua como **última fase** do plano (após verificação AGENTS.md + Aikido). Quota típica: `~15–30 min` / fora do appetite de engenharia se o appetite já estiver cheio — a fase existe mesmo assim.

**O que muda** (só o que a sessão realmente tocou; não reescreva histórico):

| Superfície                                                            | Quando atualizar                                       | O quê                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.cursor/rules/projects/<projeto>.mdc` (ex. `nucleos-eleitorais.mdc`) | Sempre que houve implementação ou decisão material     | Bullet de **Status** no topo: o que entrou, data, link do plano, débitos/follow-ups com gatilho; **Decisões** só se algo novo foi travado |
| `docs/plans/<slug>.md`                                                | Sempre                                                 | "Atualizado em", Status (ex. entregue / parcial), linha de revisão (o quê + por quê + data); rabbit holes adiados se surgiram             |
| `docs/roadmap.md`                                                     | Item passou a entregue (ou mudou janela/deps)          | Marca `✓` + "(entregue YYYY-MM-DD)" no grafo e na tabela; "Atualizado em"; consistência tripla tabela = grafo = Dependências do plano     |
| `AGENTS.md`                                                           | Mudança de convenção/modelo que outros agents precisam | Seção "Recently resolved" ou domínio afetado — só se o as-built diverge do que AGENTS descreve                                            |

**Como verificar a fase:** diff das docs cita o ID do item, a data de hoje, e o que ficou de fora / próximo gatilho; notebook e plano não contradizem o roadmap.

**Pedidos só de planejamento (Passos 1–8):** a fase entra no plano gerado como item futuro; **não** execute a documentação de entrega até haver trabalho real na sessão (exceto correções do Passo 7 por divergência de auditoria).

Termine o plano com: dependências assumidas (e o que foi verificado no Passo 2), decisões assumidas _(validar com produto)_ no formato Opções+Recomendação+rejeitadas, classificação Impeccable do Passo 8, `Dados: N/A | <forma + decisão>` ([data-presentation.md](../roadmap-item/data-presentation.md)), rabbit holes / adiados com gatilho, self-score ≥4/5, o que fica explicitamente de fora (com o plano/item para onde vai), e a **fase final de documentação da sessão** (checklist das superfícies acima).

## Passo 7 — Atualizar a documentação se houve divergência

Se o Passo 4 achou itens **defasados** ou **conflitantes** (correção **durante o planejamento**, distinta da fase final pós-implementação no Passo 10d):

- Atualize `docs/plans/<slug>.md`: corrija as seções afetadas, atualize "Atualizado em" e registre a revisão em uma linha (o quê + por quê + data), no padrão das revisões existentes.
- Se a divergência tocar dependências/janela/escopo do item, atualize também o `docs/roadmap.md` nos pontos de consistência (grafo, tabela de janela, "Atualizado em") — a consistência tripla tabela = grafo = seção "Dependências" do plano é obrigatória (ver Passo 6–7 da skill `roadmap-item`).
- Divergência pequena e puramente factual (caminho renomeado): corrija direto. Divergência de decisão de produto: corrija adotando a fonte mais recente e destaque a mudança no resumo ao usuário.

## Passo 8 — Classificar superfície UI e gate Impeccable

Antes de implementar (e já no plano do Passo 6), classifique o item:

| Classe                       | Critério                                                                 | Impeccable?                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **A — Só backend**           | Migration, seed, utility, access, aggregate SQL; zero rota/componente UI | Não — pule Passo 10b                                                                                 |
| **B — UI encaixada**         | Edita tela/componente existente sob o tema `campaign` / site público     | Sim — craft compacto + critique/polish no alvo                                                       |
| **C — UI nova / ambígua**    | Rota nova, fluxo multi-tela, ou sem design-ref claro                     | Sim — shape obrigatório, depois craft                                                                |
| **D — Design-ref já existe** | Par em `docs/design-refs/latest/` (tabela do roadmap)                    | Sim — shape **compacto** (estrutura do ref + tokens `campaign`); não redesenhar a paleta do HTML/PNG |

**Pipeline Impeccable (B/C/D) — obrigatório vs gatilho:**

| Passo                                         | Obrigatório?                | Quando                                                                                                                                                                                                                                               |
| --------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shape` → `craft` → `critique` → **`polish`** | Sim (shape conforme classe) | Toda superfície UI deste item                                                                                                                                                                                                                        |
| `/impeccable harden <alvo>`                   | **Só sob gatilho**          | Form/action nova; empty state novo; critique com P0/P1 de resiliência (overflow, erro, rede, permissão). Em `/campanha` **não** abrir rabbit hole de i18n/RTL — o produto é pt-BR; reusar shells/`mapCampaignFormActionError`/feedback existente     |
| `/impeccable optimize <alvo>`                 | **Só sob gatilho**          | Mapa/lista pesada, bundle client novo, appetite do item é perf, ou critique/`/simplify` com sinal de lentidão. **Medir antes** (o próprio comando exige); sem evidência → não rodar. Perf estrutural vira item de escala (não engorde este delivery) |

Ordem quando os gatilhos disparam: `critique` → (`harden` se gatilho) → (`optimize` se gatilho) → **`polish` por último**. Nunca rode `harden`/`optimize` no pipeline fixo “por completude”.

**Regras Teqo (não negociáveis no fluxo Impeccable):**

1. Carregue a skill `/impeccable` (Setup: `context.mjs` com `--target` na rota/componente concreto; register `product` → `reference/product.md` para `/campanha` e ferramentas; `reference/brand.md` só se o item for superfície de marketing do site público).
2. **Paleta:** tokens `data-theme='campaign'` / site existente. A paleta do UX Pilot (vermelho escuro / navy / dourado) é **anti-referência de cor** — só UX/estrutura do `.html`/`.png`.
3. **Componentes:** reusar `src/components/ui` (shadcn) e `src/components/campaign/*`; não introduzir segundo design system.
4. **Dados na UI:** se Dados ≠ N/A, craft/critique validam a forma contratada no plano (escada de pobreza + decisão nomeável). Critique P0 se a tela mostrar métrica sem “vs quê” / sem próximo passo possível, ou se violar anti-goals (% estadual absoluto, gauge SaaS). Não “melhorar” trocando tabela por chart no polish sem reabrir Opções+Recomendação.
5. **Gates do craft:** se shape for obrigatório (classe C, ou B/D sem brief confirmado), apresente o brief e **pare** até o usuário confirmar — não comprima shape → código numa única resposta.
6. **Pós-UI:** após a fase de UI funcional, rode `/impeccable critique <alvo>` (path sob `src/app/(campaign)/...` ou frontend). Trate P0/P1 como bloqueadores de merge; aplique `harden`/`optimize` só se a tabela de gatilhos acima bater; feche com `/impeccable polish <alvo>` no mesmo escopo. Snapshot em `.impeccable/critique/` é artefato útil — não substitua o checklist AGENTS.md.
7. **Itens classe A:** declare no resumo "Impeccable: N/A (sem superfície UI)" e siga só engenharia + Aikido. Se a classe A só entrega aggregate para UI futura, ainda assim a seção Dados do plano deve dizer quem consome e qual forma esperada (ou Adiado com gatilho).

No plano de implementação, cada fase de UI deve citar o comando Impeccable e o **alvo** (path ou rota), e declarar explicitamente se harden/optimize estão **in** ou **out** (com o gatilho, se in), por exemplo:

```text
Fase 3 — UI lista GOTV
  Impeccable: shape (compacto; ref Dia-D-GOTV) → craft → critique → harden (form/CSV novo) → polish
  optimize: out (sem sinal de perf)
  Alvo: src/app/(campaign)/campanha/(app)/apoiadores/...
```

## Passo 9 — Confirmação antes de implementar

Se o pedido foi só planejamento/revisão → entregue o resumo final (abaixo) e **pare**.

Se o pedido foi implementar ("vamos fazer", "implementa", "entrega o X"):

- Apresente o plano em fases + classificação Impeccable (A/B/C/D) em forma compacta.
- Peça confirmação **uma vez** (ou "segue" implícito se o usuário já listou as fases a executar). Não reabra o Passo 5 inteiro.
- Só então avance ao Passo 10.

## Passo 10 — Executar a implementação

Ordem fixa. Não pule a verificação final.

### 10a — Schema e server (sem Impeccable)

Execute as fases de migration, collections, utilities, server actions e testes de domínio. Siga `payload-migrations` quando houver schema. Commits só se o usuário pedir.

### 10b — UI via `/impeccable` (classes B/C/D)

1. **Setup Impeccable** (obrigatório no início da primeira fase de UI desta sessão): rode o `context.mjs` da skill impeccable com `--target <path da superfície>`; leia `PRODUCT.md` / `DESIGN.md` se o script os imprimir; leia o register reference (`product` ou `brand`).
2. **Shape** (obrigatório em C; compacto em D; em B só se a direção visual ainda for ambígua): siga `reference/shape.md`. Design-ref do roadmap + princípios do PRODUCT.md respondem a maior parte — não repita entrevista longa. Pare para confirmação do brief.
3. **Craft**: siga `reference/craft.md` — implementar no código real do Next.js/Payload, não num sandbox paralelo. Respeite o pipeline do repo (`pnpm` scripts). Anuncie se o harness não tem geração nativa de imagem e siga com o brief + design-ref.
4. **Critique** no alvo entregue: `reference/critique.md`. Persista snapshot; feche P0/P1 antes de declarar a fase de UI pronta.
5. **Harden** (só se o Passo 8 acionou o gatilho): `reference/harden.md` — empty/erro/overflow/permissão no alvo; em `/campanha` não abrir i18n/RTL; preferir shells e padrões de feedback já no repo.
6. **Optimize** (só se o Passo 8 acionou o gatilho): `reference/optimize.md` — medir bottleneck neste alvo, corrigir o que importa, medir de novo; sem evidência, pule. Débito de escala maior que o appetite → `capture-review-debts`, não estique a fase.
7. **Polish** (sempre, por último entre os passos Impeccable): `reference/polish.md` alinhado ao design system existente (`DESIGN.md`, tokens `campaign`, padrões de lista/detalhe/form já no `/campanha`).

Se o item misturar backend + UI, intercale: complete o mínimo de server necessário para a tela funcionar, craft a UI, volte a server se o critique revelar gap de dados — não adie o Impeccable para "no final depois de tudo".

### 10c — Verificação de engenharia

Checklist AGENTS.md completo contra banco **local**; scan Aikido nos arquivos first-party editados (skills `xometry-aikido-scan` / `aikido-scan`).

### 10d — Documentação da sessão (sempre por último)

Execute a **última fase** do plano (bloco "Fase final obrigatória — Documentação da sessão" do Passo 6). Ordem: notebook do projeto → `docs/plans/<slug>.md` → `docs/roadmap.md` (se entregue ou deps/janela mudaram) → `AGENTS.md` só se a convenção/as-built mudou.

Regras:

- Documente o que **esta sessão** fez (código, decisões, débitos com gatilho) — não invente status de deploy ou merge sem evidência.
- Se o pedido era entregar o item end-to-end e a verificação passou, marque o item como entregue no plano + roadmap + notebook na mesma passada.
- Se a sessão ficou parcial (só algumas fases), registre Status parcial + o que falta; não marque `✓` no roadmap.
- Commits das docs só se o usuário pedir commit (mesmo critério do resto).

Não declare a implementação completa sem 10d.

## Resumo final ao usuário

**Após planejamento (Passos 1–8):** (1) item e estado no roadmap (janela, appetite, dependências, bloqueios); (2) veredito da auditoria — confirmado / defasado / conflitante / awaiting-evidence, incl. achados de desenho e de **Dados → decisão → apresentação**; (3) o plano de implementação em fases (quota de appetite + tracer bullet), com fases Impeccable marcadas (`polish` obrigatório; `harden`/`optimize` in|out com gatilho) e **última fase = documentação da sessão**; (4) classificação A/B/C/D, `Dados: N/A | <forma>`, `Qualidade de decisão: N/5`, e decisões assumidas que merecem validação de produto.

**Após implementação (Passo 10):** o que entrou em cada fase, resultado do critique/polish (score/P0–P1 se houver), se harden/optimize rodaram (gatilho + resultado) ou por que ficaram out, checklist AGENTS.md + Aikido, superfícies de doc atualizadas no 10d, e o que ficou de fora.

Se `/simplify` ou `/impeccable critique` deixaram follow-ups **maiores que o cleanup da sessão**, ofereça a skill `capture-review-debts` (triage → confirmação → `roadmap-item`) em vez de registrar débitos ad hoc ou abandoná-los no chat.

**Fluxo de fechamento em worktree:** após simplify/impeccable → `rebase-on-main` → `capture-review-debts` → `ship-to-main` (atalho único: `close-delivery`).
