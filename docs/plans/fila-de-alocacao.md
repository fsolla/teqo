# E9 — Fila de alocação (lista de decisão do coordenador)

Status: entregue em código (2026-07-24; ver "Entregue (as-built)" abaixo)
Atualizado em: 2026-07-24 (entrega registrada — escopo cortado e correção da fórmula do E8)
Item do roadmap: [docs/roadmap.md](../roadmap.md) (seção "Inteligência de campanha", E9; plano-mestre [inteligencia-campanha.md](inteligencia-campanha.md))
Impeccable: B — visão nova DENTRO de `/campanha/municipios` (ordenações + colunas + painel), sem rota nova
Appetite: ~1,5 dia eng; sem migration (deriva de E8 + dados existentes)
Responsável: —

## Entregue (as-built, 2026-07-24)

A fila é a lista de municípios existente com duas ordenações novas e três sinais dobrados em células que já existiam — **sem rota nova, sem coluna nova e sem migration**. A auditoria antes do craft encontrou um problema material na dependência: a meta sintética do E8 era decomposta proporcionalmente ao **teto do campo** (voto de Lula), ignorando a votação própria, o que dava meta 2.911 a Vitória da Conquista (5.005 votos dele em 2022) e 813 a Campo Formoso (47 votos). Ordenar por déficit sobre essa meta colocaria desertos no topo — o oposto do que o item existe para fazer, e contra o padrão P6 do relatório. Corrigir a fórmula virou a Fase 0 desta entrega.

**Fase 0 — meta sintética por cenário, ancorada em 2022** ([municipalityPotential.ts](../../src/utilities/municipalityPotential.ts), [goalCoverage.ts](../../src/utilities/goalCoverage.ts), [municipalityGoalAccount.ts](../../src/utilities/municipalityGoalAccount.ts)):

```
base_i       = votação própria de 2022 no município (artefato TSE commitado)
pessimista_i = base_i × (1 − margin)                 Σ = 116.071
central_i    = base_i                                Σ = 128.968   ("repetir 2022")
otimista_i   = base_i × (stateGoal ÷ Σ base)         Σ = 150.000   (exato)
```

`decomposeStateGoal` foi substituída por `deriveSuggestedGoalsByScenario`; `computeGoalCoverage`/`computeGoalCoverageByScenario` passaram a receber `SuggestedGoalByScenario` no lugar do escalar, deixando `expectedVotes[S] ?? suggestedGoal[S]` simétrico nos dois lados. Guarda implementada: se `stateGoal` < Σ base, o otimista clampa em `max(central, otimista)`. Os três totais caem na faixa realista da cadeira (80–150 mil, relatório linha 323) e o déficit central passa a medir o indicador que a literatura nomeia — "% do voto histórico da praça coberto por liderança ativa". Campo Formoso vira 42/47/55. `stateGoal` e `margin` do global `campaignGoals` mantiveram papel de cálculo (o fator 1,163 traduz "meta de 150 mil" em "2022 mais 16% em todo lugar"; `margin` vira o corte pessimista, fallback 10%) — só `admin.description` mudou, daí não haver migration.

**Fase 1 — frescor e ordenações** ([votePledgeData.ts](../../src/utilities/votePledgeData.ts), [municipalityUi.ts](../../src/utilities/municipalityUi.ts), [municipalityPageData.ts](../../src/utilities/municipalityPageData.ts), [municipalityViewModels.ts](../../src/utilities/municipalityViewModels.ts)): `declaredAt`/`estimatedAt` entraram no `select` do agregado (`lastPledgeAt`); `lastSignalAt = max(municipality.lastUpdateAt, lastPledgeAt)` no view model, com o mesmo helper (`resolveMunicipalityLastSignalAt`) servindo o comparador do servidor e a leitura da UI, para não divergirem; sort keys `deficit` (**novo default do staff**, desc) e `frescor` (mais frio primeiro, "nunca teve sinal" na frente), ambas derivadas em memória sobre o bundle já carregado. A ordenação usa o cenário `central` fixo no servidor — o seletor de cenário é client-side, e movê-lo para a URL é o fill-in "Cenário junto aos filtros".

**Fase 2 — UI (Impeccable B)** ([MunicipalityList.tsx](../../src/components/campaign/MunicipalityList.tsx), [MunicipalityListOverview.tsx](../../src/components/campaign/MunicipalityListOverview.tsx), [MunicipalityListGoalCoverageCell.tsx](../../src/components/campaign/MunicipalityListGoalCoverageCell.tsx)): frescor dobrado na coluna "Última atualização" ("há N dias"; frio a partir de `MUNICIPALITY_COLD_SIGNAL_DAYS` = 21); badge "sem responsável" na célula de assessoria quando `priority === 'alta'` e zero assessores; "coluna da vergonha" como `detail` da métrica "Cobertura de assessoria", linkando `?priority=alta&coverage=sem_assessor`; tooltip da célula de cobertura nomeando o cenário ativo; copy "Praças" → "Municípios" corrigida. O `critique` trocou o tom do sinal frio de `text-destructive` para `text-estimate-pending-foreground`: com badge de prioridade e badge "sem responsável" possíveis na mesma linha, o vermelho deixava de significar urgência.

**Escopo cortado (e para onde foi):** votos em jogo → **B13** (que já prevê símbolo proporcional por votos em jogo); LQ/captura → **E10** (classe operacional e pesos por classe são daquele item); coluna dedicada de déficit → desnecessária, a célula do E8 já mostra % e déficit assinado; seletor de colunas → **B17**, não entregue, e é por isso que nenhum sinal novo virou coluna.

**Verificação:** `tsc --noEmit`, `pnpm lint` (zero warnings) e `pnpm exec knip` limpos; 365 testes unit+int verdes (inclui unit do comparador e das três somas da meta, int de `deficit`/`frescor`, e2e cobrindo default + coluna de frescor); e2e 9 passed + 1 flaky (flake pré-existente de carga da máquina, verde no retry); `pnpm build` contra o banco local verde; Aikido sem achado novo (o único achado, object-injection em `municipalityPotential.ts`, está em linha pré-existente do E8, fora do diff).

## Design (Impeccable)

Âncoras: `PRODUCT.md` (princípios 2 "clarity under pressure", 3 "edit where you see", 5) / `DESIGN.md` (register `product`) · tema `data-theme='campaign'` · shells existentes (`MunicipalityList`, `MunicipalityListOverview`, `MunicipalityFilters`, `CampaignListPagination`).

Na implementação: craft compacto → critique → polish.

- **Persona / contexto:** "o mapa serve ao padrão espacial; a alocação de verdade se decide na lista" (relatório D3). Coordenador prepara a reunião de recurso; assessor abre a fila dos seus municípios.
- **Job principal:** a primeira linha da lista é o lugar onde falta mais voto que a campanha planejou ter.
- **Estratégia de cor:** Restrained; "coluna da vergonha" (sem responsável) como badge âmbar discreta, não alarme.
- **Edit where you see:** sim — responsável/meta/nível editáveis em contexto (reusa `MunicipalityListAdvisorsControl` e padrão B9).
- **Anti-goals:** data-grid/planilha full-row; segunda lista paralela à de municípios; ranking gamificado de assessores (alimenta gaming — relatório G4).

## Contexto

O relatório definiu a "fila de trabalho" com 7 colunas ranqueadas (FU3): votos em jogo; meta/cobertura/delta; classe operacional; desempenho relativo (LQ/captura); rede + frescor; competição local; tendência — com **ordenação default por déficit descoberto** (meta − comprometido, decrescente; empate por votos em jogo) e uma ordenação de risco (municípios de defesa por frescor, o mais dormente primeiro). A lista de municípios atual (`MunicipalityList` + `loadMunicipalityListPageBundle`) já tem filtros/URL/overview/edição rápida; faltam as colunas derivadas e as ordenações de decisão. A hierarquia de triagem completa (5 níveis) vive no plano-mestre e vira produto no E11 — aqui entra só a fila "estática" de colunas+ordenações.

## Objetivos

- Novas ordenações na URL (`?sort=deficit|risco-frescor|votos-em-jogo`) via `campaignListUrl.ts`, preservando filtros existentes — estende o `?sort=votos` que nasce em **A11** ([ranking-votos-municipio.md](ranking-votos-municipio.md)).
- Colunas derivadas na linha do município: déficit (meta − comprometido), cobertura %, votos em jogo (válidos projetados), **% da própria votação** (rank/share via helper de A11 — a âncora de prioridade da mesa, sessão 2026-07-23), LQ/captura, frescor (dias desde último pledge/sinal/atualização), badge "sem responsável".
- Visão do assessor: mesma fila filtrada às seus municípios (access já garante o escopo — `getAccessibleMunicipalityIds`).
- Overview da lista ganha "coluna da vergonha": contagem de municípios priorizados sem responsável (link filtrado).
- `leader` não vê a fila (colunas staff-only seguem o padrão de redaction dos view models `municipalityViewModels.ts`).

## Decisões travadas

- **A fila é a própria lista de municípios com ordenações/colunas novas — não uma rota nova.** Evita segundo sistema de listas e mantém filtros/URL/paginação existentes (C6 shells). **Rejeitado:** rota `/campanha/fila` dedicada (duplicaria filtros e navegação; a fila de _sugestões_ do E11 é outra superfície e outro item); tabela full-row editável (anti-goal PRODUCT.md).
- **Default de ordenação para staff = `deficit` quando houver metas** (revisão 2026-07-24). A regra de adoção do discovery é "registro no fluxo de poder — a reunião de recurso começa pela lista"; fila opt-in atrás de um select esconde a inteligência. Sem metas (pré-E8/E4R), default continua nome. **Rejeitado:** fila opt-in permanente (contradiz E1/O-B do relatório); forçar o default também para ordenações de risco (essas seguem opt-in).
- **Déficit usa meta efetiva = `expectedVotes.central ?? suggestedGoal`** (mesma regra de E8; `voteGoals` foi removido em 2026-07-24), e municípios N0/N1 (pós-E14) saem do topo por meta mínima — até E14, municípios sem meta ficam no fim, não no topo. **Rejeitado:** ordenar por déficit bruto sem tratamento (município perdido com meta lixo polui o topo — FU3).
- **i18n e naming:** `municipalityQueueSort`, `deficit`, `freshnessDays`, `unassignedPriorityCount`; labels pt-BR ("Déficit", "Frescor", "Sem responsável").

## Questões em aberto

- ~~**Frescor conta o quê?**~~ Resolvido na entrega: máx(pledge mais recente, `municipality.lastUpdateAt`). Planos entram quando houver demanda — C12 já tipou sinais, mas incluí-los alargaria "frescor" sem pedido de campo.
- ~~**Colunas visíveis por default no mobile?**~~ Não se aplica ao as-built: nenhum sinal novo virou coluna, todos dobraram em células existentes (o card mobile mostra frescor e badge junto do que já mostrava).

## Abordagem proposta

```mermaid
flowchart LR
    Bundle["loadMunicipalityListPageBundle<br/>(municipalityPageData.ts)"]
    Pot["municipalityPotential/goalCoverage (E8)"]
    Fresh["freshness helper<br/>(pledges + lastUpdateAt)"]
    Sort["municipalityQueueSort<br/>(déficit | risco | votos)"]
    List["MunicipalityList + MunicipalityListOverview<br/>(colunas novas)"]
    Bundle --> Sort
    Pot --> Sort
    Fresh --> Sort
    Sort --> List
```

Componentes:

- **`src/utilities/municipalityQueue.ts`**: composição das linhas (déficit, cobertura, frescor, flags) sobre o bundle existente — uma passada, sem N+1; ordenações puras testáveis em unit.
- **`MunicipalityList.tsx` / `MunicipalityListOverview.tsx`**: colunas/badges novas; select de ordenação em `MunicipalityFilters.tsx` (mesmo padrão auto-aplicado do fill-in filtros-auto).
- **URL**: `campaignListUrl.ts` ganha `sort` (nasce em A11 com `votos`); com metas presentes (E8/E4R), o default do staff passa a `deficit` (decisão travada acima); sem metas, default nome. Select "Ordenar por" continua para as demais ordenações.
- **Sem migration, sem collection, sem server action nova** (edição em contexto reusa `municipalityStaffFormActions`).

## Dependências

- Dura: **E8** (meta efetiva, votos em jogo, cobertura). Suaves: E10 (coluna classe passa a usar classificação relativa quando existir; até lá mostra a atual), E14 (nível modula o topo), C12 (frescor de sinais tipados).
- Reusa: `municipalityPageData.ts`, `votePledgeData.ts`, `campaignListUrl.ts`, `MunicipalityFilters`, padrão B9 de edição em contexto.

## Não escopo

- Sugestões/menu de ações e triagem 1–5 (E11 — [motor-de-sugestoes.md](motor-de-sugestoes.md)); rollup por TI (E12); mudanças no mapa (B13); histerese de mudanças (E11/E14).

## Rabbit holes

- **Virar data-grid.** "Só mais uma coluna editável" até virar planilha. **Mitigação:** colunas derivadas são read-only; edição só nos 3 Popovers já existentes (B9) + meta (E8).
- **Ordenação server-side vs. client.** O bundle já carrega o conjunto filtrado inteiro para overview/mapa (A9+); ordenar em memória é O(n log n) sobre ~435 — não abrir paginação SQL nova por isso.

## Adiado com gatilho

- **Fila persistida com posição manual (drag).** Gatilho: coordenador pedir reordenação manual na reunião (hoje: ordenação é derivada, determinística).

## Referências

- `docs/roadmap.md` (Inteligência de campanha, E9) · [plano-mestre](inteligencia-campanha.md) (fila canônica) · [ranking-votos-municipio.md](ranking-votos-municipio.md) (A11 — helper de rank/share e `?sort=votos`)
- `docs/research/relatorio-entrevista-persona-campanha.md` FU3 (colunas e ordenações), §6.2 (triagem), D3 ("a alocação se decide na lista")
- `docs/CUSTOMER.md` — "Salvador cobrado 10×" (coluna da vergonha), âncora % da própria votação (sessão 2026-07-23)
- `src/utilities/municipalityPageData.ts`, `src/utilities/votePledgeData.ts`, `src/components/campaign/MunicipalityList.tsx`, `src/components/campaign/MunicipalityListOverview.tsx`, `src/components/campaign/MunicipalityFilters.tsx`, `src/utilities/campaignListUrl.ts`
- AGENTS.md — access por papel, view models com redaction, URLs com chaves em inglês
