# C101 — Agenda mobile: calendário com cara de app nativo

Status: rascunho
Atualizado em: 2026-08-09
Issue: #497
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — redesign local da superfície mobile de `/campanha/agenda` (chrome do calendário + topo da página)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-11/canvases/plan-c101-ui-draft.canvas.tsx
Appetite: ~1,5–2 dias eng; um outcome verificável — no celular a agenda se comporta como calendário nativo: contexto no topo, navegação por arrasto, filtro colado e sempre visível, dia abrindo na hora atual
Responsável: —

## Intenção

No campo o celular é a mesa, mas a agenda mobile ainda navega pelo chrome genérico do FullCalendar: um título enorme ("9 de agosto de 2026") e os botões "< > Hoje" ocupando o topo do calendário. Isso não fala o gesto mobile e rouba espaço vertical precioso. Queremos que `/campanha/agenda` no telefone se comporte como o calendário do próprio celular: o contexto do período no header do app (onde hoje diz "Agenda"), navegação por arrasto horizontal, o filtro sem moldura (edge-to-edge, sempre na tela) e a visão de dia abrindo centralizada na hora atual, com o cabeçalho do dia ("domingo 9") fixo enquanto rola os horários.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor de campo, em pé, um polegar, sol/ruído; o celular é a ferramenta de trabalho.
- **Job principal:** saber em que período está e pular entre períodos com o mínimo de precisão de toque — sem caçar botõezinhos de toolbar.
- **Fluxo desejado:** abre a agenda → topo diz "9 Agosto" (contexto) e o filtro está colado embaixo da barra → arrasta o calendário para o lado para ver o dia/semana/mês seguinte → a linha do tempo da visão de dia abriu centrada na hora atual e o cabeçalho "domingo 9" acompanha a rolagem.
- **Anti-goals de produto:** não virar segunda barra de controles (o seletor de vista C95 continua no header; nada de stack de sub-nav); não quebrar criação inline por toque no slot (C91), nem o remanejo de horário por arrasto vertical (C15); **não mudar o desktop** neste item.

### Esboço de fluxo (C)

```text
abre /campanha/agenda (mobile)
→ [topo] "9 Agosto" + [Semana ▾] + sino   (sem hamburger — C102)
→ [strip do filtro] edge-to-edge, sem label, chips, sticky
→ [calendário sem toolbar própria] arrasta → períodos
→ visão de dia: linha do tempo centrada na hora atual; "domingo 9" fixo ao rolar
```

## Objetivo e aceite

- O **título do FullCalendar** ("9 de agosto de 2026") não aparece mais no mobile; os **botões "< > Hoje"** da toolbar do calendário somem no mobile.
- O **header do app** (onde hoje diz "Agenda") mostra o contexto do período e **atualiza ao navegar**: dia → "9 Agosto"; semana → "3–9 Agosto" (intervalo visível, segunda a domingo); mês → "Agosto"; lista → "Agenda" (na lista os dias já aparecem no corpo).
- **Navegação por arrasto** no calendário: arrastar para a esquerda → período seguinte; arrastar para a direita → período anterior (dia/semana/mês conforme a vista). Não conflita com tap para criar inline nem com arrasto vertical de evento/horário.
- O **filtro** perde o rótulo "Filtrar agenda" e os paddings: fica **edge-to-edge**, encostado no topo (barra do app) e no limite superior do calendário, e **permanece na tela** enquanto o usuário navega/rola.
- A **visão de dia** abre com a linha do tempo **centrada na hora atual** (hoje é fixa em 08:00, independente do horário de abertura).
- O **cabeçalho do dia** ("domingo 9") fica **fixo** no topo da visão de dia enquanto o usuário rola os horários.
- Sem regressão: desktop mantém o chrome atual (título + "< > Hoje"); criação inline (C91), remanejo por arrasto (C15), seletor de vista (C95), feed/import (C92–C93) e leader lockdown intactos.

## Dados (intenção)

- **Vou apresentar dados?** Não — filtro e navegação são estado de tela/URL, não apresentação de dados.
- **Decisões desbloqueadas:** "o que estou olhando e para onde vou" com um olhar e um gesto.
- **Forma:** adiada ao plano de implementação (título nativo vs custom, mecânica do gesto).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/ActivityAgenda.tsx` (toolbar do FullCalendar → config condicional por viewport; abertura da visão de dia na hora atual; cabeçalho do dia fixo; gesto de arrasto no container do calendário), `src/app/(campaign)/campanha/(app)/agenda/page.tsx` + chrome do header (`CampaignMobileTopBar` / `CampaignPageChromeContext` — título agenda-contextual alimentado pelo período visível), `src/components/campaign/activity/ActivityAgendaFilters.tsx` + `CampaignListOmnibox` (rótulo/paddings/edge-to-edge/sticky, com escopo só na agenda), `ActivityAgenda.css`.
- **Precedente a olhar:** C94/C95 (mesmo header do app, mesmo slot agenda-contextual — o título dinâmico entra pelo mesmo mecanismo de chrome por-página), C91 (gestos de tap no calendário), B181 (edição recente do mesmo componente).
- **Risco de acoplamento:** o header do app é compartilhado por todas as rotas `/campanha` — título com contexto de período só na rota agenda, e só no mobile; a omnibox é chassis compartilhado das listas — as mudanças de rótulo/padding são agenda-only; o gesto de arrasto não pode engolir o tap de criação nem o long-press de evento.

## Dependências

- Coordenação com C102 (mesma barra superior mobile; o título e o strip ocupam o espaço do hamburger — sem ordem dura; cada um entrega sozinho).

## Fora de escopo

- Desktop (mantém chrome do FullCalendar como está).
- Botões de modo de vista (C95, entregue) e o "Hoje" do desktop.
- Remover hamburger/sidebar mobile → **C102**.
- Overlay de criação inline (C91) e o clipping de viewport baixo (B181).
- Mudar o filtro das demais listas /campanha.

## Rabbit holes de produto

- **Gesto captura tudo.** Se alguém "só completar": arrasto horizontal em cima de evento/slot compete com tap de criação e long-press de remanejo. **Corte neste item:** navega só um arrasto horizontal claro (com limiar), em área sem evento em drag; tap continua criando.
- **Filtro sticky vira padrão global.** A omnibox é compartilhada; a mudança é agenda-only, outras listas intactas.
- **Re-centralizar a cada troca de dia.** Lutar contra o scroll do usuário. **Corte:** centra na abertura (e ao voltar ao hoje); trocar de dia depois não re-centra.
- **"Hoje" órfão.** Sem botão, usuário pode se perder no calendário. **Corte:** tap no título do header volta ao hoje (recomendação abaixo — validar no gate).

## Questões em aberto (produto)

- **Como voltar ao "hoje" sem botão?** **Opções:** A) tap no título do header ("9 Agosto") volta ao hoje | B) nada — usuário arrasta de volta | C) chip "Hoje" no strip do filtro. **Recomendação:** A — cabe no gesto já existente, sem controle extra. _(assumido — validar)_
- **O contexto do header inclui o dia da semana?** **Opções:** A) só "9 Agosto" (como pedido) | B) "domingo 9 Agosto". **Recomendação:** A — o cabeçalho fixo da visão de dia já mostra "domingo 9". _(assumido — validar)_
- **Semana cruzando o mês:** **Opções:** A) "28 Julho – 3 Agosto" | B) "Julho–Agosto". **Recomendação:** A — preserva os dias, que é o que importa na leitura. _(assumido — validar)_
- **Desktop muda junto?** **Opções:** A) não — mobile-only neste item | B) sim — mesma simplificação no desktop. **Recomendação:** A — o pedido é a visualização mobile; desktop tem espaço e botões legíveis. _(assumido — validar)_

## Referências

- GitHub Issue #497
- Precedentes: GitHub Issues #390 (C15 — FullCalendar), #438 (C94 — filtro/toolbar), #439 (C95 — seletor de vista), #428 (C91 — criação inline)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-11/canvases/plan-c101-ui-draft.canvas.tsx`
- `ActivityAgenda.tsx` (`headerToolbar`, `scrollTime="08:00:00"`, `MOBILE_BREAKPOINT_PX`), `ActivityAgenda.css`, `CampaignPageChromeContext` (override de título do header)
