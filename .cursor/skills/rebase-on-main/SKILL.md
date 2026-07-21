---
name: rebase-on-main
description: >-
  Sync the current feature branch with latest origin/main via fetch + rebase,
  then resolve conflicts intelligently. Use after /simplify & /impeccable and
  before capture-review-debts when the user says "pull main, rebase on main,
  resolve conflicts", "rebase on main", "atualiza com main", "sincroniza com
  main", or asks to bring the worktree branch up to date with main.
---

# Rebase on main

Etapa do fluxo de entrega Teqo (worktree) **depois** de `/simplify` + `/impeccable` e **antes** de `capture-review-debts`: trazer `origin/main` e rebasear a branch da sessão, resolvendo conflitos com critério.

**Inspiração:** `superpowers:using-git-worktrees` (detecção de worktree), `babysit` (resolver conflitos preservando intent), regras de git do usuário (sem force-push, sem `--no-verify`).

**Announce at start:** "Using rebase-on-main to sync this branch with main."

## Checklist

```
- [ ] 1. Detectar ambiente (branch, worktree, dirty tree)
- [ ] 2. Fetch origin/main
- [ ] 3. Rebase da branch atual em cima de origin/main
- [ ] 4. Resolver conflitos (ou abortar e perguntar se intents colidem)
- [ ] 5. Verificar resultado e reportar
```

## Passo 1 — Detectar ambiente

Rode em paralelo:

```bash
git status -sb
git branch --show-current
git rev-parse --show-toplevel
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
git log --oneline -5 HEAD
git log --oneline -3 origin/main 2>/dev/null || true
```

**Guards (pare e explique se verdadeiros):**

| Condição                                     | Ação                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch é `main` / `master`                   | Não rebasear main em si. Pare.                                                                                                                                                           |
| Detached HEAD                                | Pare; peça branch nomeada ou checkout.                                                                                                                                                   |
| Working tree dirty (uncommitted)             | Stash **só** se o usuário autorizar; preferência: commit primeiro via `ship-to-main` parcial, ou stash com mensagem `rebase-on-main:<branch>`. Sem dirty tree limpa → não invente stash. |
| Rebase / merge / cherry-pick já em andamento | Continue ou `git rebase --abort` **só** com confirmação explícita.                                                                                                                       |

Se `GIT_DIR != GIT_COMMON` (e não é submodule): está em worktree — OK; rebase acontece **aqui**, na feature branch.

## Passo 2 — Fetch

```bash
git fetch origin main
```

Se `origin/main` não existir, tente `master`. Confirme o tip:

```bash
git rev-parse origin/main
git merge-base HEAD origin/main
git log --oneline --left-right HEAD...origin/main | head -40
```

Se já está up-to-date (`HEAD` contém `origin/main` e não há commits de main à frente): reporte "já sincronizado" e pare (sucesso no-op).

## Passo 3 — Rebase

```bash
git rebase origin/main
```

**Não** use `git pull --rebase` no main checkout para “atualizar a feature” — o rebase é da **feature atual** sobre `origin/main`.

**Não** force-push aqui. Se a branch já tinha sido pushed e o rebase reescreveu commits, o push (com `--force-with-lease` se necessário) fica para `ship-to-main` ou pedido explícito do usuário.

## Passo 4 — Resolver conflitos

Quando o rebase parar com conflitos:

1. Liste arquivos: `git status` / `git diff --name-only --diff-filter=U`
2. Para **cada** arquivo, leia ambos os lados e o contexto do projeto antes de editar.
3. **Gotcha do rebase:** durante `git rebase`, `ours` = branch base (`origin/main`) e `theirs` = o commit que está sendo reaplicado (sua feature). Não inverta mentalmente com merge.
4. Preserve **intent e correção** dos dois lados. Se os intents forem incompatíveis (ex.: main removeu a API que a feature estende), **`git rebase --abort`**, explique o conflito de produto, e pergunte — não “ganhe” um lado no escuro.
5. Após editar: `git add <files>` → `git rebase --continue` (editor: `GIT_EDITOR=true` ou `-c core.editor=true` se precisar não abrir editor interativo para a mensagem do commit).
6. Repita até o rebase terminar ou abortar com pergunta.

### Heurísticas Teqo (quando o arquivo conflitar)

| Superfície                                               | Como resolver                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/migrations/index.ts`                                | Unir **ambos** os exports/imports na ordem cronológica; nunca dropar migration de um dos lados.                                               |
| `src/migrations/*.ts` / `*.json`                         | Arquivos novos de lados diferentes → manter os dois. Mesmo timestamp/nome → pare e pergunte (não fundir SQL no escuro).                       |
| `src/payload-types.ts`                                   | Prefira regenerar (`pnpm generate:types`) **depois** do rebase limpo em vez de merge manual gigante, se o schema dos dois lados for coerente. |
| `docs/roadmap.md` / `docs/plans/*`                       | Preserve entregas `✓` de main **e** itens/planos novos da feature; não apague marca de entregue de main.                                      |
| Snapshots/fixtures (`plaza-catalog`, municipality codes) | Se main e feature divergiram o gerador, rode o rebuild/seed canônico do plano; não edite snapshot “no feeling”.                               |
| Lockfiles (`pnpm-lock.yaml`)                             | Aceite um lado e rode `pnpm install` para regenerar; não mescle lockfile à mão.                                                               |

### Quando abortar e perguntar

- Conflito em access control / Consent / uniqueness / migration destrutiva sem regra clara
- Main reverteu ou redesenhou a mesma feature
- Mais de ~5 arquivos com conflito sem padrão óbvio de união

```bash
git rebase --abort   # só neste caso, após explicar
```

## Passo 5 — Verificar e reportar

```bash
git status -sb
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Opcional e leve (se o rebase tocou schema/types): `pnpm exec tsc --noEmit` nos arquivos relevantes — **não** rode a suíte inteira salvo pedido.

**Resumo ao usuário (curto):**

1. Branch + worktree path
2. Quantos commits rebased / se no-op
3. Conflitos resolvidos (paths + uma linha de racional cada) **ou** “nenhum”
4. Se abortou: por quê + o que precisa de decisão
5. Próximo passo natural: `capture-review-debts` (se ainda não rodou), `ship-to-main`, ou o atalho `close-delivery` (rebase+debts+ship)

## Anti-padrões

| Nunca                                        | Em vez disso                                                  |
| -------------------------------------------- | ------------------------------------------------------------- |
| `git push --force` sem pedido                | Deixe force-with-lease para `ship-to-main` / pedido explícito |
| Resolver conflito sem ler os dois lados      | Abra o arquivo + `git show :1/:2/:3:` se precisar             |
| Continuar rebase com markers `<<<<<<<`       | Grep por `^<<<<<<<` antes de `--continue`                     |
| Rebasear em cima de `main` local stale       | Sempre `fetch` + `origin/main`                                |
| `reset --hard` para “limpar” conflito        | Abort ou resolve; hard reset só com pedido explícito          |
| Expandir escopo (refatorar além do conflito) | Só o necessário para o rebase passar                          |

## Posição no fluxo

```
suggest-next → implement-roadmap-item → /simplify+/impeccable
  → rebase-on-main → capture-review-debts → ship-to-main
  # ou atalho: close-delivery
```
