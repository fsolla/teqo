---
name: ship-to-main
description: >-
  Commit all session work, push the feature branch, merge into main, push main,
  then remove the session git worktree and delete the feature branch. Use after
  capture-review-debts when the user says "commit all, push, merge to main",
  "ship", "merge to main", "fecha a entrega", "sobe pro main", or asks to finish
  the worktree session and land on main.
---

# Ship to main

Etapa final do fluxo de entrega Teqo em worktree: **commit all → push feature → merge em main → push main → apagar worktree da sessão**.

**Inspiração:** `superpowers:finishing-a-development-branch` (merge local + cleanup de worktree com `cd` no repo principal), regras de commit/PR do usuário, `gh` quando houver PR aberto.

**Announce at start:** "Using ship-to-main to land this branch on main and clean up the worktree."

**Pré-condição típica:** `rebase-on-main` já rodou (branch em dia com `origin/main`). Se estiver atrás de main, rode `rebase-on-main` antes de mergear — não mergeie feature stale.

## Checklist

```
- [ ] 1. Detectar ambiente (branch, MAIN_ROOT, worktree path)
- [ ] 2. Commit all (se houver mudanças; seguir protocolo de commit)
- [ ] 3. Push da feature branch
- [ ] 4. Merge da feature em main (no checkout principal) + push main
- [ ] 5. Remover worktree da sessão + deletar feature branch
- [ ] 6. Reportar URLs/SHAs e avisar se a sessão Cursor ficou em path morto
```

## Passo 1 — Detectar ambiente

```bash
git status -sb
FEATURE_BRANCH=$(git branch --show-current)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
# Primary checkout (safe even when CWD is a linked worktree):
MAIN_ROOT=$(git worktree list --porcelain | awk '/^worktree / {print $2; exit}')
git worktree list
git -C "$MAIN_ROOT" branch --show-current
git fetch origin main
git merge-base --is-ancestor origin/main HEAD && echo "in-sync-or-ahead" || echo "behind-main"
```

Se `GIT_DIR == GIT_COMMON`, você já está no checkout principal: `MAIN_ROOT="$WORKTREE_PATH"` e o Passo 5a vira no-op.

**Guards:**

| Condição                                  | Ação                                                  |
| ----------------------------------------- | ----------------------------------------------------- |
| `FEATURE_BRANCH` é `main`/`master`        | Pare — não “ship” de main para main.                  |
| Detached HEAD                             | Pare — precisa de branch nomeada.                     |
| Rebase/merge em andamento                 | Termine ou aborte antes.                              |
| Feature atrás de `origin/main`            | Rode `rebase-on-main` primeiro.                       |
| Usuário pediu só commit / só push / só PR | Não execute o fluxo completo; honre o pedido parcial. |

Capture `WORKTREE_PATH` **antes** de qualquer `cd` — é o path a remover no Passo 5.

## Passo 2 — Commit all

Siga o protocolo de commit do usuário (status + diff staged/unstaged + log recente **em paralelo**; mensagem via HEREDOC; sem `--no-verify`; sem amend salvo regras dele).

```bash
git status -sb
git diff --stat && git diff --cached --stat
git log -5 --oneline
```

- Inclua arquivos relevantes da entrega (código + docs de roadmap/planos da sessão).
- **Não** commite segredos (`.env`, credenciais).
- Se working tree limpa e já há commits na feature: pule o commit, siga.
- Mensagem: 1–2 frases no estilo do repo, foco no **porquê** da entrega (item do roadmap se conhecido).

## Passo 3 — Push da feature

```bash
git push -u origin HEAD
```

Se o rebase reescreveu commits já pushed e o push for rejeitado:

```bash
git push --force-with-lease origin HEAD
```

Use `--force-with-lease` **somente** neste caso (feature branch própria, nunca `main`). Sem lease cego (`--force`).

## Passo 4 — Merge em main e push main

Tudo a partir do **checkout principal**, nunca de dentro do worktree da feature:

```bash
cd "$MAIN_ROOT"
git checkout main
git pull --ff-only origin main
git merge --no-ff "$FEATURE_BRANCH" -m "Merge branch '$FEATURE_BRANCH'"
```

Preferência Teqo (solo / worktree): merge local. Se `git pull --ff-only` falhar, pare e diagnostique — não force main.

**Alternativa só se o usuário pedir PR em vez de merge local:**

```bash
gh pr create --title "…" --body "…"   # ou merge de PR existente
gh pr merge --merge   # ou --squash se o usuário pedir
```

Após merge local bem-sucedido:

```bash
git push origin main
```

Verifique:

```bash
git status -sb
git log -3 --oneline
git -C "$MAIN_ROOT" merge-base --is-ancestor "$FEATURE_BRANCH" main && echo "feature ⊆ main"
```

**Só avance ao Passo 5 se main contém a feature e o push de main OK.**

Se testes/CI forem gate explícito do usuário neste momento, espere; caso contrário não rode a suíte completa de AGENTS.md de novo (já veio de simplify/implement).

## Passo 5 — Apagar worktree + branch

Ordem obrigatória (igual Superpowers): **merge OK → remove worktree → delete branch**. Nunca delete a branch enquanto o worktree ainda a referencia.

```bash
cd "$MAIN_ROOT"
```

### 5a. Remover worktree da sessão

Se `WORKTREE_PATH` == `MAIN_ROOT`: **não remova** — não há worktree extra.

Se `WORKTREE_PATH` ≠ `MAIN_ROOT`:

```bash
git worktree remove "$WORKTREE_PATH"
# Se dirty residual após merge (raro):
# git worktree remove --force "$WORKTREE_PATH"
git worktree prune
```

**Cursor / harness (`~/.cursor/worktrees/...`):** esta skill **é** o consentimento explícito para remover o worktree da sessão após o merge — diferente do default cauteloso de `finishing-a-development-branch`. Ainda assim:

- Remova **somente** o `WORKTREE_PATH` da sessão atual, nunca outros worktrees listados.
- Remova sempre com CWD em `$MAIN_ROOT`.
- Avise que a janela/agente Cursor pode estar apontando para um diretório já apagado — o usuário deve reabrir o checkout principal (`$MAIN_ROOT`).

Se existir ferramenta nativa de exit/cleanup de worktree do harness, prefira-a; senão `git worktree remove` como acima.

### 5b. Deletar feature branch

```bash
git branch -d "$FEATURE_BRANCH"
git push origin --delete "$FEATURE_BRANCH" 2>/dev/null || true
```

Use `-d` (safe). Só `-D` se o merge foi confirmado mas o Git ainda reclama e você verificou `feature ⊆ main`.

## Passo 6 — Resumo

1. SHA de `main` após o merge + mensagem do merge/commit
2. Feature branch deleted? remote deleted?
3. Worktree removido: path (ou “n/a — já era main”)
4. Aviso Cursor se aplicável: reabrir `$MAIN_ROOT`
5. Próximo passo natural: `suggest-next-roadmap-items`

## Anti-padrões

| Nunca                                                        | Em vez disso                              |
| ------------------------------------------------------------ | ----------------------------------------- |
| Mergear de dentro do worktree feature com checkout bagunçado | `cd "$MAIN_ROOT"` → checkout main → merge |
| `git worktree remove` com CWD dentro do worktree             | Sempre a partir de `$MAIN_ROOT`           |
| Apagar worktree **antes** do merge/push de main OK           | Passo 4 completo primeiro                 |
| Remover _outros_ worktrees do `git worktree list`            | Só `WORKTREE_PATH` da sessão              |
| `push --force` em `main`                                     | Só ff / merge commit normal               |
| `git clean -fdx` / `reset --hard` no main                    | Fora de escopo                            |
| Pular commit com mudanças uncommitted                        | Commit no Passo 2 ou pergunte             |

## Posição no fluxo

```
suggest-next → implement-roadmap-item → /simplify+/impeccable
  → rebase-on-main → capture-review-debts → ship-to-main
  # ou atalho: close-delivery
```
