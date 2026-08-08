# C95 — Agenda: seletor do modo de visualização no header do app (mobile e desktop)

Status: rascunho
Atualizado em: 2026-08-08
Issue: #439
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe no header global do shell (controle compacto; sem redesign)
Canvas UI: coberto/atualizado com o plan-c94-ui-draft.canvas.tsx (header do app com o seletor)
Appetite: ~0,5–1 dia eng; um outcome verificável — trocar o modo de visualização (semana/dia/mês/lista) por um seletor único no header do app, sem aumentar o header
Responsável: —

## Dependência rápida

- **Com [C94](c94-agenda-combobox-header-acoes-rapidas.md) (coordenar):** os dois tocam o **header do app** (`CampaignDesktopHeader`/`CampaignMobileTopBar`) — C94 coloca o "Link de import" lá; C95 coloca o seletor de vista.**Sequenciar com C94** (slot agenda-contextual é construído por um, reutilizado pelo outro), mas sem ordem dura fixa.

## Intenção

Hoje o troca-modo do calendário (semana/dia/mês/lista) vive nos **botões embutidos** do próprio FullCalendar (cada modo com seu botão), no meio da página. Os controles do calendário devem morar no **header do app** — a barra superior do `/campanha` onde já ficam o título da página, o botão do Sollinha/AI chat e o de notificações — tanto em desktop quanto em mobile. Em vez de um botão por modo, **um seletor único** ("Semana ▾"), compacto o bastante para **não aumentar o tamanho do header**. No mobile, a mesma barra superior (título + sino) ganha o seletor no mesmo gesto.

## Persona e fluxo

- **Persona / contexto:** coordenador/assessor alternando entre vista de dia, semana, mês ou lista conforme o gesto: no campo (mobile) quer o dia; na mesa (desktop) quer a semana com o mês à esquerda para saltar.
- **Job principal:** trocar o modo de visualização com um controle só, **no header do app** (onde já olha título/sino/AI), sem perder o estado do filtro nem o recorte.
- **Fluxo desejado:** header do app → seletor "Semana ▾" → escolhe "Mês" → calendário muda a vista; escolha vale para a sessão e sobrevive ao reload (vira parte do estado da tela, junto do filtro).
- **Anti-goals de produto:** não duplicar com os botões do FullCalendar (remover `end` do `headerToolbar`); não empilhar segunda linha de controles; não esconder o modo ativo; **não aumentar a altura/forma do header**.

### Esboço de fluxo (B)

```text
[header] seletor "Semana ▾" → [Dia|Semana|Mês|Lista] → calendário muda → escolha persiste
```

## Objetivo e aceite

- Um **seletor único** de modo de visualização no **header do app** (`CampaignDesktopHeader` no desktop; `CampaignMobileTopBar` no mobile), **agenda-contextual** (só na rota `/campanha/agenda`), substituindo os 4 botões do FullCalendar.
- O seletor **não aumenta a altura do header** (mantém `min-h-11` desktop / `min-h-14` mobile; só insere o controle compacto na linha existente, junto do título/sino/AI chat).
- Modos disponíveis: Dia (`timeGridDay`), Semana (`timeGridWeek`), Mês (`dayGridMonth`) e Lista (`listMonth`) — os mesmos de hoje.
- A escolha persiste por sessão/reload (estado da tela, junto do filtro) e respeita o recorte do filtro.
- Sem regressão: navegação prev/next/hj continua no FullCalendar; criação inline (C91) intacta; leader lockdown; demais telas `/campanha` sem o seletor (contextual).

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** "estou olhando o recorte do jeito certo para o meu gesto".
- **Forma:** adiada (select compacto vs segmented são igualmente válidos; cabe ao executor, respeitando "não crescer o header").

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/shell/CampaignDesktopHeader.tsx` + `src/components/campaign/shell/CampaignMobileTopBar.tsx` (slot do seletor, agenda-contextual; o mecanismo de chrome por-página do `CampaignPageChromeDisplay`/contexto é a pista para o encaixe), `src/components/campaign/activity/ActivityAgenda.tsx` (remover botões de modo do `headerToolbar`; conectar o seletor ao `changeView` via `calendarRef`), e o estado de vista eventualmente junto ao `ActivityAgendaState`/URL (persistência).
- **Precedente a olhar:** C91 (`agenda-criar-evento-inline.md`) mexe no mesmo FullCalendar; o "Link de import" do C94 entra no mesmo header do app — coordenar slot/ordem.
- **Risco de acoplamento:** o header do app é **compartilhado por todas as rotas** `/campanha` — o seletor precisa ser agenda-contextual para não poluir as demais telas. A lógica responsiva que hoje troca semana↔dia ao redimensionar (narrow) precisa reconciliar com um modo **escolhido pelo usuário** — a escolha do usuário deve vencer (detalhe de interação, não de layout).

## Dependências

- C94 (coordenar — mesmo header do app / slot agenda-contextual; serializar na fila).

## Fora de escopo

- Redesign do FullCalendar (C15); criação inline (C91).
- Mover prev/next/"Hoje" para o header (mantém dentro do calendário).
- Persistência entre dispositivos/contas (só sessão/tela).
- O slot agenda-contextual do header em si — construído junto do "Link de import" (C94) e reutilizado aqui.

## Rabbit holes de produto

- **Seletor vira barra de controles.** Se alguém "só completar": arrastar prev/next/título/modo tudo pro header do app. **Corte neste item:** só o seletor de modo; navegação permanece no calendário.
- **Crescer o header.** O gatilho "só mais um controle" vira segunda linha ou aumenta `min-h`. **Corte:** um controle único compacto, dentro da linha existente do header do app.

## Questões em aberto (produto)

- **Controle: select texto vs segmented de ícones.** **Opções:** A) select/dropdown compacto (rótulo do modo atual + ▾) | B) segmented com 4 ícones. **Recomendação:** A — é o que cabe na linha única sem crescer; 4 segmentos não. _(assumido — validar)_
- **Posição no header do app (desktop).** **Decidido no gate:** cluster direito na ordem `[Semana ▾][Link de import][Notificações][IA]` — o seletor é o primeiro do cluster da agenda. No mobile, junto ao sino, à direita do título. Fora de questão.
- **Escolha do usuário × auto-responsivo.** **Opções:** A) escolha do usuário vence e não é trocada por resize (só o default muda por viewport) | B) resize continua forçando de volta. **Recomendação:** A — o usuário que escolheu mês não deve ser jogado de volta ao fechar o teclado. _(assumido — validar)_

## Referências

- GitHub Issue #390 (C15 — agenda FullCalendar), #428 (C91 — criar inline)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c94-ui-draft.canvas.tsx` (header-alvo com o seletor)
- `ActivityAgenda.tsx` (`headerToolbar` `end: 'timeGridWeek,timeGridDay,dayGridMonth,listMonth'`; `MOBILE_BREAKPOINT_PX`)
