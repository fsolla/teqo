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
3. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push` (não
   `git push` nu).

Tracer bullet cedo se o item for grande. Inclua o `*-impl.md` no commit da
entrega.

## /simplify + débitos

1. Rode o comando `/simplify` completo (3 reviewers paralelos via Task,
   read-only) no diff da sessão.
2. Aplique fixes pontuais que preservem comportamento.
3. Rode `capture-review-debts` no modo do ator (ver deltas). Nunca edite a
   Issue `in-progress` atual para absorver débitos.

## Fechar em main

1. Branch do ator (ver deltas) — nunca crie branch nova fora dela.
2. **`pnpm push -u origin HEAD`**
3. PR **Ready** (nunca draft): `gh pr create --base main` com `Closes #<N>`
4. `gh pr merge --auto --merge` imediatamente
5. `gh pr checks <PR> --watch --required` (`checks` + `migration-lock`; ignore
   Vercel Git)
6. CI flipa `done`/`in-prod` no merge. Comente na Issue o desfecho em uma linha.

## Deltas por ator

| Ator | Branch | UI | `capture-review-debts` | Cloud |
| ---- | ------ | --- | ---------------------- | ----- |
| **Humano** (`work-issue`) | `<Code>-<slug>` (worktree; nunca crie branch nova na sessão) | shape → craft → critique → polish | **com gate humano** — colha, pontue e apresente antes de registrar | n/a (máquina do humano) |
| **Pool** (`agent-work-issue`) | `agent/<id>-<slug>` (worktrees Cursor podem já ter criado) | shape → craft → critique → polish (harden/optimize só sob gatilho) | **autônomo** — só `expensive_lock` com score ≥4 (Issues novas com `depends`); score ≤3 / cheap_polish / defer_trigger → defer no `*-impl.md` ou descarte | `ManagePullRequest` com `draft: false`; Prep Cloud no Passo 0 |
