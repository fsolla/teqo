---
name: work-issue
description: 'Execute a claimed Issue end-to-end with human supervision on the impl plan.'
disable-model-invocation: true
---

# Work-issue (humano supervisiona)

Executa uma Issue já claimada de ponta a ponta com supervisão humana. A sessão nasce no contrato: Issue claimada, worktree correto, branch correta.

**Proibido:** DB de prod; merge sem CI green; editar outras Issues `in-progress`; pular a pausa do impl plan; Draft / sem auto-merge.

## Decomposição em sub-agentes

Fases pesadas são delegadas a sub-agentes com contexto mínimo. O agente principal orquestra.

### Sub-agente: Explorador de código

**Quando:** Passo 3a, antes de escrever o plano.
**Input:** plano de intenção + `engineering-brief.md` + `codebase-map.mdc`
**Task:** Explorar o codebase para esta feature. Encontrar: padrões existentes para reutilizar, implementações similares, arquivos afetados, rabbit holes potenciais. **Não escrever código nem planos.**
**Output:** ≤25 linhas de achados concisos.

### Sub-agente: Escritor de plano de implementação

**Quando:** Passo 3b, após o explorador.
**Input:** plano de intenção + achados do explorador + `implementation-template.md` + `decision-quality.md`
**Task:** Escrever `docs/plans/<slug>-impl.md` conforme o template. Incluir: abordagem recomendada + alternativas rejeitadas + fases + riscos. Self-score decision-quality ≥4/5.
**Output:** conteúdo markdown do plano.

### Sub-agente: Revisor estrutural

**Quando:** Passo 5, reviewer 1 (paralelo).
**Input:** diff da sessão + princípios de `code-simplification`
**Task:** Revisar o diff para conformidade arquitetural:
- Violações da Dependency Rule (lib→utilities→components→app)
- Violações de boundary de módulo (lógica na camada errada)
- Abstrações prematuras (abstrações novas para <3 call sites)
- Duplicação entre módulos
- Violações de type honesty
- Conformidade de padrões de access/transaction
**Output:** lista de achados com file:line e severidade.

### Sub-agente: Revisor de qualidade

**Quando:** Passo 5, reviewer 2 (paralelo).
**Input:** diff da sessão + princípios de `code-simplification`
**Task:** Revisar o diff para qualidade de código:
- Clareza de nomes (nomes descrevem o que o código faz?)
- Tamanho/complexidade de funções (funções longas, nesting profundo)
- Código morto (imports não usados, branches inacessíveis)
- Type assertions redundantes
- Complexidade desnecessária (poderia ser mais simples sem mudar comportamento)
- Convenções do projeto
**Output:** lista de achados com file:line e severidade.

### Sub-agente: Capturador de débitos

**Quando:** Passo 6, após simplify.
**Input:** achados da sessão + regras de triagem de `capture-review-debts`
**Task:** Triagem: score (1-5), tipo (expensive_lock/cheap_polish/defer_trigger), destino (registrar/absorver/defer/descartar/já_resolvido). **Output:** tabela de triage.

## Checklist

```
- [ ] 0. Prep: `pnpm i` se preciso
- [ ] 1. Contexto: validar Issue + carregar camada AGENTS
- [ ] 2. Ler plano de intenção do body da Issue
- [ ] 3a. Dispatch sub-agente explorador → receber findings
- [ ] 3b. Dispatch sub-agente escritor → receber impl plan
- [ ] 3c. GATE humano: apresentar plano → pausa → confirmação
- [ ] 4. Executar (main agent iterativo)
- [ ] 5. Dispatch 2 sub-agentes revisores (paralelo) → receber achados
- [ ] 6. Dispatch sub-agente capturador → receber triage
- [ ] 7. PR → merge
```

## Passo 1 — Contexto da sessão

A Issue chega no prompt/`$ARGUMENTS` do `/work-issue` (`--issue <N>` ou o número —
contrato OPS33; chamada manual: passar o número). Sempre consulte o tracker do GitHub
(`github.com/fsolla/teqo/issues`, via `pnpm issue` / `scripts/issue.mjs`) para o
resto (fonte única é a Issue, nunca um brief duplicado).

- **Presente** → valide o básico (issue do GitHub `https://github.com/fsolla/teqo/issues`:
  existe, `OPEN`, label `in-progress` — confirma que o claim foi feito fora da
  skill) e use.
- **Ausente** → **uma** pergunta ao humano ("Qual Issue?"), valide o número
  informado com a mesma checagem e siga.
- **Checagem falhou** (não existe / não `OPEN` / sem `in-progress`) → a Issue
  não está claimada: **pare e peça ao humano** para claimar fora da skill
  (`pnpm agent:claim --issue <N>`; no pós-OPS33, o `worktree next` já claima).
  Nunca siga com Issue não claimada, nunca claim na sessão.
- **Nunca rode `pnpm agent:claim`** — claim é contrato do ambiente (worktree
  next / script), não da skill.
- **Modelo: não verifique.** `model:` da Issue é metadata consultiva (o pool
  spawna nele; o claim brief o imprime). A sessão da máquina do humano é sempre
  o modelo fixo do ambiente (DeepSeek V4 Flash).
- **Carregar camada AGENTS:** se toca `/campanha`, leia `AGENTS-campaign.md`. Se site público, `AGENTS-public.md`. Se deploy/CI, leia `AGENTS-infra.md`.

## Passo 2 — Intenção

O path do plano vem do body da Issue (`Plano: docs/plans/...`). Sem link → body é spec. Abra e leia.

## Passo 3 — Plano de implementação + GATE

### 3a. Dispatch sub-agente explorador

Monte o task prompt:
- Plano de intenção (conteúdo completo)
- `engineering-brief.md` (invariantes + skills sob demanda)
- `codebase-map.mdc` (direção de dependência + onde vive o quê)
- Instrução: "Encontre arquivos relevantes, padrões existentes, rabbit holes. ≤25 linhas. Não escreva código nem planos."

Aguarde o output.

### 3b. Dispatch sub-agente escritor

Monte o task prompt:
- Plano de intenção + achados do explorador
- `implementation-template.md` + `decision-quality.md`
- Instrução: "Escreva `docs/plans/<slug>-impl.md`. Abordagem + alternativas rejeitadas + fases + riscos."

Aguarde o output. Crie o arquivo `docs/plans/<slug>-impl.md`.

### 3c. GATE humano

Apresente no chat:
- Abordagem recomendada + opções rejeitadas
- Fases, riscos, divergências da hipótese de direção

**Pare.** Não escreva código até confirmação explícita.

Divergência material de produto → pare, pergunte ao humano.

## Passo 4 — Executar

`SwitchMode` → `agent`. Siga `execution-pipeline.md`:

- **Branch:** `<Code>-<slug>` do worktree — nunca crie branch nova.
- **Nível de teste:** unit → int → e2e-com-benefício (dono da definição: `test-driven-development`; ver pipeline).
- **E2E local afetado (OPS72):** discricionário — rode os e2e criados + mesma superfície.
- **UI:** shape → craft → critique → polish.
- **Gates:** `pnpm gate:fast` na iteração; entrega com `pnpm push`.

## Passo 5 — Simplify (2 sub-agentes paralelos)

Dispatche os dois revisores em paralelo com o diff da sessão + princípios de `code-simplification`. Cada um retorna lista de achados.

Aplique fixes pontuais que preservem comportamento.

## Passo 6 — Capture debts (sub-agente)

Dispatche o capturador com os achados do simplify + sessão + regras de `capture-review-debts`. Receba a tabela de triage.

Aplique: registre o aprovado, absorva em plano existente, defira com gatilho, descarte o resto.

## Passo 7 — Fechar em main

Siga `execution-pipeline.md`: changelog → `pnpm push` → PR no GitHub `--base main` com `Closes #N` → auto-merge → CI.

## Resumo final

Issue · impl plan · simplify + débitos · PR + merge.
