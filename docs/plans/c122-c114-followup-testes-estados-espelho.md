# C122 — C114 follow-up: cobertura de testes dos estados do espelho Google

Status: rascunho
Atualizado em: 2026-08-11
Issue: #<pendente>
Priority: P3
Model: composer-2.5
Impeccable: B — superfícies existentes (pill + diálogo da agenda); sem fluxo novo
Appetite: ~0,5 dia eng — fill-in de cobertura, sem mudança de comportamento

## Intenção

O C114 entregou o espelho Teqo→Google com três estados derivados na UI
(sincronizado / pausado / não configurado / desativado), mas a cobertura de
testes parou no estado `not-configured` (e2e) e no engine (int com stub). O
que o /simplify deixou de fora, em um lote:

- **S14 — teste de componente dos chromes:** o auto-retry do
  `AgendaGoogleSyncChrome` (uma tentativa por mount quando `paused`) e o
  rótulo da pill por status não têm nenhum teste; o repo tem precedente
  jsdom+RTL (`wizardExpectedVotesStep.unit.spec.tsx`).
- **S17 — e2e dos outros estados:** `disabled` (Reativar), `paused` (erro +
  link "Abrir Google Calendar") e `synced` (link block + copiar + instruções)
  nunca exercitados; o FAB mobile ("Agenda da Campanha") também não tem pin.
- **S18 — int da action de desativar:** `setGoogleCalendarSyncDisabled`
  (grava `disabledAt`, re-enable limpa e o hook da config re-sincroniza — D7)
  sem teste.

## Aceite

- Unit (RTL): pill renderiza o rótulo/estado correto por status; auto-retry
  dispara UMA vez quando `paused` e nenhuma quando `synced`/`not-configured`.
- E2E: dialog nos estados disabled/paused/synced (seed do doc
  `googleCalendarSync` + env key fake — estados determinísticos, sem rede) e
  FAB mobile abrindo o sheet.
- Int: disable → `disabledAt` gravado; re-enable → limpo e o
  `googleCalendarSyncConfigHook` dispara a reconciliação (spy/observável via
  stub) — sem tocar na rede.

## Direção no codebase

- `src/components/campaign/activity/AgendaGoogleSyncChrome.tsx` +
  `GoogleCalendarSyncDialog.tsx` (alvos do teste de componente).
- `src/app/(campaign)/campanha/actions/googleCalendarSync.ts` (alvo do int).
- `tests/unit/`, `tests/int/`, `tests/e2e/` — precedentes:
  `wizardExpectedVotesStep.unit.spec.tsx`, `googleCalendarSync.int.spec.ts`,
  `campaignAgendaGoogleSync.e2e.spec.ts`.

## Fora de escopo

- Serialização de passes concorrentes (advisory lock no estado) — defer:
  self-healing (o próximo pass recobre), gatilho: reclamação de pill preso em
  `paused` ou o C115.
- Teste dos estados no modo mobile do pill na linha de filtros (decisão C114:
  FAB é a superfície mobile).
- Refactor do chrome de instruções addbyurl (2 call sites) — defer, gatilho:
  3ª superfície de calendário (C115).
