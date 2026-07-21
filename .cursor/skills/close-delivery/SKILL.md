---
name: close-delivery
description: >-
  Runs the full post-simplify delivery closeout in one flow: rebase-on-main,
  capture-review-debts (auto-confirm triage recommendations), then ship-to-main
  (commit, push, merge to main, delete session worktree). Use after /simplify
  and /impeccable when the user says "close delivery", "fecha a entrega",
  "rebase + debts + ship", "fecha o ciclo", or wants the three closeout steps
  without pausing for debt-triage confirmation.
---

# Close delivery

Orquestra o fechamento da entrega em worktree numa única invocação:

1. **`rebase-on-main`** — sync com `origin/main` + conflitos
2. **`capture-review-debts`** — triage de débitos **com auto-confirmação** da recomendação
3. **`ship-to-main`** — commit all → push → merge main → apagar worktree

**Announce at start:** "Using close-delivery: rebase → capture debts (auto-confirm) → ship."

**REQUIRED SUB-SKILLS:** Leia e execute integralmente, nesta ordem:

- `.cursor/skills/rebase-on-main/SKILL.md`
- `.cursor/skills/capture-review-debts/SKILL.md` (com override abaixo)
- `.cursor/skills/ship-to-main/SKILL.md`

Não reimplemente a lógica delas aqui — só orquestre + aplique o override de confirmação.

## Checklist

```
- [ ] 1. rebase-on-main (completo; pare se abortar/perguntar)
- [ ] 2. capture-review-debts com auto-confirm (override do Passo 5)
- [ ] 3. ship-to-main (completo)
- [ ] 4. Resumo unificado do ciclo
```

## Override: auto-confirm em `capture-review-debts`

A skill filha exige **Pare e confirme** no Passo 5 antes de editar docs. **Neste fluxo, esse gate está dispensado.**

Comportamento:

1. Execute Passos 1–4 de `capture-review-debts` normalmente (colher, deduplicar, pontuar, mesclar).
2. Mostre a tabela de triage no resumo (transparência).
3. **Trate a recomendação da tabela como aprovada** e avance ao Passo 6 sem esperar o usuário.
4. Se não houver candidatos / só `já_resolvido`+`descartar`+`defer` sem registro: no-op de docs; siga para `ship-to-main`.
5. `defer` continua sem criar ID; anote gatilho no plano-pai se a skill filha mandar.

**Ainda pare e pergunte** (não auto-confirm) se:

- A triage ficar ambígua entre dois destinos sem regra clara na skill filha
- Um candidato `expensive_lock` (access/LGPD/schema/unicidade) não tiver destino seguro sem decisão de produto
- `roadmap-item` falharia por falta de dado que só o usuário pode dar

Nesses casos: reporte o bloqueio, **não** rode `ship-to-main` ainda (working tree pode ter só o rebase).

## Regras de orquestração

| Situação                             | Ação                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Rebase no-op (já sync)               | Siga para debts                                                           |
| Rebase com conflitos resolvidos      | Siga para debts                                                           |
| Rebase abortado / precisa decisão    | **Pare** — não debts, não ship                                            |
| Debts auto-confirm OK (ou no-op)     | Siga para ship                                                            |
| Debts bloqueado (lock / ambiguidade) | **Pare** — não ship                                                       |
| Ship: feature atrás de main          | Não deve ocorrer se Passo 1 OK; se ocorrer, re-rode rebase antes de merge |
| Ship: branch é `main`                | Pare (guard da filha)                                                     |

Commit das mudanças de roadmap/planos feitas no Passo 2 entra no **mesmo** `ship-to-main` (Passo 2 da filha — commit all).

## Resumo unificado (final)

Um bloco só, curto:

1. **Rebase:** no-op / N commits / conflitos (paths) / abort
2. **Debts:** contagem (colhidos / registrados / absorvidos / defer / descartados) + IDs/slugs se houver + nota “auto-confirm”
3. **Ship:** SHA de main, branch/worktree removidos, aviso Cursor se path morto
4. **Próximo:** `suggest-next-roadmap-items`

## Posição no fluxo

```
suggest-next → implement-roadmap-item → /simplify+/impeccable
  → close-delivery
     (= rebase-on-main → capture-review-debts[auto] → ship-to-main)
```

As três skills filhas continuam invocáveis à parte quando o usuário quiser pausar entre etapas.
