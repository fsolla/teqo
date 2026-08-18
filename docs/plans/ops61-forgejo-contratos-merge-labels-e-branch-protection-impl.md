# Impl: OPS61 — Forgejo: contratos de merge/flip quebrados — labels não flipam (GITHUB_TOKEN 403) e branch protection de main não reportada

Status: aprovado
Atualizado em: 2026-08-18
Issue: #53
Intenção: docs/plans/ops61-forgejo-contratos-merge-labels-e-branch-protection.md
Appetite restante: herdado (~1 dia de ops)

## Leitura da intenção

- **Outcome:** (S1) os dois workflows pós-merge usam PAT com `issues:write` — `Closes/Fixes #N` flipe `done`+`in-prod` e `Related #N` promova `ready` em PRs reais; (S3) a regra de branch protection de `main` (required status check = rollup `checks` do ci-pr) existe no servidor ou as docs dizem a verdade ("gate no script, não no servidor"); (2b) `waitForChecks` espera o rollup `CI (PR) / checks` — snapshot com jobs não-agendados nunca parece verde.
- **O que NÃO negociar:** o flip deve **falhar ruidoso** se falhar (rejeitado: engolir 403); nenhuma edição de Issues `in-progress` de terceiros; nada de prod DB (ops de Forgejo, não de DB).
- **O que reavaliar:** qual PAT usar (intenção sugere `POOL_GITHUB_TOKEN`); por que a regra não está no servidor; o contexto exato que a regra exige (a intenção supunha `checks`).

## Achados da exploração (evidência ao vivo 2026-08-18)

1. **S1 root cause:** `forgejo-api.mjs` resolve token na ordem `FORGEJO_API_TOKEN` → `GITHUB_TOKEN`. Nos dois workflows pós-merge nenhum `env:` injeta o PAT → cai no `GITHUB_TOKEN` nativo, que 403 em labels/comments de Issues. Os jobs terminam success porque os scripts engolem o erro no `try/catch`.
2. **Fork guard ausente** nos dois workflows pós-merge: `on: pull_request: types: [closed]` dispara também para PRs de fork e o `actions/checkout` faz checkout do **head do fork** → o script do fork roda com o token do Actions. O workflow irmão `agent-pr-ready-automerge.yml` tem o guard `head.repo.full_name == github.repository` exatamente por isso (RCE com o token). Injetar um PAT com `issues:write` nesses workflows **sem** o guard agrava o buraco — o guard entra junto.
3. **S3 root cause:** `GET /repos/fsolla/teqo/branch_protections` → `[]` (0 regras, confirmado). O changelog do OPS50 lista `pnpm configure:branch-protection` como **passo humano pendente** ("Pendente (parte 2): … passos humanos (secrets no Forgejo, `pnpm configure:branch-protection`, …)") — o script nunca rodou pós-port. `CUTOVER-MAIN-ONLY.md`, `AGENT-OPS.md` e `agent-pr-workflow.mdc` documentam a regra como aplicada — docs mentem.
4. **Contexto real do rollup:** statuses observados do sha do PR #52/#48/#50: `CI (PR) / checks (pull_request)` (contexto inclui o sufixo ` (evento)`). O `checks` do `ci-pr.yml` tem `if: always()` + `needs` de todos os jobs → só posta depois da cascata inteira.
5. **Como o Forgejo casa os contextos da regra:** fonte (branch `forgejo`): `MergeRequiredContextsCommitStatus` compila cada `status_check_contexts` com **glob** (gobwas/glob, `glob.Compile(ctx)`) e casa contra `commitStatus.Context`; contexto exigido que não casa **nenhum** status → `pending` (bloqueia merge). Ou seja: `checks` literal **nunca** casaria `CI (PR) / checks (pull_request)` — a regra, mesmo se aplicada com o valor atual do script, bloquearia todo merge silenciosamente. O glob `CI (PR) / checks*` casa o rollup real (o sufixo ` (pull_request)` não contém `/`, então casa com ou sem semântica de separador).
6. **O servidor realmente bloqueia:** o merge POST passa por `CheckPullBranchProtections` → `IsPullCommitStatusPass` → `ErrDisallowedToMerge` (405 "PR is not ready to be merged"). A regra no servidor é a defesa final real (o plano da intenção suspeitava que o Forgejo 9 pudesse não expor; a expõe e bloqueia).
7. **Timeouts:** `waitForChecks` default 30 min; o workflow `ready-automerge` tem `timeout-minutes: 40`. Com o gate do rollup esperamos a cascata inteira (incl. e2e×2, int, build) — 30 min fica apertado sob carga (capacity 4, pool em paralelo). Subir CLI para 45 min e workflow para 55 min.

## Abordagem recomendada

```mermaid
flowchart LR
  A[PRs pós-merge: env FORGEJO_API_TOKEN + fork guard] --> B[flip real com PAT]
  C[waitForChecks: gate do rollup CI (PR) / checks*] --> D[merge só com cascata completa]
  E[configure-branch-protection: glob real + idempotente] --> F[regra no servidor = defesa final]
  G[PR da entrega Closes #53] --> H[verificação ao vivo de S1 e S3]
```

**Opções consideradas:**

- S1: (A) `FORGEJO_API_TOKEN` nos dois workflows; (B) `POOL_GITHUB_TOKEN`; (C) PAT dedicado novo.
- S3: (A) script corrigido (glob real) + idempotente + rodar; (B) rodar script como está (`checks` literal); (C) contexto literal exato `CI (PR) / checks (pull_request)`; (D) docs-only ("gate no script").
- 2b: (A) gate do rollup no `waitForChecks` + `mergeable === false` só após cascata assentar + timeouts maiores; (B) lista exaustiva de contextos; (C) só regra no servidor.

**Recomendação:** S1-A + S3-A + 2b-A — porque:

- **S1-A:** o `forgejo-api.mjs` já prefere `FORGEJO_API_TOKEN`; é o PAT que o pool usa em produção para o mesmo tipo de escrita (claim = flip de labels, comments, issues) — escopo `issues:write` comprovado; secret já existe no Forgejo (pool roda verde). `POOL_GITHUB_TOKEN` (B) existe para `/actions/variables` (o 403 que ele resolve é de variables, não de issues) e é redundante para este uso; (C) cria provisioning humano sem ganho.
- **S3-A:** o glob `CI (PR) / checks*` é o único valor que casa os statuses reais (achado 5); o script vira GET→POST/PATCH idempotente com dry-run honesto (criar/atualizar/no-op), fechando a promessa "idempotente" do próprio doc. (B) criaria regra que nunca casa → todo merge bloqueado (pior que nada). (C) funciona (casamento exato) mas é frágil ao formato do sufixo ` (evento)`; `*` é resiliente e igualmente preciso (o literal `CI (PR) / checks` antes do `*` não casa o `CI / checks` do push).
- **2b-A:** o rollup é o único contexto com `if: always()` sobre a cascata toda; exigir presença+success dele mata a raça (snapshot pré-`docs-guards` não tem rollup → pending). `mergeable === false` passa a lançar só depois do rollup assentar (senão a regra recém-aplicada faria o CLI lançar "conflito" prematuro durante a CI). (B) é frágil a mudanças de jobs; (C) sozinho faz o merge falhar ruidoso em vez de esperar — o gate no script é que espera.
- **Fail-loud do flip (racional da intenção):** `forgejo-issue-transition.mjs` passa a sair com exit 1 se qualquer flip falhar (o job é o propósito inteiro do workflow); `agent-promote-related-on-merge.mjs` mantém o soft-skip documentado (safety net multi-issue por design — falha de uma Issue não aborta irmãs; a troca de token é o fix da causa raiz).

**Rejeitadas:** engolir 403 no script (intenção veto); `POOL_GITHUB_TOKEN` (semântica de variables); `checks` literal (glob nunca casa — merges bloqueados para sempre); lista de contextos (frágil); confiar só no servidor (merge falha em vez de esperar); docs-only (a regra funciona e é a defesa final real).

### Componentes / mudanças

- **`.forgejo/workflows/issue-done-on-main-merge.yml`**: `if:` ganha o fork guard (`head.repo.full_name == github.repository`); job `env: FORGEJO_API_TOKEN: ${{ secrets.FORGEJO_API_TOKEN }}`; comentário do header explica o PAT (GITHUB_TOKEN 403 em Issues).
- **`.forgejo/workflows/plan-issue-ready-on-main-merge.yml`**: idem (fork guard + env + header).
- **`scripts/lib/forgejo-api.mjs`** (`waitForChecks`): novo gate — entre os statuses do sha, o contexto que começa com `CI (PR) / checks` deve existir e ser `success` (failure/error → throw; ausente/pending → continua poll); `mergeable === false` só lança se o rollup já assentou (success); restante (failure/error de outros contextos, pending, draft, timeout) preservado.
- **`scripts/forgejo-pr-automerge.mjs`**: passa `timeoutMs: 45 * 60 * 1000` explícito ao `autoMerge`.
- **`.forgejo/workflows/agent-pr-ready-automerge.yml`**: `timeout-minutes: 40` → `55`.
- **`scripts/forgejo-issue-transition.mjs`**: falhas de flip viram exit 1 (log continua por Issue, com `continue` entre irmãs — não aborta a lista inteira, mas o job vermelha).
- **`scripts/configure-branch-protection.mjs`**: `status_check_contexts: ['CI (PR) / checks*']`; fluxo idempotente GET → POST (cria) / PATCH (atualiza se drift) / no-op (igual); dry-run imprime a ação exata; após aplicar, re-lê e loga a regra.
- **`scripts/lib/branch-protection.mjs`** (novo, puro): `planBranchProtectionRule(existing, desired)` → `create | update | noop` (testável). Reusa o shape da API.
- **Docs:** `docs/AGENT-OPS.md` (tabela de workflows: token usado; secrets: nota que `FORGEJO_API_TOKEN` cobre os pós-merge; estado da branch protection), `.agents/rules/agent-pr-workflow.mdc` (seção "Required checks": contexto literal `CI (PR) / checks`, regra aplicada no servidor; seção safety net: gate do rollup), `docs/CUTOVER-MAIN-ONLY.md` (checkbox da branch protection = aplicado em 2026-08-18), `README.md` (linha 5 stale: remove `VERCEL_*`, atualiza a linha da branch protection).
- **Tests:** `tests/unit/forgejoApi.unit.spec.ts` — novos casos de `waitForChecks`: (a) statuses verdes mas sem rollup → continua poll (a raça); (b) rollup presente success → retorna; (c) rollup failure → lança; (d) `mergeable === false` antes do rollup assentar → continua; (e) `mergeable === false` após rollup success → lança. `tests/unit/branchProtection.unit.spec.ts` (novo) — decisão create/update/noop + glob casa os contextos observados.
- **Migration:** sem migration (não toca schema/DB).
- **Access / Consent:** N/A.
- **UI:** N/A (A).

## Fases verificáveis

1. **Scripts + workflows + docs + testes** — diff completo do PR da entrega; `pnpm gate:fast` local (lint/format/typecheck/knip/cycles/unit).
2. **Push + PR** — `pnpm push`; PR `Closes #53`. Enquanto a CI roda: **aplicar a regra no servidor** (`pnpm configure:branch-protection -- --dry-run` → aplicar → `GET /branch_protections` confirma). A auto-merge da própria PR prova o gate do rollup (2b) e a regra (S3) num único ciclo: `waitForChecks` espera a cascata → rollup green → merge permitido pela regra → merge. Se o glob estiver errado, o merge 405/`mergeable=false` falha ruidoso e corrigimos antes de qualquer outra PR.
3. **Flip (S1) ao vivo** — o merge dispara `issue-done-on-main-merge.yml` com o PAT; a Issue #53 vira `done`+`in-prod` com comentário. Se não flipar, o job agora vermelha (exit 1) — visível.
4. **Changelog** — `docs/changelog/2026-08-18-ops61.md` + `pnpm changelog:build`.

## Rabbit holes / Não escopo (engenharia)

- Não mudar o soft-skip do `agent-promote-related-on-merge.mjs` (design documentado; token é o fix).
- Não mexer no merge do pool (usa os mesmos caminhos — herda o fix).
- Não reaplicar/alterar `enable_push`/approvals da regra (0 reviews, strict=false — contrato atual).
- Não corrigir o `README.md` inteiro (drift pré-existente pós-OPS50) — só a linha do escopo.
- Guard de fork como débito? Não — entra na entrega (achado 2, mesmo arquivo, mesma classe do guard do irmão).

## Riscos e mitigação

- **Glob da regra errado → todo merge bloqueado:** mitigação — verificação empírica na própria PR da entrega (Fase 2); falha é ruidosa (405/throw) e reversível (PATCH contexts); a fonte do Forgejo confirmou o casamento por glob e o valor observado.
- **`mergeable === false` prematuro com regra aplicada durante a CI:** mitigação — lançar só após o rollup assentar; a PR da entrega exercita exatamente esse caminho.
- **Cascata completa estoura o timeout (esperamos e2e agora):** mitigação — CLI 45 min + workflow 55 min; medir na PR da entrega e ajustar se a folga for pequena.
- **PRs de fork param de flipar issues pós-merge:** comportamento novo e intencional (guard) — documentado no changelog; flip manual para fork PRs se algum dia precisar.
- **Secret `FORGEJO_API_TOKEN` não ter `issues:write`:** mitigação — o pool já escreve issues/labels/comments com ele em produção (evidência: runs verdes); se faltar escopo, o job vermelha (exit 1) e o humano ajusta o PAT — visível, não silencioso.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (flip real, regra no servidor, rollup gate, fail ruidoso)
- [ ] Invariantes AGENTS/engineering-standards (zero-dep scripts, forks nunca rodam código com token do repo, docs honestas)
- [ ] Testes de domínio previstos (unit: waitForChecks ×5, branchProtection ×3) onde os write/merge paths mudam
- [ ] Verificação ao vivo: #53 flipe `done`+`in-prod` com PAT; `GET /branch_protections` mostra a regra; PR da entrega mergeia pelo novo gate
