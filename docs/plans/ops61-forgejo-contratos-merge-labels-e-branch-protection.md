---
id: OPS61
depends: [OPS57]
serializes: []
priority: P2
model: ops
---

# OPS61 — Forgejo: contratos de merge/flip quebrados — labels não flipam (GITHUB_TOKEN 403) e branch protection de main não reportada

Débitos colhidos na sessão OPS57 (triage do /simplify + observação ao vivo):

## S1 — `issue-done-on-main-merge.yml` roda com GITHUB_TOKEN, que 403 em issues → labels nunca flipam

Observado ao vivo em 2026-08-18: PR #42 (OPS56) e PR #48 (OPS57) fecharam as
Issues #28/#44 (`state: closed`) mas os labels ficaram `in-progress`; o job
`issue-done` terminou success (o script `forgejo-issue-transition.mjs` engole o
erro no `try/catch` e loga "skip (403…)"). Flip manual necessário
(`node scripts/forgejo-issue-transition.mjs --pr 48` com `FORGEJO_API_TOKEN`).
O AGENT-OPS (tabela de secrets) já documenta: "`GITHUB_TOKEN` costuma 403" —
por isso o pool usa o PAT `POOL_GITHUB_TOKEN` (actions:write + issues:write).
Mesmo padrão no `plan-issue-ready-on-main-merge.yml` (`agent-promote-related-on-merge.mjs`,
promote blocked → ready via OPS18) — candidato ao mesmo 403, verificar.

Impacto: o contrato do pipeline "CI flipa `done`/`in-prod` no merge"
(execution-pipeline passo 7, issue-done-on-main-merge.yml) quebra em silêncio —
labels de status mentem e o `project-status`/triage perde o estado real.

## S3 — Branch protection de `main`: docs dizem que existe (`checks` required), API reporta 0 regras

`agent-pr-workflow.mdc` ("Branch protection on `main` requires only: `checks`"),
`docs/AGENT-OPS.md` e o comentário do `agent-pr-ready-automerge.yml` assumem a
regra no servidor; o `GET /branch_protections` do Forgejo (token admin)
retorna **0 regras**. O gate de checks hoje vive inteiramente no script
(`waitForChecks`), não no servidor — push direto em main com CI vermelho
passaria sem proteção. Há `scripts/configure-branch-protection.mjs` (idempotente,
`pnpm configure:branch-protection`) para aplicar/consertar.

**Evidência ao vivo (2026-08-18, PR #52):** o `waitForChecks` mergeou com o
CI vermelho. A raça: o script considera "tudo verde" quando os statuses do sha
têm zero `pending`/`failure` — mas jobs **ainda não agendados** (na fila do
runner) não postam status nenhum, então um snapshot antes do `docs-guards`
postar (failure) parece verde e o merge dispara; o `docs-guards` postou
`failure` depois. O rollup `checks` (que espera todos os jobs) é o único
contexto que garante "CI completo" — o `waitForChecks` não o espera
especificamente. A mesma classe do incidente OPS52, agora causada pelo
snapshot parcial em vez do veredito do POST.

## Abordagem

**Fase 1 (S1):** trocar o token dos dois workflows de pós-merge
(`issue-done-on-main-merge.yml`, `plan-issue-ready-on-main-merge.yml`) pelo PAT
com `issues:write` (o `POOL_GITHUB_TOKEN` existente, ou um PAT dedicado —
decisão de execução) via `env:` no step. Verificar que `issue-done` flipe
`done`/`in-prod` e o `plan-issue-ready` promova `ready` numa PR real de teste
(PR de docs com `Closes #N`).

**Fase 2 (S3):** rodar `pnpm configure:branch-protection` (dry-run primeiro)
e investigar por que a regra não está no servidor (API path/permissão/regra
com nome diferente). **Fase 2b (raça do waitForChecks, evidência PR #52):**
`waitForChecks` deve esperar o rollup `CI (PR) / checks` (o único contexto que
cobre todos os jobs do ci-pr) além dos statuses do sha — um snapshot com jobs
não-agendados não pode parecer verde; a branch protection no servidor (regra
`checks` required) é a defesa final para o merge agendado (o "merge when
checks succeed" do Forgejo, que hoje mergeou cedo demais por não haver regra).
Desfecho esperado: regra `main` com `enable_status_check: checks` no servidor
**ou** docs corrigidas para "gate no script, não no servidor" (se a API/Forgejo
9 não expuser a regra criada — registrar o achado).

**Rejeitado:** tornar o script `forgejo-issue-transition.mjs` tolerante a 403
(engolir mais é pior — o job deve falhar ruidoso se o flip falhar).

## Appetite

~1 dia de ops (2 fases pequenas + verificação ao vivo).

## Já resolvido no simplify (não reabrir)

- Veto de draft em conversão mid-run (`waitForChecks`/`autoMerge` param em PR
  draft) + spec — OPS57 fix.
- CLI valida `base.ref === 'main'` — OPS57 fix.
- Docs sem o mecanismo fantasma `gh pr` — OPS57 fix.
- Comentário do fork guard (por que não desce pro CLI) — OPS57 fix.
- `head.repo.full_name` validado empiricamente (run 1347 mergeou a PR #48).

## Explicitamente fora

- CLI `forgejo-pr-automerge.mjs` sem seam de teste (P3-2 do simplify): **defer
  com gatilho** — adicionar spec do CLI na próxima mudança de política do
  script (estrutura pré-existente, 3 linhas de branch).
- Re-check de same-repo dentro do CLI (P2 do reviewer): **descartado** — em PR
  de fork o checkout já roda o script do fork; o guard só é seguro no `if:` do
  workflow (racional documentado no comentário do YAML).
- PRs históricas `refs/pull/N/head` (era da migração): não acionável.
