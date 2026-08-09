# B181 — Agenda: remover o aviso "Nenhum compromisso nesta janela e neste filtro"

Status: rascunho
Atualizado em: 2026-08-09
Issue: #480
Priority: P2
Model: composer-2.5 / deepseek-v4-flash-high
Impeccable: B — remoção de elemento na tela da agenda (`/campanha/agenda`)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b181-ui-draft.canvas.tsx
Appetite: ~0,5 dia eng; um outcome verificável — janela vazia na agenda sem o aviso ocupando espaço
Responsável: —

## Intenção

Na `/campanha/agenda`, quando a janela carrega sem compromissos, a página mostra um bloco
"Nenhum compromisso nesta janela e neste filtro" com um botão "Criar atividade" logo acima do
calendário. Ele só ocupa espaço — principalmente no mobile — e é redundante: a criação já é
acessível por clique num slot do calendário (C91) e pelo FAB de ações rápidas (C94). Queremos
remover esse bloco por completo.

## Persona e fluxo

- **Persona / contexto:** staff (coordenador / assessor / candidato) na agenda, mobile ou
  desktop, navegando por uma janela sem compromissos.
- **Job principal:** ver o calendário da janela sem ruído visual acima dele.
- **Fluxo desejado:** abre `/campanha/agenda` numa janela sem compromissos → vê o calendário
  começando limpo na primeira linha → se quiser criar, clica num slot, usa o botão existente ou
  o FAB — exatamente os caminhos de hoje.
- **Anti-goals de produto:** não substituir o aviso por outro elemento (callout, ilustração,
  empty-state novo); não mudar nenhuma affordance de criação; não tocar em outros empty-states.

### Esboço de fluxo (B)

```text
[agenda com janela vazia] → [sem aviso; calendário começa no topo] → [criação pelos caminhos atuais: clique no slot / botão existente / FAB]
```

## Objetivo e aceite

- Janela sem compromissos na agenda **não exibe mais** "Nenhum compromisso nesta janela e neste
  filtro" nem o botão "Criar atividade" — em nenhuma largura de tela (mobile incluso).
- O espaço antes ocupado pelo bloco some: o calendário começa no topo da área, sem "buraco".
- Sem regressão: avisos de carregando e de erro permanecem; criação por clique no slot (C91),
  FAB de ações rápidas (C94) e demais botões de criar atividade intactos.
- Nada novo entra na tela por causa deste item.

## Dados (intenção)

- **Vou apresentar dados?** Não — remoção de elemento de estado vazio; nenhuma métrica ou
  série nova.
- **Decisões desbloqueadas:** N/A.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/activity/ActivityAgenda.tsx` (bloco do aviso na
  faixa ~306–313 e o que ficar órfão com ele, ex. `emptyHref`/`buildActivityCreateHref` — knip
  valida); rota `src/app/(campaign)/campanha/(app)/agenda/page.tsx` (não deve mudar).
- **Precedente a olhar:** `docs/plans/agenda-criar-evento-inline.md` (C91 — criação inline no
  calendário), `docs/plans/c94-agenda-filtro-combobox-header-do-app-link-acoes-no-fab.md` (C94 —
  FAB de ações rápidas).
- **Risco de acoplamento:** o bloco compartilha o helper de link de criação com outros pontos;
  remover o que ficar órfão junto. Não tocar no texto interno do FullCalendar (`noEventsText`,
  vista "Lista") nem nos estados de loading/erro do mesmo componente.

## Dependências

- Nenhuma.

## Fora de escopo

- Texto interno do FullCalendar na vista "Lista" ("Nenhum compromisso nesta janela") — outra
  superfície (ver questão em aberto).
- Qualquer outro empty-state do `/campanha` (ex. listas de municípios/apoiadores).
- Mudança nas affordances de criação (já cobertas por C91/C94).

## Rabbit holes de produto

- **"Já que estou aqui, melhoro o empty state".** Se alguém "só completar": substituir o aviso
  por um callout/ilustração/empty-state novo, ou redesenhar o topo da agenda. **Corte neste
  item:** somente remover o bloco; nada novo entra na tela.

## Questões em aberto (produto)

- **O texto interno do FullCalendar na vista "Lista" ("Nenhum compromisso nesta janela") também
  sai?** **Opções:** A) fica — preenche a lista vazia, não é header e não rouba espaço no mobile
  | B) sai junto. **Recomendação:** **A** — o pedido é o bloco acima do calendário; o texto
  interno é contexto in-loco da vista lista. _(assumido — validar)_

## Referências

- GitHub Issue #480 (B181 — agenda: remover o aviso de janela vazia)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b181-ui-draft.canvas.tsx`
- `src/components/campaign/activity/ActivityAgenda.tsx` — bloco do aviso (~306–313), `noEventsText` (~343)
- `src/app/(campaign)/campanha/(app)/agenda/page.tsx` — página que monta a agenda
- `docs/plans/agenda-criar-evento-inline.md` (C91) e `docs/plans/c94-agenda-filtro-combobox-header-do-app-link-acoes-no-fab.md` (C94)
