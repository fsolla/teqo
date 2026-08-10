---
description: Cria o worktree da próxima Issue claimável (next [--stay]), um worktree novo de planejamento do /plan-issue (plan [bag] [--stay]) ou destrói o worktree atual (kill [--force])
---

Rode o script determinístico abaixo (não improvise a lógica) e reporte o resultado de forma concisa.

- `next [--stay]`: cria (ou reutiliza) o worktree da próxima Issue claimável. Por padrão o script imprime `cd <dir>` na última linha — aplique-o na sessão de shell atual (`cd <dir>`) e reporte o novo diretório. `--stay` suprime o `cd` (não troque de diretório). `--go` explícito continua aceito como no-op.
- `plan [bag] [--stay]`: cria um worktree de planejamento **diferente a cada invocação** (branch `plans/plan-issue-<bag>`, ou `plans/plan-issue-<n>` sequencial sem bag; sufixo `-2`/`-3` em colisão) para rodar `/plan-issue` sem ocupar o main; nunca conflita com `next`. Mesmo contrato de `cd` do `next`: aplique a última linha `cd <dir>` por padrão; `--stay` suprime.
- `kill [--force]`: destrói o worktree em que você está e remove seus bancos. O script imprime `cd <main>` na última linha — aplique-o (`cd <main>`) para a sessão sair do diretório destruído.

> **Este comando roda SEM o marcador `TEQO_WORKTREE_TERMINAL`, então nunca recebe a diretiva `launch`** — só o `cd`. O launch do opencode (OPS26) acontece apenas na função `worktree()` de `.agents/shell/worktree.sh` (terminal interativo); nunca abra um TUI aninhado a partir daqui.

!`node scripts/worktree.mjs $ARGUMENTS`
