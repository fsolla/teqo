---
description: Cria o worktree da próxima Issue claimável (next [--go]), um worktree novo de planejamento do /plan-issue (plan [bag] [--go]) ou destrói o worktree atual (kill [--force])
---

Rode o script determinístico abaixo (não improvise a lógica) e reporte o resultado de forma concisa.

- `next [--go]`: cria (ou reutiliza) o worktree da próxima Issue claimável. Com `--go`, o script imprime `cd <dir>` na última linha — aplique-o na sessão de shell atual (`cd <dir>`) e reporte o novo diretório.
- `plan [bag] [--go]`: cria um worktree de planejamento **diferente a cada invocação** (branch `plans/plan-issue-<bag>`, ou `plans/plan-issue-<n>` sequencial sem bag; sufixo `-2`/`-3` em colisão) para rodar `/plan-issue` sem ocupar o main; nunca conflita com `next`.
- `kill [--force]`: destrói o worktree em que você está.

!`node scripts/worktree.mjs $ARGUMENTS`
