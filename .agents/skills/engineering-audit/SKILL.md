---
name: engineering-audit
description: 'Run a Pass-style engineering audit of the Teqo codebase.'
---

# Engineering Audit (Pass N v2)

**Modo primário: autônomo, de ponta a ponta numa execução** ("dispara antes de dormir, acolhe pela manhã"). Nenhum passo depende de confirmação humana durante a noite; o humano é o gate **FINAL** — explora o PR único e mescla. O modo interativo (desktop) é fallback documentado, não o caminho canônico.

> Nota histórica: o modo "solitário" com precheck do agent-pool morreu com o pool (OPS65) — nada a pausar, nenhum precheck. A remediação P0/P1 in-session virou implementação por sub-agentes na mesma branch (contrato abaixo).

Method: the engineering skills this repo follows (improve-code-quality, clean-code, refactoring-patterns, software-design-philosophy, pragmatic-programmer, working-with-legacy-code, remove-technical-debt), specialized to Teqo's standards and history. The pass number is the next one after the last in `docs/IMPROVE-CODE-QUALITY-PLAN.md`.

## Contrato de entrega (o Pass inteiro numa branch)

1. **Branch:** `audit/pass-<N>` criada de `main` atual.
2. **Três artefatos** (passo 5) commitados nessa branch — retrato consolidado comparável entre Passes. Fallback interativo: apresentar antes de escrever.
3. **Melhorias elegíveis** (teto abaixo) planejadas por escritores `-impl` e executadas por implementadores em série na MESMA branch — commit(s) separado(s) por entrega (soft).
4. **UM único PR Ready**, base `main`, **SEM auto-merge**: o safety-net pula branches `audit/*` (`decideAutomergeAction` → `audit-veto`; OPS98). A descrição do PR é o **relatório completo**: achados com números, índice dos artefatos, decisões autônomas + justificativas, bloqueadores, índice commit→achado.
5. **Estado terminal:** required check verde + mergeable. Conflito → rebase em `main`. Falha de CI → loop de correção; 3 ciclos consecutivos no mesmo delivery → estaciona (reverte se necessário), registra bloqueador no relatório e segue. Inviável após esforço limitado → parar gracefully e documentar.
6. Miss resolvida por guardrail nesta entrega carrega `Closes #N` no corpo do relatório (keyword repetida por número — `Closes #52, closes #73`); o resto do relatório usa keyword nenhuma. Sem Issues/PRs por entrega: o registro é o par ledger + PR único; Issue só para pendência/bloqueio que sobrevive ao Pass.

### Teto de implementações por Pass

Elegível = severidade **P0/P1** **e** esforço **S/M**. Fora da noite por construção (independe de severidade): migração de schema, contrato de URL público, behavior delta "not allowed" do protocolo do passo 3 (Consent/LGPD fail-closed, shapes públicos); item L vira ledger + Issue (padrão plan-issue). Guardrails colhidos de misses contam para o teto (a guarda embarca na entrega do fix). **Teto duro: 6 implementações** — ordenadas P0 primeiro, depois P1, dentro de cada severidade por blast radius crescente; excedente elegível fica no ledger marcado `deferred: teto do Pass` e vai para o relatório.

## Decomposição em sub-agentes

Fases pesadas rodam em sub-agentes com contexto mínimo e output limitado; o agente principal orquestra, valida e grava.

### Sub-agente: Varredor de área

**Quando:** passo 2, um por área (paralelo).
**Input:** escopo da área + `reference/smells.md` (desta pasta) + formato de linha do passo 4.
**Task:** Varrer a área contra as famílias de smell. **Não corrigir nada.**
**Output:** ≤20 linhas de ledger-row candidata.

### Sub-agente: Caçador de consolidação

**Quando:** passo 3.
**Input:** hotspot map + `reference/consolidation.md` + precedents/rejected-with-reason de `reference/canon.md`.
**Task:** Classificar candidatos (merge agora / register-with-trigger / look-alike-not-duplication), nomeando o CONHECIMENTO duplicado. **Não propor abstrações fora das táticas listadas.**
**Output:** ≤15 candidatos com knowledge nomeado.

### Sub-agente: Escritor de -impl

**Quando:** passo 6, um por melhoria elegível (paralelo).
**Input:** linha(s) aprovada(s) do ledger + `work-issue/implementation-template.md` + `work-issue/decision-quality.md`.
**Task:** Escrever o conteúdo de `docs/plans/<slug>-impl.md` conforme o template. **Não criar arquivos nem registrar Issues.**
**Output:** conteúdo markdown do plano; self-score decision-quality ≥4.

### Sub-agente: Implementador serial

**Quando:** passo 7, UM POR VEZ, sempre na branch `audit/pass-<N>` compartilhada — sem corridas.
**Input:** UM `-impl` aprovado.
**Task:** Executar o plano (padrão `agent-work-issue`: gates bare, §Prep Cloud sem Docker quando aplicável), commit(s) separado(s) por entrega. **Proibido: mergear, abrir PR, criar branch nova, tocar migração.**
**Output:** hash(es) de commit + resultado do gate (≤10 linhas).

## Checklist

```
- [ ] 0a. Load the canon and the history (OBRIGATÓRIO antes de julgar qualquer coisa) — ler `reference/canon.md` + `docs/AGENT-OPS.md` (paradigma vigente)
- [ ] 0b. Harvest `kind:agent-miss` → candidatos a guardrail (alimenta o passo 4b)
- [ ] 1. Hotspot map (churn × size × mechanical gates); âncora de delta = seção mais recente de `docs/IMPROVE-CODE-QUALITY-PLAN.md`
- [ ] 2. Smell sweep por varredores de área em paralelo (`reference/smells.md`)
- [ ] 3. Consolidation hunt pelo caçador (`reference/consolidation.md`)
- [ ] 4. Triage (severity P0–P3; verify open ledger rows)
- [ ] 4b. Recurrence prevention: classify a deterministic guard for every finding class (`reference/guards.md`; ledger em `docs/GUARDRAILS.md`)
- [ ] 5. Write the three artifacts on the branch (fallback interativo: apresentar antes)
- [ ] 6. Melhorias elegíveis planejadas por escritores `-impl`
- [ ] 7. Implementação serial pelos implementadores (teto: 6)
- [ ] 8. Único PR Ready sem auto-merge + relatório-na-descrição + loop até CI green + mergeable
```

## Passos operacionais

**0a — Canon:** leitura obrigatória de `reference/canon.md` (ordem do canon, precedents de consolidação, rejected-with-reason) ANTES de julgar — reproposta de ideia rejeitada (ex.: ports-and-adapters NO-GO) é defeito do audit. **0b — Harvest:** investigue cada miss aberta (`pnpm issue all` / API do GitHub): causa raiz no corpo, fix aplicado segurou?, classe ainda reproduzível? Miss cuja classe já tem guarda viva gera hardening da guarda, não guardrail novo; cada miss alimenta o 4b; guardrail mergeado fecha a miss com `Closes #N`.

**1 — Hotspot map:** âncora de delta = data da seção mais recente de `docs/IMPROVE-CODE-QUALITY-PLAN.md`; `git log --since="<âncora>" --name-only --format= | sort -u` é o foco prioritário (trabalho paralelo desde o último Pass); churn 3 meses: `git log --since="3 months ago" --name-only --format= | sort | uniq -c | sort -rn | head -40`; baseline dos gates estáticos (`tsc --noEmit`, `lint`, `knip`, `check:cycles`) anotada — vermelho pré-existente é "pre-existing", não do audit.

**2 — Sweep:** áreas (`src/lib`, `src/utilities` +`access/`, `src/components/campaign`, `(campaign)`, `(frontend)`, `src/collections`, `src/globals`, `scripts/`, `tests/`) distribuídas aos varredores; detalhe das famílias em `reference/smells.md`. Bug achado na auditoria é REGISTRADO, não corrigido. Guarda existente dodgeável é finding próprio.

**3 — Consolidação (core deliverable):** classes de equivalência, táticas e behavior-delta protocol em `reference/consolidation.md`; precedents e rejected em `reference/canon.md`.

**4 — Triage:** cada vira linha de ledger — ID, area, smell/type, evidence (file:line + measurement), pattern/decision violated, proposed fix, behavior delta, blast radius, pins, recurrence-guard class (4b), effort (S/M/L), severity: **P0** correctness/security (access control, transactions, consent, type honesty masking errors) · **P1** active harm (gate permanentemente vermelho, perf medida, duplicação com comportamento divergente) · **P2** drift com custo real · **P3** polish. Verifique toda linha aberta de `docs/TECH-DEBT.md`: still true? Close stale com evidência. Priorize: changing next × high churn × core domain.

**4b — Guardas determinísticas:** classifique cada classe de achado na escada de `reference/guards.md` (1 Type → 6 Doc/judgment-only declarado). Guarda viável embarca NA MESMA entrega do fix; guarda dodgeável vira item de hardening; preferir UMA guarda por classe a N pins.

**5 — Artefatos:** (1) nova seção Pass N em `docs/IMPROVE-CODE-QUALITY-PLAN.md`; (2) novas linhas `open — Pass N` nas tabelas de `docs/TECH-DEBT.md` + stale fechadas; (3) `docs/plans/entrega-engenharia-pN.md` (pt-BR) com workstreams P0→P3, cada item com sua Guarda determinística e o plano com guard map. Commitados na branch (fallback interativo: sign-off antes).

**6–8 — Ciclo de melhorias e entrega:** escritores `-impl` → implementadores em série (teto acima) → push `pnpm push -u origin HEAD` → PR único Ready (base `main`, **sem auto-merge**) com relatório completo na descrição → loop até CI green + mergeable → para. O humano explora e mescla.

## Ground rules (non-negotiable)

1. Read-only em `src/`, `tests/`, `scripts/` durante a VARREDURA. Writes da noite: os três artefatos, os `-impl` das melhorias elegíveis e suas implementações na branch do Pass.
2. Gate commands bare, never piped (`pnpm test | tail` swallows the exit code).
3. Never `knip --fix` blind — verify with `git grep -w <symbol>` (knip cannot load `payload.config.ts`; ledgered P3).
4. Production is live Postgres on the homeserver (`teqo_1313`) with real PII. Local DB only, `teqo_test` for tests. The audit needs no DB writes.
5. Every claim gets a number (lines, exports, call sites, ms, kB). "Rejected by measurement" is an acceptable outcome.
6. Frozen migrations never edited; schema change = `pnpm migrate:create` (e sai do escopo da noite — ver teto).
7. Leftovers → ledger via `capture-review-debts`; nothing lives only in chat.

## Done when

Canon lido antes de julgar; hotspot map com âncora de delta e números; sweep completo com ledger rows; todo candidato de consolidação classificado (merge now / register-with-trigger / look-alike-not-duplication); toda linha aberta do ledger verificada; toda miss colhida classificada (guardrail com `Closes #N` / hardening de guarda viva / judgment-only); todo classe de achado com guarda classificada e guard map no plano; três artefatos commitados na branch; melhorias elegíveis implementadas em série (≤6) com commits separados; PR único Ready sem auto-merge com relatório completo na descrição; CI verde + mergeable — ou parada gracefully documentada no relatório.
