---
name: agent-work-issue
description: 'Execute a claimed Issue end-to-end autonomously: plan → execute → simplify → PR.'
disable-model-invocation: true
---

# Agent work-issue (autônomo)

Conduz **uma** Issue já claimada do plano de implementação ao merge em `main`. Contrato dos workers do agent pool.

**Proibido:** DB de prod / `ALLOW_REMOTE_DB`; merge sem CI green; editar outras Issues `in-progress`; pular `/simplify`; entregar Draft ou sem auto-merge.

**Fonte de produto:** plano de intenção (`docs/plans/<slug>.md`) + body da Issue.
**Fonte de engenharia:** o `*-impl.md` que **você** cria.

## Relação com outras skills

| Skill | Papel |
| ----- | ----- |
| `plan-issue` | Intenção (já feita) |
| **`agent-work-issue` (esta)** | Impl plan → execução → simplify → débitos → PR |
| `work-issue` | Humano: impl plan → **pausa humana** → execução → simplify → débitos → PR |

## Decomposição em sub-agentes

Mesmo padrão de `work-issue` — sub-agentes para fases pesadas:

- **Explorador** (código) → findings
- **Escritor** (impl plan) → plano
- **2 Revisores** (paralelo: estrutural + qualidade) → achados do simplify
- **Capturador** (débitos) → tabela de triage

## Checklist

```
- [ ] 0. Prep: `pnpm i` se preciso; Cloud → §Prep Cloud (sem Docker)
- [ ] 1. Sessão: rename_chat + open_resource + carregar camada AGENTS
- [ ] 2. Plan mode → dispatch explorador + escritor → impl plan
- [ ] 3. Executar (main agent iterativo)
- [ ] 4. Dispatch 2 revisores paralelos → simplify
- [ ] 5. Dispatch capturador → triage de débitos
- [ ] 6. PR Ready + auto-merge
```

## Passo 0 — Prep

```bash
pnpm i   # se node_modules ausente/stale
```

### Cloud (sem Docker)

Não use `pnpm db:start`. Postgres via `.cursor/environment.json`. `gate:fast` / `gate:push` não precisam de DB. **Proibido** `git push --no-verify` no fechamento.

## Passo 1 — Sessão (Issue já claimada)

**Não** rode `pnpm agent:claim`.

1. `rename_chat` → `#<N> <id> — <título>`.
2. `open_resource` no plano de intenção (`docs/plans/<slug>.md`).
3. Carregar camada AGENTS: se toca `/campanha`, leia `AGENTS-campaign.md`. Se site público, `AGENTS-public.md`. Se deploy/CI, `AGENTS-infra.md`.

## Passo 2 — Plano de implementação

1. `SwitchMode` → `plan`.
2. Dispatch sub-agente **explorador** com plano de intenção + `engineering-brief.md` + `codebase-map.mdc`. Receba findings (≤25 linhas).
3. Dispatch sub-agente **escritor** com plano + findings + `implementation-template.md` + `decision-quality.md`. Receba impl plan.
4. Crie `docs/plans/<slug>-impl.md`. Marque `aprovado`.
5. `SwitchMode` → `agent`.

**Divergência material de produto:** pare, comente na Issue, flip para `blocked`.

## Passo 3 — Executar

Siga `execution-pipeline.md` com deltas do pool:

- **Branch:** `agent/<id>-<slug>` (worktrees Cursor podem já ter criado).
- **E2E local afetado (OPS72):** discricionário (Cloud sem browsers → registre justificativa).
- **UI:** shape → craft → critique → polish.
- **`capture-review-debts`:** autônomo — só `expensive_lock` com score ≥4; resto → defer/descarte.
- **Cloud:** PR via `ManagePullRequest` com `draft: false` no GitHub.

## Passo 4 — Simplify (2 sub-agentes paralelos)

Dispatche os dois revisores com o diff:
- **Revisor estrutural:** Dependency Rule, module boundaries, abstractions, duplication, type honesty
- **Revisor de qualidade:** naming, function size, dead code, complexity, conventions

Aplique fixes que preservem comportamento.

## Passo 5 — Débitos (sub-agente)

Dispatche capturador com achados + regras de `capture-review-debts`. Receba triage. Registre/absorva/defira/descarte.

## Passo 6 — Fechar

PR Ready `--base main` (GitHub) + auto-merge nativo — `pnpm push -u origin HEAD` → `node scripts/github-pr.mjs` (ou `ManagePullRequest` `draft: false` no Cloud).

## Resumo final

Issue · impl plan · simplify + débitos · PR + merge.
