# Qualidade de decisão (roadmap / implementação / débitos)

Inspirado em `design-code-architecture` e nas skills que ela compõe (37signals, software-design-philosophy, clean-architecture, DDD) — **sem** jornada guiada por fases. Use estes filtros automaticamente ao redigir planos, implementar ou triar débitos. Decisão silenciosa é defeito.

## Filtro caro vs barato

Delibere e registre só o **caro de reverter**. O barato vira Não escopo, fill-in, ou “mais simples que funciona” com **gatilho de revisitação** (não “depois”).

| Caro (decidir agora + alternativas rejeitadas)                           | Barato (adiar / mais simples)       |
| ------------------------------------------------------------------------ | ----------------------------------- |
| Collection nova, unicidade, modelo de access                             | Polish cosmético, 2º estilo de card |
| Nova chave `Consent` / superfície PII                                    | Copy, motion, a11y P3               |
| Semântica de escrita multi-collection / locks                            | Prefetch, apresentação de KPI       |
| URL pública / slug imutável                                              | Ordem de colunas na lista           |
| Separar item de trilha vs absorver em plano                              | Rename de pureza, naming cosmético  |
| Fronteira de módulo em ponto de volatilidade real (DB, vendor, delivery) | Adapter/interface com 1 call site   |

Converter caro em barato: colocar um boundary na frente (fail-closed por chave, join em `Contact`, chips opt-in em vez de igualdade forçada) — o conjunto irredutível de decisões caras deve caber nas Decisões travadas.

## Forma obrigatória de decisão

Toda decisão não trivial (posicionamento, classe Impeccable B↔C, absorver vs registrar, default de produto, schema vs não):

```text
Opções: A | B | C
Recomendação: B — porque …
Alternativas rejeitadas: A porque …; C porque …
```

No plano: Decisões travadas = **decisão + por quê + fonte/data + alternativas rejeitadas**. Em Questões em aberto: **Opções + Recomendação** (nunca pergunta sem posição). Assuma o default e marque _(assumido — validar com produto)_ — não abra tour de confirmações.

## Appetite (tempo fixo, escopo flexível)

Além da **janela** eleitoral, declare um **appetite** (quanto o slice vale), não uma estimativa aberta:

- Exemplos: `~0,5 dia eng, só utility` · `~1–2 dias, migration + 1 action + encaixe em lista` · `~1 ciclo curto, UI nova 1 rota`.
- Se a Abordagem proposta estourar o appetite → cortar rabbit holes / Não escopo, não inflar o item.
- Em `implement-roadmap-item`, cada fase declara quanto do appetite consome; preferir um **tracer bullet** cedo (schema → uma action → uma superfície UI) antes de polish paralelo.

## Rabbit holes

Riscos que explodem o escopo se tocados “de passagem”. Listar ao lado de Não escopo (não são a mesma coisa):

| Não escopo                                       | Rabbit hole                                                                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exclusão consciente com destino (outro plano/ID) | Armadilha se alguém “só completar”                                                                                                                     |
| Ex.: mapa Leaflet → B3                           | Ex.: layers Clean Architecture só para um feature; 2ª collection de pessoa; igualdade forçada TSE; event sourcing; helper shared antes de 3 call sites |

Rabbit holes Teqo recorrentes: layers/cerimônia sem volatilidade, cadastro paralelo a `Contact`, Consent hardcoded por ID, abstração DRY prematura, redesign de paleta fora de `campaign`.

## Depth check (módulos profundos)

Antes de propor arquivo/utility/componente novo na Abordagem:

1. Já existe módulo profundo que esconde isso? (`campaignAccess`, shells de lista, `withPayloadTransaction`, `campaignConsent`, …) → **reusar**.
2. O novo símbolo esconde complexidade real ou é pass-through raso (classitis)? → **consolidar ou não criar**.
3. Uma decisão de design vazaria em N módulos? → **encapsular uma vez**.

Não invocar a skill `software-design-philosophy` inteira — aplicar só este check no momento da decisão.

## Defer com gatilho

Adiar sem gatilho vira backlog morto. Formato:

`Adiar X até <evidência concreta>` — ex.: “shared `drizzleBulk` quando existir o 3º caminho bulk”; “réplicas/cache quando QPS médio > N” (raro neste produto).

Em `capture-review-debts`: DRY com &lt;3 call sites → preferir **descartar** ou **defer+gatilho** a **registrar**, salvo access/LGPD/hot path.

## Princípios sob demanda (método, não jornada)

Quando o tipo de decisão bater, aplicar o princípio — **não** abrir fases de `design-code-architecture`:

| Tipo de decisão                                       | Princípio                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Dependências de código / testabilidade do domínio     | Dependency Rule: framework/ORM no anel externo; core testável sem DB/web                         |
| Vocabulário / aggregate / “Customer” em dois sentidos | DDD: não unificar; invariants no aggregate; refs por ID                                          |
| Escopo de v1 do item                                  | 37signals: build less, YAGNI, cortar abstração especulativa; **nunca** cortar o caro de reverter |
| Depth / leakage na abordagem                          | software-design-philosophy: deep modules, um lugar por conhecimento                              |
| Outbound / lista / import                             | Timeouts, paginação, fail-closed (já em AGENTS.md) — nomear como decisão se o item toca          |
| KPI / mapa / série / ranking na UI                    | [data-presentation.md](data-presentation.md): dado → decisão nomeável → forma mais pobre         |

## Self-score (gate de 30s)

Antes de gravar docs ou declarar o plano de implementação pronto, pontue 0–5 (1 ponto cada). **&lt;4 → corrigir antes de escrever/seguir**:

1. Decisões caras têm alternativas rejeitadas?
2. Appetite declarado e abordagem cabe nele?
3. Rabbit holes nomeados (além de Não escopo)?
4. Depth check: reusa shells/helpers existentes (sem classitis)?
5. Consistência aplicável: tripla grafo=tabela=Dependências **ou** triage score/destino/tipo alinhados?

Opcional no resumo ao usuário: `Qualidade de decisão: N/5` + o item que falhou.
