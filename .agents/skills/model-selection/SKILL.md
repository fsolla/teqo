---
name: model-selection
description: >-
  Escolhe o modelo (e o nível de raciocínio/effort) com melhor custo/valor
  para cada classe de tarefa do Teqo, e despacha subagentes já no modelo certo
  via o parâmetro `model` da tool Task. Dois ambientes: pool (Composer 2.5,
  Grok 4.5, Kimi K3 Low) e local/Zed (Composer 2.5, Grok 4.5, DeepSeek V4
  Pro, DeepSeek V4 Flash). Toda Issue declara `model:` (pool) + `model-local:`
  (alternativa DeepSeek V4 high|max para trabalho local). Usar no início de
  implementação, ao despachar subagentes, antes de /simplify, ou quando o
  usuário perguntar "qual modelo usar".
---

# Seleção de modelo × effort × ambiente

**Dois ambientes, cardápios diferentes:**

| Ambiente | Modelos disponíveis | Frontmatter |
| -------- | ------------------- | ----------- |
| **Pool (remoto)** | Composer 2.5, Grok 4.5 (low\|medium\|high), Kimi K3 Low | `model:` |
| **Local (Zed)** | Composer 2.5, Grok 4.5, **DeepSeek V4 Pro** (high\|max), **DeepSeek V4 Flash** (high\|max) | `model-local:` |

**Toda Issue declara os dois**: `model:` para o pool + `model-local:` com a alternativa DeepSeek V4 (high ou max) para trabalho local. O agente local **pode** escolher Composer/Grok se fizer mais sentido na sessão, mas o `model-local:` é a referência declarada.

Três eixos, nesta ordem: **(1) classe da tarefa → família de modelo**, **(2) ambiente → cardápio disponível**, **(3) se Grok ou DeepSeek → effort**. Preço e contexto compram capacidade; effort compra deliberação. **Não pule o eixo 3** — High/Max não é o default automático.

## Tabela canônica (2026-08-03)

### Pool (remoto) — `model:`

| Prioridade | Família | Slug `model:` | Quando |
| ---------- | ------- | ------------- | ------ |
| 1 (default) | **Composer 2.5** | `composer-2.5` | Features, chores simples, fixes localizados, docs leves — sempre que couber |
| 2 | **Grok 4.5** | `cursor-grok-4.5-low` \| `cursor-grok-4.5-medium` \| `cursor-grok-4.5-high` | Precisa de deliberação além do Composer (abaixo) |
| 3 | **Kimi K3 Low** | `kimi-k3-low` | Só na **fase de execução** de issues bipartidas (refactor grande / simplify / migrations+RBAC de blast radius alto), depois de um plano fechado |

### Local (Zed) — `model-local:`

| Família | Slug `model-local:` | Quando |
| ------- | -------------------- | ------ |
| **DeepSeek V4 Flash** | `deepseek-v4-flash-high` \| `deepseek-v4-flash-max` | Pareia com **Composer 2.5** — execução rápida, tarefas mecânicas ou com julgamento leve. Flash-high é o default para `composer-2.5`. |
| **DeepSeek V4 Pro** | `deepseek-v4-high` \| `deepseek-v4-max` | Pareia com **Grok 4.5** — deliberação, multi-domínio, design não óbvio. Pro-high para Grok Low/Medium; Pro-max para Grok High. |

**Pool + local também aceitam** Composer 2.5 e Grok 4.5 localmente, mas o `model-local:` é **sempre** um slug DeepSeek — é a referência canônica para quem abre a Issue no Zed.

**Removidos** desta skill (não usar como 1ª escolha nem fallback documentado): Kimi K2.7, Haiku, GLM, Gemini, Luna. O pool mapeia os slugs `model:` para a API Cloud (`grok-4.5`+`effort`, `kimi-k3`+`reasoning`); slug desconhecido → fallback `composer-2.5`.

### Quando sair do Composer → Grok (eixo 1)

Suba para Grok só se **pelo menos um** for verdade:

- design / approach **não óbvio** (várias opções plausíveis, trade-offs reais);
- **discovery** de produto ou síntese de evidência (entrevistas, jargão, ilhas novas);
- **multi-domínio** (auth+schema+UI, Consent/LGPD, paradigm/skills com julgamento);
- critique visual / harvest de guardrails onde o critério é qualitativo.

Se o caminho está no plano e é execução mecânica → **fique em Composer** (ou Kimi na exec bipartida).

### Effort Grok (eixo 2) — escolha explícita

Depois de escolher Grok, **obrigatório** pickar um effort. Escreva o slug completo na Issue (`model: cursor-grok-4.5-…`).

| Effort | Slug `model:` | Nome no produto / Task | Quando |
| ------ | ------------- | ---------------------- | ------ |
| **Low** | `cursor-grok-4.5-low` | Cursor Grok 4.5 · Effort Low | Já é Grok-class, mas o trabalho é **mecânico com leve julgamento**: reescrever skills/docs após decisão travada, cutover de strings/base branch, bookkeeping que Composer erra por falta de contexto do paradigma. **Não** use Low para Prettier/merge puro — isso é Composer. |
| **Medium** | `cursor-grok-4.5-medium` | Cursor Grok 4.5 · Effort Medium | **Discovery / análise moderada**, critique/polish visual, harvest de padrões → guardrail, glossário a partir de evidência, chores de processo com trade-offs claros. Default quando Grok cabe e **não** é multi-domínio de alto risco. |
| **High** | `cursor-grok-4.5-high` | Cursor Grok 4.5 · Effort High | **Multi-domínio ou design não óbvio** com custo de falha alto: fundações (auth/sessão/schema), Consent/LGPD, plan half de bipartição, arquitetura nova. |

**Proibido:** sufixo `-fast` em qualquer slug (`composer-2.5-fast`, `cursor-grok-4.5-high-fast`, …). O pool **pina `fast=false`** em todo spawn cuja família Cloud exponha o param `fast` (Composer, Grok, …). Só omitir o param **não basta**: a API Create-Agent resolve o default da variante, que hoje é `fast=true` (`composer-2.5-fast` no usage dashboard). Se a Issue trouxer `-fast`, o resolver remove o sufixo, resolve a base + `fast=false` e emite warn.

**Heurística anti-viés:** se você ia marcar High por hábito, pergunte "a falha é cara **e** o desenho é aberto?". Se só uma das duas → Medium (ou Low). Se nenhuma → Composer.

### Effort DeepSeek V4 (eixo 3 local)

Depois de escolher o `model:` do pool, **obrigatório** declarar o `model-local:` com o slug DeepSeek correspondente. A família (Flash vs Pro) e o effort (high vs max) são determinados pelo `model:` do pool:

**Mapeamento canônico `model:` → `model-local:`:**

| `model:` (pool) | `model-local:` (DeepSeek) | Por quê |
| --------------- | ------------------------- | ------- |
| `composer-2.5` | `deepseek-v4-flash-high` | Composer-class → Flash: rápido, barato, execução com julgamento leve |
| `cursor-grok-4.5-low` | `deepseek-v4-high` | Grok-class → Pro: deliberação, mesmo que leve |
| `cursor-grok-4.5-medium` | `deepseek-v4-high` | Grok-class → Pro: análise moderada, trade-offs |
| `cursor-grok-4.5-high` | `deepseek-v4-max` | Grok High → Pro-max: multi-domínio, design não óbvio, custo de falha alto |
| `kimi-k3-low` | `deepseek-v4-max` | Kimi K3 > Grok 4.5 em capacidade → Pro-max: execução de blast radius alto (refactors, migrations+RBAC, simplify amplo) |

**Flash-max (`deepseek-v4-flash-max`)** existe mas é exceção: só quando uma Issue Composer-class tem complexidade inesperada e o agente local decide subir o effort sem trocar de família. Não é o default de mapeamento nenhum.

**Kimi K3 Low é exceção à regra Flash/Pro:** mais potente que Grok 4.5, vai direto para Pro-max — é execução, mas de blast radius alto e com plano fechado, não execução mecânica trivial.

### Pool × API Cloud

| Slug `model:` | API `model.id` | params |
| ------------- | -------------- | ------ |
| `cursor-grok-4.5-low` | `grok-4.5` | `effort=low`, `fast=false` |
| `cursor-grok-4.5-medium` | `grok-4.5` | `effort=medium`, `fast=false` |
| `cursor-grok-4.5-high` | `grok-4.5` | `effort=high`, `fast=false` |
| `kimi-k3-low` | `kimi-k3` | `reasoning=low` |
| `composer-2.5` | `composer-2.5` | `fast=false` |

Slugs `model-local:` (`deepseek-v4-high`, `deepseek-v4-max`, `deepseek-v4-flash-high`, `deepseek-v4-flash-max`) **não são enviados ao pool** — são consumidos apenas pelo agente local (Zed).

## Issues muito complexas

O plano de **implementação** nasce em `work-issue` / `agent-work-issue` (`*-impl.md`), não em `plan-issue`. Preferir **uma** Issue de intenção + Grok no `model:` quando a deliberação de engenharia for cara.

Bipartir (`{id}-plan` Grok High → `{id}-exec` `kimi-k3-low`) só sob pedido explícito ou blast radius extremo (refactor repo-wide / simplify amplo). Não despachar Kimi K3 Low sem plano de implementação fechado.

## Regras

1. **Composer 2.5 é o default de pool.** Se a tarefa cabe nele, não suba de modelo.
2. **Grok exige effort explícito** (`-low` / `-medium` / `-high` no slug). Não deixe `cursor-grok-4.5` sem sufixo; não use High como coringa.
3. **Toda Issue declara `model-local:`** com o slug DeepSeek V4 correspondente, conforme o mapeamento canônico. Issue sem `model-local:` está incompleta.
4. **Nunca `-fast`.** Nem em Issue, nem em `Task.model`, nem sob pedido — recusar e usar o slug sem `-fast`.
5. **Kimi K3 Low só na exec bipartida** (ou quando a Issue já declara `kimi-k3-low` após um plan).
6. **Nunca economizar em:** migrations (história congelada), access control (`overrideAccess: false`), Consent/LGPD — se for uma Issue só disso e complexa, bipartir (plan Grok High → exec K3).
7. **Usuário pediu modelo específico:** a escolha dele vence (exceto `-fast`, sempre recusado); avise uma vez se houver desperdício claro.
8. **`model-local:` é sempre DeepSeek.** O agente local pode usar Composer/Grok na sessão se fizer sentido, mas o frontmatter declara o DeepSeek canônico.

## Como aplicar

- **Frontmatter da Issue:** `model:` (slug pool) + `model-local:` (slug DeepSeek, conforme mapeamento). Ambos obrigatórios.
- **Subagentes (`Task.model`):** prefira o slug da Issue quando o enum do produto listar (`composer-2.5`, `cursor-grok-4.5-high`, `kimi-k3-low`, …). **Nunca** escolha variantes `-fast` do enum. Se a Issue é `-low`/`-medium` e o enum não tem o slug, use `inherit` (sessão já no effort certo) ou `cursor-grok-4.5-high` só se a subtarefa for a parte difícil — **não** "promova" a Issue inteira para High.
- **Sessão principal:** o agente não troca o próprio modelo. Se o atual não for o da tabela, diga em uma linha e siga.
- **Pool:** `POOL_DEFAULT_MODEL_SLUG` = `composer-2.5`; `resolvePoolModel` mapeia os slugs canônicos → API e **sempre** inclui `fast=false` quando o modelo Cloud aceita o param (senão o dashboard fatura `*-fast`).

## Gates por fluxo

- **`/simplify`:** herda o modelo da sessão. Preferir sessão em Kimi K3 Low **só** quando houver Issue de exec bipartida; caso contrário Composer ou Grok (effort pela tabela) conforme complexidade.
- **`work-issue`:** verifica `model:` + `model-local:` (assimétrico: mais fraca → informa e segue; mais forte → informa e **pausa**). Ausentes → aplica esta tabela.
- **`agent-work-issue`:** pool já fixou o modelo no spawn; sessão mais forte → informa e segue.
- **`plan-issue`:** sugere via esta tabela (slug completo com effort); bipartição só sob blast radius extremo / pedido explícito.
- **`agent-pool` smoke:** Composer default; Grok com effort explícito / Kimi K3 Low em Issues de teste bipartidas.
