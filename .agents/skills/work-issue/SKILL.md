---
name: work-issue
description: >-
  Versão humana de agent-work-issue: claim de uma Issue, Plan mode com plano
  de implementação deliberado a partir da intenção, pausa para confirmação
  humana, depois execução → /simplify → capture-review-debts → PR Ready em
  main com auto-merge. Use quando o usuário pedir /work-issue, quiser
  supervisionar a abordagem de engenharia, ou trabalhar uma Issue com gate
  humano antes do código.
disable-model-invocation: true
---

# Work-issue (humano supervisiona)

Mesmo pipeline de [`agent-work-issue`](../agent-work-issue/SKILL.md), com duas diferenças:

1. **Você claima** a Issue (`pnpm agent:claim`).
2. **Pausa após o plano de implementação** até o humano confirmar — só então executa.

**Proibido:** DB de prod; merge sem CI green; editar outras Issues `in-progress`; pular a pausa do impl plan; Draft / sem auto-merge.

## Checklist

```
- [ ] 0. Prep: `pnpm i` se preciso
- [ ] 1. Claim: pnpm agent:claim (ou -- --issue <N>)
- [ ] 1b. rename_chat + open_resource (intenção)
- [ ] 2. Verificação de modelo (assimétrica — pausa se sessão mais forte)
- [ ] 3. Plan mode → escrever `*-impl.md` → **PARAR e confirmar com o humano**
- [ ] 4. Após “ok”: executar como agent-work-issue Passos 4–6
```

## Passo 0–1 — Prep e claim

```bash
pnpm i
pnpm agent:claim            # topo da fila
pnpm agent:claim -- --issue <N>
```

O brief do stdout é o contrato de **produto** (id, prio, model, link da intenção). Claim = `ready → in-progress`.

### Rename + abrir intenção

Padrão: `#<N> <id> — <título>` via `cursor-app-control` `rename_chat`.  
Abra o plano de intenção com `open_resource` (`file:///…/docs/plans/<slug>.md`).

## Passo 2 — Modelo

Regra assimétrica (`model-selection`):

- Sessão **mais fraca** que `model:` → informa e segue
- Sessão **mais forte** → **informa e pausa** (“pedir X, está em Y — seguir?”)
- Ausente → aplique model-selection e registre na Issue

## Passo 3 — Plano de implementação + GATE humano

Siga o **Passo 3** de `agent-work-issue` (Plan mode, engineering-brief, decision-quality, `docs/plans/<slug>-impl.md`).

Depois de gravar o impl plan:

1. Apresente no chat: abordagem recomendada, opções rejeitadas, fases, riscos, o que diverge da hipótese de direção da intenção.
2. **Pare.** Não escreva código de feature até confirmação explícita (“ok”, “pode executar”, “aprovado”, …).
3. Se o humano pedir mudança de abordagem → revise o `*-impl.md` e reapresente.
4. Confirmação → marque Status `aprovado` no impl plan → `SwitchMode` `agent` → continue.

## Passos 4–6 — Execução

Idênticos a `agent-work-issue`:

- Executar fases (schema/server → UI → gates)
- `/simplify` completo + fixes
- `capture-review-debts` **com** gate humano (Passo 5 daquela skill) — não use o modo autônomo do pool
- `pnpm push` → PR Ready `--base main` + `Closes #N` → auto-merge → `gh pr checks --watch --required`

Detalhes, Prep Cloud, invariantes e templates: leia [`agent-work-issue/SKILL.md`](../agent-work-issue/SKILL.md) e os arquivos em `.agents/skills/work-issue/` (`engineering-brief.md`, `implementation-template.md`, `decision-quality.md`).

## Resumo final

Issue claimada · sessão renomeada · intenção aberta · modelo · **impl plan confirmado pelo humano** · execução · simplify/débitos · PR + merge.
