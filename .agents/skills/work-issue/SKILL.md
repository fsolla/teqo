---
name: work-issue
description: 'Execute a claimed Issue end-to-end with human supervision on the impl plan.'
disable-model-invocation: true
---

# Work-issue (humano supervisiona)

Executa uma Issue já claimada de ponta a ponta com supervisão humana. A sessão nasce no contrato: Issue claimada, worktree correto, branch correta.

**Proibido:** DB de prod; merge sem CI green; editar outras Issues `in-progress`; pular a pausa do impl plan (exceto com `--auto`, ver §Modo autônomo); Draft / sem auto-merge.

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

### Sub-agente: Designer

**Quando:** trigger (a) — superfície/estado visual novo que o design do plano não cobre e trigger (b) — design aprovado não pode ser seguido como está, ambos **antes** de o implementador mexer no markup; trigger (d) — ícones/ilustrações; e trigger (c) — no fechamento, crítica visual do diff que muda UI contra o app renderizado (screenshots 390/1280 + estados).
**Input:** plano de intenção + artefato aprovado `docs/plans/<slug>-ui-design.html` + o app renderizado (screenshots).
**Task:** criar/estender o artefato (a/b/d) ou criticar a implementação contra ele (c). Dono da estrutura visual: `.opencode/agent/designer.md` (fallback `designer-degraded.md`), doutrina `ui-design-html.md`. **Não implementa a feature nem decide engenharia.**
**Output:** artefato estendido ou lista numerada de ajustes; `DEGRADED` + sign-off humano quando o tier não for primário.

Triggers/non-triggers, ladder e o fechamento fail-closed vivem em `execution-pipeline.md` (§Design) — esta skill declara só o delta.

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
- [ ] 3d. Designer (trigger a/b): estender o artefato se o design aprovado não cobrir a superfície
- [ ] 4. Executar (main agent iterativo) — `designer` nos triggers (a/b/d)
- [ ] 5. Dispatch 2 sub-agentes revisores (paralelo) → receber achados
- [ ] 6. Dispatch sub-agente capturador → receber triage
- [ ] 7. PR → merge — crítica do `designer` (c); `DEGRADED` ⇒ sign-off humano antes do push
- [ ] 8. Verificação pós-deploy em staging (§Verificação pós-deploy do pipeline)
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

## Modo autônomo (`--auto`)

Opt-out da pausa por invocação. Detecta-se em `$ARGUMENTS`: `/work-issue --issue <N> --auto` (a flag vive dentro do prompt, junto do `--issue <N>` do contrato OPS33; sem parser dedicado).

- **Sem a flag (ou flag desconhecida):** o Passo 3c GATE vale idêntico — apresente o plano, pare e aguarde confirmação explícita. Proibido pular a pausa.
- **Com a flag:** o impl plan do Passo 3b nasce marcado `aprovado` pelo próprio agente; o Passo 3c vira apresentação-no-chat-sem-espera (abordagem + rejeitadas + fases + riscos continuam obrigatórios no chat e no arquivo) e a execução (Passo 4) segue direto até o PR.
- **Pode auto-aprovar:** abordagem técnica, cortes de escopo já previstos na skill e os literais de dados que o próprio plano recomenda (registrados como assumidos).
- **Continua parando (vale mesmo com a flag):** Consent/LGPD fail-closed, migração de schema, contrato de URL público, shapes públicos, produção/aprovação humana, certificação visual `DEGRADED` (tier não-primário não certifica — o fluxo `--auto` para e flipa para `blocked`), merge sem CI green, DB de prod; divergência material de produto → pare, comente na Issue e flipe para `blocked` (precedente do fluxo autônomo). O claim continua contrato do ambiente: este modo nunca claima Issue.
- **Não confundir:** `--auto` aqui é flag da skill dentro do prompt; o `--auto` do CLI opencode (auto-aprovar permissões de ferramenta) é outro conceito.
- **Convivência:** `agent-work-issue` continua sendo o contrato do pool dormente; este modo é opt-in da sessão humana. Consolidação futura é item à parte.

## Passo 4 — Executar

`SwitchMode` → `agent`. Siga `execution-pipeline.md`:

- **Branch:** `<Code>-<slug>` do worktree — nunca crie branch nova.
- **Nível de teste:** unit → int → e2e-com-benefício (dono da definição: `test-driven-development`; ver pipeline).
- **E2E local afetado (OPS72):** discricionário — rode os e2e criados + mesma superfície.
- **UI:** §Design do pipeline — o `designer` é dono da estrutura visual; dispare nos triggers (a/b/d) e porte o artefato aprovado classe-a-classe (nunca improvise estrutura visual).
- **Gates:** `pnpm gate:fast` na iteração; entrega com `pnpm push`.

## Passo 5 — Simplify (2 sub-agentes paralelos)

Dispatche os dois revisores em paralelo com o diff da sessão + princípios de `code-simplification`. Cada um retorna lista de achados.

Aplique fixes pontuais que preservem comportamento.

## Passo 6 — Capture debts (sub-agente)

Dispatche o capturador com os achados do simplify + sessão + regras de `capture-review-debts`. Receba a tabela de triage.

Aplique: registre o aprovado, absorva em plano existente, defira com gatilho, descarte o resto.

## Passo 7 — Fechar em main

Siga `execution-pipeline.md`: changelog → `pnpm push` → PR no GitHub `--base main` com `Closes #N` → auto-merge → CI.

Antes do push, se o diff muda UI, a crítica final do `designer` (trigger c) é obrigatória (§Design). Com crítica certificada, registre `Design tier: <slug>` no body. Com `DEGRADED`/tier não-primário, **pare antes do `pnpm push`**, apresente a crítica `DEGRADED` + screenshots e aguarde sign-off humano explícito; só então o PR nasce Ready com `Design tier: DEGRADED (<slug>)` + o registro do sign-off — nunca "segue sem".

## Passo 8 — Verificação pós-deploy em staging

Você (humano, com browser) é o ator que **executa** a §Verificação pós-deploy
(staging) do pipeline — a mecânica, os literais e a fronteira dura moram lá; aqui
fica só o delta: espera o run de `deploy.yml`/job `deploy-staging`, abre o staging
e exerce a funcionalidade recém-entregue; defeito no escopo vira Issue claimável,
observação vira `file-miss`, a Issue original (`done`) só recebe comentário de
link. Em timeout, reporta e para. Produção segue 100% humana.

## Resumo final

Issue · impl plan · simplify + débitos · PR + merge · verificação pós-deploy em staging.
