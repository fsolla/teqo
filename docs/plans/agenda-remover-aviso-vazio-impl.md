# Impl: B181 — Agenda: remover o aviso "Nenhum compromisso nesta janela e neste filtro"

Status: aprovado
Atualizado em: 2026-08-09
Issue: #480
Intenção: docs/plans/agenda-remover-aviso-vazio.md
Appetite restante: herdado (~0,5 dia eng; item de ~20 min de diff)

## Leitura da intenção

- **Outcome:** janela sem compromissos na `/campanha/agenda` não exibe mais o bloco
  "Nenhum compromisso nesta janela e neste filtro" + botão "Criar atividade", em nenhuma
  largura de tela; o calendário começa no topo da área; nada novo entra na tela.
- **O que NÃO negociar:** não substituir o aviso por outro empty-state; não mudar affordances
  de criação (slot click C91, FAB C94, botão dos filtros); loading e erro permanecem; texto
  interno do FullCalendar (`noEventsText`, vista "Lista") fica (questão em aberto A).
- **O que reavaliar:** a intenção previa que `buildActivityCreateHref` pudesse ficar órfão —
  **não fica**: `ActivityInlineCreate.tsx:111` ("Mais detalhes") e `ActivityAgendaFilters.tsx:144`
  (botão "Nova atividade" desktop) seguem usando. Só o uso local em `ActivityAgenda` sai.

## Abordagem recomendada

Remoção cirúrgica de um bloco JSX + seus órfãos locais no único componente que o renderiza.
Sem mudança em `activityUi.ts`, sem migration, sem mudança de acesso.

**Opções consideradas:** A | B
**Recomendação:** A — remover só o bloco no `ActivityAgenda.tsx` e os imports locais que
ficam órfãos. É o menor diff que mantém o aceite; os caminhos de criação permanecem todos.
**Rejeitadas:** B — remover também `noEventsText` do FullCalendar (vista "Lista"). A intenção
recomenda manter (opção A da questão em aberto): é contexto in-loco da lista vazia, não um
header que rouba espaço no mobile, e sair dela expandiria o escopo deste chore sem pedido.

### Componentes / mudanças

- **`ActivityAgenda`** (`src/components/campaign/activity/ActivityAgenda.tsx`):
  - remover o bloco `!isLoading && !loadError && events.length === 0` (linhas 306–313);
  - remover `const emptyHref = buildActivityCreateHref(state)` (linha 277) — órfão;
  - remover `import Link from 'next/link'` (linha 21) — único uso era o `<Link>` do bloco;
  - remover `buildActivityCreateHref` do import de `@/utilities/activityUi` (linha 42);
  - manter `Button` (usado no bloco de erro, linha 295), `activity-agenda-notice` CSS
    (loading 287 + erro 293) e `noEventsText="Nenhum compromisso nesta janela"` (343).
- **`activityUi.ts`** (`src/utilities/activityUi.ts`): **sem mudança** —
  `buildActivityCreateHref` continua com 2 consumidores.
- **`ActivityAgendaFilters.tsx` / `ActivityInlineCreate.tsx`**: sem mudança — os botões de
  criação que o aceite exige manter.
- **Migration:** sem migration (nenhuma coleção/global/campo tocado).
- **Access / Consent:** sem mudança.
- **UI:** Impeccable A — remoção de elemento; nenhum shape/craft necessário. A classe
  `.activity-agenda-notice` permanece no CSS porque loading/erro continuam usando-a.

## Fases verificáveis

1. **Diff** — edição do `ActivityAgenda.tsx` (remoção do bloco + 3 órfãos de import).
2. **Teste de regressão** — novo `it` em `tests/unit/activityAgendaInteractions.unit.spec.tsx`:
   janela vazia (`loadEvents` → `[]`) não renderiza mais "Nenhum compromisso nesta janela e
   neste filtro" nem botão "Criar atividade", e o slot-click (C91) segue abrindo o inline
   create. Os testes existentes já renderizam com `[]`, então nenhum outro muda.
3. **Gates** — `pnpm gate:fast` (inclui tsc, lint, knip, ciclos, testes unit+int);
   `pnpm push` para fechar (inclui gates completos; knip valida que não sobrou órfão).

## Rabbit holes / Não escopo (engenharia)

- Não mexer no `noEventsText` (vista "Lista") — fora de escopo, questão em aberto A.
- Não "melhorar" o topo da agenda nem o empty-state da grade (`dayGrid`/`timeGrid` vazios
  mostram a grade vazia do FullCalendar — comportamento desejado, é o "calendário no topo").
- Não tocar em outros empty-states do `/campanha`.
- Não extrair nada para helper novo — remover é o oposto de abstrair.

## Riscos e mitigação

- **Órfãos de import/knip:** removidos no mesmo edit (`Link`, `buildActivityCreateHref`);
  `pnpm gate:fast`/knip confirma.
- **Regressão de affordance de criação:** nenhum botão de criação é removido — só o do
  aviso, que some junto com ele; filtros (desktop) e inline create (C91) intactos, ambos
  cobertos por testes existentes (unit + e2e).
- **Estado "janela vazia" no teste unitário:** o mock do FullCalendar já exercita `[]`;
  o novo `it` usa o mesmo mock sem mudança.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (janela vazia sem aviso; nada novo na tela)
- [ ] Invariantes AGENTS/engineering-standards (nenhum access/Consent/transação tocado)
- [ ] Testes de domínio previstos (unit) onde o comportamento visual muda
