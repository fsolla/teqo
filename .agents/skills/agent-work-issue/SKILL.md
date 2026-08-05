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

Conduz **uma** Issue já claimada do plano de implementação ao merge em `main`. É o contrato dos workers do **agent pool** e a base de execução de `work-issue` (versão humana só adiciona claim + pausa).

**Proibido:** DB de prod / `ALLOW_REMOTE_DB`; merge sem CI green; editar outras Issues `in-progress`; pular `/simplify`; entregar Draft ou sem auto-merge.

**Fonte de produto:** plano de intenção (`docs/plans/<slug>.md`) + body da Issue.  
**Fonte de engenharia:** o `*-impl.md` que **você** cria — não o plano de intenção.

## Relação com outras skills

| Skill | Papel |
| ----- | ----- |
| `plan-issue` | Intenção (já feita) |
| **`agent-work-issue` (esta)** | Impl plan → execução → simplify → débitos → PR |
| `work-issue` | Igual, mas claim + **confirmação humana** do impl plan |

## Checklist

```
- [ ] 0. Prep: `pnpm i` se preciso; Cloud → §Prep Cloud (sem Docker)
- [ ] 1. Sessão: rename_chat + open_resource na intenção
- [ ] 2. Modelo (best effort) vs `model:` da Issue
- [ ] 3. Plan mode → plano de implementação (`*-impl.md`)
- [ ] 4. Executar o impl plan (schema/server → UI → gates)
- [ ] 5. /simplify → fixes; capture-review-debts (modo autônomo)
- [ ] 6. PR Ready `--base main` + auto-merge + checks --required
```

## Passo 0 — Prep

```bash
pnpm i   # se node_modules ausente/stale
```

### Cloud (sem Docker)

Não use `pnpm db:start`. Postgres via `.agents/environment.json`. `gate:fast` / `gate:push` não precisam de DB. **Proibido** `git push --no-verify` no fechamento.

## Passo 1 — Sessão (Issue já claimada)

**Não** rode `pnpm agent:claim` — o pool (ou o humano via `work-issue`) já claimou.

1. `rename_chat` → `#<N> <id> — <título>` (padrão canônico; truncar só o título).
2. `open_resource` no plano de intenção (`docs/plans/<slug>.md`).

## Passo 2 — Modelo

Compare `model:` da Issue com a sessão (`model-selection`):

- Sessão mais fraca → informa e segue
- Sessão mais forte → informa; em autonomia do pool, **segue** (o spawn já fixou o modelo)
- Ausente → trate como `composer-2.5`

## Passo 3 — Plano de implementação (Plan mode)

1. `SwitchMode` → `plan` (explique: deliberar engenharia a partir da intenção).
2. Leia [engineering-brief.md](../work-issue/engineering-brief.md) e aplique skills/princípios sob demanda.
3. Explore o código o bastante para **reavaliar** a “Direção no codebase” da intenção — você **deve** escolher a melhor abordagem maintainable, mesmo que difira da hipótese do plano de intenção, desde que o **aceite de produto** se mantenha.
4. Escreva `docs/plans/<slug>-impl.md` via [implementation-template.md](../work-issue/implementation-template.md). Qualidade: [decision-quality.md](../work-issue/decision-quality.md) ≥4/5.
5. Em autonomia: marque Status `aprovado` e **siga sem pausa**. (Em `work-issue`, o humano confirma antes.)

**Divergência material de produto** (aceite/persona/lockdown da intenção não cabem na abordagem): pare, comente na Issue, flip para `blocked` se pool — não invente produto novo.

## Passo 4 — Executar

`SwitchMode` → `agent` se ainda estiver em plan. Ordem:

1. **Schema/server** — migrations (`payload-migrations`), utilities, actions, testes de domínio. Invariantes do engineering-brief.
2. **UI** — se Impeccable B/C/D: shape → craft → critique → polish (harden/optimize só sob gatilho). Tokens `data-theme='campaign'`; shells existentes.
3. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push` (não `git push` nu).

Tracer bullet cedo se o item for grande. Inclua o `*-impl.md` no commit da entrega.

## Passo 5 — `/simplify` + débitos

1. Rode o comando `/simplify` completo (3 reviewers paralelos via Task, read-only) no diff da sessão.
2. Aplique fixes pontuais que preservem comportamento.
3. Rode `capture-review-debts` em **modo autônomo**:
   - Colha e pontue como a skill manda
   - **Sem** gate humano: registre só `expensive_lock` com score ≥4 (Issues novas com `depends: [<id-pai>]` se necessário)
   - Score ≤3 / cheap_polish / defer_trigger → defer com gatilho no `*-impl.md` ou descarte — **não** polua a fila
   - Nunca edite a Issue `in-progress` atual para absorver débitos

## Passo 6 — Fechar em main

1. Branch `agent/<id>-<slug>` (worktrees Cursor podem já ter criado).
2. **`pnpm push -u origin HEAD`**
3. PR **Ready** (nunca draft): `gh pr create --base main` com `Closes #<N>` — ou Cloud `ManagePullRequest` com `draft: false`
4. `gh pr merge --auto --merge` imediatamente
5. `gh pr checks <PR> --watch --required` (`checks` + `migration-lock`; ignore Vercel Git)
6. CI flipa `done`/`in-prod` no merge. Comente na Issue o desfecho em uma linha.

## Resumo final

Issue · impl plan (abordagem escolhida + rejeitadas) · o que divergiu da hipótese de direção · simplify + débitos registrados/deferidos · PR + estado do merge.
