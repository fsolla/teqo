---
name: bug-fix
description: 'Corrige bugs de ponta a ponta: diagnóstico → causa-raiz → fix → verificação → prevenção → post-mortem.'
disable-model-invocation: true
---

# Bug-fix

Corrige um bug de ponta a ponta e fecha o ciclo com prevenção e post-mortem. A sessão nasce no contrato: worktree `fix/<slug>` criado por `pnpm worktree fix [bug]` — o launch entrega `/bug-fix` com a descrição do bug no prompt (a skill lê o resto do contexto).

**Proibido:** DB de prod / `ALLOW_REMOTE_DB`; fix de sintoma (máscara) em vez de causa-raiz; merge sem CI green; fix sem teste de regressão; declarar bug de prod "corrigido" antes da confirmação em prod; pular o post-mortem.

## Decomposição em sub-agentes

Fases pesadas são delegadas a sub-agentes com contexto mínimo — o agente principal não engorda com a exploração, verificação, análise nem redação. O agente principal orquestra e implementa o fix.

### Sub-agente: Investigador de causa-raiz

**Quando:** Passo 3, antes de qualquer código.
**Input:** relatório do bug (sintoma, URL/rota, erro/log/stack, quando começou, ambiente) + dica de onde procurar.
**Task:** Encontrar a ORIGEM: reproduzir (se possível), localizar a camada (UI/API/DB/infra/teste), apontar a causa-raiz provável com `file:line`, propor repro mínimo. **Não escrever código nem fix.**
**Output:** ≤25 linhas: evidência, repro, origem `file:line`, hipótese de causa-raiz.

### Sub-agente: Verificador

**Quando:** Passo 5, após o fix.
**Input:** diff do fix + causa-raiz + cenário original do bug.
**Task:** Provar que o fix funciona: rodar o teste de regressão (falha sem o fix, passa com), a suíte afetada e o cenário original end-to-end (e2e quando a superfície for de UI). **Não alterar código — reportar falhas para o orquestrador.**
**Output:** relatório de verificação com evidência (comandos rodados + resultados).

### Sub-agente: Estrategista de prevenção

**Quando:** Passo 7, após a verificação verde.
**Input:** causa-raiz + fix + relato de verificação.
**Task:** Analisar por que e como o bug aconteceu (5-whys) e classificar a estratégia de prevenção: **barata** (teste de regressão, guard, lint, validação — implementar AGORA no mesmo PR) vs **cara** (refactor estrutural, nova infra de observabilidade, mudança de contrato — documentar no post-mortem, NÃO implementar aqui).
**Output:** ≤25 linhas: análise causal + estratégia classificada + passos concretos de cada lado.

### Sub-agente: Escritor do post-mortem

**Quando:** Passo 9, por último.
**Input:** relatório, causa-raiz, fix, verificação, análise de prevenção.
**Task:** Escrever `docs/postmortems/<data>-<slug>.md` conforme `postmortem-template.md`. Não inventar fato ausente — marcar "não apurado".
**Output:** conteúdo markdown completo do documento.

## Checklist

```
- [ ] 0. Prep: `pnpm i` se preciso; confirmar worktree fix/ (senão criar branch fix/<slug>)
- [ ] 1. Contexto: relatório do bug ($ARGUMENTS / bag / Issue / humano)
- [ ] 2. Reproduzir o bug (ou registrar por que não reproduz)
- [ ] 3. Dispatch sub-agente investigador → causa-raiz
- [ ] 4. Fix da causa-raiz + teste de regressão (main agent iterativo)
- [ ] 5. Dispatch sub-agente verificador → prova verde
- [ ] 6. Gates + PR → merge; bug de prod: deploy manual → confirmação do humano
- [ ] 7. Dispatch sub-agente estrategista → prevenção classificada
- [ ] 8. Implementar prevenção barata agora (a cara fica no post-mortem)
- [ ] 9. Dispatch sub-agente escritor → post-mortem + entrada de changelog
```

## Passo 0 — Prep

```bash
pnpm i   # se node_modules ausente/stale
```

O worktree `fix/<slug>` já foi criado pelo `pnpm worktree fix` (mesmo provisionamento isolado de `next`/`plan`/`new`). Se o `/bug-fix` foi invocado fora de um worktree `fix/` (ex.: no main), crie a branch `fix/<slug>` de `origin/main` você mesmo — bug-fix não toca a fila de claim, nunca rode `pnpm agent:claim`.

## Passo 1 — Contexto do bug

O relatório chega no `$ARGUMENTS` (a descrição passada ao `worktree fix`), do humano no chat, ou de uma Issue do GitHub referenciada. Junte o mínimo para investigar:

- **Sintoma:** o que acontece (mensagem de erro, comportamento errado, tela branca…)
- **Onde:** rota/URL, coleção/feature, camada
- **Quando começou:** deploy/commit suspeito, "sempre esteve assim" ou regressão
- **Ambiente:** prod / dev / CI / worktree
- **Severidade/impacto:** quem afeta, bloqueia usuário?

Ausente → **uma** pergunta ao humano ("Qual o bug?"). Se houver Issue no GitHub (`github.com/fsolla/teqo/issues`), leia-a via `pnpm issue` / `scripts/issue.mjs` — mas bug-fix não exige Issue (o post-mortem é o registro).

## Passo 2 — Reproduzir

Antes de mexer em código: fazer o bug acontecer de forma confiável.

- **Bug local:** dev server do worktree (porta própria do `.env.local`), banco dev isolado.
- **Bug de prod:** verifique o comportamento em prod de forma **read-only** (browser/curl na URL pública — nunca escreva em prod, nunca aponte DATABASE_URL para `teqo_1313`). Nunca tente reproduzir bug de prod escrevendo em prod.
- **Não reproduz:** registre as condições testadas e prossiga com a hipótese baseada em evidência (logs, código, git log/bisect na área suspeita). Documente a não-reprodução no post-mortem.

## Passo 3 — Investigar (sub-agente)

Dispatch o **investigador de causa-raiz** com o relatório do Passo 1 + condições do Passo 2. Receba ≤25 linhas: evidência, repro, origem `file:line`, hipótese de causa-raiz.

O agente principal decide a causa-raiz com base nos achados — o investigador sugere, não decide.

## Passo 4 — Fix da causa-raiz (main agent)

`SwitchMode` → `agent`. Corrija a **causa-raiz**, nunca o sintoma:

- **Teste de regressão primeiro** (que falha sem o fix) — o kernel do guard de recorrência.
- Convenções do repo: transação para escrita multi-coleção (`req: { transactionID }`), access control, migrations commitadas se houver mudança de schema (`pnpm migrate:create` — nunca `push`).
- Itere com `pnpm gate:fast` (lint + typecheck + unit). E2E afetado quando a superfície for de UI (OPS72: discricionário, rode os que criou + mesma superfície).

## Passo 5 — Verificar (sub-agente)

Dispatch o **verificador** com o diff + causa-raiz + cenário original. Ele roda a prova: teste de regressão (sem o fix falha, com o fix passa), suíte afetada, cenário end-to-end. Falhas → volte ao Passo 4. Não declare corrigido sem a prova.

## Passo 6 — Fechar e confirmar em prod

- `pnpm push` → PR no GitHub **Ready** base `main` (`Closes #N` se houver Issue; `Related #N` para PR só de docs — plans-only guard) → auto-merge nativo com o required check `CI (PR) / checks` verde. Siga `agent-pr-workflow.mdc`.
- **Bug de prod:** o merge NÃO é o fim. O deploy é **manual** (`workflow_dispatch` de `deploy.yml`, só humano — AGENT-OPS). Peça ao humano para disparar o deploy e **espere a confirmação de que prod se comporta** (o humano relata; você nunca toca o homeserver). Só então o bug está corrigido — registre data/hora da confirmação.

## Passo 7 — Prevenção (sub-agente)

Dispatch o **estrategista de prevenção** com causa-raiz + fix + verificação. Receba a análise causal e a estratégia classificada (barata vs cara).

## Passo 8 — Aplicar a prevenção

- **Barata** → implemente AGORA no mesmo PR (o teste de regressão do Passo 4 já é o guard mínimo).
- **Cara** → NÃO implemente neste fluxo (evite scope creep e risco sem evidência): registre no post-mortem como a estratégia que preveniria a recorrência — o documento vira o gatilho para uma Issue futura (`pnpm agent:register` é caminho do humano/plan-issue).

## Passo 9 — Post-mortem (sub-agente) + changelog

Dispatch o **escritor do post-mortem** com todo o material. Crie:

1. `docs/postmortems/<data>-<slug>.md` conforme `postmortem-template.md`.
2. Entrada curta em `docs/changelog/<data>-<slug>.md` (convenção de entrega — uma entrada por arquivo; nunca edite `docs/CHANGELOG-AGENTS.md` nem o HISTORY).

Revise o documento contra os fatos apurados antes do push. O post-mortem entra no MESMO PR do fix (ou num PR só de docs `Related #N` se o fix já mergeou).

## Resumo final

Bug · causa-raiz · fix · verificação (CI + prod) · prevenção · post-mortem.
