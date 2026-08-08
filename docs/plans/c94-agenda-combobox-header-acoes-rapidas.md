# C94 — Agenda: filtro combobox único, header compacto (ícones) e ações no FAB mobile

Status: rascunho
Atualizado em: 2026-08-08
Issue: #438
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: C — redesign local da toolbar/header da agenda (`/campanha/agenda`)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c94-ui-draft.canvas.tsx
Appetite: ~1–1,5 dia eng; um outcome verificável — toolbar consolidada (combobox único + ícones) e uma só entrada "Nova atividade"/"Link de import" por viewport
Responsável: —

## Intenção

A barra da agenda (C15) foi construída como 3 seletor­es avulsos (Município, Tag, "Deputado presente") + botões de ação, e hoje **duplica** caminhos: no mobile o usuário vê dois botões de criação na página **e** as mesmas ações no FAB; o "Link de import" vive dentro do card de filtros. Resultado: superfície sem hierarquia e fluxo redundante. Queremos consolidar:

1. **Um filtro combobox único** (chassis omnibox já usado em `/campanha/municipios` e nas listas) no lugar dos 3 seletor­es — com chips removíveis e sugestões agrupadas.
2. **Mobile:** tirar os botões de criação da página; a entrada vira **ação rápida no FAB**. "Link de import" também entra como ação rápida.
3. **Desktop:** um **ícone "+" (Nova atividade)** logo à direita do combobox, e o **"Link de import" como botão-ícone no header do app** (barra superior junto do AI chat e das notificações, agenda-contextual).

## Persona e fluxo

- **Persona / contexto:** coordenador e assessor de mesa (desktop) e de campo (mobile) usando a agenda para planejar e acompanhar compromissos.
- **Job principal:** filtrar e criar/assinar de forma consistente, com um caminho só por gesto.
- **Fluxo desejado (desktop):** combobox filtra (chips) → "+" ao lado abre o formulário de nova atividade com o recorte → ícone de calendário abre o diálogo de "Link de import" (mantém nomear → copiar → revogar).
- **Fluxo desejado (mobile):** combobox filtra → FAB abre o drawer → ações: "Nova atividade", "Link de import", "Planejar giro" (as existentes de lista permanecem).
- **Anti-goals de produto:** manter a criação inline por clique no slot (C91) e o fluxo de giro (compositor) intactos; não virar um header de segundo nível com stack de sub-nav.

### Esboço de fluxo (C)

```text
desktop: [header app: título agenda … AI chat][Link de import][notif.]   [toolbar: combobox][carrinho: giro][+ nova atividade]
mobile : [top bar app: título agenda … Link de import/FAB][notif.]  + FAB → drawer [Nova atividade][Link de import][Planejar giro]
```

## Objetivo e aceite

- Os 3 filtros (Município, Tag, Deputado presente) ficam **num combobox único** com chips removíveis e "Limpar" (chassis omnibox), substituindo os seletor­es nativos e o botão "Limpar filtros".
- **Toolbar da página (desktop):** `[combobox] [ícone carrinho: Planejar giro] [ícone "+": Nova atividade]` — decisão de produto confirmada no gate (`combobox→giro→+`).
- **"Link de import" no header do app (desktop), não na toolbar:** vira **botão-ícone na barra superior** (`CampaignDesktopHeader`), no cluster à direita onde já ficam o botão do Sollinha/AI chat e o de notificações — **agenda-contextual** (só aparece na rota `/campanha/agenda`). O diálogo nomear→copiar→revogar permanece igual.
- **Mobile:** nenhum botão de criação no corpo da página; "Nova atividade" e "Link de import" como ações rápidas no drawer do FAB (com o filtro atual); "Link de import" abre o mesmo diálogo como **sheet** (decisão confirmada no gate).
- O estado do filtro segue refletido na URL (padrão de navegação das listas); reload e share continuam consistentes.
- Sem regressão: criação inline no slot (C91), giros, revogação de feeds, leader lockdown.

## Dados (intenção)

- **Vou apresentar dados?** Não (filtro = navegação/URL, não apresentação de dados).
- **Decisões desbloqueadas:** "vejo/dou manutenção ao recorte da agenda com um gesto só".
- **Forma:** adiada (chips/sugestões do omnibox já é o padrão do repo).

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/ActivityAgendaFilters.tsx` (vira o adaptador do combobox), `src/utilities/activityOmnibox.ts` (precedente de chips/sugestões para o estado de agenda — reuso ou adaptação), `src/components/campaign/shared/CampaignListOmnibox.tsx` (chassis), `src/app/(campaign)/campanha/(app)/agenda/page.tsx` (toolbar `[combobox][giro][+]`), e o registro de ações rápidas (`src/lib/activityQuickActions.ts` / `campaignQuickAction*`) para "Link de import" no mobile.
- **Header do app (desktop):** o "Link de import" entra como controle **agenda-contextual** em `src/components/campaign/shell/CampaignDesktopHeader.tsx` (cluster à direita, ao lado de `CampaignAIHeaderButton` e do sino). O mesmo mecanismo de chrome por-página usado hoje pelo título (`CampaignPageChromeDisplay`/contexto) serve de pista para o slot contextual — o executor decide o encaixe menos invasivo (slot no header vs renderizar no shell pela rota).
- **Precedente a olhar:** B127/B138 (omnibox nas listas), B126/B132 (FAB de ações rápidas), B120 (combobox mobile em municípios).
- **Risco de acoplamento:** o header do app é **compartilhado por todas as rotas** `/campanha` — qualquer controle novo precisa ser agenda-contextual para não poluir as demais telas; coordenar com C95 (mesmo header, mesmo slot). C91 inline create só adiciona overlay; sem conflito de intent. Coordenar com C92/C93 (dialog de feed) para o ícone não ser porta morta.

## Dependências

- C92 (soft — o ícone de feeed só vale com criação funcionando).

## Fora de escopo

- Gerar feed sem filtros → **C93** (o ícone reflete apenas o estado habilitado/desabilitado do momento).
- Redesign do calendário em si (C15) e do overlay de criação inline (C91).
- Mudanças no compositor de giro.

## Rabbit holes de produto

- **Combobox vira "omnibox de busca global" da agenda.** Se alguém "só completar": busca por texto livre, presets de janela, múltiplos municípios simultâneos. **Corte neste item:** Município (único) + Tag + Deputado presente, como hoje; sem busca textual nem multi-seleção.
- **Header vira barra de navegação.** Manter no máximo 3 controles + o botão de giro secundário; nada de stacks de sub-nav.

## Questões em aberto (produto)

- **"Planejar giro" no desktop?** **Decidido no gate:** vira **ícone carrinho**, na toolbar, entre o combobox e o "+" (ordem `[combobox][giro][+]`). Fora de questão.
- **"Deputado presente" como chip?** **Decidido no gate:** chip bool no combobox. Fora de questão.
- **Mobile: rápida de feed mantém o diálogo atual?** **Decidido no gate:** sim, como **sheet**. Fora de questão.
- **Onde mora o "Link de import" desktop?** **Decidido no gate:** no **header do app** (cluster à direita, junto do AI chat/notificações), agenda-contextual — não na toolbar. Fora de questão.
- **Chip de município permite trocar sem remover?** **Opções:** A) com sugestões marcando o ativo ao reabrir | B) só remove→re-adiciona. **Recomendação:** indistinguível ao usuário fora do detalhe; deixa o executor escolher a mecânica barata que satisfaz (A). _(assumido — validar)_
- **Ordem no header do app (desktop):** **Decidido no gate** — `[título …][Semana ▾ (C95)][Link de import][Notificações][IA]`. Fora de questão.

## Referências

- GitHub Issue #392 (C16 — sync/feed), #390 (C15 — agenda), #428 (C91 — criar inline)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c94-ui-draft.canvas.tsx`
- Precedente: `CampaignListOmnibox` (B127), `atividades-omnibox-presets-busca` (B138), FAB de ações rápidas (B126/B132)
