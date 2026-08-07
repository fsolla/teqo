---
name: worktree-next-issue
description: >-
  Cria um worktree git a partir de main para a próxima Issue claimável da fila
  do projeto, com branch legível no formato <código>-<slug> (ex.
  C15-fullcalendar-em-campanha-agenda, slug pt-BR do título sem acentos).
  Read-only no GitHub — NÃO claima, NÃO altera Issues. Usar quando o usuário
  pedir "worktree da próxima issue", "cria o worktree para o próximo da fila",
  "prepara o ambiente do próximo item", ou quiser começar a trabalhar a próxima
  Issue sem abrir o pool/Cursor.
---

# Worktree da próxima Issue claimável

Prepara o ambiente git para a próxima Issue da fila de claim, **sem** tocá-la no GitHub (read-only por contrato — claim continua sendo `pnpm agent:claim`, feito à parte).

## Fonte canônica: `pnpm worktree` (script)

A lógica determinística (fila → código+slug → branch → worktree) vive em **`scripts/worktree.mjs`** — fonte única, coberta por `tests/unit/worktree.unit.spec.ts`. Não a reescreva à mão aqui.

```bash
pnpm worktree next            # cria worktree de origin/main para a próxima claimável
pnpm worktree kill [--force]  # destrói o worktree em que o shell atual está
```

No opencode, isso é o comando **`/worktree next`** / **`/worktree kill`** (`.opencode/commands/worktree.md`), que só repassa `$ARGUMENTS` para o script.

No terminal interativo, para `--go` trocar de diretório de verdade, use a função `worktree()` de **`.agents/shell/worktree.sh`** (uma linha de `source` no profile): o script imprime `cd <dir>` e a função o aplica no shell que te chamou — node não consegue mudar o cwd do shell pai.

## Fluxo quando invocado como skill (agentes que não têm opencode)

1. Rode `pnpm worktree next` e leia a saída inteira. Se a fila estiver vazia, ele para sozinho — não crie worktree sem Issue.
2. Se a saída reclamar de conflito (worktree/branch já existentes), o script já reporta o que reutilizar.
3. Reporte ao usuário: código, `#<N>`, branch (`<code>-<slug>`), path — e que a Issue **não** foi claimada.

## O que o script garante (contrato)

- **Fila = `pnpm agent:claim --dry-run`** (ready + desbloqueadas, por `prio:P*` e mais antiga primeiro — mesma ordenação do pool e de `project-status`).
- **Branch `<code>-<slug>`**: `code` = `id` do frontmatter; `slug` = título pt-BR via `src/lib/slug.ts` (acentos fora, não-alfanumérico → hífen); truncamento só no slug, nunca no código; valida com `git check-ref-format --allow-onelevel`.
- **Base `origin/main`** (com `git fetch` antes); dir em `~/.cursor/worktrees/teqo/<branch>`.
- **`kill`**: recusa destruir o worktree principal (main); recusa worktree sujo sem `--force`; remove e apaga o branch.
- **NUNCA usa `--force` no `add`**, não inventa código de Issue, e é **read-only no GitHub**.

## NÃO faz

- Não roda `pnpm agent:claim` (mudaria labels no GitHub).
- Não usa `git worktree add --force` nem destrói worktrees existentes (isso é `kill`, explícito).
- Não duplica a lógica: se o script falhar ou faltar (gh fora do ar), reporte e pare.
