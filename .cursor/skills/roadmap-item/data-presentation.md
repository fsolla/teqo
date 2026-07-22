# Dados → decisão → apresentação

Filtro obrigatório quando um item do roadmap **produz, agrega ou exibe** números, séries, rankings, mapas ou KPIs. Inspirado em `visualization-choice-reporting` (pergunta → tipo de chart → narrativa acionável) e no kernel Teqo (`PRODUCT.md` §5 + `docs/research/`). **Não** é um tour de dashboard design — são três perguntas com resposta registrada no plano. Decisão silenciosa (“só coloca um gráfico”) é defeito.

Aplique em silêncio em `roadmap-item` (ao semear o plano) e em `implement-roadmap-item` (ao auditar e fatiar UI). Se o item **não** apresenta dados (ex.: migration de Consent, invite WhatsApp, form CRUD sem métrica), escreva `Dados: N/A` no plano e pule o resto.

## As três perguntas (ordem fixa)

Responda nesta ordem. Pular para “qual chart?” antes de fechar (1)–(2) é o erro clássico.

```text
1. Vou apresentar dados?
2. Quais decisões serão tomadas a partir destes dados?
3. Como apresentar estes dados para auxiliar essa decisão de forma efetiva?
```

### 1. Vou apresentar dados?

| Resposta                       | Critério                                                               | Ação no plano                                     |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- |
| **Não**                        | Só schema/action/access; nenhum número lido por humano nesta entrega   | `Dados: N/A` — fim                                |
| **Sim, derivado / API só**     | Utility/aggregate que **outra** superfície já consome (ou item futuro) | Registrar payload + quem consome; UI fica no dono |
| **Sim, superfície neste item** | Lista, detalhe, dashboard, mapa, CSV export legível, card de insight   | Preencher seção completa abaixo                   |

Se “sim”: profile rápido do dado — tipo (categórico / numérico / temporal / geo), granularidade (praça / município / TI / estado), tamanho típico (1 KPI vs 436 linhas vs série 3 anos), e se é **absoluto ou relativo** (no `/campanha` electoral, preferir relativo/local — ver anti-goals).

### 2. Quais decisões serão tomadas a partir destes dados?

Uma frase por decisão, no formato **ator + escolha**. Sem decisão nomeável → o dado é vaidade; corte ou rebaixe a “contexto secundário”.

Exemplos Teqo bons:

- Coordenador: “nesta semana, atacar déficit descoberto em quais Praças?”
- Assessor: “minha meta fecha? se não, renegociar pledge ou abrir demanda?”
- Staff: “comparar candidato X vs Solla neste município — manter ou pivotar discurso?”

Exemplos ruins (rejeitar):

- “Ter visibilidade do % estadual” (anti-goal; não decide alocação)
- “Ver quantos apoiadores cadastrados” sem vínculo a cobertura/meta
- “Dashboard bonito para impressionar”

Se o item toca inteligência de campanha / mapa / metas / fila: consulte **antes** o playbook em `docs/research/relatorio-entrevista-persona-campanha.md` (§6 padrões dado→decisão) e o anti-catálogo do plano-mestre `docs/plans/inteligencia-campanha.md`. Não invente métrica que o research vetou.

### 3. Como apresentar para auxiliar essa decisão?

Escolha a **forma mais pobre que ainda responde a decisão** (depth: reusar shell existente > chart novo > lib de charts). Registre no plano: forma + racional + o que foi rejeitado.

**Escada de pobreza (preferir o degrau mais baixo que resolve):**

| Degrau                         | Quando usar                                                       | Reuso Teqo típico                                     |
| ------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------- |
| **Número + contexto**          | 1–2 valores, “fecha / não fecha”, delta vs meta/semana            | `CampaignMetricStrip`, linha no overview              |
| **Tabela / lista ranqueada**   | Comparar muitas entidades (Praças), ordenar por déficit/cobertura | `PlazaList` + colunas; fila de alocação               |
| **Série temporal simples**     | Evolução curta (3–5 pontos: 2014/2018/2022 ou delta semanal)      | sparkline / tabela ano×valor; não multi-eixo          |
| **Mapa (cor / símbolo)**       | Decisão é **onde** agir; geo é central à pergunta                 | `BahiaMap` + escala relativa (quantil/LQ), não % est. |
| **Chart (barra / linha)**      | Comparação de poucas categorias ou tendência com >~5 pontos       | shadcn/`src/components/ui`; tokens `campaign`         |
| **Chart composto / dashboard** | Só se appetite e research pedirem; senão rabbit hole              | Adiar com gatilho                                     |

**Família de pergunta → forma** (resumo de visualization-choice-reporting, calibrado ao Field Desk):

| Pergunta que o dado responde       | Preferir                         | Evitar neste produto                |
| ---------------------------------- | -------------------------------- | ----------------------------------- |
| Quanto falta / cobre a meta?       | Número + % cobertura + delta     | Gauge/velocímetro SaaS, hero-metric |
| Onde está o buraco / oportunidade? | Mapa relativo ou lista ranqueada | Choropleth de % estadual absoluto   |
| Como evoluiu no tempo?             | Linha/sparkline ou tabela anos   | Pie; dual Y-axis                    |
| Como A se compara a B (poucos)?    | Barra horizontal ou tabela       | Pie com muitas fatias; 3D           |
| Qual a composição do todo?         | Stacked bar ou tabela            | Donut decorativo                    |
| Correlação / nuvem de pontos?      | Quase nunca em v1 `/campanha`    | Scatter exploratório sem decisão    |

**Narrativa mínima na UI** (mesmo sem relatório formal): o bloco de dados deve permitir ler, nesta ordem — **insight → padrão → contexto (vs meta/histórico) → implicação → próxima ação possível**. Título descritivo (“Votos por mês”) sem insight é falha. Em `/campanha`, a “ação” é menu para julgamento humano (nunca auto-decisão) — alinhado ao research.

## Anti-goals Teqo (não negociar sem fonte nova)

- KPI de **% estadual absoluto** como escala principal (achatamento; DF ≠ majoritária).
- Contagem bruta de cadastros / “vanity metrics” sem vínculo a cobertura/meta/fila.
- Cartograma, gauge, rainbow choropleth, dual-axis enganoso.
- Mapa bonito com pergunta errada (visualização serve à análise; análise serve à decisão — research § ordem Brewer/Pickle).
- Segunda lib de charts / design system paralelo; inventar paleta fora de `data-theme='campaign'`.
- Sugestão automática sem registro de decisão humana (C12 / motor de sugestões).

## Quando NÃO usar gráfico

- Um único número decisivo → número tipográfico + unidade + vs quê.
- Dois números → lado a lado com delta %.
- Poucas linhas densas de auditoria → tabela.
- Export/CSV para operação → tabela; chart é opcional depois.

## Caro vs barato nesta superfície

| Caro (Decisão travada + rejeitadas)              | Barato (Não escopo / Adiado)              |
| ------------------------------------------------ | ----------------------------------------- |
| Métrica canônica (fórmula, denominador, quem vê) | Cor da barra, ordem de colunas            |
| Escala do mapa (absoluta vs % vs quantil/LQ)     | Tooltip copy                              |
| Staff-only vs leader-visible                     | Sparkline vs número só                    |
| Persistência de derivado vs compute on read      | Biblioteca de chart (se já há shadcn/SVG) |

## Self-check (30s, só se Dados ≠ N/A)

Antes de gravar o plano ou declarar a fase de UI pronta — 1 ponto cada; **&lt;3 → corrigir**:

1. As três perguntas estão respondidas por escrito?
2. Há pelo menos uma **decisão nomeável** (ator + escolha)?
3. A forma escolhida é o degrau mais pobre que resolve — com alternativas rejeitadas?
4. Anti-goals do research/`PRODUCT.md` §5 não foram violados?
5. Depth: reusa `CampaignMetricStrip` / lista / `BahiaMap` / tabela existente quando bastam?

## Onde registrar

- **`roadmap-item`:** seção **Dados → decisão → apresentação** no `docs/plans/<slug>.md` (template). Se N/A, uma linha basta.
- **`implement-roadmap-item`:** auditar essa seção no Passo 4; se ausente e o item claramente apresenta dados → defasado (completar no Passo 7). Nas fases de UI, a escolha de forma é input do craft/critique — não reinventar no meio do polish.
- Skills externas (opcional, leitura sob demanda): `visualization-choice-reporting` (famílias de chart + narrativa); `.agents/skills/refactoring-ui/references/data-visualization.md` (quando NÃO chartar); Mapbox patterns só se o item for mapa Mapbox (hoje o mapa Teqo é Leaflet/`BahiaMap`).
