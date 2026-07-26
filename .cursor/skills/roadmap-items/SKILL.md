---
name: roadmap-items
description: Registra VÁRIOS itens no docs/roadmap.md do Teqo de uma vez, aplicando a skill roadmap-item a cada um e consolidando as edições do roadmap num único passe (IDs sem colisão, dependências intra-lote, renumeração de Ordem, mermaid, Atualizado em). Usar quando o usuário passar uma lista de ideias/features/débitos para registrar, ou disser "adiciona esses itens ao roadmap", "cria planos para essas ideias", "registra tudo isso no roadmap", "roadmap em lote".
---

# Adicionar VÁRIOS itens ao roadmap (lote)

Esta skill recebe **N ideias de uma vez** e produz: N planos em `docs/plans/<slug>.md` + **uma** edição consistente do `docs/roadmap.md` cobrindo todos eles.

**REQUIRED SUB-SKILL:** `.cursor/skills/roadmap-item/SKILL.md` — leia-a integralmente antes de começar. Ela é a autoridade sobre **como** classificar, explorar, decidir posicionamento e escrever cada plano (incl. [decision-quality.md](../roadmap-item/decision-quality.md), [data-presentation.md](../roadmap-item/data-presentation.md), [plan-template.md](../roadmap-item/plan-template.md)). **Não reimplemente nada dela aqui.** Esta skill só orquestra o lote e resolve o que só existe em lote: colisão de IDs, dependências entre os próprios itens do lote, e uma renumeração/edição única do roadmap.

**Announce at start:** "Using roadmap-items: N itens → planos individuais + um passe consolidado no roadmap."

## O que muda em relação a rodar `roadmap-item` N vezes

| Aspecto                          | `roadmap-item` × N                                | `roadmap-items` (esta)                                             |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| Leitura do `docs/roadmap.md`     | Uma por item                                      | **Uma só** no início (Fase 0) + releitura antes do passe de escrita |
| Atribuição de ID                 | Próximo livre por trilha, item a item             | **Reservados de uma vez** no Fase 1 → sem colisão dentro do lote    |
| Dependência entre itens do lote  | Invisível (item 3 não sabe que o item 1 existirá) | Resolvida explicitamente (grafo intra-lote no Fase 1)               |
| Edição do roadmap (7 pontos)     | N vezes, renumerando "Ordem" a cada vez           | **Um passe** com renumeração única (Fase 2)                         |
| `Atualizado em:`                 | N edições da mesma linha                          | Uma linha, uma nota cobrindo o lote                                 |
| Perguntas ao usuário             | Interrompe N vezes                                | **Uma rodada** de perguntas agregada (gate do Fase 1)               |

## Checklist do fluxo

```
- [ ] 0. Parse do lote: separar itens, deduplicar entre si, ler o roadmap uma vez
- [ ] 1. Por item: Passos 2–6 de roadmap-item (classificar, explorar, posicionar, plano)
      com IDs reservados e dependências intra-lote resolvidas
- [ ] 1b. Gate único: perguntas agregadas ao usuário (se houver)
- [ ] 2. Passe consolidado no roadmap (Passo 7 de roadmap-item para todos de uma vez)
- [ ] 3. Verificação cruzada do lote (Passo 8) + resumo em tabela
```

## Fase 0 — Parse do lote e leitura única

1. **Separe os itens.** A entrada pode vir como lista numerada, bullets, parágrafo corrido ou colagem de notas. Se a separação for ambígua (ex.: uma frase que pode ser 1 item ou 3), assuma a leitura mais provável, **liste os itens como você os entendeu** e siga — a confirmação vai junto do gate do Fase 1b, não numa rodada só para isso.
2. **Deduplique dentro do lote.** Antes de olhar o roadmap, cheque se dois itens do lote são o mesmo item, ou se um é fase/sub-escopo de outro. Desfechos: **mesclar** (um item, plano único), **absorver** (vira fase de outro plano), ou **manter separados** com dependência explícita. Registre a decisão — ela vai no resumo final.
3. **Leia `docs/roadmap.md` inteiro uma única vez** (Passo 1 de `roadmap-item`). Se ele estiver inchado com ciclos entregues, rode `compile-roadmap` **antes** — em lote o custo de um grafo inconsistente se multiplica.
4. **Deduplique contra o que já existe** (Passo 2 de `roadmap-item`) para **todos** os itens de uma vez: um grep por lote em `docs/roadmap.md` e `docs/plans/*.md`. Itens já cobertos saem do lote agora (viram linha "já coberto" no resumo), não depois.

## Fase 1 — Por item: Passos 2–6 de `roadmap-item`

Para cada item sobrevivente, execute **Passos 2 a 6** da skill filha (classificação, exploração de código, classe Impeccable A–D, filtro de dados, posicionamento com Opções/Recomendação/rejeitadas, appetite, e criação de `docs/plans/<slug>.md`). Sem atalhos: um plano de lote tem o mesmo padrão de qualidade de um plano avulso, incluindo self-score ≥4/5.

Três regras que só existem no lote:

**a) Reserve os IDs de uma vez, antes de escrever qualquer plano.** Levante o último ID usado por trilha no roadmap lido no Fase 0 e distribua sequencialmente para os itens do lote (ex.: trilha B em `B24` → os três itens de B viram `B25`, `B26`, `B27`). Fixe essa tabela antes de escrever — atribuir ID durante a escrita é como nascem os duplicados.

**b) Resolva as dependências intra-lote explicitamente.** Um item do lote pode depender de outro item do lote. Monte o grafo do lote antes de decidir janelas: se `B26` precisa de `B25`, `B26` não pode cair numa janela anterior. Ordene a execução do Fase 1 em ordem topológica — o plano do dependente cita o ID do dependido, que já existe.

**c) Acumule as perguntas, não pergunte item a item.** Quando a skill filha mandaria perguntar (classe C ambígua demais para brief compacto; priorização que depende de decisão de produto), **anote a pergunta com a sua recomendação** e siga para o próximo item.

### Fase 1b — Gate único

Se houve perguntas acumuladas, faça **uma** rodada com `AskQuestion` cobrindo todos os itens (a recomendação primeiro, marcada como recomendada). Inclua aqui também a confirmação da separação/dedup do Fase 0 se ela ficou ambígua.

Se não houve perguntas, **não pare** — siga direto ao Fase 2.

Não escreva nada no `docs/roadmap.md` antes deste gate. Os planos em `docs/plans/` podem ser escritos antes (são arquivos novos, isolados); ajuste-os depois se a resposta mudar o posicionamento.

## Fase 2 — Passe consolidado no roadmap

Releia `docs/roadmap.md` (pode ter mudado desde o Fase 0) e aplique o **Passo 7 da skill filha uma única vez para o lote inteiro**, nos 7 pontos de consistência:

1. **`Atualizado em:`** — uma data, uma nota curta cobrindo o lote (ex.: "B25–B27 registrados: …"). Nunca N notas.
2. **Grafo mermaid** — todos os nós novos + todas as setas de uma vez, incluindo as **setas intra-lote** do Fase 1b.
3. **Lista de paralelizáveis** — some os itens sem seta de entrada; cheque que nenhum item do lote listado como paralelizável depende de outro item do lote.
4. **Tabelas de janela** — insira todas as linhas e **renumere a coluna "Ordem" uma vez só**, ao final das inserções. Renumerar a cada item é o erro clássico do lote. Atualize "Paralelizável com" dos vizinhos afetados depois que todas as linhas estiverem no lugar.
5. **Tabela de referências de design** — para os itens com par em `docs/design-refs/latest/`.
6. **Cortes seguros / não cortáveis** — cada item do lote precisa cair em uma das duas listas, com racional. Ordene os cortáveis do lote entre si.
7. **Onda 0** — se **qualquer** item exigir novo texto de `Consent`/jurídico, todos os textos do lote entram no **mesmo** lote jurídico existente. Nunca criar uma segunda rodada jurídica.

Itens fora das trilhas (site público, admin, fill-in, bloqueador, fora de escopo) entram nas suas listas próprias no mesmo passe, mantendo o padrão da seção.

## Fase 3 — Verificação cruzada e resumo

Rode o Passo 8 da skill filha **para cada item** e mais estas checagens que só o lote exige:

- Nenhum ID duplicado — nem contra o roadmap antigo, nem entre itens do lote.
- Coluna "Ordem" contínua e sem repetição após a renumeração única.
- Consistência tripla (tabela de janela ↔ grafo ↔ seção "Dependências" do plano) verificada **item a item**, incluindo as dependências intra-lote nos três lugares.
- Nenhum item do lote em janela anterior à de um item do mesmo lote de que ele dependa.
- Um link de plano por item, todos resolvendo; todo plano com `Item do roadmap:` no cabeçalho.
- `Atualizado em` foi tocado uma vez só.

**Resumo final** — uma tabela do lote, uma linha por item:

| Item | ID  | Janela | Appetite | Depende de | Impeccable | Dados | Decisão N/5 | Plano |
| ---- | --- | ------ | -------- | ---------- | ---------- | ----- | ----------- | ----- |

Abaixo da tabela, em prosa curta: itens mesclados/absorvidos/descartados por duplicidade e por quê; decisões de posicionamento que merecem validação de produto; e o que o gate do Fase 1b decidiu.

## Regras de orquestração

| Situação                                                    | Ação                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Um item do lote já está coberto no roadmap                  | Tire do lote no Fase 0; reporte no resumo apontando o item/plano existente                    |
| Dois itens do lote são o mesmo                              | Mescle em um plano; o resumo diz o que foi mesclado                                           |
| Um item é fase de um plano existente                        | Adicione a fase ao plano existente; **não** consome ID novo                                   |
| Um item exige decisão de produto                            | Posicione com a sua recomendação, marque _(proposto — validar com produto)_, pergunte no gate |
| Um item é grande demais para um slice                       | Fatie em itens do lote com dependência entre si — não infle o appetite                        |
| O lote inteiro cai na mesma janela e estoura a janela       | Mantenha o registro; sinalize no resumo qual item é cortável primeiro                         |
| `compile-roadmap` é necessário                              | Rode antes do Fase 0; registrar em cima de roadmap inchado multiplica a inconsistência        |
| O lote é grande (>~6 itens) e a exploração de código é cara | Paralelize **só** o Passo 3 (exploração) com subagents `explore`; escrita fica sequencial     |

**Nunca paralelize a escrita.** Planos podem ser escritos em sequência rápida, mas o `docs/roadmap.md` é editado por um único passe (Fase 2) — dois agentes editando mermaid/tabelas do mesmo arquivo produzem grafo quebrado e "Ordem" duplicada.

## Posição no fluxo

```
ideias soltas (várias)
  → roadmap-items  (= roadmap-item por item + passe consolidado)
     → suggest-next-roadmap-items
        → implement-roadmap-item → /simplify + /impeccable → close-delivery
```

Para **uma** ideia só, use `roadmap-item` direto — esta skill só paga o overhead a partir de dois itens.
