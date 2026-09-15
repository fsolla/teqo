# B32/B34 — Raiz dos testes de lideranças que quebraram o verify 3 runs seguidos (regressão ou flake sob carga) — Plano de Implementação

Status: pronto
Atualizado em: 2026-09-15
Issue: #1036
Priority: P1
Impeccable: N/A — sem UI
Rascunho UI: N/A
Appetite: ~1–2 dias eng (diagnóstico + fix + prova verde)
Responsável: —

## Diagnóstico (revisado com logs)

**Veredito: flake sob carga de 4 workers — não é regressão de código.** A trilha C165/C165-F1 é inocente: nenhum arquivo de liderança/célula/action mudou entre os SHAs que falharam e o HEAD.

Evidência (logs dos jobs `104476711539`, `104458195479`, `104434116739` + run `35008333471`):

1. **B32 (`campaignLeaderships.e2e.spec.ts:15`)** — `Test timeout of 60000ms exceeded` no `locator.click` de "Editar status de apoio" (`:35:72`), sempre os 60 s inteiros do teste, em runs 2 e 3 (3/3 tentativas). O call log diz `waiting for getByRole(...)`: o controle da célula é filho de um boundary RSC — enquanto o chunk não commita, o botão existe apenas na cópia oculta `div[id^="S:"]` do stream (a mesma classe OPS83). O spec não tem gate de settle nenhum antes do clique e o clique consome o orçamento inteiro do teste.
2. **B34 (`campaignLeaderships.e2e.spec.ts:59`)** — duas falhas distintas:
   - `toHaveAttribute`/`toBeVisible` falhando na presença do chip (runs 1 e 3: `:91`, run 2: `:133`) **depois** do gate de settle inline — o gate genérico `div[id^="S:"]` pode resolver antes do chunk começar a streamar; a receita documentada do próprio helper (`waitForStreamSettled`, OPS83/E2E-DEBT-S-GATE) manda parear com um poll focado no elemento.
   - `page.waitForResponse: Test timeout of 60000ms exceeded` no primeiro add (run 2, retry #1) com `400 Bad Request` no console e um `NotFound: Não Encontrado` no `payload.findByID` da liderança (runs 1 e 3, retry #1). O `expectPostResponse` filtra `response.ok()`, então um 400 vira 60 s de espera cega — a mensagem do corpo da rota (floor/cap/scope/staff/leadership inexistente) nunca aparece no log.
   - **Colapso por conteúdo (reproduzido localmente sob carga):** a célula de municípios clampa em 3 linhas e esconde os chips atrás de "Ver mais…". Com **dois** chips, o loop de medição desconta o espaço reservado do input de busca (`min-w-32`) + toggle; com nomes largos — e o allocator entrega nomes arbitrários por run — o `fitting` chega a **0** e TODOS os chips saem do DOM (snapshot de falha: célula só com "Ver mais…" e status "Municípios salvos."). O spec afirmava visibilidade de chip sem expandir, então o timeout de 30 s era certo quando o par de nomes não cabia. É a mesma classe "flake sob carga" que os vizinhos, mas determinística por conteúdo.
3. **Não é "último verify verde":** o run `35002372682` (`13aeb9bb`, 17:36) rodou o verify full e passou — é o mesmo HEAD verde que a Issue já registrava como anti-recorrência. Os runs seguintes (`a1649613`, `9e00de36`, `c2ee60dd`) têm `verify: skipped` (preflight pula quando outro deploy está queued/in_progress) e **não** são prova de estabilidade. O último verify que de fato executou (`35008333471`, `36d9abe8`, 18:34) **falhou**, e B32/B34 estavam de novo no conjunto flaky (B34 ✘→✘→✓ retry #2; B32 ✘→✓ retry #1) — o problema segue vivo.
4. **Vizinhos** (`campaignAiChatResize:44`, `campaignColumnPicker:21`, `campaignMunicipalities:659`, `campaignActivity:525`, `campaignSavedFilters:35`) são a mesma classe de latência sob 4 workers (postmortem 2026-09-12); não são alvo.

## Decisão

**Hardening do spec + diagnóstico no waiter** — usar os helpers/recipe já abençoados pelo OPS83 em vez de gates inline, dar orçamentos explícitos aos pontos que hoje consomem o timeout inteiro do teste, e fazer o waiter do POST falhar rápido com o corpo da resposta quando a rota recusa. Zero mudança de produção.

### Alternativas rejeitadas

- **Marcar como flaky / aumentar retry:** `verify` verde por tolerância esconde a regressão viva — rabbit hole explícito da Issue.
- **Mudar código de produção (células/actions/access):** sem evidência de que a UI seja a causa; o diagnóstico mostra latência de stream/RSC e orçamento de teste, não comportamento.
- **Reabrir a cast rotativa do #882:** escopo distinto; B32/B34 são persistentes, não rotativos.
- **Mudar a semântica global de `expectPostResponse` (resolver em qualquer POST):** mudaria o contrato compartilhado por 19 usos em 5 specs; adotou-se um opt-in `{ throwOnNonOk: true }` no owner, com o default byte-idêntico.

## Mudanças

`tests/e2e/campaignLeaderships.e2e.spec.ts` (único arquivo de teste):

- **B32:** `waitForStreamSettled(page)` depois do chrome, `expect(statusButton).toBeVisible({ timeout: 30_000 })` e só então o clique — o botão deixa de consumir os 60 s do teste quando o row streama tarde.
- **B34:** gate inline `page.waitForFunction(div[id^="S:"])` → `waitForStreamSettled(page)` (owner do concern, OPS83/E2E-DEBT-S-GATE); poll focado `expect.poll(count).toBeGreaterThan(0)` no chip inicial antes do `toHaveAttribute` (receita documentada do helper); waiter de POST via `expectPostResponse(..., { throwOnNonOk: true })` (owner), sem twin local.
- **B34 colapso por conteúdo:** `expandCollapsedChips()` — espera a medição do clamp assentar e clica "Ver mais…" quando ele está no estado colapsado (nunca "Ver menos"), antes de cada asserção de chip (inicial, pós-add, pós-reload). É o caminho do usuário; sem ele, nomes largos deixam o chip fora do DOM.

`tests/e2e/fixtures/campaignE2EFixtures.ts` (owner do helper):

- `expectPostResponse` ganha `{ throwOnNonOk?: boolean }` (default `false`, os 19 usos existentes intocados): resolve no primeiro POST da rota e lança `POST <rota> → <status>: <body>` quando a resposta não é ok — em vez de pendurar o teste até o timeout com um "400" cego.

`docs/changelog/2026-09-15-b32-b34.md` (registro obrigatório da entrega, OPS85) e este impl plan.

## Prova

- `pnpm gate:fast` (lint + typecheck + unit) verde.
- E2E dos specs alterados em **modo prod** (`E2E_PROD=1`, o modo do CI — o dev server local emite um warning React de key dev-only que o `e2eFailureGuard` trata como erro e que não existe no build de produção), com repetição para estresse.
- `verify` full (4 workers) no PR.

## Riscos

1. **Orçamentos explícitos mascararem regressão real:** os budgets são de presença (30 s) e o teste continua falhando rápido quando o elemento some — mitigado pelo waiter que lança a mensagem da rota.
2. **400/NotFound residual:** o corpo da resposta passará a aparecer no log; se a causa for a colisão cross-run (purge-on-claim numa linha viva), o diagnóstico fica instrumentado para a próxima ocorrência. Não se mexe no contrato do allocator aqui.
3. **Flake dos vizinhos:** fora de escopo (evidência, não alvo).

## Fora de escopo

- Contrato de deploy (`deploy.yml`, jobs, runners).
- Mudança de UI/comportamento visível da lista.
- Reescrita ampla dos specs B32/B34 ou das outras superfícies da cast.
- Semântica global de `expectPostResponse` (19 usos).

## Referências

- Issue #1036 · Run `35002372682` (verify verde em `13aeb9bb`) · Run `35008333471` (último verify executado, falhou em `36d9abe8`)
- Jobs de log: `104476711539`, `104458195479`, `104434116739`, `104513700572`
- `tests/e2e/campaignLeaderships.e2e.spec.ts` (B32 `:15`, B34 `:59`)
- `tests/e2e/fixtures/campaignE2EFixtures.ts` (`waitForStreamSettled` `:632`, `expectPostResponse` `:554`)
- `docs/plans/autosave-status-lista-liderancas.md` (B32) · `docs/plans/chips-municipios-lista-liderancas.md` (B34)
- Postmortem 2026-09-12 (classe de latência sob 4 workers)
