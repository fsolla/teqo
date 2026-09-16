# Impl: Modelos padrão do worktree: --go → DeepSeek V4.1 Flash e --zen → Muse Spark 1.3 Free

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1048
Intenção: docs/plans/worktree-modelos-go-zen.md
Appetite restante: herdado (~0,5 dia — 2 valores do mapa + textos + pin)

## Leitura da intenção

- **Outcome:** Flags --go e --zen resolvem para os novos IDs de modelo
- **O que NÃO negociar:** Preset sem flag (deepseek/deepseek-flash) intocado; demais flags do mapa; reintroduzir --variant
- **O que reavaliar:** Se scripts/worktree.mjs é realmente HIGH_RISK e se o pin unitário cobre todas as superfícies

## Abordagem recomendada

- **Opções:** A (update direto do mapa + sync de todas as superfícies + pin) | B (só mapa, ignorar doc/shell) | C (script automatizado para sync)
- **Recomendação:** A — por quê (coerência total, precedente OPS95/100/101)
- **Rejeitadas:** B por contrato divergente; C por over-engineering (são 2 valores, não um catálogo)

### Componentes / mudanças

- **`scripts/lib/worktree.mjs`** (fonte única): Atualizar WORKTREE_MODEL_MAP go e zen + docblock OPS112
- **`scripts/worktree.mjs`**: Atualizar docblocks (help interpeta o mapa sozinho)
- **`.agents/shell/worktree.sh`**: Docblock da função
- **`.opencode/commands/worktree.md`**: Bloco do `next`
- **`.agents/skills/worktree-next-issue/SKILL.md`**: Prose do default-go e launch
- **`tests/unit/worktree.unit.spec.ts`**: Pin toEqual do mapa
- **`.agents/skills/local-database/SKILL.md`**: Confirmar citação (nada muda)
- **`docs/changelog/2026-09-15-ops112.md`**: Nova entrada

### Dados → forma

- Itens config-only: literais de produto (IDs pedidos), nada de schema/DB/access

## Fases verificáveis

1. **Atualizar fonte única** — scripts/lib/worktree.mjs go e zen
2. **Sync de todas as superfícies** — docblocks, scripts, shell, commands, skills
3. **Pin unitário** — tests/unit/worktree.unit.spec.ts
4. **Changelog** — docs/changelog/2026-09-15-ops112.md
5. **Gates** — `pnpm gate:fast`; push via `pnpm push`

## Rabbit holes / Não escopo (engenharia)

- Não mexer no preset canônico
- Não criar nova flag ou mecanismo
- Não editar docs históricos/congelados

## Riscos e mitigação

- scripts/worktree.mjs é HIGH_RISK_EXACT → diff nele dispara unit/int full + e2e curado; mitigar confirmando que help text muda automaticamente com o mapa
- ID do --zen muda de provider (opencode-go → opencode) → confirmar que a flag name ainda faz sentido

## Aceite de engenharia

- [ ] Acerte de produto da intenção coberto
- [ ] Invariantes de codebase
- [ ] Testes de domínio (unit) onde access/write paths mudam

Self-score decision-quality ≥4 antes de marcar aprovado ou executar.

---
