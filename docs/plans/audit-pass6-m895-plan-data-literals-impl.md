# Impl: Guardrail P6-M895 — plano de intenção registra os dados literais da decisão

Status: aprovado
Atualizado em: 2026-08-25
Issue: #895
Intenção: docs/plans/entrega-engenharia-p6.md
Appetite restante: herdado (~0,5 dia eng, docs-only)

## Leitura da intenção

- **Outcome:** todo plano de intenção que registra uma decisão de DADOS grava os valores literais (IDs, nomes de modelo, envs, tabelas de threshold) — nunca só narrativa. O GATE de planos ganha um prompt que cobra isso.
- **O que NÃO negociar:** classe **6 declarada judgment-only** — sem detector determinístico; nada de código/teste; não fingir que doc é guarda.
- **O que reavaliar:** pontos de aterrissagem exatos no skill (template vs SKILL.md).

## Abordagem recomendada

**Opções:** A (só template) | B (só checklist do gate) | C (ambos)
**Recomendação: C.** O miss tem dois lados: o escritor omitiu os IDs E o gate aprovou sem eles.
**Rejeitadas:** A (gate cego — repete a falha onde ela escapou); B (escritores sem instrução não produzem o dado).

### Componentes / mudanças

- **`.agents/skills/plan-issue/intention-template.md`**: novo bloco **"Dados da decisão (literais)"** — tabela/lista verbatim de valores a aplicar (flag→ID, lista de modelos, strings exatas, envs). Presente SEMPRE que a intenção fixa valores de dados; "N/A" explícito quando não houver.
- **`.agents/skills/plan-issue/SKILL.md`**: Checklist e Passo 4 (GATE) ganham o prompt "decisão de dados → valores literais presentes no plano?".
- **`docs/GUARDRAILS.md`**: linha na tabela Ativos — origem `#895`, classe `6 (judgment-only declarada)`, mecanismo `bloco "Dados da decisão (literais)" + prompt no gate`.
- **`docs/changelog/2026-08-25-audit-pass6-m895.md`**: entrada append-only.
- **Migration / Access / UI:** sem migration, sem access, sem UI.

## Fases verificáveis

1. **Template** — bloco + exemplo concreto do próprio miss (OPS95: tabela flag→ID do mapa).
2. **Gate** — prompt no Checklist/Passo 4 do SKILL.md.
3. **Ledger + changelog** — linha em GUARDRAILS.md; changelog append-only.
4. **Gates** — `pnpm gate:fast` + docs-guards; push via `pnpm push`.

## Rabbit holes / Não escopo

- Não inventar detector de "prosa sem dados" (infalsificável; viola classe 6).
- Não varrer `docs/plans/` retroativamente; não estender aos planos `-impl`; não reestruturar GUARDRAILS.md além da linha nova.

## Riscos e mitigação

- Convenção vira "bloco de cortesia": o prompt fica no GATE humano (Passo 4), não em automação; exemplo do miss nomeado.
- Docs-only: changelog append-only em arquivo novo; nunca editar HISTORY/agregado.

## Aceite de engenharia

- [x] `intention-template.md` com o bloco + exemplo #895 + regra N/A explícita
- [x] SKILL.md gate cobra os literais
- [x] GUARDRAILS.md linha classe 6 declarada, origem #895
- [x] Changelog append-only; `pnpm gate:fast` verde
- [x] Zero código/teste/migration — delta de comportamento nulo

Self-score decision-quality: 5.0 ≥ 4
