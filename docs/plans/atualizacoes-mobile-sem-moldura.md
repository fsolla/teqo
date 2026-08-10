# C106 — Atualizações mobile: feed sem moldura (omnibox sticky sem label, criar no header, cards edge-to-edge)

Status: registrado
Atualizado em: 2026-08-09
Issue: #517
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na tela mobile do feed de atualizações (`/campanha/atualizacoes`)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-15/canvases/plan-c106-ui-draft.canvas.tsx`
Appetite: ~0,5–1 dia eng; um encaixe em página existente
Responsável: —

## Intenção

No celular, o feed de atualizações acumula chrome que rouba espaço da leitura: a label
"Filtrar atualizações" gasta uma linha inteira, o filtro vem numa caixa com borda e sai da tela
ao rolar, o botão "Nova atualização" compete por espaço com o filtro, e os cards têm moldura
arredondada + gap — tudo isso quebra o ritmo de varredura de fatos do assessor em campo. Queremos
a mesma leitura fluida edge-to-edge já desenhada para Municípios (B184): filtro sem moldura e
sempre visível, ação de criar no lugar esperado (header), cards separados só por uma linha.

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador no celular, varrendo o feed de atualizações entre visitas; uma mão, atenção curta.
- **Job principal:** ler o feed e registrar um fato novo sem lutar com moldura, mantendo o filtro sempre à mão.
- **Fluxo desejado:** abre `/campanha/atualizacoes` no celular → vê o filtro limpo, sem label, preso sob a barra superior → rola os cards contínuos (só uma linha separando cada um) → o filtro permanece visível o tempo todo → toca o + no header → abre o mesmo modal/bottom sheet de criação de hoje → registra o fato e volta ao feed no mesmo recorte.
- **Anti-goals de produto:** não virar redesenho geral do shell; não mudar o comportamento de filtragem (chips continuam dentro da omnibox); não mudar o conteúdo/fluxo do modal de criação; não alterar desktop; não tocar nas outras listas.

### Esboço de fluxo (B)

Ver Canvas UI (rascunho side-by-side "Hoje × Depois"). Jornada textual:
`[abre feed] → [filtro sem label, sem borda, sticky] → [rola cards contínuos com separador de linha] → [filtro continua visível] → [toca + no header → mesmo modal → cria] → [volta ao feed no mesmo recorte]`

## Objetivo e aceite

- No mobile, a label "Filtrar atualizações" não é exibida no feed de atualizações.
- O filtro é visualmente sem moldura (sem caixa/borda), fica **sempre visível** enquanto o usuário rola os cards, e uma linha horizontal o separa do feed abaixo.
- Os chips de filtro ativo continuam **dentro da omnibox**, com o mesmo comportamento de hoje.
- O botão "Nova atualização" (texto + outline) some do mobile; a ação de criar vira **icon button no header** (o mesmo `CampaignUpdatesCreateModal` / bottom sheet de hoje, com o mesmo conteúdo e fluxo).
- Os cards de atualização no mobile ficam sem borda nem arredondamento, edge-to-edge, com uma única linha horizontal separando um card do outro.
- Desktop do feed e as demais listas `/campanha` ficam inalteradas.
- O empty state ("Nenhuma atualização encontrada") continua fazendo sentido no mobile — hoje ele cita o botão “+ Nova atualização”, que no mobile vira icon; a copy deve apontar para a ação que existe (o + no topo) sem mudar o desktop.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de acabamento visual; nenhum dado, KPI ou mapa muda.
- **Decisões desbloqueadas:** N/A (nenhuma decisão de leitura de dado nova).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/atualizacoes/page.tsx` + `src/components/campaign/municipality/CampaignUpdatesFilters.tsx` (label/placeholder do filtro e onde nasce o botão "Nova atualização" — `trailing` da omnibox; o `CampaignUpdatesCreateModal` fica onde está), `src/components/campaign/municipality/CampaignUpdatesFeed.tsx` (cards `rounded-xl border`), `src/components/campaign/shell/CampaignPageChromeContext.tsx` / `CampaignMobileTopBar.tsx` (mecanismo `setHeaderAction`/`useCampaignHeaderActions` — provável destino do icon de criar, mobile-only), `src/components/campaign/shared/CampaignListOmnibox.tsx` (chassis compartilhado — label e moldura).
- **Precedente a olhar:** B184 (`docs/plans/municipios-mobile-sem-moldura.md`) — a mesma família visual já desenhada para Municípios; se o padrão (prop/variant ou estilo local no chassis) já estiver em `main` quando este item for executado, seguir o mesmo mecanismo em vez de inventar um segundo.
- **Risco de acoplamento:** o filtro é o chassis compartilhado `CampaignListOmnibox` (B127) usado por várias listas — a intenção é escopada ao **mobile de atualizações**; o comportamento das outras listas não pode mudar. O modal de criação é o mesmo de hoje — só muda o trigger.

## Dependências

- Nenhuma dura. Suave: B184 (padrão irmão, ainda em fase de plano — se já entregue quando este item for executado, reutilizar o mecanismo que ele estabeleceu para o chassis).

## Fora de escopo

- Desktop do feed de atualizações (sem mudança).
- Demais listas `/campanha` (municípios é o B184; apoiadores, lideranças, atividades, demandas… ficam para pedido próprio).
- Novos filtros, ordenação ou mudança de dados nos cards.
- Conteúdo/fluxo do modal de criação (inalterado).
- Redesign do shell/top bar.

## Rabbit holes de produto

- **"Já que é sem moldura, melhora as outras listas também."** Explosão de superfície e review. **Corte neste item:** só `/campanha/atualizacoes` mobile; Municípios já é o B184; as demais ficam para pedido próprio se aprovado.
- **"Sticky é oportunidade de redesenhar o filtro."** Nova interação sem pedido. **Corte:** mantém chips (dentro da omnibox), sugestões e o fluxo de criar; só muda presença visual, posição fixa e o ancoradouro da ação de criar.
- **"Já que o criar vai pro header, o modal pode mudar."** O modal de criação foi desenhado e validado em C89; não há pedido de mudança de conteúdo. **Corte:** mesmo modal, só outro trigger no mobile.
- **"Edge-to-edge é todo o app."** Redesign de shell. **Corte:** só a região do feed mobile.

## Questões em aberto (produto)

- **Remover a label só no mobile ou em todas as resoluções?** **Opções:** A) mobile-only (desktop mantém label); B) remover em tudo. **Recomendação:** A — o pedido é mobile e no desktop a label ajuda descoberta sem custo de espaço. _(assumido — validar com produto)_
- **Cards edge-to-edge até a borda física da tela, ou só até o padding da página?** **Opções:** A) até a borda da tela (sem padding lateral na região do feed); B) mantém o padding atual, só troca borda por linha. **Recomendação:** A — mesma regra assumida no B184. _(assumido — validar)_
- **O icon de criar no header aparece em quais resoluções?** **Opções:** A) só mobile (desktop mantém o botão "Nova atualização" com texto); B) em tudo. **Recomendação:** A — o pedido é mobile e o botão com texto é mais descobrível no desktop, que tem espaço. _(assumido — validar)_
- **Copy do empty state no mobile:** o texto atual cita “+ Nova atualização”; com o botão virando icon, ajustar a copy para descrever a ação (ex.: “+ no topo da tela”) no mobile, mantendo o desktop? **Opções:** A) copy única que funcione nos dois; B) copy mobile-aware separada. **Recomendação:** A — copy curta que descreve a ação em vez do botão funciona nas duas resoluções e evita ramificação. _(aberto — validar)_
- **Região sticky do filtro:** chips e busca formam a região que gruda sob a barra (mesma regra do B184 — chips continuam dentro da omnibox).

## Referências

- GitHub Issue: #517
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-15/canvases/plan-c106-ui-draft.canvas.tsx`
- `src/app/(campaign)/campanha/(app)/atualizacoes/page.tsx`, `src/components/campaign/municipality/CampaignUpdatesFilters.tsx`, `src/components/campaign/municipality/CampaignUpdatesFeed.tsx`, `src/components/campaign/shared/CampaignListOmnibox.tsx`
- `docs/plans/municipios-mobile-sem-moldura.md` (B184 — família visual irmã)
