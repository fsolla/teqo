# B32/B34 — Raiz dos testes de lideranças que quebraram o verify 3 runs seguidos (regressão ou flake sob carga) — Plano de Implementação

Status: pronto
Atualizado em: 2026-09-15
Issue: #1036
Priority: P1
Impeccable: N/A — sem UI
Rascunho UI: N/A
Appetite: ~1–2 dias eng (diagnóstico + fix + prova verde)
Responsável: —

## Diagnóstico (revisado com logs e reprodução local)

**Veredito: NÃO é regressão de código de produção — é um bug de test-infra do fixture e2e que apagava lideranças vivas de outros workers.** A trilha C165/C165-F1 é inocente (nenhum arquivo de liderança/célula/action mudou entre os SHAs que falharam e o HEAD).

### Causa raiz: `where: { or: [] }` no `discoverOwnedRows` do fixture e2e

`CampaignE2EOwnership.discoverOwnedRows` (`tests/e2e/fixtures/campaignE2EFixtures.ts`) montava a descoberta de lideranças com um `or` **dinâmico**:

```ts
where: {
  or: [
    ...(userIDs.length ? [{ createdBy: { in: userIDs } }] : []),
    ...(userIDs.length ? [{ user: { in: userIDs } }] : []),
    ...(contactIDs.length ? [{ contact: { in: contactIDs } }] : []),
  ]
}
```

Um teste que **não cria** `campaignUser` nem `contact` (jornada read-only) roda o cleanup no `finally` com `userIDs` e `contactIDs` vazios → `or: []`. No adapter Drizzle do Payload 3.82.0, `parseParams` **descarta um `or` vazio** e a query roda **sem WHERE nenhum** → a descoberta "possui" TODAS as lideranças do banco compartilhado, e o `cleanup()` as deleta. O fixture int (`tests/helpers/campaignFixtures.ts`, `discoverDependents`) já guardava `leadershipConditions.length > 0`; o e2e não — assimetria entre irmãos.

**Evidência forense (Postgres com `log_statement=all` + `log_parameter_max_length`, run local CI=1 E2E_PROD=1 4 workers):**

- B32 (run 3): a liderança `id=27` foi criada às `21:37:51.875` e **deletada 57 ms depois** (`21:37:51.932`) por outra sessão em cleanup; a página abriu com "Nenhuma liderança encontrada" (snapshot do `error-context.md`) e o POST do status devolveu 400 genérico (`leadership` inexistente).
- A sessão que deletou rodava `discoverOwnedRows` de um runID sem contatos/usuários: a query de lideranças saiu **sem cláusula WHERE** (`order by "leadership"."created_at" desc`, sem `where`) — o full scan de `or: []`.
- Reprodução determinística do semantic: `payload.find({ where: { or: [] } })` retorna TODAS as linhas (pin novo em `tests/int/campaignFixtureOwnership.int.spec.ts`).
- Mesmo mecanismo explica os vizinhos com linha sumida: `campaignMunicipalities:659`/B176 (`Remover Liderança: …` não encontrada), `campaignActivity:525` e parte da classe "flaky sob 4 workers" da Issue.

### Mecanismos secundários (endurecidos no spec, mantidos)

1. **B32** esperava o controle da célula por até 60 s num `click` nu — o row streama com o chunk RSC e o clique consumia o timeout inteiro do teste; o failure não dizia o que faltava. Agora: gate de settle + orçamento explícito de 30 s na presença do botão, e o waiter de POST lança o corpo da resposta quando a rota recusa.
2. **B34** usava gate inline `div[id^="S:"]` (o helper `waitForStreamSettled` do OPS83 é o owner e manda parear com poll focado) e não tratava o **colapso por conteúdo** do clamp: a célula clampa em 3 linhas e, com dois chips de nome largo (nomes que o allocator entrega por run), o espaço reservado do input de busca derruba o `fitting` a 0 — todos os chips saem do DOM atrás de "Ver mais…" (snapshot de falha confirma). Agora: helper + poll focado + `expandCollapsedChips()` (clica "Ver mais…", nunca "Ver menos") antes de cada asserção de chip.

### Não é "o último verify está verde"

O run `35002372682` (`13aeb9bb`, 17:36) rodou o verify full e passou — é o mesmo HEAD verde que a Issue já registrava. Os runs seguintes (`a1649613`, `9e00de36`, `c2ee60dd`) têm `verify: skipped` (preflight pula quando outro deploy está na lane) e **não** são prova de estabilidade. O último verify que de fato executou (`35008333471`, `36d9abe8`, 18:34) **falhou**, com B32/B34 de novo no conjunto flaky — o problema estava vivo.

## Decisão

**Corrigir a causa raiz no fixture (guard de `or` vazio) + endurecer o spec com os helpers abençoados + instrumentar o waiter de POST.** Zero mudança de produção.

### Alternativas rejeitadas

- **Marcar como flaky / aumentar retry:** `verify` verde por tolerância esconderia o fixture apagando linhas vivas — rabbit hole explícito da Issue.
- **Mudar código de produção (células/actions/access):** sem evidência de que a UI seja a causa; o diagnóstico mostra test-infra e latência de stream.
- **Reabrir a cast rotativa do #882:** escopo distinto; a família dos vizinhos agora tem causa raiz própria (o fixture), corrigida aqui.
- **Mudar a semântica global de `expectPostResponse` (resolver em qualquer POST):** mudaria o contrato compartilhado por 19 usos em 5 specs; adotou-se um opt-in `{ throwOnNonOk: true }` no owner, com o default byte-idêntico.

## Mudanças

`tests/e2e/fixtures/campaignE2EFixtures.ts` (owner do fixture):

- **Causa raiz:** a descoberta de lideranças só roda quando há condição (`leadershipConditions.length > 0`), espelhando o fixture int; comentário explica o hazard do `or: []` (com os jobs dos runs afetados).
- `expectPostResponse` ganha `{ throwOnNonOk?: boolean }` (default `false`, os 19 usos existentes intocados): resolve no primeiro POST da rota e lança `POST <rota> → <status>: <body>` quando a resposta não é ok — em vez de pendurar o teste até o timeout com um "400" cego.

`tests/e2e/campaignLeaderships.e2e.spec.ts` (spec alvo):

- **B32:** `waitForStreamSettled` + `expect(statusButton).toBeVisible({ timeout: 30_000 })` antes do clique; waiter do POST com `throwOnNonOk`.
- **B34:** gate inline → `waitForStreamSettled`; poll focado do chip inicial (`expect.poll(count).toBeGreaterThan(0)`); `expandCollapsedChips()` antes das asserções de chip; waiter com `throwOnNonOk`.

`tests/int/campaignFixtureOwnership.int.spec.ts` (novo): pin do semantic `or: []` = match-all para o guard do fixture nunca regredir.

`docs/changelog/2026-09-15-b32-b34.md` e este impl plan. O doc de intenção ganhou Status/Referências atualizados (#1036).

## Prova

- **Antes:** full local (CI=1, E2E_PROD=1, 4 workers): B32 falhava 2x por run (linha sumida), B34 idem, B176 com chip de liderança sumido, 4+ flaky; linha `id=27` deletada 57 ms após criar.
- **Depois:** mesmo run full com o fixture corrigido: **B32, B34 e B176 verdes**; os 4 failures remanescentes são specs de agenda/contatos com fragilidade própria (strict-mode/dialog), fora do escopo e pré-existentes no ambiente local.
- `pnpm gate:fast` (lint + typecheck + unit 3268) verde; int novo verde; `pnpm gate:push` verde no `pnpm push`.
- O `verify` full pós-merge (4 workers) é a prova final.

## Riscos

1. **Orçamentos explícitos mascararem regressão real:** os budgets são de presença (30 s) e o waiter de POST lança a mensagem da rota — a falha fica explícita, não silenciosa.
2. **Colapso por conteúdo da célula (UI):** o spec agora contorna clicando "Ver mais…"; a UX de esconder TODOS os chips segue registrada como débito próprio na Issue #1042 (com o key warning dev do head), fora deste escopo.
3. **Flakes remanescentes fora do alvo:** `campaignAgendaFeed`/`campaignAgendaGoogleSync`/`campaignContacts:28` falham no ambiente local antes e depois da mudança; são de outras famílias (a #882 segue dona da cast).

## Fora de escopo

- Contrato de deploy (`deploy.yml`, jobs, runners).
- Mudança de UI/comportamento visível da lista.
- Reescrita ampla dos specs B32/B34 ou das outras superfícies da cast.

## Referências

- Issue #1036 · Run `35002372682` (verify verde em `13aeb9bb`) · Run `35008333471` (último verify executado, falhou em `36d9abe8`)
- Jobs de log: `104476711539`, `104458195479`, `104434116739`, `104513700572`
- `tests/e2e/fixtures/campaignE2EFixtures.ts` (discover/cleanup), `tests/helpers/campaignFixtures.ts` (`discoverDependents`, o irmão que já guardava), `tests/helpers/campaignResidue.ts`
- `tests/e2e/campaignLeaderships.e2e.spec.ts` · `tests/int/campaignFixtureOwnership.int.spec.ts`
- `payload@3.82.0` `@payloadcms/drizzle` `queries/parseParams.js` + `queries/buildQuery.js` (o `or` vazio é descartado)
- Issue #1042 (débito UX registrado: clamp + key warning) · Postmortem 2026-09-12
