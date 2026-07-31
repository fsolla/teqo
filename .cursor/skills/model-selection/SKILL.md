---
name: model-selection
description: >-
  Escolhe o modelo (e o nível de raciocínio/effort) com melhor custo/valor
  para cada classe de tarefa do Teqo, e despacha subagentes já no modelo certo
  via o parâmetro `model` da tool Task. Caminho feliz único: Composer 2.5 ↔
  Grok 4.5 (effort) ↔ Kimi K3 Low (exec bipartida). Usar no início de
  implementação, ao despachar subagentes, antes de /simplify, ou quando o
  usuário perguntar "qual modelo usar".
---

# Seleção de modelo × effort

Dois eixos, nesta ordem: **(1) classe da tarefa → modelo**, **(2) custo de uma falha → effort**. Preço e contexto compram capacidade; effort compra deliberação.

## Tabela canônica (2026-07-31)

| Prioridade | Modelo | Quando |
| ---------- | ------ | ------ |
| 1 (default) | **Composer 2.5** (`composer-2.5`, sem `-fast`) | Features, chores simples, fixes localizados, docs leves — sempre que couber |
| 2 | **Grok 4.5** (`cursor-grok-4.5-*`) | Effort por complexidade (abaixo) |
| 3 | **Kimi K3 Low** (`kimi-k3-low`) | Só na **fase de execução** de issues bipartidas (refactor grande / simplify / migrations+RBAC de blast radius alto), depois de um plano fechado |

**Removidos** desta skill (não usar como 1ª escolha nem fallback documentado): Kimi K2.7, Haiku, GLM, Gemini, Luna. Se a API Cloud rejeitar um slug, o pool já faz fallback para `composer-2.5` no código — não documentar outros modelos aqui.

### Effort (Grok 4.5)

| Effort | Uso |
| ------ | --- |
| Low | Bookkeeping, Prettier, merges, rebase, chores mecânicos |
| Medium | Discovery / análise moderada |
| **High** | **Default para issues complexas** (multi-domínio, design não óbvio) |

Slug Task de referência: `cursor-grok-4.5-high` (High). Para Low/Medium na sessão principal, use o seletor de modelo/effort do produto — o pool resolve o id da Issue via `resolvePoolModel`.

## Issues muito complexas (bipartir)

Quando o blast radius é alto (refactor amplo, simplify repo-wide, migration+RBAC), `plan-issue` **registra duas Issues encadeadas**:

1. `{id}-plan` — `model: cursor-grok-4.5-high` — entregável = plano em `docs/plans/…` + critérios de aceite da execução
2. `{id}` ou `{id}-exec` — `model: kimi-k3-low`, `depends: [{id}-plan]` — executa o plano

Não despachar Kimi K3 Low sem plano fechado na Issue de plan.

## Regras

1. **Composer 2.5 é o default.** Se a tarefa cabe nele, não suba de modelo.
2. **Grok High para complexidade**, não para volume mecânico.
3. **Kimi K3 Low só na exec bipartida** (ou quando a Issue já declara `kimi-k3-low` após um plan).
4. **Nunca economizar em:** migrations (história congelada), access control (`overrideAccess: false`), Consent/LGPD — se for uma Issue só disso e complexa, bipartir (plan Grok High → exec K3).
5. **Usuário pediu modelo específico:** a escolha dele vence; avise uma vez se houver desperdício claro.

## Como aplicar

- **Subagentes (`Task.model`):** só estes slugs nesta skill:
  - `composer-2.5`
  - `cursor-grok-4.5-high`
  - `kimi-k3-low`
  - `inherit` só quando a classe do subagente é a mesma da sessão
- **Sessão principal:** o agente não troca o próprio modelo. Se o atual não for o da tabela, diga em uma linha e siga.
- **Pool:** `POOL_DEFAULT_MODEL_SLUG` = `composer-2.5`; `resolvePoolModel` cai para Composer se o slug da Issue for desconhecido.

## Gates por fluxo

- **`/simplify`:** herda o modelo da sessão. Preferir sessão em Kimi K3 Low **só** quando houver Issue de exec bipartida; caso contrário Composer ou Grok High conforme complexidade.
- **`work-issue`:** verifica `model:` da Issue (assimétrico: sessão mais fraca → informa e segue; mais forte → informa e pausa). Ausente → aplica esta tabela.
- **`plan-issue`:** sugere via esta tabela; em issues muito complexas, registra o par plan/exec.
- **`agent-pool` smoke:** Composer default; Grok High / Kimi K3 Low em Issues de teste bipartidas.
