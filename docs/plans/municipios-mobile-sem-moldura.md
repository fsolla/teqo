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
- **Anti-goals de produto:** não virar redesenho geral do shell; não mudar o comportamento de filtragem (chips continuam dentro da omnibox); não alterar desktop; não tocar nas outras listas.

### Esboço de fluxo (B)

Ver Canvas UI (rascunho side-by-side "Hoje × Depois"). Jornada textual:
`[abre lista] → [filtro sem label, sem borda, sticky] → [rola cards contínuos com separador de linha] → [filtro continua visível] → [toca card → detalhe]`

## Objetivo e aceite

- No mobile, a label "Filtrar municípios" não é exibida na lista de municípios.
- O filtro é visualmente sem moldura (sem caixa/borda), fica **sempre visível** enquanto o usuário rola os cards, e uma linha horizontal o separa do feed abaixo.
- Os chips de filtro ativo continuam **dentro da omnibox**, com o mesmo comportamento de hoje.
- O "Limpar" (botão de texto atual) sai do mobile; no lugar, um **X circular dentro do input, junto à borda direita**, que limpa os filtros — aparece só quando há o que limpar (filtros ativos ou busca digitada).
- O "Salvar filtro" atual sai da região do filtro; no mobile ele vira **icon button no header** (o popover de nomear/renomear continua o mesmo).
- Os cards de município no mobile ficam sem borda nem arredondamento, edge-to-edge (sem respiro lateral da página na região da lista), com uma única linha horizontal separando um card do outro.
- Desktop da lista e as demais listas `/campanha` ficam inalteradas.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de acabamento visual; nenhum dado, KPI ou mapa muda.
- **Decisões desbloqueadas:** N/A (nenhuma decisão de leitura de dado nova).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/municipality/MunicipalityFilters.tsx` (label/placeholder do filtro e onde as ações nascem), `src/components/campaign/municipality/SaveMunicipalityFilterControl.tsx` (popover de salvar — só muda o ancoradouro/trigger no mobile), `src/components/campaign/municipality/MunicipalityListMobileCards.tsx` (cards `rounded-xl border`), `src/app/(campaign)/campanha/(app)/municipios/page.tsx` + `CampaignPageShell` (padding/respiro da região), `src/components/campaign/shell/CampaignMobileTopBar.tsx` (header — destino do icon de salvar).
- **Precedente a olhar:** `docs/plans/polimento-mobile-lista-municipios.md` (B42, mobile já entregue), Issues B120 (filtro combobox mobile) e B127 (chassis da omnibox).
- **Risco de acoplamento:** o filtro é o chassis compartilhado `CampaignListOmnibox` (B127) usado por várias listas — a intenção é escopada ao **mobile de municípios**; o executor escolhe como escopar (prop/variant ou estilo local), mas o comportamento das outras listas não pode mudar.

## Dependências

- Nenhuma.

## Fora de escopo

- Desktop da lista de municípios (sem mudança).
- Demais listas `/campanha` (apoiadores, lideranças, atividades, demandas…).
- Novos filtros, ordenação ou mudança de dados nos cards.
- Redesign do shell/top bar.

## Rabbit holes de produto

- **"Já que é sem moldura, melhora as outras listas também."** Explosão de superfície e review. **Corte neste item:** só `/campanha/municipios` mobile; as demais ficam para pedido próprio se aprovado.
- **"Sticky é oportunidade de redesenhar o filtro."** Nova interação sem pedido. **Corte:** mantém chips (dentro da omnibox), sugestões e o fluxo de salvar (só muda o ancoradouro); só muda presença visual, posição fixa e os dois controles de ação.
- **"Edge-to-edge é todo o app."** Redesign de shell. **Corte:** só a região da lista mobile.

## Questões em aberto (produto)

- **Remover a label só no mobile ou em todas as resoluções?** **Opções:** A) mobile-only (desktop mantém label); B) remover em tudo. **Recomendação:** A — o pedido é mobile e no desktop a label ajuda descoberta sem custo de espaço. _(assumido — validar com produto)_
- **Cards edge-to-edge até a borda física da tela, ou só até o padding da página?** **Opções:** A) até a borda da tela (sem padding lateral na região da lista); B) mantém o padding atual, só troca borda por linha. **Recomendação:** A — "seamlessly edge-to-edge" é explícito no pedido. _(assumido — validar)_
- **O X circular de limpar aparece quando?** **Opções:** A) só com filtros ativos (chips) ou busca digitada — padrão de clear input; B) sempre visível. **Recomendação:** A — segue a mesma regra do "Limpar" de hoje (que só existe quando há o que limpar) e não polui o estado vazio. _(decidido no gate — chips sempre dentro da omnibox)_
- **O icon de salvar filtro no header aparece quando?** **Opções:** A) só quando há recorte ativo para salvar (mesma regra do controle atual, que se omite sem filtros aplicados); B) sempre visível. **Recomendação:** A — o controle atual já se esconde sem recorte; o header ganha o mesmo gate, senão o icon não faria nada. _(assumido — validar)_
- **Região sticky do filtro:** chips e busca formam a região que gruda sob a barra (confirmado no gate — chips continuam dentro da omnibox). O picker de colunas segue onde está hoje, fora da região sticky.

## Referências

- GitHub Issue: #514
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-14/canvases/plan-b184-ui-draft.canvas.tsx`
- `src/components/campaign/municipality/MunicipalityFilters.tsx`, `src/components/campaign/municipality/MunicipalityListMobileCards.tsx`, `src/components/campaign/shared/CampaignListOmnibox.tsx`
- `docs/plans/polimento-mobile-lista-municipios.md` (B42 — mobile entregue)
