# Post-mortem: clique no dia do calendário pelo nome acessível derruba o verify do deploy

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-10-01                                                                                                 |
| Severidade          | alta (bloqueou o deploy do main; CI vermelho — sem impacto em produção, o `verify` roda antes de publicar) |
| Ambiente            | CI (job `verify` do Deploy no GitHub Actions)                                                              |
| Issue(s)            | #1406 (auto-unblock; não fechar — o wrapper cuida) + #1401 (primeira detecção, fechada sem fix)            |
| PR do fix           | a preencher (este PR) — número registrado por commit de follow-up (precedente `59a6480d`)                  |
| Detectado por       | CI (deploy run vermelho) / wrapper auto-unblock                                                            |

## Timeline

| Momento                 | Data/hora                     | Evento                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável         | 2026-08-09                    | C104 (`ea700e31`) criou o picker de término com data fixa (`/17 de agosto de 2026/`).                                                                                                                                                                                                                                                                                                              |
| Fragilidade latente     | 2026-08-13                    | C134 (commit `fe0a7999`) passou a derivar hoje + 1, mas manteve o clique pelo nome acessível — a fragilidade só dispara quando hoje + 1 cai em dia 01–09 do mês.                                                                                                                                                                                                                                  |
| Detecção 1              | 2026-10-01 04:44–05:02 UTC    | run `36816518055` (commit `20d3781e`, docs(C240), docs-only), job `verify`, passo "E2E tests (full suite, single job, 4 workers)" falhou: C104 falhou nas 3 tentativas (mesmo strict mode violation); 2 failed (C104 + `campaignSpeechAcervo` C222, que não reapareceu no run seguinte), 3 flaky, 326 passed. Issue #1401 aberta (single-flight) e fechada em 2026-10-01T15:38:43Z sem PR de fix. |
| Detecção 2 / do disparo | 2026-10-01 ~15:40 / 16:08 UTC | run `36820002374` (commit `ca843fb4`, attempt 2 ~15:40Z), passo do `verify` falhou às 16:08Z: C104 falhou nas 3 tentativas; 1 failed, 7 flaky, 323 passed. Issue #1406 aberta (auto-unblock).                                                                                                                                                                                                     |
| Bloqueio do deploy      | 2026-10-01                    | O run vermelho segurava a lane; os deploys de `77e7b0ef` (run `36886280567`) e `cd4942d9` (run `36887968057`) foram preflight-skipped.                                                                                                                                                                                                                                                            |
| Correção implementada   | 2026-10-01                    | Worktree `fix/falha-do-job-verify-do-deploy-github-actions-desbloqueie`.                                                                                                                                                                                                                                                                                                                          |
| Correção mergeada       | a preencher                   | a preencher (este PR).                                                                                                                                                                                                                                                                                                                                                                            |
| Deploy                  | a preencher                   | a preencher.                                                                                                                                                                                                                                                                                                                                                                                      |
| Verificado em prod      | não se aplica                 | Bug de CI/teste; o comportamento público não muda. A confirmação é o `verify` verde no run de deploy pós-merge; produção depende do approve humano (não aprovado por esta sessão).                                                                                                                                                                                                                |

## O bug

O passo de e2e full do `verify` falhava deterministicamente no teste `[campaign] › tests/e2e/campaignActivity.e2e.spec.ts › Agenda — calendário operacional › cria compromisso "Todo o dia" no slot, sem horário e com faixa no calendário (C104)`: ao abrir o date picker de "Término" e clicar no dia de hoje + 1, o Playwright abortava com `strict mode violation: ... getByRole('button', { name: '2 de Outubro de 2026' }) resolved to 3 elements` (dias 02, 12 e 22 de outubro). O CI ficou vermelho no run de 2026-10-01 e os merges seguintes tiveram o deploy preflight-skipped — o deploy do main ficou bloqueado. Nenhum impacto em produção: o `verify` roda antes de publicar. **Sintoma — não a causa.**

## Causa-raiz

Origem `file:line` pré-fix: `tests/e2e/campaignActivity.e2e.spec.ts:355` (`endPicker.getByRole('button', { name: endDayLabel }).click()`), com `endDayLabel` montado em `:352` ("2 de Outubro de 2026") a partir de `civilDatePlusDays(formatBahiaCivilDate(new Date()), 1)` (`:348`).

O accessible name real do botão vem do react-day-picker com locale pt-BR: `"sexta-feira, 2 de outubro de 2026"` (date-fns `PPPP`); `src/components/ui/Calendar.tsx:167` também expõe `data-day="02/10/2026"`. O matcher de nome do Playwright é substring + case-insensitive por default; `"2 de outubro de 2026"` é substring de `"12 de outubro de 2026"` e `"22 de outubro de 2026"` (mesmo grid). `exact: true` não serve (o nome tem o dia da semana). O bug só dispara quando hoje + 1 cai em dia 01–09; em outubro/2026 caiu em 02.

### 5 whys

1. Por que o `verify` quebrou? Porque o clique usou o nome acessível.
2. Por que o teste clicava pelo nome? Porque herdou esse clique do C104 original e o manteve no C134, que só trocou a data fixa por hoje + 1.
3. Por que o locator não usou o contrato estável? Porque `data-day` já existia no Calendar, mas não havia helper que o montasse — role + name parecia o locator "semântico" correto.
4. Por que passou nos runs anteriores? Porque a fragilidade é dependente do calendário (só dias 1–9) e o alvo caiu nessa faixa apenas em 2026-10-02.
5. Por que nenhuma camada a montante pegou? Porque unit/int não veem locators de DOM e o e2e de PR é `selected` (OPS72) — a classe só é pega no verify full do deploy.

## Correção

Sem mudança de schema/produto — o defeito era do locator do spec:

- `tests/e2e/helpers/agendaPeriodLabels.ts:46`: novo helper `calendarDaySelector(civilDate)` → `[data-day="DD/MM/YYYY"]` (o contrato do `Calendar.tsx:167`), aditivo (funções existentes intocadas).
- `tests/e2e/campaignActivity.e2e.spec.ts:357`: o C104 clica `endPicker.locator(calendarDaySelector(endCivilDate))`; comentário atualizado.
- `tests/unit/e2eNavigationConventions.unit.spec.ts:96`: guard miss #55 que varre todos os `tests/e2e/**/*.e2e.spec.ts` e falha o build em clique de célula de dia por nome (`*DayLabel` ou literais/templates com " de " e ano), + teste do contrato do helper (zero-padded) em `:119`.
- `docs/TESTING.md:17`: parágrafo "Calendar day-cell clicks (miss #55)", ao lado do miss #54.

Resolve a causa: o clique passa a mirar o atributo de contrato (inequívoco por construção) em vez do texto, e a suposição antiga ("clicar pelo nome é seguro") deixa de ser aceita sem falhar um teste.

## Verificação

- Sem o fix: repro local em dev (`env -u CI pnpm test:e2e --no-deps --project=campaign -g "Todo o dia"`) falhou exatamente com o strict mode violation (3 elementos: data-day 02/10, 12/10, 22/10) em 2026-10-01; no CI falhou nas 3 tentativas (runs `36816518055` e `36820002374`).
- Guard de regressão: com o spec antigo (stash) a suíte `tests/unit/e2eNavigationConventions.unit.spec.ts` falha com offender `tests/e2e/campaignActivity.e2e.spec.ts:355`; com o fix, 4 passed.
- Com o fix: e2e C104 1 passed (1.4m, dev); `pnpm gate:fast` verde (eslint `--max-warnings=0`, `tsc --noEmit`, unit 458 arquivos / 5.071 testes).
- Flaky do run `36820002374` (7, todos passaram no retry; sem relação causal com o diff): `frontendShareLink` (kill-switch, 404 pós-republish), `campaignAgendaGoogleSync` (500 `POST /campanha/agenda`), `campaignBottomNav` (clique não navegou), `campaignMunicipalities` (apoiador não visível), `campaignPeople` (filtro não aplicado na URL), `campaignTerritoriesHttp` (cleanup com transação abortada), `frontendJingles` (404 de mídia). O run `36816518055` teve 3 flaky.
- CI: a preencher (PR).
- Prod: não se aplica (bug de CI/teste).

## Prevenção

| Estratégia                                                                                             | Custo  | Estado                                     |
| ------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------ |
| Helper `calendarDaySelector` como contrato único para clicar célula de dia                             | barata | implementada neste PR                      |
| Guard miss #55 no `e2eNavigationConventions` (varre specs futuros e auto-testa o contrato zero-padded) | barata | implementada neste PR                      |
| Doc em `docs/TESTING.md` ("Calendar day-cell clicks (miss #55)")                                       | barata | implementada neste PR                      |
| Page Object/helper de calendário completo                                                              | cara   | documentada — não implementada neste fluxo |
| Lint AST para locators (hoje o guard é regex por linha)                                                | cara   | documentada — não implementada neste fluxo |
| `failOnFlakyTests`/quarentena (hoje `retries: 2` sem `failOnFlakyTests`, `playwright.config.ts:119`)   | cara   | documentada — não implementada neste fluxo |
| Estabilizar os flaky listados (causas próprias)                                                        | cara   | documentada — não implementada neste fluxo |

**Estratégia implementada:** os cliques de célula de dia passam a usar um contrato único (`data-day` via helper), um guard de convenção varre todos os specs e falha o build no padrão antigo (e auto-testa o contrato), e a convenção está documentada no `docs/TESTING.md`. A varredura não achou outro spec com o mesmo padrão.

**Estratégia documentada (cara):** Page Object/helper de calendário completo; lint AST para locators; `failOnFlakyTests`/quarentena (`playwright.config.ts:119` roda `retries: 2` sem `failOnFlakyTests`); e estabilizar os flaky listados, que têm causas próprias e ficam como débito separado.

## Lições

- Locator "semântico" por texto pode ser menos estável que um atributo de contrato; `data-day` já existia e não foi usado.
- O C134 removeu o hardcode de data mas manteve o matcher dependente do calendário: remover a data fixa não basta se o locator continua ambíguo.
- O e2e de PR é `selected` (OPS72) e o verify full do deploy é o primeiro a pegar a classe — por isso o vermelho só apareceu no deploy.
- A falha de hoje degradou o CI por ~11h e bloqueou a lane: a segunda detecção (#1406) ocorreu porque a primeira (#1401) foi fechada sem PR de fix (a decisão da primeira sessão é não apurada).
