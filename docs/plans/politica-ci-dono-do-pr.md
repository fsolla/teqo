# Política de agente — CI vermelho é do dono do PR até o merge

Status: entregue (2026-07-30 — executado em sessão única, fora do fluxo agent:register, a pedido do humano)
Atualizado em: 2026-07-30
Issue: —
Priority: P2
Model: cursor-grok-4.5-high
Impeccable: A — N/A (sem superfície UI)
Appetite: ~0,5 dia; docs em 3 arquivos
Responsável: —

## Dados → decisão → apresentação

Dados: N/A — política de fluxo em docs.

## Contexto

Incidente (2026-07-30, PR #50): o agente em `work-issue` desistiu ao ver (a) `migration-lock` falhando por defeito de infra (job sem `checkout`) e (b) um teste int falhando fora do escopo nominal da feature (`homeSearchLeaderships`, confundido com e2e). A feature estava pronta; o PR ficou `BLOCKED` e ninguém era dono. Lacuna: nem `work-issue` nem `engineering-standards` dizem quem conserta CI quebrado "fora da feature".

Decisão de produto (2026-07-30, brief do lote CI): **done = PR mergeado em `stage` com CI verde** — corrigir qualquer falha de CI necessária ao merge, mesmo fora da feature.

## Objetivos

- `work-issue`, `engineering-standards.mdc` e `docs/AGENT-OPS.md` declaram a política com o mesmo texto-núcleo (uma fonte, duas citações).
- Regra de triagem da falha de CI documentada: infra do workflow / teste pré-existente / regressão da feature — as três são do dono do PR; o que muda é o fix.
- Registro do incidente #50 como precedente em `docs/CHANGELOG-AGENTS.md` (uma entrada curta, formato do arquivo).

## Decisões travadas

- **Dono do PR conserta, sem exceção por escopo.** Racional: com agentes paralelos, "não é minha feature" vira deadlock (o #50 ficou parado por isso). O autor já tem branch, contexto e CI loop aberto. **Rejeitado:** abrir Issue separada e seguir (o PR apodrece BLOCKED — exatamente o incidente); esperar humano (derrota a autonomia do paradigma AGENT-OPS).
- **Limite explícito: o fix colateral segue as mesmas regras de blast radius** — migration/access/Consent continuam proibidos de "consertar de passagem" sem plano; nesses casos o agente para e escala (Opções documentadas). **Rejeitado:** carta branca para qualquer fix (contradiz as invariantes de segurança do AGENTS.md).
- **Uma fonte de verdade (AGENT-OPS), citações nos outros dois** — evita o drift que o pre-push sofreu (OPS6). **Rejeitado:** repetir o parágrafo inteiro nos três arquivos.

## Questões em aberto

- **Teste flaky (não determinístico) conta como "sua responsabilidade"?** **Opções:** A) sim, repair ou quarentena com justificativa no PR | B) retry até passar. **Recomendação:** A — retry cega o CI para flakes reais; quarentena exige comentário + débito registrado via `capture-review-debts`.

## Abordagem proposta

Componentes (texto, não código):

- **`docs/AGENT-OPS.md`** — novo bloco na seção "Fluxo": "Dono do PR, dono do CI" (definição de done, triagem das 3 classes de falha, limite de blast radius, flaky→quarentena+débito).
- **`.cursor/skills/work-issue/SKILL.md`** — Passo 6.5 reforçado: falha no ci-pr → corrige na mesma branch **qualquer que seja a origem**, citando AGENT-OPS; "fora do escopo" não é critério de parada.
- **`.cursor/rules/engineering-standards.mdc`** — linha no "After every change": CI vermelho no seu PR é seu, mesmo pré-existente.
- **`docs/CHANGELOG-AGENTS.md`** — entrada do incidente PR #50 → esta política.

Texto-núcleo proposto (núcleo único citado nos três):

> Done = PR mergeado em `stage` com CI verde. Falha de CI no teu PR — infra do workflow, teste pré-existente ou regressão da feature — é tua até o merge. "Fora do escopo da feature" não é motivo para parar: corrige na mesma branch. Exceção de blast radius: se o fix exigir migration, access control ou Consent, para e escala com Opções — esses nunca se corrigem "de passagem". Flaky não se resolve com retry: repair ou quarentena justificada + débito registrado.

Sem migration, sem código de app.

## Dependências

Nenhuma dura. Sinérgica com OPS3 (que aplica a política na prática) e OPS6 (mesma família de arquivos — serializar para evitar conflito trivial).

## Não escopo

- Mudança de gates/hooks → OPS6. Refatoração de workflows → OPS4/OPS5.
- `agent:file-miss` do incidente: o incidente vira precedente documentado aqui; se o humano quiser também como `kind:agent-miss` para o harvest OPS2 (#43), registrar lá.

## Rabbit holes

- **Reescrever work-issue inteira "de passagem".** A skill está estável; o delta é uma política. **Mitigação:** diff limitado ao Passo 6 + citação.

## Adiado com gatilho

Nenhum neste item.

## Referências

- Incidente: PR #50, run 30558184687 (migration-lock sem checkout; int fora da feature)
- `docs/AGENT-OPS.md` — seção "Fluxo"; `.cursor/skills/work-issue/SKILL.md` — Passo 6
- `.cursor/rules/engineering-standards.mdc` — "After every change"
- Issue #43 (OPS2) — harvest agent-miss → guardrails
