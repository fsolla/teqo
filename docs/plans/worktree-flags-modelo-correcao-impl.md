# Impl: Corrigir mapa de modelos e launch do worktree CLI (follow-up OPS93)

Status: rascunho
Atualizado em: 2026-08-24
Issue: #876
Intenção: docs/plans/worktree-flags-modelo-correcao.md
Appetite restante: ~0,5 dia (herdado)

## Leitura da intenção

- **Outcome:** `pnpm worktree next/plan/new` volta a abrir o TUI sozinho (`--variant` sai da diretiva — o yargs do TUI rejeita o flag desconhecido) e as 5 flags apontam para o mapa de modelos corrigido; as superfícies que citam o mapa/diretiva saem sincronizadas na mesma entrega; sem flag, preset `deepseek/deepseek-v4-flash` intacto.
- **O que NÃO negociar:** cardápio fechado de 5 flags (`--cheap|--pro|--zen|--go|--alibaba`, mesmas chaves); preset sem flag; sem persistência de preferência; sem tocar `/work-issue`/`plan-issue`; sem editar config global de variantes da máquina via repo; fora do terminal interativo (`TEQO_WORKTREE_TERMINAL≠1`) as flags continuam irrelevantes.
- **O que reavaliar:** hipótese de direção confirmada linha a linha pelo explorador (ver abaixo). O mapa-alvo não estava registrado por escrito em nenhum artefato acessível (#876/#859, planos OPS93) — foi fornecido e travado pelo humano no GATE desta entrega; tabela na decisão 2 abaixo.

## Estado atual verificado (explorador)

- `scripts/lib/worktree.mjs`: mapa L43-49 (`cheap=cheapestinference/deepseek-v4-flash`, `pro=opencode-go/qwen3.7-max`, `zen=opencode-go/ox-alpha-free`, `go=opencode-go/mimo-v2.5`, `alibaba=alibaba-token-plan/qwen3.7-max`); `WORKTREE_VARIANT='max'` L54-55; docblocks L40-41 e L171-177 citam `--variant max`; erro de conflito lista flags L66; diretiva monta `[dir,'--model',selectedModel,'--variant',WORKTREE_VARIANT,'--auto']` em **L198**; preset L34-35 (`deepseek/deepseek-v4-flash`, override `OPENCODE_WORKTREE_MODEL`).
- `scripts/worktree.mjs`: importa `WORKTREE_VARIANT` (bloco L147-156); consumo via `resolveLaunchModel` L169-176 → `printLaunchDirective` L178-189; docblock/help citam mapa+variant em L22-29, L33-34, L39, L73, L88, L809, L811, L821, L824, L830, L842, L850; **resquício**: help L101 ainda diz "`--go` é no-op" (OPS24 — stale desde o remapeamento do OPS93).
- `.agents/shell/worktree.sh`: L10, L15-19 (mapa + `--variant max`), L50 (`--go` mimo-v2.5).
- `.opencode/commands/worktree.md`: L7 (mapa + "`--variant max` sempre"), L12 (diretiva com variant).
- `.agents/skills/worktree-next-issue/SKILL.md`: L32, L34. `.agents/skills/local-database/SKILL.md`: L29.
- `tests/unit/worktree.unit.spec.ts`: pins L160-218 (~10 expects com `'--variant ${WORKTREE_VARIANT}'` embutido), L195-204 (`expect(WORKTREE_VARIANT).toBe('max')`), L234-241 (`toEqual` do mapa), L251-256 (flags), L267-282 (diretiva por flag).
- Consumidores do mapa: único `resolveWorktreeModel` (lib L62-71) ← `scripts/worktree.mjs:172`. Nada exporta `WORKTREE_VARIANT` para env/shell. `tests/unit/opencodeCommands.unit.spec.ts` não é afetado (anti-goal — não mexer).
- Blast radius: `scripts/worktree.mjs` está em `HIGH_RISK_EXACT` (`scripts/lib/test-affected-core.mjs:36`; pin espelho `tests/unit/testAffected.unit.spec.ts:28`) → diff nele = unit/int full + e2e curado no PR. `scripts/lib/worktree.mjs` NÃO é high-risk.
- Catálogo local (explorador): `opencode-go` tem `ox-alpha-free` ✓ `qwen3.7-max` ✓ `mimo-v2.5` ✓; `alibaba-token-plan` tem `qwen3.7-max` ✓; `cheapestinference` serve modelos pela config da máquina (`deepseek-v4-flash`, `mimo-v2.5`); **não existe** provider `opencode-zen` (gate da intenção confirmou `--zen` → `opencode-go/ox-alpha-free` — igual ao atual).

## Abordagem recomendada

```mermaid
flowchart LR
  PINS["tests/unit/worktree.unit.spec.ts\npins novos (sem variant, mapa GATE)"] --> LIB["scripts/lib/worktree.mjs\nmapa values + remove WORKTREE_VARIANT\ndiretiva L198 sem --variant"]  LIB --> CLI["scripts/worktree.mjs\nimport/help/docblock"]
  CLI --> SURF[".agents/shell/worktree.sh\n.opencode/commands/worktree.md\n2 skills"]
  SURF --> GATES["pnpm test:unit -t worktree\npnpm gate:fast\nsmoke terminal"]
```

**Opções consideradas:** A | B | C
**Recomendação:** A — remoção incondicional de `--variant`/`WORKTREE_VARIANT` + troca dos **values** do mapa existente; assinaturas (`resolveWorktreeModel`, `opencodeLaunchDirective({dir,purpose,terminal,issueNumber,model})`), chaves de flags e preset intactos; 7 superfícies de texto sincronizadas num único lote. Cabe no appetite (~2 arquivos de lógica + 5 de doc/skill + 1 spec), não cria módulo novo (depth check: o dono do concern já existe), e a diretiva volta ao formato que o TUI aceita.

**Rejeitadas:**

- **B — emitir `--variant` condicionalmente** (só quando o modelo expuser variante): reintroduz o conceito que caiu com a premissa falsa do OPS93; exigiria catálogo de variants no repo (anti-goal: config global é assunto da máquina, OPS78/OPS89) e complexidade sem pedido. O "effort max" morre junto com a premissão — variantes seguem selecionáveis via Ctrl+T no TUI e `--variant max` segue vivo só no `opencode run` headless.
- **C — reescrever a resolução de modelo** (nova função/módulo para o mapa): twinning do `resolveWorktreeModel`/`WORKTREE_MODEL_MAP` existentes; rejeitada — editar o dono do concern, não criar paralelo.

### Decisões de engenharia (com rejeitadas)

1. **Remoção incondicional do `--variant` na diretiva do TUI**
   - Opções: A) remover sempre | B) condicional ao modelo | C) mover variante para config do repo.
   - Recomendação: A — a quebra é incondicional (o TUI nunca aceita `--variant`); B/C reabrem o laboratório de variantes cortado pela intenção (rabbit hole nomeado).
   - Forma: args volta a `[dir,'--model',selectedModel,'--auto']` (+ `--prompt` quando houver); constante `WORKTREE_VARIANT` eliminada (export + import em `scripts/worktree.mjs` + todos os pins).

2. **Mapa-alvo (confirmado pelo humano no GATE de 2026-08-24; IDs validados contra o catálogo local)**

   | Flag        | Valor atual (OPS93 entregue)          | Alvo (GATE)                                      |
   | ----------- | ------------------------------------- | ------------------------------------------------ |
   | `--cheap`   | `cheapestinference/deepseek-v4-flash` | `cheapestinference/deepseek-v4-flash` _(mantém)_ |
   | `--pro`     | `opencode-go/qwen3.7-max`             | `deepseek/deepseek-v4-pro`                       |
   | `--zen`     | `opencode-go/ox-alpha-free`           | `opencode-go/ox-alpha-free` _(mantém)_           |
   | `--go`      | `opencode-go/mimo-v2.5`               | `opencode-go/hy3`                                |
   | `--alibaba` | `alibaba-token-plan/qwen3.7-max`      | `alibaba-token-plan/deepseek-v4-flash`           |
   - Fecha a conta da intenção: três modelos corrigidos (`--pro`, `--go`, `--alibaba`) e um provider questionado (`--pro`: sai de `opencode-go`, vai ao provider `deepseek`); `--cheap`/`--zen` permanecem.
   - Restrição estrutural: só **values** mudam; chaves, `WORKTREE_MODEL_FLAGS` derivado e preset ficam intactos.
   - Validação de catálogo (feita): `deepseek/deepseek-v4-pro` ✓, `opencode-go/hy3` ✓, `alibaba-token-plan/deepseek-v4-flash` ✓, `cheapestinference/deepseek-v4-flash` ✓ (config da máquina), `opencode-go/ox-alpha-free` ✓.

3. **Sincronização das 7 superfícies + resquício do help**
   - As 7 da intenção: docblocks/mapa em `scripts/lib/worktree.mjs`, docblock/help em `scripts/worktree.mjs`, `.agents/shell/worktree.sh`, `.opencode/commands/worktree.md`, `.agents/skills/worktree-next-issue/SKILL.md`, `.agents/skills/local-database/SKILL.md`, pins de teste.
   - Inclui também o help L101 de `scripts/worktree.mjs` ("`--go` é no-op" — stale do OPS24 dentro do bloco de ajuda do `kill`): sai na mesma entrega porque é o mesmo contrato de mapa/divergência documental que a intenção manda encerrar (precedente OPS24: contrato documentado em todas as superfícies na mesma entrega). Textos citando `--variant max`/effort viram descrição do mapa sem variant; menção a variantes passa a apontar Ctrl+T/config global (fora do repo).
   - `.opencode/agent/designer-campanha-solla.md:64` e `design-vision.md:15` citam `opencode-go/mimo-v2.5` como fallback de visão — **fora do escopo** (não são parte do mapa/diretiva; nada quebra).

### Componentes / mudanças

- **`scripts/lib/worktree.mjs`**: values do `WORKTREE_MODEL_MAP` (tabela GATE); delete `WORKTREE_VARIANT` (L54-55); `opencodeLaunchDirective` L198 sem `--variant`; docblocks L40-41/L171-177 descrevendo o mapa novo e sem variant.
- **`scripts/worktree.mjs`**: remover import/usos de `WORKTREE_VARIANT`; docblock (L22-39, L73, L88) e help (L809-850, incl. L101 do `kill`) atualizados.
- **`.agents/shell/worktree.sh`**, **`.opencode/commands/worktree.md`**, **2 skills**: textos espelhos do mesmo contrato.
- **`tests/unit/worktree.unit.spec.ts`**: remover pins de `WORKTREE_VARIANT`/`'--variant'`; nova pinagem da diretiva (`--model X --auto [--prompt …]`) e do mapa GATE; suite de flags/exclusividade intacta em estrutura.
- **Migration:** sem migration — tooling pura. **Access/Consent:** N/A. **UI:** Impeccable A — sem superfície de produto.

## Fases verificáveis

1. **Pins primeiro (TDD)** — atualizar `tests/unit/worktree.unit.spec.ts` para o contrato-alvo (diretiva sem `--variant`, mapa GATE confirmado); rodar e ver vermelho. Quota ~25%.
2. **Lib** — `scripts/lib/worktree.mjs`: mapa + remoção do variant + docblocks; unit verde. Quota ~25%.
3. **CLI + superfícies** — `scripts/worktree.mjs` (import/help/docblock/incl. L101) + shell + command + 2 skills, num único lote de sincronização. Quota ~30%.
4. **Gates + entrega** — `pnpm test:unit -t worktree`; `pnpm gate:fast`; smoke `TEQO_WORKTREE_TERMINAL=1 node scripts/worktree.mjs next --stay` (diretiva impressa sem `--variant`, modelo do flag escolhido; múltiplas flags continua falhando alto); changelog NOVA entrada `docs/changelog/<data>-ops95.md`; `pnpm push` → PR `Closes #876` (HIGH_RISK_EXACT dispara unit/int full + e2e curado no CI). Quota ~20%.

## Rabbit holes / Não escopo (engenharia)

- Reabrir o mapa além da tabela GATE (trocar `--cheap`/`--zen`, aceitar `provider/model` livre, cardápio novo).
- Reintroduzir effort/variante por outra via (env por worktree, `opencode.json` do repo, config global via commit) — variantes vivem na máquina (Ctrl+T; `opencode run --variant max` para headless).
- Mudar preset, chaves de flags, prompts ou pins de `tests/unit/opencodeCommands.unit.spec.ts`.
- Editar planos/changelog históricos (OPS93 imutável; entrada nova em `docs/changelog/`).
- Estender o cardápio ou aceitar `provider/model` livre.
- `.opencode/agent/designer-campanha-solla.md` e `design-vision.md` citam `opencode-go/mimo-v2.5` como fallback de visão (fora do mapa/diretiva; nada quebra). **Deferido com gatilho:** atualizar na próxima troca de mapa de modelos ou edição desses docs (mesma classe de drift texto↔código desta entrega).

## Riscos e mitigação

- **HIGH_RISK_EXACT (`scripts/worktree.mjs`)** → PR roda unit/int full + e2e curado; mitigação: tocar só import/docblock/help, sem `provision`/claim/PORT/env.
- **Divergência de contrato nas 7 superfícies de texto (+ resquício do help do kill)** → mitigação: lote único (Fase 3) + grep final por `--variant`/`WORKTREE_VARIANT`/valores antigos do mapa zerando fora de histórico imutável.
- **Suíte herdar `OPENCODE_WORKTREE_MODEL`** (`presetInEffect()` lê env) → mitigação: manter padrão existente do spec; rodar unit no ambiente limpo do gate.
- **ID do mapa GATE sumir do catálogo da máquina no futuro** → mitigação: IDs validados hoje; smoke imprime a diretiva e o uso real falha alto/visível — se um provider mudar, vira correção futura, não commit de catálogo.

## Aceite de engenharia

- [ ] Aceite de produto coberto: TUI abre sozinho nas invocações com/sem flag; 5 flags → mapa corrigido; sem flag → preset; fora do terminal inalterado; 7 superfícies sincronizadas.
- [ ] Invariantes: sem collection/migration/PII/Consent; identificadores em inglês; sem ciclo; editado o dono do concern (sem twin).
- [ ] Testes: unit pins do mapa + diretiva (TDD); `pnpm gate:fast` verde; smoke de terminal registrado no PR.

---

Self-score decision-quality: 5/5 — decisões caras com rejeitadas (remoção incondicional; values-only; sync única); cabe no appetite; rabbit holes nomeados (inventar mapa é bloqueado pelo GATE); reusa `WORKTREE_MODEL_MAP`/`resolveWorktreeModel`/`opencodeLaunchDirective` sem twinning; outcome da intenção preservado.
