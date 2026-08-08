---
description: Cria o worktree da próxima Issue claimável (next [--go]), o worktree de planejamento do /plan-issue (plan [--go]) ou destrói o worktree atual (kill [--force])
---

Rode o script determinístico abaixo (não improvise a lógica) e reporte o resultado de forma concisa.

- `next [--go]`: cria (ou reutiliza) o worktree da próxima Issue claimável. Com `--go`, o script imprime `cd <dir>` na última linha — aplique-o na sessão de shell atual (`cd <dir>`) e reporte o novo diretório.
- `plan [--go]`: cria (ou reutiliza) o worktree de planejamento (branch fixo `plans/plan-issue`, sem vínculo com a fila) para rodar `/plan-issue` sem ocupar o main; nunca conflita com `next`.
- `kill [--force]`: destrói o worktree em que você está.

!`node scripts/worktree.mjs $ARGUMENTS`
