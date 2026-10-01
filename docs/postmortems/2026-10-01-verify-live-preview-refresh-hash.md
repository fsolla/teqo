# Post-mortem: refresh RSC do live preview apaga o hash `#novidades` e derruba o verify do deploy

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-10-01                                                                                                 |
| Severidade          | alta (bloqueou o deploy do main; CI vermelho, sem impacto em produção — o `verify` roda antes de publicar) |
| Ambiente            | CI (job `verify` do Deploy no GitHub Actions)                                                              |
| Issue(s)            | #1413 (auto-unblock; não fechar — o wrapper cuida)                                                         |
| PR do fix           | #1415                                                                                                      |
| Detectado por       | CI (deploy run vermelho) / wrapper auto-unblock                                                            |

## Timeline

| Momento               | Data/hora         | Evento                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável       | julho/2026        | Bridge de live preview (`RefreshRouteOnSave`) montado em toda página pública (`375398af`/`f23c2582`) — a corrida fica latente desde então.                                                                                                                                              |
| Detecção              | 2026-10-01 21:19Z | run `36924161319` (push em `main`, commit `0a8b0774`), job `verify`, step "E2E tests (full suite, single job, 4 workers)": 1 failed, 4 flaky, 329 passed (8.8m); o failed é `campaignNewsletter` (hash `#novidades` ausente nas 3 tentativas); Issue #1413 às 21:21:50Z (auto-unblock). |
| Bloqueio do deploy    | 2026-10-01        | `deploy-staging` e `deploy-production` ficaram skipped no run vermelho — deploy do main bloqueado.                                                                                                                                                                                      |
| Correção implementada | 2026-10-01        | worktree `fix/falha-do-job-verify-do-deploy-github-actions-desbloque-2`.                                                                                                                                                                                                                |
| Correção mergeada     | a preencher       | PR #1415 aberto (Ready; auto-merge armado pelo safety net).                                                                                                                                                                                                                             |
| Deploy                | a preencher       | a preencher.                                                                                                                                                                                                                                                                            |
| Verificado em prod    | não se aplica     | bug de CI/teste; a confirmação é o `verify` verde no deploy pós-merge; produção depende do approve humano (não aprovado por esta sessão).                                                                                                                                               |

## O bug

O clique no CTA secundário do hero (`<a href="#novidades">`, `src/components/CampaignHero.tsx:107`) deixava de gravar o hash `#novidades` na URL de forma intermitente, e a seção de novidades não era alcançada por âncora. Não havia caminho de usuário determinístico — era corrida de timing —, então só a suíte e2e pegava.

No run vermelho `36924161319` (evento `push` em `main`, commit `0a8b0774` — "feat(S44): home divulga a Plenária da Vitória…", criado 2026-10-01T20:47:33Z), o job `verify` falhou no step "E2E tests (full suite, single job, 4 workers)": 1 failed, 4 flaky, 329 passed (8.8m). O failed foi `[campaign] tests/e2e/campaignNewsletter.e2e.spec.ts:142:3 › Campaign home novidades capture › captures the visitor and confirms in place`: `expect(page).toHaveURL(/#novidades/)` recebeu `http://localhost:3000/?e2e=…` (sem hash) nas 3 tentativas. Os flaky passaram no retry e não têm relação causal — `campaignColumnPicker`, `campaignSavedFilters`, `campaignTerritoriesHttp` e `frontendJingles`. Com o `verify` vermelho, `deploy-staging` e `deploy-production` ficaram skipped — sem impacto em produção, já que o `verify` roda antes de publicar. **Sintoma — não a causa.**

## Causa-raiz

O trace do Playwright provou o mecanismo: o clique aplicava `#novidades` e, ~30 ms depois, uma resposta RSC (`GET /?e2e=…&_rsc=acjh4`) regravava a URL sem hash; nos runs que passavam, o refresh chegava antes do clique. A regravação vinha do `HistoryUpdater` do App Router (`next/dist/client/components/app-router.js`, `window.history.replaceState(…, canonicalUrl)`); o refresh RSC, por sua vez, era disparado pelo bridge de live preview do Payload (`@payloadcms/live-preview-react`), montado em toda página pública via `RefreshRouteOnSave` no layout `src/app/(frontend)/layout.tsx:84`.

### 5 whys

1. Por que a URL perdia o hash? Porque o `HistoryUpdater` do App Router aplicava o refresh RSC e regravava a URL canônica sem hash.
2. Por que havia refresh RSC no mount? Porque `src/components/RefreshRouteOnSave.tsx` montava o bridge de live preview do Payload em TODA página pública; o pacote chama `refresh()` (`router.refresh()`) incondicionalmente no mount (e posta `ready` para `window.opener || window.parent`).
3. Por que o bridge era montado sem gate? Porque foi adotado como cidadão do layout (padrão da doc do Payload) — não checava se a página estava de fato dentro do preview do admin (iframe/popup).
4. Por que só derrotou a suíte agora? Porque a corrida existia desde julho/2026 (bridge em `375398af`/`f23c2582`), mas só virou sistemática no verify do S44 (`0a8b0774`): a home ganhou uma seção nova (Plenária) e o payload/janela do refresh cresceu o bastante para o RSC cair depois do clique.
5. Por que escapou até aqui? Porque nenhum teste afirmava "o hash sobrevive ao refresh", o unit não monta o layout, o e2e de PR (`selected`) nem sempre selecionava o spec, e `retries: 2` sem `failOnFlakyTests` transformava corrida real em "flaky verde" — o verify full do deploy foi o primeiro a pegar.

## Correção

Sem mudança de schema/produto, sem Consent/PII e sem migration. O que mudou:

- `src/components/RefreshRouteOnSave.tsx`: o bridge só monta quando há contexto real de preview (`window.parent !== window || window.opener != null`); standalone público renderiza `null` (estado inicial `false` + `useEffect`, SSR-safe) e deixa de disparar o `router.refresh()` de mount. O live preview (iframe/popup) segue funcionando.
- Prova de regressão: `tests/unit/refreshRouteOnSave.unit.spec.tsx` (2 casos: standalone não monta/não refresca; iframe monta/refresca) e caso e2e novo em `tests/e2e/campaignNewsletter.e2e.spec.ts:245` ("hero CTA keeps the hash when an on-mount refresh lands late"), que segura a resposta `_rsc` do home com `page.route` e só libera DEPOIS do clique (determiniza a corrida).
- `scripts/lib/e2e-affected-manifest.mjs`: entrada nova `['src/components/RefreshRouteOnSave.tsx', 'src/app/(frontend)/layout.tsx']` → specs `['frontend','campaignNewsletter']`.

Resolve a causa: sem refresh posterior ao clique, o `HistoryUpdater` não regrava a URL e o hash sobrevive — o gate elimina o refresh espúrio no standalone em vez de mascarar o assert.

## Verificação

- Teste de regressão: `tests/unit/refreshRouteOnSave.unit.spec.tsx` (2 casos) e o caso e2e novo `tests/e2e/campaignNewsletter.e2e.spec.ts:245` — falham sem o fix e passam com.
- RED sem o fix: unit 1 failed (`livePreview.mounts` = 1 no standalone); e2e novo falhou determinístico (`toHaveURL` sem `#novidades`) — logs `/tmp/unit-red.log` e `/tmp/e2e-red.log`.
- GREEN com o fix: unit 2/2; e2e novo 1 passed; arquivo inteiro `--repeat-each=3 --retries=0` 18/18; arquivo inteiro `--repeat-each=2 --retries=0` 12/12 (verificador); hero irmão em `frontend.e2e.spec.ts` 1 passed.
- Repro local (2026-10-01, worktree, modo prod com build `.next-e2e`, banco isolado `teqo_wt817_test`): `tests/e2e/campaignNewsletter.e2e.spec.ts` com `--retries=0 --repeat-each=4` deu 4 falhas em 20 execuções (16 passed), sempre no mesmo assert.
- `pnpm gate:fast`: lint e typecheck verdes; unit 5089 passed / 6 failed — todos flakes de ambiente (timeouts de 5s em `archiveCatalogCli` (2), `flickrImportCli` (2), `faceCli` (1) — CLIs que spawnam subprocesso — e `contentPiecePeopleField` (1)), arquivos alheios ao diff; re-run isolado dos 4 arquivos: 31/31 passed, exit 0.
- CI: a preencher (PR).
- Prod: não se aplica (bug de CI/teste); a confirmação é o `verify` verde no deploy pós-merge; produção depende do approve humano (não aprovado por esta sessão).

## Prevenção

| Estratégia                                                                                                                                           | Custo  | Estado                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Gate de contexto do bridge (só monta em iframe/popup; standalone renderiza `null`)                                                                   | barata | implementada neste PR                                        |
| Unit de regressão `refreshRouteOnSave.unit.spec.tsx` (standalone não monta × iframe monta)                                                           | barata | implementada neste PR                                        |
| E2E determinístico que segura a resposta `_rsc` e só libera depois do clique                                                                         | barata | implementada neste PR                                        |
| Entrada no manifesto de e2e afetado (`scripts/lib/e2e-affected-manifest.mjs`: componente + layout)                                                   | barata | implementada neste PR                                        |
| Auditoria/inventário de mounts de terceiros que mutam URL/history/scroll (detector que falha quando `history.replaceState` roda sem interação)       | cara   | documentada — não implementada neste fluxo                   |
| `failOnFlakyTests`/quarentena global e triagem das classes flaky (já apontada no postmortem C104)                                                    | cara   | documentada — não implementada neste fluxo                   |
| E2E real do live preview admin→iframe→frontend com URL por ambiente                                                                                  | cara   | documentada — não implementada neste fluxo                   |
| Trocar `serverURL="http://localhost:3000"` hardcoded no bridge (e `livePreview.url` equivalente em `src/payload.config.ts:110`) por URL por ambiente | cara   | documentada — não implementada neste fluxo — débito separado |

**Estratégia implementada:** o gate de contexto do bridge (bridge só monta em iframe/popup), o unit de regressão (standalone × iframe), o e2e determinístico (segura a resposta `_rsc` e libera depois do clique) e a entrada do componente + layout no manifesto de e2e afetado — tudo neste PR.

**Estratégia documentada (cara):** auditoria/inventário de mounts de terceiros que mutam URL/history/scroll (detector que falha quando `history.replaceState` roda sem interação); `failOnFlakyTests`/quarentena global e triagem das classes flaky (já apontada no postmortem C104); e2e real do live preview admin→iframe→frontend com URL por ambiente; e o `serverURL="http://localhost:3000"` hardcoded no bridge (e o `livePreview.url` equivalente em `src/payload.config.ts:110`), que deixa o preview de produção frágil — trocar por URL por ambiente é débito separado. Nada disso implementado neste fluxo.

## Lições

- Componente de terceiro montado no layout global pode mutar a URL da página inteira sem interação; bridge de preview deve ser gated pelo contexto de preview.
- Corrida real de ~20% local virou 3/3 no CI sob carga; teste de hash tem que segurar a resposta RSC e liberar depois do clique para ser determinístico.
- `retries: 2` sem `failOnFlakyTests` esconde corridas verdadeiras atrás de "flaky".
