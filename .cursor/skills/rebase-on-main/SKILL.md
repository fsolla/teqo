---
name: rebase-on-main
description: >-
  Sync the current feature branch with latest origin/main via fetch + rebase,
  then resolve conflicts intelligently. Auto-handles a dirty tree (commit WIP
  or stash+pop — no asking). Use after /simplify & /impeccable and before
  capture-review-debts when the user says "pull main, rebase on main, resolve
  conflicts", "rebase on main", "atualiza com main", "sincroniza com main",
  or asks to bring the worktree branch up to date with main.
---

# Rebase on main

Etapa do fluxo de entrega Teqo (worktree) **depois** de `/simplify` + `/impeccable` e **antes** de `capture-review-debts`: trazer `origin/main` e rebasear a branch da sessão, resolvendo conflitos com critério.

**Inspiração:** `superpowers:using-git-worktrees` (detecção de worktree), `babysit` (resolver conflitos preservando intent), regras de git do usuário (sem force-push, sem `--no-verify`).

**Announce at start:** "Using rebase-on-main to sync this branch with main."

## Checklist

```
- [ ] 1. Detectar ambiente (branch, worktree, dirty tree)
- [ ] 1b. Se dirty: decidir commit vs stash (sem perguntar) e limpar a árvore
- [ ] 2. Fetch origin/main
- [ ] 3. Rebase da branch atual em cima de origin/main
- [ ] 4. Resolver conflitos do rebase (ou abortar e perguntar se intents colidem)
- [ ] 4b. Se usou stash: stash pop e resolver conflitos do pop
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

Se dirty, também colete (em paralelo com o restante do diagnóstico):

```bash
git diff --stat
git diff --cached --stat
git diff --name-only
git diff --cached --name-only
git status --porcelain
git log --oneline origin/main..HEAD 2>/dev/null | head -20
git diff --name-only origin/main...HEAD 2>/dev/null
```

**Guards (pare e explique se verdadeiros):**

| Condição                                     | Ação                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Branch é `main` / `master`                   | Não rebasear main em si. Pare.                                                             |
| Detached HEAD                                | Pare; peça branch nomeada ou checkout.                                                     |
| Working tree dirty (uncommitted)             | **Não pergunte.** Decida e execute sozinho — ver [Passo 1b](#passo-1b--árvore-suja-auto). |
| Rebase / merge / cherry-pick já em andamento | Continue ou `git rebase --abort` **só** com confirmação explícita.                         |

Se `GIT_DIR != GIT_COMMON` (e não é submodule): está em worktree — OK; rebase acontece **aqui**, na feature branch.

## Passo 1b — Árvore suja (auto)

Objetivo: working tree limpa **antes** do rebase, sem pedir autorização. Escolha **um** caminho e anuncie em uma linha (“dirty → commit …” ou “dirty → stash …”).

### Decisão (avaliar nesta ordem; primeira que bater vence)

| #   | Condição                                                                                                                                                                                                                              | Caminho   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | Há secretos / credenciais / env local no dirty set (`.env`, `.env.*`, `credentials.json`, `*.pem`, tokens óbvios no diff)                                                                                                              | **stash** |
| 2   | Dirty é só ruído local / efêmero: untracked scratch, IDE/OS (`.DS_Store`, `.idea/`, `*.swp`), cache, arquivos fora de `src/` `tests/` `docs/` `scripts/` `.cursor/skills/` `.github/` e sem relação com o tip da branch                 | **stash** |
| 3   | Dirty é mistura: parte parece WIP da feature **e** parte é ruído/local/secrets → **não** faça commit parcial no escuro                                                                                                                | **stash** |
| 4   | Diff é WIP intencional da feature: toca os mesmos paths (ou domínio) de `origin/main...HEAD`, ou continua o intent dos commits recentes da branch; dá para redigir **uma** mensagem de commit coerente com o estilo do repo         | **commit** |
| 5   | Branch ainda sem commits próprios (`origin/main..HEAD` vazio) mas o dirty é claramente o trabalho da feature (plano/roadmap item, arquivos de entrega) e a mensagem fecha em uma frase                                                | **commit** |
| 6   | Caso ambíguo / WIP quebrado demais para descrever sem inventar história / não passa no feeling de “um commit”                                                                                                                         | **stash** |

**Default se empatar:** **stash** (reversível; não polui o histórico). **Nunca** invente stash/commit com árvore já limpa.

### Caminho A — commit + rebase

Siga o protocolo de commit do usuário (status/diff/log → mensagem → `git add` seletivo → `git commit` via HEREDOC). Regras extras desta skill:

- Commit **só** o dirty set da feature; não stageie secrets (se aparecerem no meio, **mude para stash** em vez de commitar o resto).
- Mensagem: 1–2 frases no estilo do `git log` da branch; foque no porquê (evitar “wip:” genérico salvo se o log local já usa isso).
- Se o pre-commit hook **falhar**: corrija e faça um **novo** commit (não `--amend`, salvo as regras do usuário). Se ficar claro que o dirty não era commitável, e o commit desta invocação ainda é o tip local não-pushed que **você** criou agora: `git reset --soft HEAD~1`, então mude para **stash** e siga.
- Depois do commit limpo → Passo 2 → rebase → conflitos do rebase → Passo 5.
- Esse commit fica na branch (entra no `ship-to-main` depois). Não faça push aqui.

### Caminho B — stash + rebase + stash pop

```bash
git stash push -u -m "rebase-on-main:<branch>"
# … Passo 2 + rebase (Passo 3–4) até a branch estar rebased e limpa …
git stash pop
```

- Use `-u` para incluir untracked (senão o rebase ainda pode falhar / o “limpo” é mentira).
- Se o Passo 2 concluir “já sincronizado” (no-op): **mesmo assim** faça o `stash pop` (Passo 4b) antes de encerrar — o stash não pode ficar órfão.
- Se `stash pop` gerar conflitos: resolva como no Passo 4 (ler os dois lados; preservar intent). Depois `git add` nos resolvidos — **não** crie commit só do pop; deixe o resultado como dirty working tree restaurada, a menos que o usuário peça commit.
- Se `stash pop` falhar de forma estranha (stash parcialmente aplicado): pare, reporte `git stash list` + status, e **não** rode `stash drop` no escuro.
- Em sucesso do pop sem conflitos, o stash entry costuma dropar sozinho; confirme com `git stash list`.
- Conflitos de produto irreconciliáveis no pop → explique e pergunte (mesmo critério do Passo 4); não descarte o stash.

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

Se já está up-to-date (`HEAD` contém `origin/main` e não há commits de main à frente): reporte "já sincronizado". Se o Passo 1b usou **stash**, ainda assim execute o Passo 4b (`stash pop`) antes de encerrar; senão pare (sucesso no-op).

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
2. Se a árvore estava suja: caminho escolhido (**commit** com hash/msg **ou** **stash** + resultado do pop) e a regra da tabela que decidiu
3. Quantos commits rebased / se no-op
4. Conflitos resolvidos — rebase e/ou stash pop (paths + uma linha de racional cada) **ou** “nenhum”
5. Se abortou: por quê + o que precisa de decisão
6. Próximo passo natural: `capture-review-debts` (se ainda não rodou), `ship-to-main`, ou o atalho `close-delivery` (rebase+debts+ship)

## Anti-padrões

| Nunca                                           | Em vez disso                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Perguntar commit vs stash com árvore suja       | Decida pela tabela do Passo 1b e execute                                      |
| `git push --force` sem pedido                   | Deixe force-with-lease para `ship-to-main` / pedido explícito                 |
| Commitar `.env` / secrets para “limpar” a árvore | Stash (regra 1); nunca stageie secret                                        |
| Stash sem `-u` deixando untracked no caminho    | `git stash push -u -m "rebase-on-main:<branch>"`                              |
| Resolver conflito sem ler os dois lados         | Abra o arquivo + `git show :1/:2/:3:` se precisar                             |
| Continuar rebase com markers `<<<<<<<`          | Grep por `^<<<<<<<` antes de `--continue`                                     |
| Rebasear em cima de `main` local stale          | Sempre `fetch` + `origin/main`                                                |
| `reset --hard` para “limpar” conflito           | Abort ou resolve; hard reset só com pedido explícito                          |
| Expandir escopo (refatorar além do conflito)    | Só o necessário para o rebase passar                                          |
| Dropar stash após pop conflictivo               | Preserve o entry; reporte e pergunte                                          |

## Posição no fluxo

```
suggest-next → implement-roadmap-item → /simplify+/impeccable
  → rebase-on-main → capture-review-debts → ship-to-main
  # ou atalho: close-delivery
```
