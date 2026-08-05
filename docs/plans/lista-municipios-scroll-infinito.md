# Listas de tabela da campanha: scroll infinito virtualizado + controles fixos

Status: rascunho
Atualizado em: 2026-08-05
Issue: #382
Priority: P1
Model: cursor-grok-4.5-medium (pool) · deepseek-v4-high (local)
Impeccable: B — encaixe na superfície compartilhada de listas de tabela (5 listas)
Canvas UI: /Users/francisco.solla/.cursor/projects/teqo/canvases/plan-b161-ui-draft.canvas.tsx
Status: registrado
Registrado em: 2026-08-05 (#382)
Appetite: ~2–3 dias eng; primitivo compartilhado + 5 listas, sem migration
Responsável: —

## Intenção

As listas de tabela do `/campanha` (municípios, lideranças, dobradinhas, demandas, organizações) funcionam como tabelas paginadas: 20 linhas por página, contagem e botões de página no rodapé, filtro e cabeçalho que somem com o rolar. São as 5 listas que **já compartilham o mesmo primitivo** (`CampaignTable` + `CampaignListFooter`), então a mudança pode virar um único upgrade da camada compartilhada em vez de 5 refactors independentes.

O pedido: as 5 listas viram contínuas — rolar até o fim e as linhas continuam carregando — com omnibox de filtro e cabeçalho da tabela sempre visíveis, o total discretamente no topo (ao lado do rótulo do filtro) e dois acabamentos visuais na tabela: aproximar o território do nome do município (hoje visualmente distantes na listagem de municípios) e eliminar o scrollbar interno que rola quase nada. A outra coorte (`apoiadores`, `atividades`, `assessores`), que já usa lista própria com `CampaignListFooter`, fica na paginação atual — migra em issue futura se o padrão validar.

## As-built (entrega)

_(pendente — preenchido quando a Issue for implementada e mergereada)_

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador varrendo as listas de tabela no desktop/tablet; a liderança nunca chega nessas telas (lockdown de acesso).
- **Job principal:** percorrer a lista filtrada inteira sem fricção de páginas, sempre vendo os controles (filtro, cabeçalho das colunas).
- **Fluxo desejado:** abre qualquer lista de tabela → vê o total ao lado do rótulo do filtro → filtra/ordena como hoje → rola; novas linhas carregam ao se aproximar do fim, com skeletons discretos otimistas → filtrar/cabeçalho permanecem fixos → no fim, nada mais carrega.
- **Anti-goals de produto:** não virar spreadsheet mode; não mudar o padrão de filtro/ordenação/seletor de colunas; não tocar a lista mobile (cards).

## Objetivo e aceite

- As 5 listas que usam `CampaignTable` + `CampaignListFooter` viram contínuas: linhas carregam automaticamente ao se aproximar do fim, até esgotar o resultado.
- O total de resultados aparece discretamente no topo de cada lista, junto ao rótulo do filtro, refletindo os filtros ativos.
- A omnibox de filtro e o cabeçalho da tabela permanecem visíveis durante o rolar de cada lista (fixos).
- As 5 listas adotam o mesmo primitivo de scroll infinito (a mudança é feita uma vez, não cinco).
- Na coluna "Município" da listagem de municípios, o território é lido imediatamente abaixo do nome (distância visual curta).
- As áreas de lista deixam de exibir scrollbar interno que rola quase nada; o scroll da página é a única superfície de rolagem.
- As interações inline das células continuam funcionando nas 5 listas (assessores, lideranças, dobradinhas, tendência, sinal, etc).
- Acesso por papel é preservado (assessor só vê seus municípios, etc) na carga incremental.
- Estado de zero resultados continua existindo (filtro/cabeçalho montados + estado vazio, como hoje).
- Carregamento otimista: ao se aproximar do fim, **skeletons** das próximas linhas aparecem no lugar e são substituídas pelo conteúdo quando a página carrega (sem texto "carregando…").

## Dados (intenção)

- **Vou apresentar dados?** Sim — aggregate já existente (total filtrado), hoje no rodapé, deslocado discretamente para o topo.
- **Decisões desbloqueadas:** staff percebe na hora o tamanho do universo filtrado sem procurar o rodapé, em todas as 5 listas.
- **Forma:** N/A — é o mesmo total de hoje; nenhuma métrica nova.

## Direção no codebase (hipótese)

- **Áreas prováveis:** primitivo compartilhado (`src/components/campaign/shared/CampaignTable.tsx`, `CampaignListFooter.tsx`, `CampaignListPending.tsx`), páginas de lista das 5 coortes (`municipios`, `liderancas`, `dobradinhas`, `demandas`, `organizacoes`), filtros correspondentes (`MunicipalityFilters`, `LeadershipFilters`, `StateDeputyFilters`, `DemandFilters`, `OrganizationFilters`), utilitários `municipality*ListUrl/Filters` e os irmãos de liderança/dobradinha/demanda/organização.
- **Precedente a olhar:** B158 (`docs/plans/colunas-responsivas-municipios-impl.md` — sticky + container queries), B160 (#378 — serialização de mutações de célula, mesma superfície).
- **Risco de acoplamento:** não quebrar os editores de célula (B159/B160); não regredir acesso por papel na carga incremental; `MunicipalityListMobileSection` intocada.

## Dependências

- Nenhuma dura. Suave: **B160** (#378, serialização de mutações de célula) — mesma superfície; coordenar ordem de execução/review.

## Fora de escopo

- Lista mobile (cards) — intocada; o pedido é desktop/tablet.
- 3 listas com componente de lista próprio (`apoiadores`, `atividades`, `assessores`) — ficam na paginação atual. Migram numa issue futura, depois que o padrão estiver validado na coorte de tabela.
- Mudança no modelo de filtros, ordenação ou seletor de colunas.
- Deep-link/restauro de posição de rolagem na URL — ver questão em aberto.

## Rabbit holes de produto

- **Abstração total sobre todas as listas do /campanha.** Se alguém "só completar": refator das 3 listas com componente próprio antes de validar o padrão. **Corte neste item:** a coorte de tabela (5 listas) é o critério — se compartilharem o primitivo, migram; senão, ficam para depois.
- **Perder as interações de célula.** Virtualização que quebra popover/edição inline transforma a lista em vitrine read-only. **Corte:** o aceite exige os editores atuais funcionando em todas as 5 listas.
- **Redesenhar mobile.** O pedido é desktop/tablet. **Corte:** cards como estão.

## Questões em aberto (produto)

- **Biblioteca de virtualização?** **Opções:** A) **TanStack Virtual** (headless, canônico, alto reputation) + `react-intersection-observer` (sentinela de próxima página) + server action de `fetchPage`; B) TanStack Virtual + TanStack Query `useInfiniteQuery` (traria nova camada de dados client-side); C) `react-virtuoso` (faz infinite-scroll out of the box, mais pesado); D) hand-rolled. **Recomendação:** **A** — TanStack Virtual é a escolha padrão da comunidade React para listas/tabelas grandes, headless (não compete com nosso sistema de design), baixo custo de adoção; a sentinela de próxima página cabe em `react-intersection-observer` (~20 linhas de glue) porque o payload de dados já vem de server actions e o RSC/partial render do Next.js já dá o "skeleton otimista" natural ao invocar a ação de próxima página. TanStack Query só se justificaria se houvesse um plano de migrar o /campanha para dados client-first. _(assumido)_
- **O que acontece com `?page=` e as URLs de paginação?** **Opções:** A) abandonar o parâmetro de página em todas as 5 listas (scroll sempre inicia no topo); B) restauro leve de posição por sessão; C) manter `page` como "saltar para trecho". **Recomendação:** A — as listas são visão operacional de varredura e os filtros já vivem na URL; revisitar se o time sentir falta. _(assumido)_
- **Indicador de fim de lista.** **Opções:** A) silêncio (nada); B) linha discreta "fim da lista". **Recomendação:** A — o total no topo já fecha a conta. _(assumido)_
- **Skeletons durante o fetch das próximas linhas.** **Opções:** A) skeleton de linha otimista (recomendado); B) linha discreta "carregando mais"; C) spinner no fim. **Recomendação:** A — é o pedido, e dá a sensação de "a lista já está se preenchendo" ao invés de "esperando servidor". _(decidido)_

## Referências

- Canvas UI (gate): /Users/francisco.solla/.cursor/projects/teqo/canvases/plan-b161-ui-draft.canvas.tsx
- `src/components/campaign/shared/CampaignTable.tsx`, `CampaignListFooter.tsx`, `CampaignListPending.tsx`
- 5 páginas-alvo: `municipios`, `liderancas`, `dobradinhas`, `demandas`, `organizacoes`
- `docs/plans/colunas-responsivas-municipios-impl.md` (B158)
