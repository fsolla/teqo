# Agenda: compromisso "Todo o dia" na criação rápida

Status: rascunho
Atualizado em: 2026-08-09
Issue: #505
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe na superfície existente (sheet de criação inline da agenda, C91)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-13/canvases/plan-c104-ui-draft.canvas.tsx
Appetite: ~0,5 dia eng; um outcome verificável — um compromisso de dia inteiro se cria no sheet sem inventar horário
Responsável: —

## Intenção

Muitos compromissos da agenda duram o dia inteiro — congresso, viagem, evento de município, dia de gravação — e alguns duram **vários dias inteiros**. Hoje o sheet de criação só aceita horário e o usuário inventa "09:00–18:00", o que polui a agenda e engana quem lê. Queremos um toggle **"Todo o dia"** no formulário (entre o título e a data de início): ligou, os horários somem e ficam **só as datas** — início **e** término, que pode ser outro dia (vários dias inteiros) — e o compromisso aparece no calendário como **faixa de dia inteiro** — igual ao Google Calendar que a mesa já usa.

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor de campo planejando a semana; compromissos de dia cheio são comuns (eventos fora da base, viagens de vários dias).
- **Job principal:** registrar um compromisso que ocupa um ou mais dias inteiros sem precisar inventar um intervalo de horário.
- **Fluxo desejado:**
  1. Toca num slot vazio → sheet de criação abre.
  2. Alterna **"Todo o dia"** (entre o título e a data de início) → os seletores de horário somem; **início e término viram só data**; o término pode apontar para outro dia (vários dias inteiros).
  3. Preenche o resto (título, município…), salva → o compromisso aparece no calendário como **faixa de dia inteiro** (topo da visão de dia/semana).
  4. "Mais detalhes" leva ao formulário completo **preservando** a escolha todo-dia.
- **Anti-goals de produto:** não é recorrência nem semântica de timezone (granularidade de dia); não vira campo obrigatório nem afeta quem cria com horário; liderança não acessa a agenda (inalterado).

### Esboço de fluxo (B)

```text
[toca no slot] → [sheet] → título → alterna "Todo o dia"
  → Início vira só data · Término continua, como data (pode ser outro dia)
  → salvar → faixa de dia inteiro no calendário (sem horário)
```

## Objetivo e aceite

- O sheet de criação ganha um toggle **"Todo o dia"**, posicionado **entre o título e a data de início**.
- Com o toggle ligado: o campo de início mostra **apenas a data** (sem hora/minuto) e o campo de **término continua visível, também só data** — podendo ser **outro dia** (compromisso de vários dias inteiros).
- O compromisso salvo com "Todo o dia" aparece no calendário como **evento de dia inteiro** (faixa no topo da visão de dia/semana, sem horário impresso), ocupando todos os dias do intervalo.
- "Mais detalhes" leva ao formulário completo com a escolha todo-dia **preservada** (e, se o form completo tiver o toggle — ver questão em aberto —, editar depois não quebra o evento).
- Criar com horário continua funcionando exatamente como hoje.

## Dados (intenção)

- **Vou apresentar dados?** Não. `Dados: N/A` — o toggle é estado do formulário; a forma de guardar (flag vs horários de borda) fica para o plano de implementação.

## Direção no codebase (hipótese)

- **Áreas prováveis:**
  - `src/components/campaign/activity/ActivityInlineCreate.tsx` — toggle + campos condicionais (data-only quando ligado).
  - `src/components/campaign/activity/ActivityAgenda.tsx` (`toEventInput`, hoje fixa `allDay: false`) — o evento todo-dia precisa ser renderizado como faixa de dia inteiro.
  - Fluxo completo: `src/app/(campaign)/campanha/actions/activity.ts` (criação/edição) e `src/components/campaign/activity/ActivityForm.tsx` (se o toggle entrar no form completo), `src/lib/schemas/activity.ts` (validação).
- **Precedente a olhar:** `ActivityDateTimeField.tsx` (C97 — controle de data/hora; a data-only já é meio caminho), `agenda-criar-evento-inline.md` (C91), FullCalendar `allDay` (C15).
- **Risco de acoplamento:** a representação do todo-dia (flag vs 00:00–23:59) afeta o que o "Mais detalhes" e a edição veem — a escolha é do plano de implementação, mas o **aceite de produto** (preserva a escolha, edição não quebra) vale para qualquer caminho.

## Dependências

- Suave: **C103** (mesma superfície — sheet da criação; prefira C103 primeiro para o sheet estar usável no celular).

## Fora de escopo

- Recorrência de compromissos.
- Troca de modo no calendário (o seletor de vista C95 não muda).
- Tags/filtros → **C105**.

## Rabbit holes de produto

- **"Todo o dia vira semântica de timezone."** Se alguém "só completar": meia-noite, fusos, atrito com `endAt`. **Corte neste item:** granularidade de dia — horário nunca aparece com o toggle ligado; multi-dia é só o término em outra data.
- **"Toggle em todos os lugares de uma vez."** **Corte:** começa no sheet (pedido); o form completo entra só se a edição de eventos todo-dia ficar quebrada sem ele (ver questão em aberto).
- **"Todo-dia precisa de cor/ícone especial."** **Corte:** o calendário já diferencia pela posição (faixa no topo); sem identidade visual nova.

## Questões em aberto (produto)

- **O toggle vive também no formulário completo/edição?** **Opções:** A) só no sheet; editar um evento todo-dia mostra horário "00:00" (regressão de leitura) | B) o mesmo toggle no form completo (`/nova` e `/editar`), reusando o mecanismo do sheet. **Recomendação: B** — é o mesmo controle; evita evento todo-dia "quebrado" ao editar. _(assumido — validar)_
- **Prefill do slot com "Todo o dia" ligado?** **Opções:** A) o toggle nasce desligado e o usuário liga | B) slots de dia cheio (mês) abrem com ele ligado. **Recomendação: A** — comportamento previsível; o prefill do horário continua como está. _(assumido — validar)_
- **Término multi-dia, como funciona na prática?** **Opções:** A) término em data posterior = compromisso de vários dias inteiros (faixa contínua no calendário) | B) término sempre igual ao início (um dia só). **Recomendação: A** — pedido explícito do usuário no gate (pode ser mais de um dia inteiro); o término continua sendo só data. _(decidido no gate)_

## Referências

- GitHub Issue: — (a registrar)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-13/canvases/plan-c104-ui-draft.canvas.tsx`
- `src/components/campaign/activity/ActivityInlineCreate.tsx`, `ActivityAgenda.tsx` (`toEventInput`), `ActivityDateTimeField.tsx` (C97)
- Precedentes: `docs/plans/agenda-criar-evento-inline.md` (C91), `docs/plans/fullcalendar-agenda-campanha.md` (C15)
