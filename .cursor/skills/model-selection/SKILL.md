---
name: model-selection
description: >-
  Escolhe o modelo (e o nível de raciocínio/effort) com melhor custo/valor
  para cada classe de tarefa do Teqo, e despacha subagentes já no modelo certo
  via o parâmetro `model` da tool Task. Usar no início de trabalho de
  implementação, ao despachar subagentes, antes de passes de /simplify ou
  auditoria, ou quando o usuário perguntar "qual modelo usar", "modelo mais
  barato para X", "troca o modelo", "vale a pena effort high".
---

# Seleção de modelo × effort por classe de tarefa

Dois eixos independentes, decididos nesta ordem: **(1) classe da tarefa → modelo**, **(2) custo de uma falha → effort**. Preço e contexto compram capacidade; effort compra deliberação (tokens de thinking, cobrados como output). Esforço escala com **quanto custa errar**, não com o tamanho da tarefa.

## Tabela canônica (atualizada 2026-07-29 — revalidar preços em cursor.com/docs/models-and-pricing antes de citar valores)

| Classe de tarefa                                                                                      | Modelo (1ª escolha) | Fallback metered | Effort   |
| ----------------------------------------------------------------------------------------------------- | ------------------- | ---------------- | -------- |
| Feature delivery do roadmap (itens B/E/C, multi-arquivo, gates completos)                             | Composer 2.5 (pool) | Gemini 3.1 Pro   | Medium   |
| Passes de /simplify, auditoria de plano, review debts (bugs sutis: closures, races, drift de strings) | Kimi K3 (1M ctx)    | Gemini 3.1 Pro   | **High** |
| Migrations, access control / RBAC, Consent, segurança (blast radius alto, história congelada)         | Kimi K3             | Gemini 3.1 Pro   | **High** |
| Fixes pequenos e localizados (um arquivo, sintoma conhecido, repair de teste)                         | Kimi K2.7           | Haiku 4.5        | Medium   |
| Ciclos de discovery / research (compêndios, personas, relatórios longos em pt-BR — write-heavy)       | GLM 5.2             | Gemini 3.6 Flash | Medium   |
| Docs/bookkeeping (planos, TECH-DEBT, débitos no roadmap), Prettier, merges, rebase, chores            | Grok 4.5 (pool)     | Kimi K2.7        | **Low**  |
| Perf/infra (medição de bundle, waterfall, análise de queries)                                         | Gemini 3.1 Pro      | Composer 2.5     | Medium   |
| Depuração travada ("horas sem progresso", bug intermitente com hipóteses esgotadas)                   | Kimi K3             | GPT-5.6 Luna     | **Max**  |

## Regras

1. **Pool primeiro.** Composer 2.5 e Grok 4.5 saem do pool "Cursor Models" (uso incluído generoso) — ~70% do trabalho deste repo é rotina e não deveria tocar o pool metered ("Other Models", cobrado a preço de API).
2. **Kimi K3 é cirúrgico, não default.** Custa 3× o K2.7 no input e ~4× no output. Reservar para as três classes onde uma falha perdida vira bug de produção ou migration congelada errada. O 1M de contexto sem sobretaxa é o diferencial para auditorias repo-wide.
3. **Effort default = Medium.** Subir para High só nas classes marcadas; Low em docs/formatação/merges; Max é exceção de depuração, nunca rotina. Em tarefa fácil, effort alto só reescreve o óbvio com tokens mais caros.
4. **Nunca economizar em:** migrations (história congelada, aplicam em produção no build), access control (`overrideAccess: false`), Consent/LGPD, e passes de /simplify — o histórico do repo mostra que é neles que os P0/P1 sutis aparecem.
5. **Metered barato ≠ grátis:** K2.7 ($0.95/$4) e Haiku 4.5 ($1/$5) consomem o pool "Other Models"; se a tarefa cabe num pool model, pool vence sempre.

## Como aplicar o modelo

- **Subagentes (automático):** a tool `Task` aceita `model`. Despache já no slug certo — não rode o subagente no modelo herdado e sugira troca depois:
  - `composer-2.5` / `composer-2.5-fast` — features e rotina
  - `cursor-grok-4.5-high` — docs, chores, exploração
  - `gemini-3.1-pro` — fallback metered forte / perf
  - `gemini-3.6-flash-high` — discovery write-heavy (fallback)
  - `glm-5.2-high` — discovery/research
  - `kimi-k2.7-code` — fixes pequenos
  - `kimi-k3-low` — auditorias/simplify/migrations (única variante K3 disponível para subagentes; o raciocínio extra vem do modelo, não do effort knob aqui)
  - `claude-4.5-haiku-thinking` / `gpt-5.6-luna-medium` — fallbacks de fix pequeno
  - `inherit` só quando a classe do subagente é a mesma da sessão.
- **Sessão principal (sugestão):** o agente não troca o próprio modelo. Ao classificar a tarefa no início do trabalho, se o modelo atual não for o da tabela, diga em uma linha: _"Esta tarefa é classe X — o melhor custo/valor é **Y** (effort Z); considere trocar no seletor de modelo."_ Não repita o aviso na mesma sessão.
- **Usuário pediu modelo específico:** a escolha dele vence a tabela; use-a só para avisar uma vez se houver desperdício claro (ex.: K3 numa formatação Prettier).

## Gates por fluxo (onde a decisão de modelo entra no loop)

- **`/simplify` (comando built-in, não editável):** seus três subagentes de review **herdam o modelo da sessão pai** — não há como despachá-los em outro modelo. Portanto a decisão acontece **antes** de invocar `/simplify`: se a sessão não estiver em Kimi K3 (effort High) ou Gemini 3.1 Pro, avise uma vez e sugira a troca — _"passes de /simplify são onde este repo acha os P0/P1 sutis; considere rodar em K3 High."_ Se o usuário optar por seguir no modelo barato, aceite — é escolha informada, não erro.
- **`ship-to-main` / `close-delivery`:** têm Passo 0 com gate declaratório — param o fluxo se a sessão estiver em metered premium. São classe docs/chores; nunca justificam K3/Pro/GLM.
- **`implement-roadmap-item`:** a classe pode mudar **por fase** — fases de schema/migration são High-effort (K3), fases de documentação da sessão são Low (pool model). Sessões longas: vale sugerir troca entre a fase de engenharia e a fase final de docs.
- **`suggest-next-roadmap-items`:** leitura + ranqueamento — classe docs/análise; pool model (Grok 4.5) ou metered barato bastam. A recomendação de modelo que ele emite por item é para a **worktree de implementação**, não para a sessão de sugestão.
- **Discovery cycles (`docs/research/`):** write-heavy pt-BR — GLM 5.2 ou Gemini 3.6 Flash, Medium.

## Quando o effort faz diferença (critério de decisão)

Suba um degrau de effort quando **duas ou mais** forem verdade:

- a falha é silenciosa (sem teste que a pegue — ex.: drift de string em `safeMessages`, race otimista);
- a verificação exige rastrear um valor por 3+ frames/requests/renders;
- o diff toca migration, access, ou hook com `req`/transação;
- a tarefa é "provar ausência" (auditoria, knip, ciclos) e não "produzir presença".

Desça um degrau quando a saída é mecânica (formatar, renomear, registrar débito, resolver merge trivial) ou quando já existe gate que pega o erro (tsc/lint/teste pinado cobre exatamente o risco).
