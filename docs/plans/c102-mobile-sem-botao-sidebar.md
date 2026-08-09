# C102 — Mobile: sem botão/sheet de sidebar (navegação pela barra inferior + "Mais")

Status: rascunho
Atualizado em: 2026-08-09
Issue: #498
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe no shell mobile (remove um controle do topo; sem redesign)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-11/canvases/plan-c102-ui-draft.canvas.tsx
Appetite: ~0,5–1 dia eng; um outcome verificável — no mobile nenhuma tela staff tem hamburger nem sheet de sidebar; tudo chega pela barra inferior + "Mais"
Responsável: —

## Intenção

No mobile a navegação já tem a barra inferior (Início, Municípios, Atualizações, Agenda, Mais) com **todos** os destinos de staff no drawer "Mais" (mais Perfil/Sair). O hamburger do topo e o sheet de sidebar duplicam isso e roubam espaço do topo — exatamente onde a agenda mobile quer título de contexto e filtro (C101). Remover o botão de abrir sidebar para todas as telas no mobile; o sheet de navegação pode até ser desmontado para staff.

## Persona e fluxo

- **Persona / contexto:** staff de campo, um polegar; já aprendeu que a navegação é embaixo ("Mais" abre o resto).
- **Job principal:** chegar a qualquer tela com 1–2 toques, sem um drawer duplicado que só aparece no canto superior.
- **Fluxo desejado:** topo livre (título/contexto + ações) → barra inferior cobre os 4 primários → "Mais" cobre o resto (Quadro, Territórios, Lideranças, Organizações, Dobradinhas, Demandas, Apoiadores, Assessores, Conceitos + Perfil/Sair).
- **Anti-goals de produto:** não deixar nenhum destino inalcançável no mobile; não quebrar o leader lockdown (que não tem barra inferior); não mudar o desktop.

### Esboço de fluxo (B)

```text
antes:  [≡ Agenda ··· sino] → sheet duplica o "Mais"
depois: [9 Agosto ··· Semana ▾ · sino]  +  barra inferior [Início|Municípios|Atualizações|Agenda|Mais]
```

## Objetivo e aceite

- No **mobile**, nenhuma tela `/campanha` de staff mostra o botão de abrir sidebar na barra superior; o sheet de navegação **não é renderizado** para staff.
- Todos os destinos de staff permanecem acessíveis: barra inferior (4 primários) + drawer "Mais" (demais itens + Conceitos + Perfil + Sair).
- **Desktop inalterado**: sidebar continua como é (collapsible offcanvas, B38).
- **Leader (lockdown) mantém o sheet**: não tem barra inferior; Início e "Meus contatos" continuam acessíveis no mobile.
- **Filtros salvos de Municípios (B18)** continuam acessíveis no mobile (ver questão em aberto).
- Sem regressão: wizard, busca do Início, modo offline, PWA.

## Dados (intenção)

- **Vou apresentar dados?** Não — remoção de controle de navegação.
- **Decisões desbloqueadas:** "no celular a navegação mora embaixo, o topo é contexto".
- **Forma:** adiada ao plano de implementação.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignMobileTopBar.tsx` (remover `SidebarTrigger`), `src/app/(campaign)/campanha/(app)/layout.tsx` (`CampaignSidebar` condicional por viewport/papel — ou só por papel + não renderizar no mobile), `src/components/campaign/shell/CampaignSidebar.tsx` (sheet que some), `src/components/campaign/shell/CampaignBottomNav.tsx` (drawer "Mais" — lar de destino dos itens que só a sidebar tinha, ex. filtros salvos).
- **Precedente a olhar:** B164 (barra inferior + "Mais", entregue), B18/B124 (filtros salvos na sidebar), C101 (mesma barra superior mobile — coordenar).
- **Risco de acoplamento:** o top bar é compartilhado por todas as rotas `/campanha` (a remoção é global por natureza — é o pedido); o sheet ainda é necessário para **leader** (lockdown sem barra inferior); filtros salvos (B18) hoje vivem **só** na sidebar.

## Dependências

- Coordenação com C101 (mesma barra superior mobile; o espaço do hamburger é onde C101 quer título/strip — sem ordem dura).

## Fora de escopo

- Redesign da barra inferior ou do drawer "Mais" (B164 entregue).
- Remover a sidebar do desktop.
- Desktop e tablet (largura ≥ md mantém sidebar).

## Rabbit holes de produto

- **Desmontar para todo mundo.** Se alguém "só completar": leader perde a única navegação no mobile. **Corte neste item:** staff desmonta; leader mantém o sheet.
- **Filtro salvo vira item fantasma.** A sub-lista de filtros salvos de Municípios (B18) só existe na sidebar — se a sidebar some e nada a substitui, um recurso entregue fica inalcançável no mobile. **Corte:** manter acessível (recomendação abaixo — validar no gate).

## Questões em aberto (produto)

- **Escopo da remoção:** **Opções:** A) global — todas as telas `/campanha` no mobile (o pedido: "todas as telas em mobile"; a barra inferior + "Mais" cobrem staff) | B) só a agenda. **Recomendação:** A. _(assumido — validar)_
- **Leader:** **Opções:** A) mantém o sheet (única navegação dele no mobile) | B) some também (leader fica sem trocar de tela no mobile). **Recomendação:** A. _(assumido — validar)_
- **Filtros salvos de Municípios (B18):** hoje vivem só na sidebar. **Opções:** A) migrar a sub-lista para o drawer "Mais" (mesmo componente de dados, novo lar) | B) ficam desktop-only nesta fatia e um sucessor move para o "Mais" | C) manter o sheet para staff (rejeitado — contradiz o pedido). **Recomendação:** A — o drawer é o novo lar da navegação secundária e o componente é o mesmo; senão B e registrar o débito. _(assumido — validar)_

## Referências

- GitHub Issue #498
- Precedentes: GitHub Issues #400 (B164 — barra inferior + "Mais"), #176 (B18 — filtros salvos na sidebar)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-11/canvases/plan-c102-ui-draft.canvas.tsx`
- `CampaignMobileTopBar.tsx` (`SidebarTrigger`), `layout.tsx` (`CampaignSidebar`), `CampaignBottomNav.tsx` (drawer "Mais"), `MunicipalityNavSavedFilters.tsx` (sub-lista B18)
