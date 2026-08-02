# Remover overview da lista de municípios

Status: registrado
Atualizado em: 2026-08-02
Issue: #266
Priority: P1
Model: composer-2.5
Impeccable: B — remoção de bloco em `/campanha/municipios` (todos os viewports)
Appetite: ~0,5 dia eng; um outcome verificável (lista sobe, overview some)
Responsável: —

## Intenção

Na lista de municípios (`/campanha/municipios`), o painel de visão geral acima da tabela (“Média nos municípios filtrados”, declarações, cobertura de assessoria, etc.) ocupa demais a tela e atrasa o Coordenador Geral a chegar nas linhas — o trabalho real da página. Em qualquer viewport, o bloco deve sair para a lista (e os filtros) voltarem a ser o primeiro conteúdo útil abaixo do cabeçalho.

## Persona e fluxo

- **Persona / contexto:** Coordenador Geral (também staff com visão completa) na mesa, em desktop ou mobile, abrindo Municípios para filtrar, varrer e agir nas linhas.
- **Job principal:** Ver e trabalhar a lista de municípios sem precisar rolar um bloco de agregados primeiro.
- **Fluxo desejado:** Entra em Municípios → vê filtros/busca e, em seguida, a lista (tabela ou cards) → filtra/ordena/abre linhas. Sem strip de métricas agregadas do conjunto filtrado entre filtros e lista.
- **Anti-goals de produto:** Não redesenhar a lista; não inventar um “overview compacto” ou drawer de KPIs neste item; não mexer no overview de apoiadores nem no dashboard do Início.

### Esboço de fluxo (B)

```text
[Municípios] → filtros/busca → lista (linhas/cards) → ação na linha
                 (sem bloco "Média nos municípios filtrados" / métricas agregadas)
```

## Objetivo e aceite

- Em `/campanha/municipios`, em **todos** os tamanhos de viewport, a seção de visão geral dos municípios filtrados (métricas agregadas do conjunto filtrado) **não aparece**.
- Após filtros/busca, o conteúdo principal útil é a lista (tabela desktop / cards mobile), sem painel de agregados no meio.
- Filtros e leitura por cenário de estimativa que já vivem na barra de filtros **permanecem** — não somem só porque o overview saiu.
- Staff e papéis com acesso à lista continuam a usar a lista; sem regressão de acesso.

## Dados (intenção)

- **Vou apresentar dados?** Não — este item **remove** uma superfície de agregados; não cria métrica nova.
- **Decisões desbloqueadas:** Coordenador escolhe o próximo município / filtro / edição na lista sem o custo visual do painel. Agregados de campanha (quando necessários) continuam em superfícies já existentes (ex.: Início / detalhe), não nesta remoção.
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: não substituir o bloco removido por outro resumo agregado nesta página neste item.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `src/app/(campaign)/campanha/(app)/municipios/`; componente `MunicipalityListOverview` em `src/components/campaign/municipality/`; dados de overview em `src/utilities/municipality/` (ex. `municipalityPageData`); testes que pinam o overview da lista.
- **Precedente a olhar:** overview histórico de núcleos (`docs/plans/overview-lista-nucleos.md` — entregue e depois remodelado); seletor de cenário já nos filtros (`docs/plans/cenario-junto-filtros-municipios.md`).
- **Risco de acoplamento:** o atalho E9 “coluna da vergonha” (prioritárias sem responsável) hoje vive no overview; Prioridade + Assessoria nos filtros já cobrem o mesmo recorte — não recriar o atalho neste item salvo decisão abaixo.

## Dependências

- Nenhuma

## Fora de escopo

- Overview / KPIs de `/campanha/apoiadores` (`SupporterListOverview`)
- Dashboard / mapa / métricas do Início (`/campanha`)
- Redesign da tabela, filtros salvos, ou seletor de colunas
- Relocar o atalho “prioritárias sem responsável” para outro lugar (só se produto pedir em item separado)

## Rabbit holes de produto

- **“Tirar o overview mas deixar um resumo menor.”** Reabre o mesmo problema de espaço. **Corte neste item:** remoção completa da superfície agregada na lista.
- **“Salvar o atalho da coluna da vergonha noutro sítio.”** Escopo novo de UI. **Corte neste item:** filtros existentes; novo atalho só com pedido explícito.
- **Mexer no overview de apoiadores “já que estamos nisso.”** Persona/superfície diferentes. **Corte:** só municípios.

## Questões em aberto (produto)

- **O atalho “N prioritárias sem responsável” some com o overview?** **Decidido (gate 2026-08-02):** A — some neste item; o recorte segue pelos filtros Prioridade + Assessoria. Sem relocação do atalho neste item.

## Referências

- GitHub Issue [#266](https://github.com/fsolla/teqo/issues/266)
- `src/components/campaign/municipality/MunicipalityListOverview.tsx` (label “Média nos municípios filtrados” via cenário ativo)
- `src/app/(campaign)/campanha/(app)/municipios/page.tsx`
- `docs/plans/overview-lista-nucleos.md` · `docs/plans/cenario-junto-filtros-municipios.md`
- E9 / “coluna da vergonha” — contexto em `docs/plans/inteligencia-campanha.md` (não reabrir fila de alocação aqui)
