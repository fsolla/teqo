# OPS83 — Desbloquear deploy: estabilizar os e2e do verify (falhas + flakes) sem reduzir cobertura; entregar deploy real

Status: rascunho
Atualizado em: 2026-08-24
Issue: #824
Priority: P0
Impeccable: A — N/A (sem UI)
Rascunho UI: N/A — sem UI
Appetite: ~2–3 dias eng; um outcome verificável (deploy real verde)
Responsável: —

## Intenção

"Deploy is failing. Investigate what is blocking deploy and create a plan to fix it. E2E tests being skipped or marked as Flaky — study them, figure out if the app is buggy and the test is getting a real issue or if the test has to be rewritten. Don't just stop testing, skip, mark as flaky or cover less surface. E2E tests should work. The final delivery must be a successful deploy."

Diagnóstico já estudado (conclusão de produto, não a lista de engenharia): a maioria das falhas são **races de teste** sob 4 workers (streaming RSC, convergência ISR da home, optimistic UI, feed iCal sem hermeticidade, locator não-escopado). Duas foram **bugs reais de app** (C142 gate `'writable'` no `/editar`; FAB sem `data-slot`) — já corrigidos em a97cd56f com unit pins; as classes pararam de falhar. **Nenhuma decisão de produto está em jogo**: o app em produção está correto; o bloqueio é a estabilidade da suíte.

## Persona e fluxo

- **Persona / contexto:** o operador humano que dispara o deploy manual (workflow_dispatch) e o agente de manutenção da suíte e2e.
- **Job principal:** conseguir publicar código em produção quando o `verify` estiver verde — e que o verde seja confiável.
- **Fluxo desejado:** dispatch do deploy → job `verify` roda a suíte full (incl. e2e full, 4 workers) → verde → job `deploy` executa no runner self-hosted do homeserver → app novo no ar (jorgesolla1313.com.br).
- **Anti-goals de produto:** não virar "remoção de cobertura"; não virar "relaxar retries/workers"; não virar corrida atrás de flake único sem classe.

## Objetivo e aceite

1. Um deploy manual a partir de main termina com `verify` verde e job `deploy` concluído — app novo no ar.
2. Suíte e2e full estável: 2 runs consecutivos de verify com zero `failed` e zero flaky recorrente nas classes estudadas (flakes rotativos contam como recorrência até desaparecer).
3. Nenhum teste pular/desaparecer: os 2 skips do campaignAgendaFeed são **removidos** (testes reescritos para rodar em prod mode); todo flake estudado vira reescrita (settle/poll/hermeticidade/escopo de locator), nunca `test.flaky`/remoção.
4. Bugs reais de app descobertos pela investigação são corrigidos com unit pins (precedente a97cd56f).

## Dados (intenção)

N/A — sem superfície de dados. O "dado" do aceite é o resultado do workflow (verde/vermelho por run) e a contagem de failed/flaky/skipped por run — baseline #15 (HEAD de main a2db543e): 1 failed + 7 flaky + 2 skipped + 1 did not run + 191 passed.

## Direção no codebase (hipótese)

Soft, não-vinculante — o impl plan decide:

- `tests/e2e/*.e2e.spec.ts` — classes estudadas: frontend:1413/781/1276/1337 (kill switch + home content), campaignMunicipalities:115/386/642 (stream, omnibox, advisor scopes), campaignPermissionProfile:85/101 (FAB), campaignNewsletter:222 (CTA scroll), campaignAgendaFeed:119 (C113), campaignDemandVisibility:62 (write do server), campaignLeaderships:59 (B34), campaignPeople:15/239/338 (stream), campaignSavedFilters:26 (strict-mode, #669), campaignActivity:131 (jornada longa).
- `tests/e2e/helpers/` (advisory lock 727001, `expectPostResponse`, settle `S:`, precedente B196 30s poll), `tests/e2e/fixtures/`, `playwright.config.ts`.
- `.github/workflows/deploy.yml` — sem mudança de workers/retries; estabilidade via reescrita, não configuração. O "1 did not run" do #15: explicar por run (serial-describe ou worker crash), não presumir.
- Mudanças de app somente quando o teste provar bug real; nunca tocar contrato público nem modelo de acesso.

## Dependências

Nenhuma dura. Soft: #763 (C113 feed), #669 (strict-mode locator), #811 (shadow `adminHeaders` sem advisory lock) absorvidas como causas-raiz no escopo.

## Fora de escopo

- Flakes int/unit não-bloqueantes (#553 DEBT-FLAKES-C100, #573 B193, #790).
- Infra do runner self-hosted (#768 em andamento).
- Mudanças de produto/UI.
- Subir workers/retries como estratégia; "flaky" tolerado.

## Rabbit holes de produto

(a) Consertar 1 flake isolado e fechar — a cast rotativa faz o deploy falhar de novo; corte: tratar a família inteira. (b) "Marcar flaky/retry 3+" como curativo — vetado pelo mandato; corte: reescrita com poll de conteúdo. (c) Engenharia de "test infra nova" (hermeticidade por DB por worker) sem tentar o barato primeiro; corte: fixes locais no spec/helper.

## Questões em aberto (produto)

_Resolvidas no gate 2026-08-24 (confirmação explícita do humano):_

1. **Skips do campaignAgendaFeed (2 testes, prod mode)?** **Decisão: B** — reescrever para rodar em prod mode (URL canônica de teste no fluxo de geração do link), removendo os `test.skip(isProdMode)`. A cobertura substituta unit/int continua como rede; o e2e volta a cobrir a superfície completa no verify.
2. **Família inteira vs só as que falharam no #15?** **Decisão: A** — família inteira de classes estudadas (a cast rotativa muda a cada run; só #15 deixa o #16 falhar em outra).
3. **Issues abertas #669/#763/#811 absorvidas?** **Decisão: A** — absorver como causas-raiz e fechar junto.

## Referências

- Issues: #763 (C113 feed global), #669 (strict-mode Municípios), #811 (shadow `adminHeaders`), #805 (fixed).
- Commit a97cd56f (fixes C142: gate `'writable'` + FAB `data-slot`).
- `docs/plans/e2e-full-flake-c142mun-impl.md`, `docs/plans/admin-login-lock-e2e-beforeeach-ui-login-impl.md`.
- `.github/workflows/deploy.yml`, `AGENTS-infra.md`.
