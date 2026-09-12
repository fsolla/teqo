# Post-mortem: fixture B196 com data fixa vencida bloqueia o verify do deploy

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| Data do post-mortem | 2026-09-12                                                                           |
| Severidade          | alta (bloqueou o deploy; nenhum dado/PII afetado; produção seguiu no build anterior) |
| Ambiente            | CI                                                                                   |
| Issue(s)            | sem Issue (fluxo `/bug-fix`; relacionada: #882, flake B176 — não é este bug)         |
| PR do fix           | #943                                                                                 |
| Detectado por       | teste (E2E do job `verify` do `deploy.yml`)                                          |

## Timeline

| Momento            | Data/hora                  | Evento                                                                                                                                                                                                                                                                                                                   |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Início provável    | 2026-08-11                 | commit `02abd7de` (B196) cria a fixture com `startAt: '2026-09-01T13:00:00.000Z'` hardcoded; o PR CI de agosto era verde porque 01/09 ainda era futuro — a data venceu em 02/09/2026                                                                                                                                     |
| Detecção           | 2026-09-11 22:04–22:24 UTC | run 34652323456 do `deploy.yml` (job `verify`, main `3aad110e`): o E2E `tests/e2e/campaignMunicipalities.e2e.spec.ts:1492` falha nas 3 tentativas (11.8s / 19.4s / 18.4s) em `:1529` (`Expected: > 0`, `Received: 0`) e o job `deploy homeserver (teqo-1313)` fica skipped — o main não vai para produção nesse dispatch |
| Correção mergeada  | 2026-09-12                 | commit `e846c916` no PR #943 — CI em execução; merge pendente no momento da escrita                                                                                                                                                                                                                                      |
| Deploy             | pendente                   | dispatch manual do `deploy.yml` pelo humano após o merge                                                                                                                                                                                                                                                                 |
| Verificado em prod | pendente                   | confirmação do humano após o deploy                                                                                                                                                                                                                                                                                      |

## O bug

O deploy manual de 2026-09-11 não chegou a produção: o job `verify` do `deploy.yml` falhou no E2E e o job `deploy homeserver (teqo-1313)` foi skipped — o código de main (`3aad110e`) não foi para produção nesse dispatch. A falha foi o teste `[campaign] tests/e2e/campaignMunicipalities.e2e.spec.ts:1492` "chassis elsewhere: the actions row keeps its breathing room and the bar glues on scroll (atividades)", que falhou nas 3 tentativas (11.8s / 19.4s / 18.4s) em `:1529` com `expect(received).toBeGreaterThan(expected)`, `Expected: > 0`, `Received: 0` ("Timeout 10000ms exceeded while waiting on the predicate"). No cenário do teste, `/campanha/atividades` renderizava "Nenhuma atividade encontrada", o scrollport não tinha overflow e a asserção nunca passava. Dos demais testes E2E, 198 passaram e 6 ficaram flaky (campaignActivity:131, campaignLeaderships:59, campaignMunicipalities:650, campaignPeople:27, campaignPeople:53, campaignSollinhaContext:115), todos aprovados no retry — classe de latência sob 4 workers, sem relação com este bug. **Sintoma — não a causa.**

## Causa-raiz

A fixture do teste B196 (commit `02abd7de`, 2026-08-11) criava 5 atividades com `startAt: '2026-09-01T13:00:00.000Z'` hardcoded. A aba default `proximos` filtra `status = confirmado` **e** `startAt >= now` (`src/utilities/activityUi.ts:408-409` e o `where` em `:442-444`), com `now = new Date()` injetado pela página (`src/app/(campaign)/campanha/(app)/atividades/page.tsx:57,65`). A partir de 02/09/2026 os fixtures ficaram no passado → `result.docs = []` → empty state → scrollport sem overflow → a asserção `scrollHeight - clientHeight > 0` recebia 0. O deploy de 27/08 (run 33074305879) passou porque 01/09 ainda era futuro, e o PR CI de agosto também era verde no instante da autoria.

5-whys:

1. **Por que o teste falhou?** A lista de atividades veio vazia e o scrollport não rolava — a data fixa da fixture venceu.
2. **Por que a data venceu?** A fixture tratava o relógio como dado estático: `2026-09-01` hardcoded, sem derivar de `now`.
3. **Por que o verde do PR não pegou?** O resultado refletia o instante da execução (agosto), não uma invariante temporal — o teste só passava enquanto a data estivesse no futuro.
4. **Por que não havia proteção?** Não existia helper/convenção de "start futuro" no fixture layer E2E nem gate de lint contra ISO literal em fixtures.
5. **Por que a classe inteira não estava coberta?** Faltava um contrato de fixture invariante no tempo — o padrão relativo a `now` já existia em specs de agenda (`tests/e2e/campaignActivity.e2e.spec.ts:136-137`), mas não era exigido.

**Evidência:** RED reproduzido localmente em 2026-09-12 (mesma linha `:1529`, `Received: 0`) e também pelo verificador independente via stash; GREEN com o fix (3 passed = 2 setups + alvo).

## Correção

- Commit `e846c916` (PR #943), em `tests/e2e/campaignMunicipalities.e2e.spec.ts`: o `startAt` da fixture B196 passa a derivar de hoje +7 dias no tempo civil da Bahia (`civilDatePlusDays(formatBahiaCivilDate(new Date()), 7)` + `parseBahiaDateTimeInput`, mesmo padrão de `tests/e2e/campaignActivity.e2e.spec.ts:136-137`).
- O poll do scrollport ganha `{ timeout: 30_000 }` — orçamento da classe de latência B196 já documentada no arquivo sob 4 workers.
- Prevenção barata: regra `no-restricted-syntax` em `eslint.config.mjs` (escopo `tests/e2e/**/*.{ts,tsx}`, selector em propriedades `start*`/`end*`/`date*` com literal `/20\d\d-\d\d-\d\dT/`) e teste em `tests/unit/eslintConventions.unit.spec.ts` (RED sem a regra / GREEN com; 13 testes).

Resolve a causa: a fixture deixa de depender de uma data absoluta e o guard pega a classe inteira na autoria. Sem migration, sem mudança de access.

## Verificação

- Teste de regressão: `tests/e2e/campaignMunicipalities.e2e.spec.ts:1492` "chassis elsewhere… (atividades)" — falha sem o fix (RED local em 2026-09-12, mesma linha `:1529`, `Received: 0`; reproduzido também pelo verificador independente via stash) e passa com o fix (GREEN 3 passed = 2 setups + alvo)
- Suíte: `pnpm gate:fast` verde (lint + typecheck + 2687 unit); `pnpm lint` completo verde (zero falso positivo da regra nova); spec completo `campaignMunicipalities.e2e.spec.ts` 27 passed / 2 failed — B176 (flake conhecido, Issue #882) e B200 (falha determinística só em dev local, `87 > 48`, reproduzida também no estado pré-fix e aprovada no verify real de 2026-09-11 em prod-mode)
- CI: em execução no PR #943
- Prod: pendente — deploy manual pendente de dispatch do humano após o merge; confirmação do humano pendente

## Prevenção

| Estratégia                                                                                                                            | Custo  | Estado                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| Fixture B196 deriva `startAt` de hoje +7 dias no tempo civil da Bahia + poll do scrollport com 30s                                    | barata | implementada agora (commit `e846c916`, PR #943)                      |
| Regra ESLint `no-restricted-syntax` banindo ISO literal em propriedades `start*`/`end*`/`date*` de `tests/e2e` + teste unit RED/GREEN | barata | implementada agora (commit `e846c916`, PR #943)                      |
| Injeção de relógio no fixture layer E2E (Playwright clock ou `now` do server) para fixtures determinísticas no tempo                  | cara   | documentada — não implementada neste fluxo                           |
| Canário periódico da aba default `proximos`                                                                                           | cara   | documentada — não implementada neste fluxo                           |
| Regra ampla "zero ISO literal em `tests/e2e`" com allowlist por arquivo                                                               | cara   | documentada — não implementada neste fluxo; candidata a Issue futura |

**Estratégia implementada:** fixture deriva o `startAt` de `now` (fim da data absoluta), poll do scrollport com o orçamento de 30s da classe de latência B196 e guard ESLint escopado a `tests/e2e` que bane ISO literal em campos de data, pinado por teste unit RED/GREEN — a classe inteira passa a ser barrada na autoria, não no calendário.

**Estratégia documentada (cara):** injeção de relógio no fixture layer E2E (Playwright clock ou `now` do server) para fixtures determinísticas no tempo; canário periódico da aba default `proximos`; regra ampla "zero ISO literal em `tests/e2e`" com allowlist por arquivo. Candidatas a Issue futura — não implementadas neste fluxo.

## Lições

- **"Verde no instante" ≠ invariante no tempo:** o PR de agosto e o deploy de 27/08 passaram; ambos só provavam que a data ainda era futura naquele dia. Teste com data absoluta tem prazo de validade embutido.
- **Fixture relativa ao relógio precisa derivar de `now`:** o padrão já existia nos specs de agenda — a fixture B196 ficou para trás. O conserto não foi "atualizar a data", foi remover a data absoluta.
- **Guard de autoria barato pega a classe inteira:** a regra ESLint escopada a `tests/e2e` bane ISO literal em campos de data no momento de escrever o teste, sem esperar o calendário virar.
