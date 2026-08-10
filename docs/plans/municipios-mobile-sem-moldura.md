# B184 — Municípios mobile: lista sem moldura (omnibox sticky + cards edge-to-edge)

Status: registrado
Atualizado em: 2026-08-09
Issue: #514
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na tela mobile da lista de municípios (`/campanha/municipios`)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-14/canvases/plan-b184-ui-draft.canvas.tsx`
Appetite: ~0,5–1 dia eng; um encaixe em lista existente
Responsável: —

> **Escopo ampliado (decisão do produto, 2026-08-09):** o look sem moldura/sticky do filtro vira o **padrão mobile do chassis `CampaignListOmnibox` — todas as listas `/campanha`** (11 call sites), não só municípios. Cards edge-to-edge e "Salvar filtro" no header continuam municípios-only (as outras listas não têm árvore de cards B42 nem saved filters). Desktop permanece inalterado em todas as listas.

## Intenção

No celular, a lista de municípios acumula chrome que rouba espaço da fila: a label "Filtrar
municípios" gasta uma linha inteira, o filtro vem numa caixa com borda e sai da tela ao rolar,
e os cards têm moldura arredondada + gap — tudo isso empurra os dados para baixo e quebra o
ritmo de varredura do assessor em campo. Queremos leitura fluida edge-to-edge: filtro sem
moldura e sempre visível, cards separados só por uma linha, e as ações de filtro no lugar
esperado — limpar dentro do próprio input (X circular, padrão comum) e salvar filtro no header
como icon button.

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador no celular, varrendo a fila de municípios entre visitas; uma mão, atenção curta.
- **Job principal:** filtrar e rolar a fila sem lutar com moldura, mantendo o filtro sempre à mão.
- **Fluxo desejado:** abre `/campanha/municipios` no celular → vê o filtro limpo, sem label, preso sob a barra superior → limpa tudo com o X circular dentro do input (só aparece quando há o que limpar) → salva o recorte pelo icon no header → rola a fila de cards contínuos (só uma linha separando cada um) → o filtro permanece visível o tempo todo → toca num card e abre o detalhe.
- **Anti-goals de produto:** não virar redesenho geral do shell; não mudar o comportamento de filtragem (chips continuam dentro da omnibox); não alterar desktop; cards edge-to-edge e salvar no header não vazam para as outras listas.

### Esboço de fluxo (B)

Ver Canvas UI (rascunho side-by-side "Hoje × Depois"). Jornada textual:
`[abre lista] → [filtro sem label, sem borda, sticky] → [rola cards contínuos com separador de linha] → [filtro continua visível] → [toca card → detalhe]`

## Objetivo e aceite

- No mobile, a label do filtro (ex.: "Filtrar municípios") não é exibida — **em todas as listas** (padrão do chassis).
- O filtro é visualmente sem moldura (sem caixa/borda), fica **sempre visível** enquanto o usuário rola os cards/linhas, e uma linha horizontal o separa do feed abaixo — **em todas as listas** (padrão do chassis).
- Os chips de filtro ativo continuam **dentro da omnibox**, com o mesmo comportamento de hoje — todas as listas.
- O "Limpar" (botão de texto atual) sai do mobile; no lugar, um **X circular dentro do input, junto à borda direita**, que limpa os filtros — aparece só quando há o que limpar (filtros ativos ou busca digitada) — todas as listas.
- O "Salvar filtro" atual sai da região do filtro; no mobile ele vira **icon button no header** (o popover de nomear/renomear continua o mesmo) — **municípios apenas**.
- Os cards de município no mobile ficam sem borda nem arredondamento, edge-to-edge (sem respiro lateral da página na região da lista), com uma única linha horizontal separando um card do outro — **municípios apenas** (única lista com cards mobile).
- Desktop de todas as listas fica inalterado.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de acabamento visual; nenhum dado, KPI ou mapa muda.
- **Decisões desbloqueadas:** N/A (nenhuma decisão de leitura de dado nova).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shared/CampaignListOmnibox.tsx` (label/placeholder do filtro e onde as ações nascem — o chassis compartilhado B127 agora é o **dono do padrão**: todos os 11 `*Filters` herdam), `src/components/campaign/municipality/SaveMunicipalityFilterControl.tsx` (popover de salvar — só muda o ancoradouro/trigger no mobile), `src/components/campaign/municipality/MunicipalityListMobileCards.tsx` (cards `rounded-xl border`), `src/app/(campaign)/campanha/(app)/municipios/page.tsx` (registro do icon no header via `SetCampaignHeaderAction`, slot C94/C95).
- **Precedente a olhar:** `docs/plans/polimento-mobile-lista-municipios.md` (B42, mobile já entregue), Issues B120 (filtro combobox mobile) e B127 (chassis da omnibox).
- **Risco de acoplamento:** o filtro é o chassis compartilhado `CampaignListOmnibox` (B127) usado por várias listas — o padrão mobile é **intencionalmente** no chassis (decisão de produto), e o desktop é preservado por variantes `md:`; cards/salvar no header ficam escopados a municípios.

## Dependências

- Nenhuma.

## Fora de escopo

- Desktop de todas as listas (sem mudança).
- Cards edge-to-edge e "Salvar filtro" no header fora de municípios (outras listas não têm cards B42 nem saved filters).
- Novos filtros, ordenação ou mudança de dados nos cards.
- Redesign do shell/top bar.

## Rabbit holes de produto

- **"Já que é sem moldura, melhora as outras listas também."** ~~Explosão de superfície e review.~~ **Decidido (2026-08-09):** o look bare/sticky **é** o padrão do chassis para todas as listas no mobile — por isso a mudança mora no chassis e não no estilo local de municípios. O que fica cortado: cards edge-to-edge e salvar no header nas outras listas.
- **"Sticky é oportunidade de redesenhar o filtro."** Nova interação sem pedido. **Corte:** mantém chips (dentro da omnibox), sugestões e o fluxo de salvar (só muda o ancoradouro); só muda presença visual, posição fixa e os dois controles de ação.
- **"Edge-to-edge é todo o app."** Redesign de shell. **Corte:** só a região da lista mobile.

## Questões em aberto (produto)

- **Remover a label só no mobile ou em todas as resoluções?** **Decidido:** A — mobile-only; no desktop a label ajuda descoberta sem custo de espaço. Aplica-se ao padrão do chassis (todas as listas).
- **Cards edge-to-edge até a borda física da tela, ou só até o padding da página?** **Decidido:** A — até a borda da tela ("seamlessly edge-to-edge" é explícito no pedido), via sangria do `p-4` do scrollport.
- **O X circular de limpar aparece quando?** **Decidido:** A — só com filtros ativos (chips) ou busca digitada — padrão de clear input; segue a mesma regra do "Limpar" de hoje ampliada à busca digitada.
- **O icon de salvar filtro no header aparece quando?** **Decidido:** A — só quando há recorte ativo para salvar (o controle já se omite sem recorte; o header ganha o mesmo gate).
- **Região sticky do filtro:** chips e busca formam a região que gruda sob a barra (confirmado no gate — chips continuam dentro da omnibox). O picker de colunas segue onde está hoje, fora da região sticky.

## Referências

- GitHub Issue: #514
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-14/canvases/plan-b184-ui-draft.canvas.tsx`
- `src/components/campaign/municipality/MunicipalityFilters.tsx`, `src/components/campaign/municipality/MunicipalityListMobileCards.tsx`, `src/components/campaign/shared/CampaignListOmnibox.tsx`
- `docs/plans/polimento-mobile-lista-municipios.md` (B42 — mobile entregue)
