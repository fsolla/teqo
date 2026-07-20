---
name: roadmap-item
description: Adiciona uma ideia, tarefa ou funcionalidade ao docs/roadmap.md do Teqo no local correto (trilha, janela do calendário eleitoral, grafo de dependências, paralelismo) e cria o plano detalhado correspondente em docs/plans/. Usar quando o usuário pedir para adicionar algo ao roadmap, registrar uma ideia/feature/débito, criar um plano para um item, ou disser "adiciona ao roadmap", "cria um plano para", "registra essa ideia".
---

# Adicionar item ao roadmap + criar plano

Esta skill transforma uma ideia solta em: (1) um item posicionado corretamente no `docs/roadmap.md` e (2) um arquivo de plano em `docs/plans/<slug>.md` linkado a partir do item. O roadmap é o registro canônico **em ordem de execução, com dependências e paralelismo explícitos** — um item mal posicionado é pior que um item ausente.

**Divisão com `/impeccable`, `implement-roadmap-item` e `compile-roadmap`:** aqui se **classifica** a superfície UI e se **semeia** âncoras de design no plano (`PRODUCT.md` / `DESIGN.md` / design-refs / brief compacto). **Não** se implementa UI nem se roda craft/critique/polish — isso pertence a `implement-roadmap-item` (Passos 8–10). Rodar Impeccable completo neste fluxo atrasa o registro e duplica trabalho. Se o `docs/roadmap.md` estiver inchado com ciclos já entregues, rode `compile-roadmap` **antes** de posicionar um item novo — senão o grafo/janelas ficam inconsistentes.

**Entrada desde reviews:** débitos de `/simplify` / `/impeccable` triageados por `capture-review-debts` chegam aqui já mesclados em lotes — não re-expanda um lote em um item por achado micro.

**Qualidade de decisão (não é tour):** aplique [decision-quality.md](decision-quality.md) em silêncio — filtro caro vs barato, Opções+Recomendação+rejeitadas, appetite, rabbit holes, depth check, self-score ≥4 antes de gravar. Não abra fases de `design-code-architecture`; só o sistema de decisão.

## Checklist do fluxo

```
- [ ] 1. Ler docs/roadmap.md inteiro (nunca editar sem ler a versão atual)
- [ ] 2. Classificar a ideia e checar duplicidade/absorção
- [ ] 3. Explorar o código relevante para fundamentar o plano
- [ ] 4. Classificar superfície UI (A–D) e semear Impeccable no plano se B/C/D
- [ ] 5. Decidir posicionamento: seção, ID, dependências, janela, paralelismo, appetite
- [ ] 6. Criar docs/plans/<slug>.md a partir do template (incl. rabbit holes / adiados)
- [ ] 7. Editar o roadmap em TODOS os pontos de consistência
- [ ] 8. Verificar links, mermaid, consistência cruzada e self-score de decisão (≥4/5)
```

## Passo 1 — Ler o roadmap atual

Leia `docs/roadmap.md` por completo antes de qualquer edição. A estrutura que importa:

- **Âncoras do calendário eleitoral** — datas fixas (convenções 20/07–05/08, registro 15/08, propaganda 16/08, congelamento ~20/09, 1º turno 04/10) que definem as janelas.
- **Trilhas com IDs**: A (dados eleitorais e território), B (superfícies de coordenação), C (operação de campo), D (plataforma e engajamento). IDs são sequenciais por trilha (próximo livre, ex.: `C6`, `D3`).
- **Grafo mermaid de dependências** — setas cheias = dependência dura; tracejadas = suave.
- **Tabelas por janela** (Janela 1–4) com colunas Ordem / Item / Plano / Depende de / Paralelizável com. A coluna "Ordem" é numeração global contínua.
- Seções paralelas: **Onda 0** (caminho crítico p/ produção), **Fill-ins**, **Bloqueadores atuais**, **Site público**, **Admin Payload**, **Plataforma white-label**, **Fora de escopo**, **Cortes seguros**.

## Passo 2 — Classificar e checar duplicidade

Determine o que a ideia é:

| Tipo                                          | Destino no roadmap                                        |
| --------------------------------------------- | --------------------------------------------------------- |
| Feature de `/campanha` com escopo próprio     | Nova linha numa trilha A/B/C/D + tabela de janela + grafo |
| Feature do site público                       | Lista da seção "Site público"                             |
| Melhoria do admin Payload                     | Lista da seção "Admin Payload"                            |
| Tarefa pequena que não bloqueia nada          | Lista "Fill-ins"                                          |
| Débito/risco que impede algo de ir a produção | Tabela "Bloqueadores atuais" (e possivelmente Onda 0)     |
| Fase 2 / multi-tenant                         | "Plataforma white-label"                                  |
| Decisão de NÃO fazer                          | "Fora de escopo (por enquanto)" com racional e fonte      |

**Antes de criar item novo, cheque se já existe.** Faça grep no roadmap e em `docs/plans/*.md` por termos da ideia. Três desfechos possíveis:

- **Já coberto** → não crie nada; aponte o item/plano existente ao usuário.
- **É uma fase de um plano existente** → adicione ao plano existente (nova fase/seção), não crie item paralelo. Precedente: "Gap vs 2022" foi absorvido como Fase 4 do baseline em vez de item próprio.
- **Realmente novo** → siga adiante.

## Passo 3 — Explorar o código antes de escrever o plano

Um plano competente cita arquivos, utilities e padrões **reais** — não abstrações. Antes de escrever, localize no código:

- Onde a feature se pluga (páginas em `src/app/(campaign)/...`, `src/app/(frontend)/...`).
- O que já existe para reusar (`src/utilities/*`, `src/components/campaign/*`, `src/components/ui/*`, `src/lib/*`) — **depth check**: preferir módulo profundo existente a wrapper novo.
- Se exige collection nova ou campo novo → então exige migration (`pnpm migrate:create`) e grupo `admin.group` correto (caro de reverter → Decisão travada com alternativas rejeitadas).
- Se toca pessoa → é join com `Contact`, nunca cadastro paralelo. Se toca opt-in/PII → `Consent` por chave estável, falhando fechado.
- Precedente análogo: encontre o plano existente em `docs/plans/` mais parecido e espelhe o nível de detalhe dele.

## Passo 4 — Classificar superfície UI e semear Impeccable

Classifique o item **antes** de travar a abordagem do plano. Use a mesma tabela que `implement-roadmap-item` (Passo 8) — divergência aqui vira plano que a implementação precisa reescrever.

| Classe                       | Critério                                                                 | Neste fluxo (`roadmap-item`)                                                                |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **A — Só backend**           | Migration, seed, utility, access, aggregate SQL; zero rota/componente UI | Declare `Impeccable: N/A` no plano; **não** leia DESIGN.md só por formalidade               |
| **B — UI encaixada**         | Edita tela/componente existente sob o tema `campaign` / site público     | Semear âncoras + decisões de UX no plano; shape completo fica para a implementação          |
| **C — UI nova / ambígua**    | Rota nova, fluxo multi-tela, ou sem design-ref claro                     | Semear âncoras + **brief compacto** (ver abaixo); marcar shape obrigatório na implementação |
| **D — Design-ref já existe** | Par em `docs/design-refs/latest/` (tabela do roadmap ou pasta)           | Linkar ref no plano; estrutura vale, paleta NÃO; shape compacto na implementação            |

**Se A:** pule o restante deste passo e vá ao Passo 5.

**Se B, C ou D — âncoras obrigatórias (ler, não reinventar):**

1. `PRODUCT.md` + `DESIGN.md` na raiz (register `product` → Field Desk / Signal Red para `/campanha`; `brand` só se for marketing do site público).
2. Design-ref em `docs/design-refs/latest/` se existir (grep na tabela "Referências de design" do roadmap).
3. Critique recente em `.impeccable/critique/` só se o item **nasce** de um débito de critique (precedente: FD2 / `field-desk-ux-pos-critique.md`) — cite o snapshot; não rode critique novo aqui.
4. Componentes/shells já no produto (`CampaignPageShell`, `CampaignMetricStrip`, shadcn em `src/components/ui`) — o plano deve reusar, não propor segundo design system.

**Brief compacto (obrigatório em C; opcional em B se a direção ainda for ambígua):**

Não rode a entrevista longa de `/impeccable shape` nem craft. No plano (seção "Design (Impeccable)" do template), registre em ≤½ página:

- Persona / estado de espírito na tela (Alex, Casey, Lia — ou quem o PRODUCT.md nomear).
- Um job principal da superfície (uma frase).
- Estratégia de cor desta superfície: Restrained (default de produto) salvo exceção justificada.
- Anti-goals (ex.: não hero-metric SaaS; não segundo sistema de cards).
- Na implementação: `Impeccable: shape → craft → critique → polish` (C) ou `craft compacto → critique → polish` (B/D).

**Proibido neste passo:**

- `/impeccable craft`, `critique`, `polish`, `live` — pertencem a `implement-roadmap-item`.
- Entrevista shape de várias rodadas que bloqueia o registro no roadmap. Se C estiver **demasiado** ambíguo para até um brief compacto, pergunte **2–3** perguntas ao usuário (assert-then-confirm), registre as respostas como decisões travadas, e siga — não abra um ciclo Impeccable completo.
- Inventar paleta ou tipografia novas quando `DESIGN.md` / tokens `data-theme='campaign'` já existem.

## Passo 5 — Decidir o posicionamento

Responda explicitamente, nesta ordem. Para cada escolha não óbvia use **Opções | Recomendação | Alternativas rejeitadas** ([decision-quality.md](decision-quality.md)) — decisão silenciosa é defeito.

1. **Filtro caro vs barato**: o que neste item é caro de reverter (schema, access, Consent, URL, fronteira de trilha)? Só isso vira Decisões travadas. O resto → Não escopo, fill-in, ou Adiado com gatilho.
2. **Dependências duras**: sem quais itens este não funciona? (ex.: precisa de `cities[]` → depende de A1). Dependências **suaves** melhoram mas não bloqueiam — marque como tracejadas.
3. **Dependentes**: quais itens existentes passam a depender dele? Atualize-os também.
4. **Paralelismo**: sem seta de entrada = paralelizável a qualquer momento → entra na lista de paralelizáveis abaixo do grafo.
5. **Janela**: a mais cedo possível dado (a) as dependências e (b) a âncora de calendário que o item serve. Item que serve a propaganda de rua precisa estar pronto antes de 16/08; nada de migration arriscada depois de ~20/09 (congelamento).
6. **Appetite**: quanto o slice vale (ex. `~1–2 dias eng`)? Janela ≠ appetite. Se a solução proposta estoura o appetite, corte rabbit holes — não inflar o item.
7. **Prioridade dentro da janela**: caminho crítico (jurídico/Onda 0) > base de dados > operação de campo > inteligência > engajamento/plataforma. Quick wins de campo podem furar fila se forem baratos e paralelizáveis.
8. **Cortável?** Decida se entra na lista de "Cortes seguros" (e em que posição) ou na lista de "não cortáveis" — todo item de trilha precisa estar em uma das duas, com racional. **Nunca** classificar como cortável uma decisão cara de reverter só para “caber no tempo”.
9. **Bloqueador externo?** Se depende de jurídico/LGPD (novo texto de `Consent`), o texto entra no **lote jurídico da Onda 0** — nunca criar rodada jurídica separada (decisão travada: fatiar multiplica lead time).

Se a priorização depender de decisão de produto que você não tem como inferir, posicione com a sua melhor recomendação (Opções+Recomendação explícitos) e marque o item como _(proposto — validar com produto)_, como foi feito com C5.

## Passo 6 — Criar o plano em `docs/plans/`

- **Slug**: kebab-case em português, descritivo, curto (padrão existente: `cadastro-nominal-apoiadores.md`, `zonas-por-municipio.md`). Idioma do conteúdo: pt-BR; identificadores de código citados: inglês.
- **Estrutura**: siga [plan-template.md](plan-template.md) à risca — mesmas seções, mesma ordem (incl. **Appetite**, **Rabbit holes**, **Adiado com gatilho**). Leia o template antes de escrever.
- **Qualidade mínima** (o que separa um plano útil de um genérico):
  - Cabeçalho traz **Appetite** alinhado ao Passo 5.
  - "Decisões travadas" = só o caro de reverter: data, fonte, **por quê** e **alternativas rejeitadas**. Desejo sem rejeitadas não é decisão.
  - "Questões em aberto" = **Opções + Recomendação** — nunca pergunta sem posição.
  - "Abordagem proposta" tem mermaid + componentes com caminhos reais; **depth check**: reusar shells/helpers profundos (`CampaignPageShell`, `campaignAccess`, …); não propor pass-through raso.
  - "Não escopo" cita destino (outro plano/ID); "Rabbit holes" nomeia explosões se tocadas de passagem; "Adiado com gatilho" usa evidência concreta de revisitação (ou `Nenhum neste item.`).
  - "Referências" lista os arquivos-fonte reais que o implementador vai abrir.
  - Classe Impeccable **A/B/C/D** aparece no plano (cabeçalho ou seção Design); se B/C/D, a seção "Design (Impeccable)" está preenchida.
- Se existir design em `docs/design-refs/latest/`, inclua a subseção de referência visual (UX Pilot) com o aviso padrão de paleta (a estrutura vale, a paleta não — usar tokens do tema `data-theme='campaign'`).
- **Self-score** ([decision-quality.md](decision-quality.md)): ≥4/5 antes de gravar; se &lt;4, corrija o plano — não peça tour ao usuário.

## Passo 7 — Editar o roadmap (todos os pontos de consistência)

Um item novo de trilha toca **até 7 lugares** no roadmap. Pule apenas os que não se aplicam:

1. **`Atualizado em:`** (linha 3) — nova data + nota curta do que mudou.
2. **Grafo mermaid** — nó novo na subgraph da trilha (`X9["X9 Nome curto"]`) + setas de/para. Setas cheias `-->` para dependência dura, `-.rótulo.->` para suave.
3. **Lista de paralelizáveis** (parágrafo logo abaixo do grafo) — se o item não tem seta de entrada.
4. **Tabela da janela** — linha nova com Ordem (renumere as seguintes se inserir no meio), Item, link `[detalhes](plans/<slug>.md)`, Depende de, Paralelizável com. Atualize a coluna "Paralelizável com" dos itens vizinhos afetados.
5. **Tabela de referências de design** — se houver design correspondente em `docs/design-refs/latest/`.
6. **Cortes seguros / não cortáveis** — insira na posição certa da lista de cortes, ou justifique como não cortável.
7. **Onda 0** — se o item exigir novo texto jurídico/`Consent`, adicione o texto ao lote jurídico único.

Para itens fora das trilhas (site público, admin, fill-in, bloqueador, fora de escopo): edite só a lista/tabela da seção correspondente + `Atualizado em`, mantendo o padrão da seção — bullets com _(fonte)_ em itálico no final, ou linha de tabela com Status e Fonte.

## Passo 8 — Verificação final

- Todos os links relativos resolvem (`plans/<slug>.md` a partir de `docs/`, `../roadmap.md` a partir de `docs/plans/`).
- O mermaid continua válido (nomes de nó únicos, subgraphs fechadas — renderize mentalmente ou cole num validador se a edição foi grande).
- Consistência tripla: o que a **tabela de janela** diz em "Depende de" = setas do **grafo** = seção "Dependências" do **plano**. Divergência aqui é o bug mais comum.
- O plano referencia o roadmap (`Item do roadmap:` no cabeçalho) e o roadmap referencia o plano (link na tabela).
- Não inventou ID duplicado nem quebrou a numeração de "Ordem".
- Classe Impeccable do Passo 4 está no plano; se B/C/D, há âncoras (`PRODUCT.md`/`DESIGN.md` e/ou design-ref) citadas — não só "fazer uma tela bonita".
- Appetite + Rabbit holes presentes; Decisões travadas caras têm alternativas rejeitadas; self-score ≥4/5.

Ao final, resuma para o usuário: ID atribuído, janela, **appetite**, dependências assumidas, **classe Impeccable (A–D)**, `Qualidade de decisão: N/5`, e as decisões de posicionamento que merecem validação de produto.
