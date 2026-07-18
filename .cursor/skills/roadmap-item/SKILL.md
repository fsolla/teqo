---
name: roadmap-item
description: Adiciona uma ideia, tarefa ou funcionalidade ao docs/roadmap.md do Teqo no local correto (trilha, janela do calendário eleitoral, grafo de dependências, paralelismo) e cria o plano detalhado correspondente em docs/plans/. Usar quando o usuário pedir para adicionar algo ao roadmap, registrar uma ideia/feature/débito, criar um plano para um item, ou disser "adiciona ao roadmap", "cria um plano para", "registra essa ideia".
---

# Adicionar item ao roadmap + criar plano

Esta skill transforma uma ideia solta em: (1) um item posicionado corretamente no `docs/roadmap.md` e (2) um arquivo de plano em `docs/plans/<slug>.md` linkado a partir do item. O roadmap é o registro canônico **em ordem de execução, com dependências e paralelismo explícitos** — um item mal posicionado é pior que um item ausente.

## Checklist do fluxo

```
- [ ] 1. Ler docs/roadmap.md inteiro (nunca editar sem ler a versão atual)
- [ ] 2. Classificar a ideia e checar duplicidade/absorção
- [ ] 3. Explorar o código relevante para fundamentar o plano
- [ ] 4. Decidir posicionamento: seção, ID, dependências, janela, paralelismo
- [ ] 5. Criar docs/plans/<slug>.md a partir do template
- [ ] 6. Editar o roadmap em TODOS os pontos de consistência
- [ ] 7. Verificar links, mermaid e consistência cruzada
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
- O que já existe para reusar (`src/utilities/*`, `src/components/campaign/*`, `src/components/ui/*`, `src/lib/*`).
- Se exige collection nova ou campo novo → então exige migration (`pnpm migrate:create`) e grupo `admin.group` correto.
- Se toca pessoa → é join com `Contact`, nunca cadastro paralelo. Se toca opt-in/PII → `Consent` por chave estável, falhando fechado.
- Precedente análogo: encontre o plano existente em `docs/plans/` mais parecido e espelhe o nível de detalhe dele.

## Passo 4 — Decidir o posicionamento

Responda explicitamente, nesta ordem:

1. **Dependências duras**: sem quais itens este não funciona? (ex.: precisa de `cities[]` → depende de A1). Dependências **suaves** melhoram mas não bloqueiam — marque como tracejadas.
2. **Dependentes**: quais itens existentes passam a depender dele? Atualize-os também.
3. **Paralelismo**: sem seta de entrada = paralelizável a qualquer momento → entra na lista de paralelizáveis abaixo do grafo.
4. **Janela**: a mais cedo possível dado (a) as dependências e (b) a âncora de calendário que o item serve. Item que serve a propaganda de rua precisa estar pronto antes de 16/08; nada de migration arriscada depois de ~20/09 (congelamento).
5. **Prioridade dentro da janela**: caminho crítico (jurídico/Onda 0) > base de dados > operação de campo > inteligência > engajamento/plataforma. Quick wins de campo podem furar fila se forem baratos e paralelizáveis.
6. **Cortável?** Decida se entra na lista de "Cortes seguros" (e em que posição) ou na lista de "não cortáveis" — todo item de trilha precisa estar em uma das duas, com racional.
7. **Bloqueador externo?** Se depende de jurídico/LGPD (novo texto de `Consent`), o texto entra no **lote jurídico da Onda 0** — nunca criar rodada jurídica separada (decisão travada: fatiar multiplica lead time).

Se a priorização depender de decisão de produto que você não tem como inferir, posicione com a sua melhor recomendação e marque o item como _(proposto — validar com produto)_, como foi feito com C5.

## Passo 5 — Criar o plano em `docs/plans/`

- **Slug**: kebab-case em português, descritivo, curto (padrão existente: `cadastro-nominal-apoiadores.md`, `zonas-por-municipio.md`). Idioma do conteúdo: pt-BR; identificadores de código citados: inglês.
- **Estrutura**: siga [plan-template.md](plan-template.md) à risca — mesmas seções, mesma ordem. Leia o template antes de escrever.
- **Qualidade mínima** (o que separa um plano útil de um genérico):
  - "Decisões travadas" registra decisões com data e fonte, não desejos. Cada uma deve ser defensável ("por quê" incluído).
  - "Questões em aberto" sempre traz **Recomendação** para cada questão — nunca deixar pergunta sem posição.
  - "Abordagem proposta" tem diagrama mermaid + lista de componentes com caminhos de arquivo reais e assinaturas concretas.
  - "Não escopo" é explícito e cita para qual outro plano/item cada exclusão vai.
  - "Referências" lista os arquivos-fonte reais que o implementador vai abrir.
- Se existir design em `docs/design-refs/latest/`, inclua a seção "Referência visual (UX Pilot)" com o aviso padrão de paleta (a estrutura vale, a paleta não — usar tokens do tema `data-theme='campaign'`).

## Passo 6 — Editar o roadmap (todos os pontos de consistência)

Um item novo de trilha toca **até 7 lugares** no roadmap. Pule apenas os que não se aplicam:

1. **`Atualizado em:`** (linha 3) — nova data + nota curta do que mudou.
2. **Grafo mermaid** — nó novo na subgraph da trilha (`X9["X9 Nome curto"]`) + setas de/para. Setas cheias `-->` para dependência dura, `-.rótulo.->` para suave.
3. **Lista de paralelizáveis** (parágrafo logo abaixo do grafo) — se o item não tem seta de entrada.
4. **Tabela da janela** — linha nova com Ordem (renumere as seguintes se inserir no meio), Item, link `[detalhes](plans/<slug>.md)`, Depende de, Paralelizável com. Atualize a coluna "Paralelizável com" dos itens vizinhos afetados.
5. **Tabela de referências de design** — se houver design correspondente em `docs/design-refs/latest/`.
6. **Cortes seguros / não cortáveis** — insira na posição certa da lista de cortes, ou justifique como não cortável.
7. **Onda 0** — se o item exigir novo texto jurídico/`Consent`, adicione o texto ao lote jurídico único.

Para itens fora das trilhas (site público, admin, fill-in, bloqueador, fora de escopo): edite só a lista/tabela da seção correspondente + `Atualizado em`, mantendo o padrão da seção — bullets com _(fonte)_ em itálico no final, ou linha de tabela com Status e Fonte.

## Passo 7 — Verificação final

- Todos os links relativos resolvem (`plans/<slug>.md` a partir de `docs/`, `../roadmap.md` a partir de `docs/plans/`).
- O mermaid continua válido (nomes de nó únicos, subgraphs fechadas — renderize mentalmente ou cole num validador se a edição foi grande).
- Consistência tripla: o que a **tabela de janela** diz em "Depende de" = setas do **grafo** = seção "Dependências" do **plano**. Divergência aqui é o bug mais comum.
- O plano referencia o roadmap (`Item do roadmap:` no cabeçalho) e o roadmap referencia o plano (link na tabela).
- Não inventou ID duplicado nem quebrou a numeração de "Ordem".

Ao final, resuma para o usuário: ID atribuído, janela, dependências assumidas, e as decisões de posicionamento que merecem validação de produto.
