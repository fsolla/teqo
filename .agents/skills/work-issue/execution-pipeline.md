# Pipeline de execução compartilhada (work-issue / agent-work-issue)

Mecânica comum de execução → fechamento das duas skills do fluxo (humano e
workers do pool). O corpo mora aqui; cada skill declara os **deltas do seu
ator** e referencia este material — nenhuma é "base" da outra.

## Executar

Ordem:

1. **Schema/server** — migrations (`payload-migrations`), utilities, actions,
   testes de domínio. Invariantes do engineering-brief.
2. **UI** — se Impeccable B/C/D: shape → craft → critique → polish. Tokens
   `data-theme='campaign'`; shells existentes.
3. **E2E local afetado (OPS72, discricionário)** — antes do push, rode
   localmente os e2e que você **criou** + os da **mesma superfície afetada**
   (você decide quais). Ver §E2E local afetado.
4. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push` (não
   `git push` nu).

Tracer bullet cedo se o item for grande. Inclua o `*-impl.md` no commit da
entrega.

## E2E local afetado (OPS72)

Política de e2e: **local = discricionário, CI/PR = blast radius, main = full
antes do deploy**.

- **O que rodar:** os specs e2e que o diff **criou** (novos `.e2e.spec.ts`) +
  os da mesma superfície trabalhada (o `E2E_AFFECTED_MANIFEST` mapeia
  `src/` → specs; a mecânica do CI é a mesma). **É discricionário: você
  decide quais rodar** — não é um gate mecânico e não está no `gate:push`.
- **Ferramenta:** `pnpm test:e2e:affected` (espelho local do classifier:
  modo `none`/`selected`/`full` conforme o diff; roda `migrate` +
  `db:seed:minimal` antes). Alternativa para specs diretas:
  `pnpm test:e2e --no-deps -- tests/e2e/<spec>.e2e.spec.ts` (ou
  `--no-deps --project=<família>`).
- **CI/PR:** roda só o **blast radius** detectado (`ci-scope.mjs`, modo
  `selected`) — nunca `full`. Diff high-risk (schema/lockfile/harness)
  classifica `full` → o PR não roda e2e: o full fica para o `verify` do
  deploy manual (antes de publicar) e, nesse mesmo diff, o espelho local
  roda full.
- **Limitação da #72 (S3-FOLLOWUP):** e2e local com `--no-deps` + projetos
  paralelos (`--project=a --project=b`) colide no `seedTestUser` (delete +
  create concorrentes nos `beforeAll` → `ValidationError: email` e falhas
  fantasma). Use `--workers=1` ou a cadeia padrão de projetos. Só afeta o
  local — no CI os projetos rodam sequenciais por construção.

## /simplify + débitos

1. Rode o comando `/simplify` completo (3 reviewers paralelos via Task,
   read-only) no diff da sessão.
2. Aplique fixes pontuais que preservem comportamento.
3. Rode `capture-review-debts` no modo do ator (ver deltas). Nunca edite a
   Issue `in-progress` atual para absorver débitos.

## Fechar em main

1. Branch do ator (ver deltas) — nunca crie branch nova fora dela.
2. **Changelog da entrega (OPS44):** escreva `docs/changelog/<data>-<id>.md`
   (ex. `2026-08-13-ops44.md`) — uma entrada curta no formato do agregado —
   e rode `pnpm changelog:build` para regenerar `docs/CHANGELOG-AGENTS.md`
   (insert-only: entradas históricas nunca mudam; o diff será só a entrada
   nova + o agregado). Rode `pnpm changelog:check` para confirmar.
3. **`pnpm push -u origin HEAD`** — origin é o **GitHub** (OPS71; o tracker de
   Issues continua no Forgejo por API).
4. PR no **GitHub** via `GITHUB_TOKEN=<PAT> node scripts/github-pr.mjs --head <branch> --title "<id> — <título>" --body-file <arquivo>` — **Ready** (nunca draft; o script não tem flag draft), base `main`, body com `Closes #<N>` (ou `Related #N` em plans-only). Em Cursor Cloud: `ManagePullRequest` com `draft: false`.
5. O safety net `agent-pr-ready-automerge.yml` arma o **auto-merge nativo do
   GitHub** (`enablePullRequestAutoMerge`, rebase) — o servidor mergea quando
   o required check `CI (PR) / checks` fica verde; nada a armar.
6. No merge, o workflow `issue-done-on-main-merge.yml` flipa `done`/`in-prod`
   **no Forgejo** (lê o body do PR via API do GitHub, escreve no tracker por
   `FORGEJO_API_TOKEN`). Comente na Issue o desfecho em uma linha.

## Deltas por ator

| Ator | Branch | UI | `capture-review-debts` | Cloud |
| ---- | ------ | --- | ---------------------- | ----- |
| **Humano** (`work-issue`) | `<Code>-<slug>` (worktree; nunca crie branch nova na sessão) | shape → craft → critique → polish | **autônomo** — decide o destino dos achados (registrar/absorver/deferir/descartar) pela triage da skill; sem pausa para o humano | n/a (máquina do humano) |
| **Pool** (`agent-work-issue`) | `agent/<id>-<slug>` (worktrees Cursor podem já ter criado) | shape → craft → critique → polish (harden/optimize só sob gatilho) | **autônomo** — só `expensive_lock` com score ≥4 (Issues novas com `depends`); score ≤3 / cheap_polish / defer_trigger → defer no `*-impl.md` ou descarte | `ManagePullRequest` com `draft: false`; Prep Cloud no Passo 0 |
