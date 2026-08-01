---
name: model-selection
description: >-
  Escolhe o modelo (e o nível de raciocínio/effort) com melhor custo/valor
  para cada classe de tarefa do Teqo, e despacha subagentes já no modelo certo
  via o parâmetro `model` da tool Task. Caminho feliz único: Composer 2.5 ↔
  Grok 4.5 (effort low|medium|high) ↔ Kimi K3 Low (exec bipartida). Usar no
  início de implementação, ao despachar subagentes, antes de /simplify, ou
  quando o usuário perguntar "qual modelo usar".
---

# Seleção de modelo × effort

Dois eixos, nesta ordem: **(1) classe da tarefa → família de modelo**, **(2) se Grok → effort**. Preço e contexto compram capacidade; effort compra deliberação. **Não pule o eixo 2** — High não é o default automático só porque a Issue saiu de Composer.

## Tabela canônica (2026-08-01)

| Prioridade | Família | Slug(s) no frontmatter `model:` | Quando |
| ---------- | ------- | -------------------------------- | ------ |
| 1 (default) | **Composer 2.5** | `composer-2.5` | Features, chores simples, fixes localizados, docs leves — sempre que couber |
| 2 | **Grok 4.5** | `cursor-grok-4.5-low` \| `cursor-grok-4.5-medium` \| `cursor-grok-4.5-high` | Precisa de deliberação além do Composer (abaixo) |
| 3 | **Kimi K3 Low** | `kimi-k3-low` | Só na **fase de execução** de issues bipartidas (refactor grande / simplify / migrations+RBAC de blast radius alto), depois de um plano fechado |

**Removidos** desta skill (não usar como 1ª escolha nem fallback documentado): Kimi K2.7, Haiku, GLM, Gemini, Luna. O pool mapeia os slugs acima para a API Cloud (`grok-4.5`+`effort`, `kimi-k3`+`reasoning`); slug desconhecido → fallback `composer-2.5`.

### Quando sair do Composer → Grok (eixo 1)

Suba para Grok só se **pelo menos um** for verdade:

- design / approach **não óbvio** (várias opções plausíveis, trade-offs reais);
- **discovery** de produto ou síntese de evidência (entrevistas, jargão, ilhas novas);
- **multi-domínio** (auth+schema+UI, Consent/LGPD, paradigm/skills com julgamento);
- critique visual / harvest de guardrails onde o critério é qualitativo.

Se o caminho está no plano e é execução mecânica → **fique em Composer** (ou Kimi na exec bipartida).

### Effort Grok (eixo 2) — escolha explícita

Depois de escolher Grok, **obrigatório** pickar um effort. Escreva o slug completo na Issue (`model: cursor-grok-4.5-…`).

| Effort | Slug (`model:`) | Nome no produto / Task | Quando |
| ------ | --------------- | ---------------------- | ------ |
| **Low** | `cursor-grok-4.5-low` | Cursor Grok 4.5 · Effort Low | Já é Grok-class, mas o trabalho é **mecânico com leve julgamento**: reescrever skills/docs após decisão travada, cutover de strings/base branch, bookkeeping que Composer erra por falta de contexto do paradigma. **Não** use Low para Prettier/merge puro — isso é Composer. |
| **Medium** | `cursor-grok-4.5-medium` | Cursor Grok 4.5 · Effort Medium | **Discovery / análise moderada**, critique/polish visual, harvest de padrões → guardrail, glossário a partir de evidência, chores de processo com trade-offs claros. Default quando Grok cabe e **não** é multi-domínio de alto risco. |
| **High** | `cursor-grok-4.5-high` | Cursor Grok 4.5 · Effort High | **Multi-domínio ou design não óbvio** com custo de falha alto: fundações (auth/sessão/schema), Consent/LGPD, plan half de bipartição, arquitetura nova. |

**Proibido:** sufixo `-fast` em qualquer slug (`composer-2.5-fast`, `cursor-grok-4.5-high-fast`, …). O pool **não** envia `fast=true`; se a Issue trouxer `-fast`, o resolver remove o sufixo, resolve a base e emite warn.

**Heurística anti-viés:** se você ia marcar High por hábito, pergunte “a falha é cara **e** o desenho é aberto?”. Se só uma das duas → Medium (ou Low). Se nenhuma → Composer.

### Pool × API Cloud

| Slug na Issue | API `model.id` | params |
| ------------- | -------------- | ------ |
| `cursor-grok-4.5-low` | `grok-4.5` | `effort=low` |
| `cursor-grok-4.5-medium` | `grok-4.5` | `effort=medium` |
| `cursor-grok-4.5-high` | `grok-4.5` | `effort=high` |
| `kimi-k3-low` | `kimi-k3` | `reasoning=low` |
| `composer-2.5` | `composer-2.5` | — |

## Issues muito complexas (bipartir)

Quando o blast radius é alto (refactor amplo, simplify repo-wide, migration+RBAC), `plan-issue` **registra duas Issues encadeadas**:

1. `{id}-plan` — `model: cursor-grok-4.5-high` — entregável = plano em `docs/plans/…` + critérios de aceite da execução
2. `{id}` ou `{id}-exec` — `model: kimi-k3-low`, `depends: [{id}-plan]` — executa o plano

Não despachar Kimi K3 Low sem plano fechado na Issue de plan.

## Regras

1. **Composer 2.5 é o default.** Se a tarefa cabe nele, não suba de modelo.
2. **Grok exige effort explícito** (`-low` / `-medium` / `-high` no slug). Não deixe `cursor-grok-4.5` sem sufixo; não use High como coringa.
3. **Nunca `-fast`.** Nem em Issue, nem em `Task.model`, nem sob pedido — recusar e usar o slug sem `-fast`.
4. **Kimi K3 Low só na exec bipartida** (ou quando a Issue já declara `kimi-k3-low` após um plan).
5. **Nunca economizar em:** migrations (história congelada), access control (`overrideAccess: false`), Consent/LGPD — se for uma Issue só disso e complexa, bipartir (plan Grok High → exec K3).
6. **Usuário pediu modelo específico:** a escolha dele vence (exceto `-fast`, sempre recusado); avise uma vez se houver desperdício claro.

## Como aplicar

- **Frontmatter da Issue / pool:** use exatamente os slugs da tabela (incl. `-low`/`-medium`/`-high`).
- **Subagentes (`Task.model`):** prefira o slug da Issue quando o enum do produto listar (`composer-2.5`, `cursor-grok-4.5-high`, `kimi-k3-low`, …). **Nunca** escolha variantes `-fast` do enum. Se a Issue é `-low`/`-medium` e o enum não tem o slug, use `inherit` (sessão já no effort certo) ou `cursor-grok-4.5-high` só se a subtarefa for a parte difícil — **não** “promova” a Issue inteira para High.
- **Sessão principal:** o agente não troca o próprio modelo. Se o atual não for o da tabela, diga em uma linha e siga.
- **Pool:** `POOL_DEFAULT_MODEL_SLUG` = `composer-2.5`; `resolvePoolModel` mapeia os slugs canônicos → API.

## Gates por fluxo

- **`/simplify`:** herda o modelo da sessão. Preferir sessão em Kimi K3 Low **só** quando houver Issue de exec bipartida; caso contrário Composer ou Grok (effort pela tabela) conforme complexidade.
- **`work-issue`:** verifica `model:` da Issue (assimétrico: sessão mais fraca → informa e segue; mais forte → informa e pausa). Ausente → aplica esta tabela **incluindo** o effort Grok.
- **`plan-issue`:** sugere via esta tabela (slug completo com effort); em issues muito complexas, registra o par plan/exec.
- **`agent-pool` smoke:** Composer default; Grok com effort explícito / Kimi K3 Low em Issues de teste bipartidas.
