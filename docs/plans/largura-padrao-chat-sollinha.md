# Largura padrão do chat Sollinha com teto no desktop

Status: rascunho
Atualizado em: 2026-08-07
Issue: #414
Priority: P2
Model: composer-2.5 / deepseek-v4-flash-high
Impeccable: B — encaixe no comportamento de abertura do painel lateral existente (desktop `/campanha`)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b166-ui-draft.canvas.tsx
Appetite: ~0,25–0,5 dia eng; valor de abertura do painel; sem migration
Responsável: —

## Intenção

O assistente Sollinha abre **grande demais** no desktop: o painel nasce com 25% da largura da janela (em telas largas, 480–640 px) toda vez que abre — sozinho ao carregar `/campanha` ou pelo botão do header. O usuário quer que a **largura padrão de abertura tenha teto de 360 px**, e que o **resize posterior seja totalmente livre (sem teto superior)**, com o **último tamanho escolhido lembrado** nas próximas aberturas.

## Persona e fluxo

- **Persona / contexto:** assessor/coordenador no desktop de `/campanha`; o chat abre sobre o trabalho (mapa, tabelas, formulários) e não deve engolir a área de trabalho.
- **Job principal:** conversar com a Sollinha mantendo a tela principal utilizável ao lado.
- **Fluxo desejado:** abre compacto (25% ou no máximo 360 px, o que for menor) → usuário arrasta o handle para o tamanho que preferir, sem teto → o tamanho escolhido é lembrado nas próximas aberturas.
- **Anti-goals de produto:** não travar o resize (o teto vale só para a **abertura padrão**; o usuário pode ajustar à vontade, inclusive mais largo que 360 px); não mudar o comportamento mobile (drawer full-screen); não encolher o conteúdo do chat a ponto de ficar ilegível.

## Objetivo e aceite

- Ao abrir o chat no desktop — sozinho (carregamento) ou pelo botão do header — o painel nasce com **25% da janela, no máximo 360 px** (ou seja: `min(25%, 360 px)`).
- O usuário pode redimensionar livremente após abrir: mais largo **sem teto superior** (limitado apenas pelo espaço que a janela/área principal permite) e mais estreito até o mínimo de ~280 px.
- O **último tamanho escolhido pelo usuário é lembrado** e usado nas próximas aberturas; o teto de 360 px vale para a abertura padrão quando não há tamanho salvo.
- Em telas onde 25% já é menor que 360 px, o comportamento atual não muda (o teto é um _máximo_, não um alvo fixo).
- Mobile (drawer full-screen) e demais superfícies de `/campanha` intactos.

## Dados (intenção)

- **Vou apresentar dados?** **Não** — N/A: ajuste de largura de painel, sem número novo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/ai/CampaignAISidebarShell.tsx` (o `Panel` do chat: `defaultSize`/constantes de tamanho, `minSize`, `maxSize`).
- **Precedente a olhar:** `docs/plans/ai-chat-sollinha.md` (entrega original do chat — `in-prod`, não editar); o resize usa `react-resizable-panels` (`Group`/`Panel`/`Separator`), que já oferece persistência própria de tamanho — o executor escolhe o mecanismo.
- **Risco de acoplamento:** o painel não persiste tamanho hoje (cada abertura volta ao default); persistir o último resize é decisão nova deste item; e o `open` do contexto controla Drawer + Panel juntos, então não confundir abertura com largura.

## Dependências

- Nenhuma (superfície independente; não toca migrations, consent, RBAC nem cache público).

## Fora de escopo

- Persistir as **conversas** do chat — continua "sessão nova a cada abertura" (plano original); este item persiste apenas o **tamanho** do painel.
- Redesenhar o conteúdo/header do chat (`CampaignAISidebar`/`CampaignAIChat`).
- Comportamento mobile (drawer full-screen — já é o desejado).
- Mexer no mínimo de resize (~280 px) — floor de legibilidade, mantido.

## Rabbit holes de produto

- **"Já que mexi, persisto as conversas."** Se alguém "só completar": persistir threads/chat no DB ou storage, mudando a semântica de "sessão nova a cada abertura" do plano original. **Corte neste item:** persistir só o tamanho do painel.
- **"Encolho o mínimo também."** Apertar o mínimo abaixo de ~280 px quebra a legibilidade do chat e pode esconder o header do painel. **Corte:** manter mínimo atual.
- **Confundir teto de abertura com teto de resize.** O pedido é: teto de 360 px **só na abertura padrão**; resize do usuário **sem máximo**. Travar o resize em 360 px seria outro produto. **Corte:** depois de aberto, o usuário ajusta como preferir.

## Questões em aberto (produto)

- **Teto de abertura: 360 px confirmado.** **Opções:** A) 360 px | B) 400 px | C) 480 px. **Recomendação:** **A** — decidido pelo produto (2026-08-07). _(resolvido)_
- **O teto é um máximo ou um alvo fixo em qualquer tela?** **Opções:** A) máximo — telas estreitas seguem com 25% (ou o que couber) | B) alvo fixo — sempre 360 px mesmo em telas pequenas. **Recomendação:** **A** — decidido pelo produto: "abre com 25% ou no máximo 360 px". _(resolvido)_
- **Resize do usuário com teto superior?** **Opções:** A) sem teto — ajusta como preferir (remover limite atual) | B) manter o teto atual. **Recomendação:** **A** — decidido pelo produto: "no ajuste do usuário não deve ter máximo". _(resolvido)_
- **Persistir o tamanho escolhido?** **Opções:** A) não (cada abertura = padrão capado) | B) sim, lembrar o último resize. **Recomendação:** **B** — decidido pelo produto (2026-08-07). _(resolvido)_

## Referências

- GitHub Issue #B166 (após registro)
- Canvas UI (gate): [plan-b166-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b166-ui-draft.canvas.tsx)
- `src/components/campaign/shell/ai/CampaignAISidebarShell.tsx` (painel do chat: `defaultSize="25"`, `minSize="280px"`, `maxSize="50"`)
- `src/components/campaign/shell/ai/CampaignAISidebarContext.tsx` / `CampaignAIHeaderButton.tsx` (abertura por botão)
- Precedente (imutável): `docs/plans/ai-chat-sollinha.md`
