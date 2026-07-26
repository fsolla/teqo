# E10 — Classificação territorial relativa

Status: **entregue 2026-07-25**
Atualizado em: 2026-07-25 (as-built E10) — as decisões travadas do rascunho anterior (vocabulário `Defesa/Ataque/Indecisa/Perdida`, edição in place de `electionInsights.ts`, NEC na v1) foram **substituídas** durante a implementação; o histórico fica abaixo em "Correções do rascunho".
Item do roadmap: [docs/roadmap.md](../roadmap.md) (seção "Inteligência de campanha", E10; plano-mestre [inteligencia-campanha.md](inteligencia-campanha.md))
Impeccable: B — muda o conteúdo de cards/lista existentes; sem rota nova
Appetite: ~1,1–1,25d eng; sem migration (derivação em leitura, âncoras versionadas em código)
Responsável: —

## O que foi entregue

Um classificador **puro sobre o artefato TSE commitado** (`src/lib/electionAggregates/bahia-federal-baseline.json`) que dá a cada um dos 435 municípios do catálogo uma classe operacional. Sem query, sem `campaignGoals`, sem `user`, sem migration.

### Vocabulário (decidido com produto nesta sessão)

`reduto | expansao | manutencao | marginal | sem_base` — rótulos **Reduto · Expansão · Manutenção · Marginal · Sem base** (valores pt-BR sem acento, precedente `politicalTrend.status`). Casa com os padrões P1/P2/P10 do E11 e com o relatório de discovery; substitui `Defesa/Ataque/Indecisa/Perdida`, herança majoritária do A5-2.

### Eixos e âncoras

`src/utilities/municipalityTerritorialClass.ts` (pure, sem `server-only`, irmão de `municipalityPotential.ts` — não pode morar em `src/lib/` porque `lib` não importa `utilities`):

- **`lq`** = (votos ÷ válidos local) ÷ (votos ÷ válidos estadual) — dominância relativa contra o padrão estadual do próprio candidato.
- **`ownShare`** = % da votação estadual dele que vem daqui (âncora da mesa, A11).
- **`fieldHeadroom`** = `projectedFieldCeiling` (E8) − votos próprios, comparado à **mediana do catálogo** (corte relativo, sem número mágico que envelhece).
- **`inCoreBlock`** = está no bloco que acumula 50% da votação própria — impede que um município grande com baixa penetração leia como "Marginal".

Regras, na ordem de leitura da mesa: `lq ≥ strongLq (2)` → Reduto; `lq < weakLq (0,5)` → Expansão se há campo (headroom ≥ mediana **ou** core block), senão Marginal; entre os cortes → Manutenção. Válidos 0 ou sem série → `sem_base`.

`TERRITORIAL_CLASS_ANCHORS` carrega os cortes com comentário de estatuto: são **ilustrativos** (research §6 dá a forma: LQ > 2–3 reduto, ~1 padrão, < 0,5 fraqueza); a calibração empírica é **E15**.

### Saída e apresentação

`{ class, factors, lq, ownShare, fieldHeadroom, inCoreBlock }`, com `factors` ordenados por força (`dominance | ownShare | field | capture`). **A UI nunca mostra o rótulo sozinho** (anti-goal do relatório §6.4 — rótulo sem "por quê" compra excesso de confiança):

- **Detalhe** — badge + linha "por quê" (2 fatores) no topo do bloco de diagnósticos do `MunicipalityGoalAccountCard` (E8), que já renderiza exatamente os números que alimentam o classificador. Não nasceu card novo.
- **Dossiê (E16)** — badge autoexplicativo na capa ("Classe reduto", ao lado de prioridade e tendência) + a linha de fatores logo abaixo; o print CSS força `print-color-adjust: exact` nos badges, senão a impressora achata os três em cinza.
- **Lista** — coluna nova **"Classe"**, logo após "2022" (mesma origem TSE), com `MunicipalitySortableHead` (`sortKey="classe"`, `filterParam="class"`). A célula é **só o chip**: os fatores por extenso a tornavam a célula mais larga de uma tabela que não rola na horizontal, então o "por quê" saiu para a tooltip da célula (hover/foco/toque) e ficou na célula como `sr-only`. Isso foi feito pela mecânica genérica do **B23** (`cellTooltip` em `CampaignTableColumn` + `shared/CampaignCellTooltip`, com `MunicipalityHoverTooltip` promovido para `shared/CampaignHoverTooltip`), não por um componente desta coluna. `sem_base` renderiza travessão, não badge, e não declara tooltip.
- **Conceitos (E18)** — dois verbetes novos na categoria `diagnostico`: `dominancia-relativa` (LQ) e `classe-territorial`.

Paleta (documentada em `DESIGN.md` § Status Badge): reduto `estimate-confirmed`, expansão `estimate-pending`, manutenção `secondary`, marginal `outline`, `sem_base` sem badge.

### Lista: filtro e ordenação derivados

O filtro por classe é o **único** que não é constraint do Payload (a classe é derivada, não armazenada). Consequência tratada em `municipalityPageData.ts`:

- `state.classes` fica **fora** de `buildMunicipalityListWhere`;
- `territorialClassFilterPredicate` força o caminho `limit: 0, pagination: false` mesmo quando o sort é nativo — senão a página devolveria menos de 25 linhas e `totalDocs` mentiria;
- o mesmo predicado se aplica a `staffScope.municipalities` antes do rollup (visão geral E8/E9 conta o escopo filtrado) e às três facetas dos popovers de coluna.

URL: `?class=` repetível, canonicalizado como `trend` (marcar todas = param ausente); sort key `classe` com default `desc` (reduto primeiro), ordinal por `territorialClassSortWeight` (`sem_base` sempre no fim).

## Dados → decisão → apresentação

- **Decisão nomeada** — Coordenador: "esta semana, onde a perna vai: defender reduto dormente ou abrir rede em expansão?" Assessor: "este município é reduto meu ou eu ainda não existo aqui?"
- **Forma** — badge + duas frases de "por quê" (degrau mais pobre que resolve: rótulo com contexto numérico), reusando `Badge`, `MunicipalityHoverTooltip`/`MetricExplanation` e a coluna de tabela.
- **Rejeitado** — chart de distribuição das classes; quantis como classe (quantil vira escala do mapa em B13); % estadual absoluto como métrica (anti-goal `PRODUCT.md` §5).
- **Anti-goal vigiado** — rótulo sem o "por quê".

## Correções do rascunho (Passo 7)

Registradas para que ninguém reabra decisões já resolvidas:

1. **`src/lib/electionInsights.ts` não existe** (deletado no Pass 2 W4a, com os limiares 35/20/10 da era núcleos e os helpers `territorialClassBadgeVariant`/`territorialClassLabel`). E10 nasceu em módulo novo, em terreno limpo — não havia classificador antigo "para manter exportado até B13".
2. **Não existe "card de insights do município"**. O lar da classe é o `MunicipalityGoalAccountCard` (E8).
3. **Caminhos**: `MunicipalityListOverview.tsx` está em `src/components/campaign/municipality/`; o loader é `municipalityPageData.ts` (não existe `municipalityData.ts`).
4. **Vocabulário**: `Reduto/Expansão/Manutenção/Marginal/Sem base` substitui `Defesa/Ataque/Indecisa/Perdida`.
5. **Mais barato que o rascunho supunha**: tudo sai do artefato commitado. `getStatewideFederalTotals(year)` foi extraído (memoizado) em `bahiaElectionAggregates.ts` e `municipalityVoteRank.ts` passou a reusá-lo, em vez de somar o estado por conta própria.
6. **NEC/competição fora da v1** (questão aberta 2 resolvida como "não"): nem `municipalityElectoralBaseline` nem `municipalityCandidateComparison` trazem os rivais do município (a comparação é opt-in, até 5 candidatos). NEC exigiria agregado SQL novo — o rabbit hole que o próprio rascunho nomeia. O eixo competição entra pelo proxy barato do artefato (`campoFederalVotesByYear` → share intracampo) como **fator**, não como classe. Gatilho para voltar: E11 precisar do eixo competição além do proxy.
7. **Coluna nova assumida sem B17**: o E9 tinha evitado coluna nova; aqui a decisão é explícita e do produto (10ª coluna staff). O seletor de colunas (B17) fica mais valioso.

## Verificação

- `tests/unit/municipalityTerritorialClass.unit.spec.ts` — as 4 classes com input sintético, bordas (válidos 0, teto ausente, LQ exatamente no corte) e um **pin de distribuição** sobre os 435 slugs reais: nenhuma classe vazia e nenhuma acima de ~70% — exatamente o modo de falha que E10 existe para corrigir.
- `tests/unit/municipalityList.unit.spec.ts` — parse/serialize de `?class=`, canonicalização "todas = ausente", sort `classe`, ausência do filtro no `where`.
- `tests/unit/campaignComponents.unit.spec.ts` — a classe nunca renderiza sem o "por quê" (texto no markup, nunca `title`); `sem_base` sai como travessão.
- `tests/unit/campaignTable.unit.spec.ts` — contrato do `cellTooltip`: coluna sem tooltip renderiza sem wrapper, linha sem conteúdo idem, e o conteúdo do Radix não existe no markup do servidor (é por isso que a cópia `sr-only` na célula é obrigatória).
- `tests/int/municipalityPageData.int.spec.ts` — o filtro derivado devolve só a classe pedida, mantém `totalDocs`/visão geral honestos e o sort `classe` ordena reduto antes de marginal.

## Não escopo

- Escala visual do mapa e símbolo proporcional → **B13** (consome `computeMunicipalityTerritorialClass` como está).
- Nível humano N0–N4 / override → **E14**. Calibração empírica dos cortes → **E15**. Classificação em nível TI → **E12** (rollup próprio).
- **NEC / desequilíbrio local** — adiado com gatilho (ver correção 6).
- **Distribuição de classes na visão geral da lista** — adiado: `CampaignMetricStrip` já tem 4 métricas e distribuição não é métrica; as contagens do popover de filtro dão a leitura.

## Assumido / a validar com produto

- Corte de "campo grande não capturado" = mediana do catálogo (relativo, sem número mágico) — _(assumido; E15 calibra)_.
- Ano de referência fixo em 2022 (o teto do campo é 2022-only por limitação do artefato) — _(assumido)_.
- Classe é coluna staff, invisível para `leader` (que já não acessa a lista) — _(assumido)_.

## Referências

- `docs/roadmap.md` (Inteligência de campanha, E10) · [plano-mestre](inteligencia-campanha.md)
- `docs/research/relatorio-entrevista-persona-campanha.md` D4 (degeneração dos limiares + âncoras relativas), §6.4 (rótulo sem "por quê")
- `docs/plans/insight-classificacao-territorial.md` (as-built A5-2 — limiares antigos, hoje removidos do código)
- `src/utilities/municipalityTerritorialClass.ts`, `src/utilities/municipalityPotential.ts`, `src/lib/bahiaElectionAggregates.ts`, `src/utilities/municipalityLabels.ts`, `src/utilities/municipalityPageData.ts`
