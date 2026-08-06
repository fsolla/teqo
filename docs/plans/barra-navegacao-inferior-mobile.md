# B164 — Barra de navegação inferior no mobile (+ página Mais)

Status: ready
Atualizado em: 2026-08-06
Issue: #400
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — chrome novo no shell mobile + página hub “Mais”
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-b164-ui-draft.canvas.tsx`
Appetite: ~1–1,5 dia eng; um outcome verificável — staff no celular troca entre os 4 destinos primários e o overflow em um toque
Responsável: —

## Intenção

No telefone, a mesa precisa **trocar de domínio com o polegar** (Início → Municípios → o que está acontecendo → agenda → o resto) sem abrir o Sheet da sidebar a cada salto. Em 2026-07-29 o produto removeu a bottom bar (**B73**) a favor de intenção no Início + sidebar; na prática o campo ainda pede atalhos de domínio. Este item **reintroduz** a barra inferior no mobile com uma IA nova: quatro destinos de trabalho + **Mais** (página com o restante da navegação).

O destino **Atualizações** é o feed da campanha (cada atualização = fio de discussão) — superfície de produto em **C89**; aqui só o slot de navegação + rota âncora.

## Persona e fluxo

- **Persona / contexto:** coordenador / assessor / candidato no celular (campo ou deslocamento); uma mão; PWA; pressão de tempo entre Zap e visita.
- **Job principal:** ir aos destinos frequentes em um toque; achar Lideranças / Assessores / Dobradinhas / etc. sem caçar no Sheet.
- **Fluxo desejado:**
  1. Em qualquer rota `(app)` no viewport mobile, vê barra fixa: **Início · Municípios · Atualizações · Agenda · Mais**.
  2. Toca um dos quatro → navega para aquele destino (estado ativo visível).
  3. Toca **Mais** → página com a lista dos destinos restantes (Lideranças, Organizações, Dobradinhas, Demandas, Apoiadores, Assessores, Quadro, Territórios, Conceitos, Perfil) + **Sair** no rodapé — filtrados por papel.
  4. Desktop/tablet: sidebar continua como hoje; barra inferior **não** compete lá.
  5. `SidebarTrigger` no header mobile **permanece** (escape hatch).
- **Anti-goals de produto:** segunda barra no desktop; spreadsheet de atalhos; reinventar catálogo de ações rápidas (FAB permanece); liberar liderança dos destinos staff; redesenhar o Início ou o FAB neste item; implementar o feed/threads neste item (→ **C89**).

### Esboço de fluxo (C)

```text
[qualquer página mobile staff]
  → barra: Início | Municípios | Atualizações | Agenda | Mais
  → [4 primários] → destino
  → [Mais] → página overflow → destino secundário / Sair
```

## Objetivo e aceite

- Viewport **&lt; `md`**, papéis staff (`coordinator` / `advisor` / `candidate`): barra inferior fixa com exatamente esses cinco rótulos (copy pt-BR), na ordem pedida.
- Destinos primários (produto) — **confirmados no gate:**
  - **Início** → `/campanha`
  - **Municípios** → lista de municípios
  - **Atualizações** → rota do feed da campanha (intenção em **C89**; até C89 landar, a rota pode existir como âncora/empty honesto, sem twin de C88)
  - **Agenda** → rótulo Agenda; href da vertical de atividades até **C15**, depois cutover para `/campanha/agenda`
  - **Mais** → página overflow (restante da nav + Conceitos + Perfil + Sair)
- Página **Mais**: lista clara dos destinos que **não** estão nos quatro primários; mesmo filtro de papel da nav atual (Assessores só unrestricted; Apoiadores só quem acessa a área; liderança não vê menu staff).
- Item ativo na barra (e na página Mais) reflete a rota corrente; safe-area inferior respeitada; conteúdo não fica escondido atrás da barra.
- **FAB** continua onde já existe; fica acima da barra / com folga.
- **Leader lockdown** intacto: liderança **não** ganha a barra de cinco destinos staff.
- Desktop/tablet: sem regressão da sidebar; sem barra inferior; `SidebarTrigger` mobile mantido.
- Sucessor explícito de **B73** — não editar o plano entregue.

## Dados (intenção)

- **Vou apresentar dados?** Não neste item — chrome de navegação. O feed (C89) é a superfície de dados/discussão.
- **Decisões desbloqueadas:** “para onde vou agora?” (domínio).
- **Forma:** adiada.

## Direção no codebase (hipótese)

- **Áreas prováveis:** shell `(app)` (layout, top bar mobile, padding do scroll), `src/components/campaign/shell/` (nav + bottom bar), rota overflow Mais, âncora de rota Atualizações; coexistência com FAB.
- **Precedente a olhar:** [remover-bottom-nav-mobile.md](remover-bottom-nav-mobile.md) (**B73**); `nav.ts`; [fab-acoes-rapidas-substituir-drawer.md](fab-acoes-rapidas-substituir-drawer.md); C14/C15; **C89** (feed); C87/C88 (modelo + deliberação).
- **Risco de acoplamento:** leader lockdown; filtros de papel; thumb-zone / FAB; não inventar segundo inventário de destinos fora da fonte da sidebar.

## Dependências

- Nenhuma dura para a barra + página Mais.
- Soft: **C15** / **C14** — cutover do href Agenda.
- Soft: **C89** — conteúdo rico do slot Atualizações (feed + threads).
- Soft: **C87** / **C88** — via C89 (modelo unificado + deliberação no fio).

## Fora de escopo

- Feed da campanha, interação e threads por atualização → **C89** (consome **C87** / **C88**).
- Remodel de registro / deliberação → **C87** / **C88**.
- FullCalendar / sync Google → **C15** / **C16**.
- Redesign do Início, FAB ou catálogo de ações.
- Bottom nav no desktop/tablet; esconder `SidebarTrigger` no mobile.
- Editar o plano entregue do B73.

## Rabbit holes de produto

- **"Já que voltou a barra, implementa o feed no mesmo PR."** Dois jobs. **Corte:** C89.
- **"Já que voltou a barra, mata o FAB / o Sheet."** Jobs diferentes. **Corte:** FAB e sidebar desktop ficam; trigger mobile fica.
- **"Coloca Quadro / Lideranças na barra primária."** **Corte:** primários fixos; resto em Mais.
- **"Liderança também ganha os cinco."** **Corte:** staff only.

## Questões em aberto (produto)

- Nenhuma pendente do gate anterior — respostas do humano (2026-08-06):
  1. Atualizações = feed da campanha com discussão; cada update = thread → fatiado em **C89**.
  2. Agenda = label Agenda; atividades até C15.
  3. Mais = restante da nav + Conceitos + Perfil + Sair.
  4. Manter `SidebarTrigger` no mobile.

## Referências

- GitHub Issue: [#400](https://github.com/fsolla/teqo/issues/400)
- Canvas UI (gate): [`plan-b164-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-b164-ui-draft.canvas.tsx)
- Irmão: [feed-atualizacoes-campanha-threads.md](feed-atualizacoes-campanha-threads.md) (**C89**)
- Sucessor de B73 / [#14](https://github.com/fsolla/teqo/issues/14) — [remover-bottom-nav-mobile.md](remover-bottom-nav-mobile.md)
- Soft: C14 [#389](https://github.com/fsolla/teqo/issues/389), C15 [#390](https://github.com/fsolla/teqo/issues/390); C87 [#396](https://github.com/fsolla/teqo/issues/396), C88 [#397](https://github.com/fsolla/teqo/issues/397)
- `src/components/campaign/shell/nav.ts`, layout `(app)`, FAB de ações rápidas
