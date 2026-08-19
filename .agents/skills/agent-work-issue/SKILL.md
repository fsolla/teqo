---
name: agent-work-issue
description: >-
  Executa uma Issue já claimada de ponta a ponta para workers do agent pool:
  Plan mode → plano de implementação (engenharia deliberada a partir da
  intenção) → execução → /simplify → capture-review-debts → PR Ready em main
  com auto-merge. Use quando o pool spawna um worker, quando a Issue já está
  in-progress, ou quando o usuário pedir /agent-work-issue.
disable-model-invocation: true
---

# Agent work-issue (autônomo)

Conduz **uma** Issue já claimada do plano de implementação ao merge em `main`. É o contrato dos workers do **agent pool** (Cursor Cloud, autônomo). O fluxo humano supervisionado é `work-issue` — skill própria, com gate humano no impl plan e contexto de Issue vindo da sessão.

**Proibido:** DB de prod / `ALLOW_REMOTE_DB`; merge sem CI green; editar outras Issues `in-progress`; pular `/simplify`; entregar Draft ou sem auto-merge.

**Fonte de produto:** plano de intenção (`docs/plans/<slug>.md`) + body da Issue.  
**Fonte de engenharia:** o `*-impl.md` que **você** cria — não o plano de intenção.

## Relação com outras skills

| Skill | Papel |
| ----- | ----- |
| `plan-issue` | Intenção (já feita) |
| **`agent-work-issue` (esta)** | Impl plan → execução → simplify → débitos → PR |
| `work-issue` | Humano: Issue já claimada → impl plan → **pausa humana** → execução → simplify → débitos → PR |

## Checklist

```
- [ ] 0. Prep: `pnpm i` se preciso; Cloud → §Prep Cloud (sem Docker)
- [ ] 1. Sessão: rename_chat + open_resource na intenção
- [ ] 2. Modelo: spawn do pool já fixou (`model:` da Issue) — sem comparação
- [ ] 3. Plan mode → plano de implementação (`*-impl.md`)
- [ ] 4. Executar o impl plan (schema/server → UI → gates)
- [ ] 5. /simplify → fixes; capture-review-debts (modo autônomo)
- [ ] 6. PR Ready `--base main` (GitHub) + auto-merge nativo — `pnpm push -u origin HEAD` → `node scripts/github-pr.mjs` (ou `ManagePullRequest` `draft: false` no Cloud)
```

## Passo 0 — Prep

```bash
pnpm i   # se node_modules ausente/stale
```

### Cloud (sem Docker)

Não use `pnpm db:start`. Postgres via `.cursor/environment.json`. `gate:fast` / `gate:push` não precisam de DB. **Proibido** `git push --no-verify` no fechamento.

## Passo 1 — Sessão (Issue já claimada)

**Não** rode `pnpm agent:claim` — o pool (ou o claim pré-sessão do humano — hoje `pnpm agent:claim` manual; OPS33 via `worktree next`) já claimou.

1. `rename_chat` → `#<N> <id> — <título>` (padrão canônico; truncar só o título).
2. `open_resource` no plano de intenção (`docs/plans/<slug>.md`).

## Passo 2 — Modelo

O spawn do pool já fixou o modelo (`model:` da Issue — ver `model-selection`); não há comparação assimétrica a fazer:

- Fallback do pool (slug inválido → `composer-2.5`) pode deixar a sessão **mais fraca** que o declarado → informa e segue
- Ausente → o pool spawna no default `composer-2.5`; segue

## Passo 3 — Plano de implementação (Plan mode)

1. `SwitchMode` → `plan` (explique: deliberar engenharia a partir da intenção).
2. Leia [engineering-brief.md](../work-issue/engineering-brief.md) e aplique skills/princípios sob demanda.
3. Explore o código o bastante para **reavaliar** a “Direção no codebase” da intenção — você **deve** escolher a melhor abordagem maintainable, mesmo que difira da hipótese do plano de intenção, desde que o **aceite de produto** se mantenha.
4. Escreva `docs/plans/<slug>-impl.md` via [implementation-template.md](../work-issue/implementation-template.md). Qualidade: [decision-quality.md](../work-issue/decision-quality.md) ≥4/5.
5. Em autonomia: marque Status `aprovado` e **siga sem pausa**. (Em `work-issue`, o humano confirma antes.)

**Divergência material de produto** (aceite/persona/lockdown da intenção não cabem na abordagem): pare, comente na Issue, flip para `blocked` se pool — não invente produto novo.

## Passo 4 — Executar

`SwitchMode` → `agent` se ainda estiver em plan. Siga a mecânica de
[`../work-issue/execution-pipeline.md`](../work-issue/execution-pipeline.md)
(executar → simplify → fechar em main), com os deltas do ator pool:

- **Branch:** `agent/<id>-<slug>` (worktrees Cursor podem já ter criado).
- **UI:** shape → craft → critique → polish (harden/optimize só sob gatilho).
- **`capture-review-debts`:** **autônomo** — só `expensive_lock` com score ≥4
  (Issues novas com `depends: [<id-pai>]` se necessário); score ≤3 /
  cheap_polish / defer_trigger → defer com gatilho no `*-impl.md` ou descarte —
  **não** polua a fila.
- **Cloud:** PR via `ManagePullRequest` com `draft: false` no **GitHub**
  (repo/PR agora no GitHub; o tracker de Issues segue no Forgejo — OPS71);
  Prep Cloud no Passo 0.

## Resumo final

Issue · impl plan (abordagem escolhida + rejeitadas) · o que divergiu da hipótese de direção · simplify + débitos registrados/deferidos · PR + estado do merge.
