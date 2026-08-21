# Impl: CI/PR do Forgejo Actions de volta para o GitHub Actions — tracker de Issues permanece no Forgejo

Status: aprovado
Atualizado em: 2026-08-19
Issue: #97
Intenção: docs/plans/ops71-ci-github-actions-tracker-forgejo.md
Appetite restante: herdado (~2–3 dias eng; este impl é o item inteiro — OPS72 roda depois com `depends`)

## Leitura da intenção

- **Outcome:** código/PR/CI no GitHub Actions (mesma cascata de verificações,
  job único `checks`), tracker de Issues no Forgejo por API, deploy **manual**
  (`workflow_dispatch`) com dois jobs (`verify` hosted full → `deploy`
  self-hosted no homeserver), rollup `CI (PR) / checks` como required check do
  GitHub, workstation livre da suíte.
- **O que NÃO negociar:** tracker (Issues/labels/claims) permanece no Forgejo;
  estrutura de job único (OPS62) preservada — nada de matrix; deploy NÃO volta
  a ser automático; sem migrar Issues; sem segundo deploy (nada de Vercel);
  nunca merge com CI vermelho; `pnpm push` continua sendo o caminho canônico.
- **O que reavaliar:** a intenção sugere "auto-merge nativo do GitHub ou
  safety net equivalente" e "`gh workflow run` (ou API GitHub)". Reavaliado:
  `gh` **não existe** em nenhuma máquina (OPS50) e a filosofia do repo é
  plain-Node stdlib — os helpers novos são scripts Node zero-dep sobre a REST
  do GitHub, no mesmo molde de `forgejo-api.mjs`. O auto-merge é o **nativo do
  GitHub** (GraphQL `enablePullRequestAutoMerge`, rebase) — o servidor espera o
  required check; o OPS64 pin (varrer statuses individuais) era defesa contra o
  rollup mentiroso do runner Forgejo, que **não existe** no GitHub (o check-run
  `CI (PR) / checks` de um job único é o veredito honesto, e o auto-merge nativo
  só mergeia com required checks verdes — garantia do servidor).

## Abordagem recomendada

```mermaid
flowchart LR
    W[worktree local] -->|pnpm push -u origin HEAD| GH[github.com/fsolla/teqo]
    GH -->|PR Ready base main Closes #N| CI["ci-pr.yml — job único checks (mesma cascata OPS62)"]
    CI -->|required check CI (PR) / checks| AM["agent-pr-ready-automerge.yml — auto-merge nativo (GraphQL, rebase)"]
    AM -->|merge| MAIN[main no GitHub]
    MAIN -->|PR closed merged| FLIP["issue-done / plan-issue-ready — flip no Forgejo via FORGEJO_API_TOKEN"]
    MAIN -->|dispatch manual| V[deploy.yml verify hosted full suite]
    V -->|needs| D["deploy runs-on self-hosted homeserver — deploy-homeserver.sh local"]
    D --> P[(teqo-1313 produção)]
```

**Opções consideradas:**

- **A — origin vira GitHub; Forgejo como remote secundário congelado; TEQO_REPO_URL → GitHub (repo público, sem auth).** `origin/main` é o base dos gates locais (ci-scope/gate-ci) — precisa apontar para o repo que recebe os merges, senão o diff local compara contra um main defasado. O repo GitHub é público (verificado: `private: false`) → o homeserver clona sem credencial.
- **B — auto-merge via GraphQL nativo.** GitHub espera o required check no servidor; nenhum poll; sem semáforo portado. Draft `cursor/*` → Ready via PATCH; draft não-`cursor/*` = veto (OPS57, preservado).
- **C — deploy.yml com `verify` (hosted, suíte full sem skips) → `deploy` (needs, self-hosted homeserver) executando `deploy-homeserver.sh <sha>` localmente (sem SSH).**
- **D — `forgejo-issue-transition.mjs` / `agent-promote-related-on-merge.mjs` ganham `PR_BODY` env** (mecanismo que `agent-promote-related` já usa): o body do PR vem do evento GitHub; o script flipa no Forgejo por API sem ler o PR do Forgejo (PR lá não existe mais).
- **E — `configure-branch-protection.mjs` reescrito para a REST do GitHub** com lib pura `github-branch-protection.mjs` (regra desejada + drift), no mesmo molde de `branch-protection.mjs`; `enforce_admins: true` preserva o invariante "nunca merge com CI vermelho" inclusive para admin (o rule-based do Forgejo valia para todos).

**Recomendação:** A+B+C+D+E — porque cada peça reusa o molde existente (plain Node stdlib, libs puras unit-testadas, drift idempotente) e o aceite da intenção exige exatamente esse desenho; nada disso exige binário novo (`gh`) nem semáforo reimplementado.

**Rejeitadas:**

- **Instalar `gh` e usar `gh pr create/merge/run`** — binário novo em todas as máquinas + workflows, contra a convenção zero-dep do repo; a REST cobre tudo.
- **Poll-and-merge portado (`waitForChecks` do Forgejo) como mecanismo único** — reimplementa o semáforo que a intenção manda cortar; o OPS64 pin era contra o bug do rollup do Forgejo, inexistente no GitHub com job único + auto-merge nativo.
- **Mirror ativo do Forgejo (`pnpm push` para dois remotes / sync pós-merge)** — nada lê o git do Forgejo em runtime (deploy usa TEQO_REPO_URL=GitHub; flips são API); o repo Forgejo congela em main no ponto do cutover (tracker intacto por API, anti-goal "nunca fecha o tracker" preservado).
- **Deletar os arquivos do Forgejo nesta entrega** — decisão do gate (2026-08-19): o sistema GitHub Actions nasce PRIMEIRO e é validado ao vivo (PR real com CI verde → auto-merge → flips → deploy manual); a remoção de `.forgejo/workflows/` + scripts mortos é **entrega sucessora**, só depois de tudo funcionando. O repo Forgejo congelado no main pré-cutover mantém os workflows como rollback (reversível: religar runner + PRs lá); apagar na primeira entrega queimaria a via de volta.
- **Manter `ci-classify-production.mjs` como check informativo no dispatch** — o hosted não alcança o homeserver (sem SSH) e o `verify` roda a suíte full sem skips; a classificação não muda nada → removido só na entrega de remoção.
- **`TEQO_REPO_URL` → Forgejo local com mirror** — dependência extra de sync; o repo GitHub é público, clone direto sem auth.
- **Fork-PR no CI** — repo público: fork PR rodaria a suíte full em minutes hosted de graça; `if:` same-repo no job `checks` (mesma guarda de RCE dos outros workflows).

## Cutover em duas fases (gate 2026-08-19)

O GitHub é **só** o host do Actions; o Forgejo permanece o **tracker principal** (Issues, labels, claims, flips — tudo via API, intacto). A remoção dos arquivos do Forgejo só acontece após validação ao vivo do fluxo GitHub:

1. **Fase 1 (esta entrega — OPS71):** cria todo o sistema GitHub Actions (workflows, scripts, libs, docs). **Nada do Forgejo é apagado** — `.forgejo/workflows/`, `forgejo-pr-automerge.mjs`, `forgejo-dispatch.mjs`, `ci-classify-production.mjs` + specs permanecem no repo (dormentes: o repo Forgejo não recebe mais push).
2. **Cutover manual (humano, nesta ordem — (a)–(c) ANTES do push do OPS71, senão o PR mergearia sem required check):** (a) remotes locais (`origin` → GitHub, `forgejo` secundário); (b) PAT `GITHUB_TOKEN` local + secrets no GitHub (`FORGEJO_API_TOKEN`, `CURSOR_API_KEY`) + `allow_auto_merge: true`; (c) `pnpm configure:branch-protection` (GitHub); (d) **desligar o runner do Forgejo** (reversível — é o que para o schedule do `ci.yml` antigo, que não tem mais sentido e disputaria a workstation; pode ser logo após o primeiro PR GitHub validado); (e) runner self-hosted no homeserver (deploy; não bloqueia PRs — pode ficar para depois); (f) push do OPS71 → PR no GitHub → CI verde → auto-merge → flip da #97 (valida os flips no merge do próprio OPS71) → deploy manual dispatch quando o runner do homeserver estiver pronto.
3. **Fase 2 (entrega sucessora, registrada no fechamento desta Issue):** remove `.forgejo/workflows/*`, scripts mortos e docs residuais do fluxo antigo. Só depois do fluxo GitHub comprovado de ponta a ponta.

### Componentes / mudanças

- **`.github/workflows/ci-pr.yml`** (novo): port do `.forgejo/workflows/ci-pr.yml` — job único `checks`, mesmos steps/guards/services (`postgres-int`/`postgres-build` por nome na rede do job), skips via `ci-scope.mjs` (env `GITHUB_BASE_REF` idêntico). Deltas GitHub: `concurrency: { group: ci-pr-${{ github.head_ref }}, cancel-in-progress: true }` (fail-fast nativo em push novo — o OPS62 não cancelava só porque o Forgejo não tem API; aqui é grátis), `if:` same-repo no job (fork não queima minutes), `permissions: contents: read` (default), e2e selected preservado (OPS72 ajusta a política depois — `depends`).
- **`.github/workflows/deploy.yml`** (novo): `workflow_dispatch` (sem inputs — ref default main). `verify` (ubuntu-latest, timeout 50): `check-test-locations` → lint → format → typecheck → knip → cycles → unit → int (migrate+seed nos services) → build → e2e **full** (4 workers; guardas de contrato de PR ficam de fora — não são verificação de produção). `deploy` (`needs: [verify]`, `runs-on: [self-hosted, homeserver]`, timeout 60, `permissions: contents: read`): checkout → `bash scripts/deploy-homeserver.sh "$GITHUB_SHA"`.
- **`scripts/deploy-homeserver.sh`**: `TEQO_REPO_URL` default → `https://github.com/fsolla/teqo.git`; no workspace existente, `git remote set-url origin "$TEQO_REPO_URL"` idempotente antes do fetch (o clone velho aponta para o Forgejo local); doc de invocação: execução local no runner (não mais pipe via ssh) — o `</dev/null` no `run --rm` do migrate permanece. Fluxo interno intacto (HEAD guard, flock, already-deployed, migrator→migrate→runner→rollout, smoke).
- **`.github/workflows/agent-pr-ready-automerge.yml`** (novo) + **`scripts/github-pr-automerge.mjs`** (novo, plain Node) + **`scripts/lib/github-api.mjs`** (novo, REST+GraphQL zero-dep): lê PR (REST); base != main → skip; draft `cursor/*` → `PATCH draft:false`; draft outro → skip (veto OPS57); senão GraphQL `enablePullRequestAutoMerge(mergeMethod: REBASE)` no `node_id` do PR. Erro do GraphQL → exit 1 (job vermelho, visível). `permissions: { contents: write, pull-requests: write }`.
- **`scripts/github-pr.mjs`** (novo, plain Node): criação de PR para agentes/humano — `GITHUB_TOKEN` env; `--head <branch> --title <t> --body-file <f>` (Ready, base `main` — sem opção draft, regra do repo). Substitui o `forgejo_create_pull_request` do MCP no fluxo de entrega.
- **`scripts/lib/github-branch-protection.mjs`** (novo, puro): `DESIRED_RULE` GitHub (`required_status_checks.checks = [{ context: 'CI (PR) / checks' }]`, strict=false, 0 reviews, `enforce_admins: true`, sem restrictions) + `ruleMatches`/`planBranchProtectionRule` (mesmo contrato do atual).
- **`scripts/configure-branch-protection.mjs`**: reescrito para a REST do GitHub (`PUT /repos/{owner}/{repo}/branches/main/protection`), idempotente (read → plan → apply → verify), `--dry-run` preservado.
- **`scripts/forgejo-issue-transition.mjs`**: aceita `PR_BODY` env (body do PR vem do evento GitHub); sem PR_BODY mantém a leitura via API do Forgejo (fallback — os workflows do Forgejo ainda estão vivos até a Fase 2); comentário do flip atualizado ("deploy manual via dispatch, ver AGENT-OPS").
- **`.github/workflows/issue-done-on-main-merge.yml` / `plan-issue-ready-on-main-merge.yml`** (novos): `pull_request: closed` + `if:` merged && base main && **same-repo** (guarda RCE: checkout de fork + PAT = RCE — preservada); `PR_BODY: ${{ github.event.pull_request.body }}`; `FORGEJO_API_TOKEN` secret; sem `GITHUB_TOKEN` de Issues do GitHub (flip é no Forgejo).
- **`.github/workflows/archive-cursor-agent.yml`** (novo): port direto do `.forgejo/workflows/` (CURSOR_API_KEY).
- **`docs/AGENT-OPS.md`, `.agents/rules/agent-pr-workflow.mdc`, `.agents/skills/work-issue/` (SKILL + execution-pipeline), `.agents/skills/agent-work-issue/SKILL.md`, `.agents/skills/capture-review-debts/SKILL.md` (linha do fechamento), `AGENTS.md`, `docs/ops/teqo-1313-deploy.md`**: fluxo de PR/CI/merge/deploy reescrito para GitHub (canônico); seção de transição nomeando a Fase 2; tabela de secrets (GitHub agora: `FORGEJO_API_TOKEN`, `CURSOR_API_KEY`, local `GITHUB_TOKEN` PAT); passos manuais do cutover na ordem (incl. desligar o runner do Forgejo e por quê — o schedule do `ci.yml` antigo pararia de ter sentido).
- **Preservados nesta entrega (Fase 2 remove):** `.forgejo/workflows/*` (6 arquivos), `scripts/forgejo-pr-automerge.mjs`, `scripts/forgejo-dispatch.mjs`, `scripts/ci-classify-production.mjs`, `scripts/lib/dockerignore.mjs`, `scripts/lib/branch-protection.mjs` + specs (`ciClassifyProduction`, `dockerignoreMatch`, `branchProtection`) — dormentes, documentados como rollback e alvo da entrega de remoção.
- **Testes novos:** `tests/unit/githubApi.unit.spec.ts` (normalização de shapes + endpoints REST/GraphQL, molde do `forgejoApi.unit.spec.ts`), `tests/unit/githubBranchProtection.unit.spec.ts` (regra desejada + drift, molde do `branchProtection.unit.spec.ts`), e pure-functions da política de draft/skip do automerger (`scripts/lib/github-pr-flow.mjs` + spec — o pin OPS57/OPS64 do jeito GitHub).
- **Migration:** sem migration (nenhum schema).
- **Access / Consent:** nenhum.
- **UI:** Impeccable N/A.

## Fases verificáveis

1. **Libs + scripts base** — `github-api.mjs`, `github-pr-flow.mjs` (puro), `github-branch-protection.mjs` (puro), `github-pr.mjs`, `github-pr-automerge.mjs`, `forgejo-issue-transition.mjs` (PR_BODY), `configure-branch-protection.mjs` (GitHub) + specs unit. Gate: `pnpm test:unit`.
2. **Workflows** — `.github/workflows/*` (6). Nada do `.forgejo/workflows/` é tocado nesta fase (Fase 2 do cutover). Gate: `pnpm gate:fast` + `pnpm check:cycles` + knip.
3. **Docs/skills + changelog** — AGENTS.md, AGENT-OPS, agent-pr-workflow.mdc, skills, runbook (com seção de transição), `docs/changelog/2026-08-19-ops71.md` + `pnpm changelog:build`.
4. **Gates finais + entrega** — `pnpm gate:ci` completo (unit+int+build), format, knip, cycles; `pnpm push -u origin HEAD` → PR no GitHub via `node scripts/github-pr.mjs` → CI verde no GitHub → auto-merge → flip da #97. **Passos manuais do cutover listados para o humano** (Fase 1 do cutover: remotes, secrets, branch protection, runner homeserver, shutdown runner Forgejo) — o PR em si não depende deles (CI roda no GitHub com secrets de teste), mas a ordem recomendada é: remotes → secrets → configure → push → PR.

## Fase 2 — entrega sucessora (pós-validação)

Registrada no fechamento desta Issue (capture-review-debts): remove `.forgejo/workflows/*`, `forgejo-pr-automerge.mjs`, `forgejo-dispatch.mjs`, `ci-classify-production.mjs`, `dockerignore.mjs` (+ specs órfãs) e qualquer doc residual do fluxo Forgejo. Critério de entrada: um ciclo completo validado no GitHub (PR → CI → auto-merge → flip → deploy manual).

## Rabbit holes / Não escopo (engenharia)

- Portar `waitForChecks`/statuses para o GitHub — não há; auto-merge nativo.
- Re-engenharia do `deploy-homeserver.sh` (fluxo docker/compose/migrate) — só a origem do clone e o modo de invocação mudam.
- Sincronizar o repo Forgejo com main — congelado (decidido, anti-goal do tracker preservado).
- Migrar Issues/labels/claims — anti-goal explícito.
- OPS72 (e2e local afetado) — item sucessor com `depends: [OPS71]`.
- Pool/`agent-pool*` — dormente (OPS65); o texto `gh pr` em `agent-pool-prompt.mjs` é de feature morta — deixo como está (fora do serializes).
- Secrets de GitHub (`FORGEJO_API_TOKEN`, `CURSOR_API_KEY`, `GITHUB_TOKEN` PAT local) — passo manual documentado, não código.

## Riscos e mitigação

- **Nome do check-run `CI (PR) / checks`:** o workflow `name: CI (PR)` + job `checks` geram exatamente esse check-run no GitHub; o required check usa o mesmo literal — pin no spec da branch protection e verificação ao vivo no primeiro PR (se o nome divergir, o configure aponta o drift e o PR não mergea — fail-closed, nunca merge sem verificação).
- **Auto-merge GraphQL com `GITHUB_TOKEN`:** permissões declaradas (`contents`+`pull-requests: write`) cobrem PATCH draft e a mutation; se o GraphQL recusar (ex.: auto-merge desabilitado no repo), o job fica vermelho com a mensagem — mitigação: passo manual `allow_auto_merge: true` no repo (Settings ou API) listado no cutover.
- **PR com conflito:** auto-merge fica armado e o PR espera — igual ao hoje (waitForChecks lançava "não mergeável"); nenhum merge errado é possível (servidor).
- **Repo público → fork PR:** `if:` same-repo no job `checks` + setting de fork workflows no repo (passo manual) — fork não queima minutes nem acessa secrets.
- **Runner do homeserver ainda não instalado:** o `deploy` fica indisponível até o passo manual; PRs seguem mergeando (CI hosted não depende do runner). O PR deste item não publica nada sozinho — o deploy é dispatch manual.
- **Schedule do `ci.yml` antigo rodando na workstation durante a transição:** com o repo Forgejo congelado, o gate do Forgejo lerá um deployed SHA inexistente no clone → fail-open vermelho → suíte full a cada 30 min na workstation. Mitigado: o cutover desliga o runner do Forgejo logo após o merge (passo (d), reversível) — antes do primeiro deploy via GitHub.
- **`gate:ci` local vs `origin/main`:** o remote muda para GitHub; sem o passo manual dos remotes, o gate local compara contra o Forgejo defasado → risco de diff falso. Mitigado: o passo de remotes é o PRIMEIRO do cutover e o runbook avisa; o `*-impl.md` documenta o comando exato.
- **TEQO_REPO_URL no homeserver:** clone velho com origin Forgejo → `set-url` idempotente no script cobre; repo público → sem credencial.
- **Knip com os scripts do Forgejo preservados:** nada órfão é criado nesta entrega (todos os scripts seguem referenciados pelos YAMLs do `.forgejo/workflows/`, que permanecem) — sem risco de knip flagrar a deleção adiada.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (CI/PR GitHub, tracker Forgejo, deploy manual verify→self-hosted, rollup required check)
- [x] Cutover em duas fases (gate 2026-08-19): sistema GitHub criado e validado primeiro; arquivos do Forgejo preservados nesta entrega, remoção em entrega sucessora pós-validação
- [x] Invariantes AGENTS/engineering-standards (sem migration, sem schema; plain Node stdlib nos helpers de CI; zero-dep nos workflows)
- [x] Testes de domínio previstos: github-api (normalização/endpoints), github-branch-protection (drift), github-pr-flow (draft policy/skips — pin OPS57/OPS64 no jeito GitHub)
