---
name: engineering-audit
description: Runs a Pass-style engineering audit of the Teqo codebase — code smells, drift from documented patterns, and consolidation of near-duplicate components/hooks/functions/modules — producing a findings ledger and a remediation plan (read-only on code during the sweep; sign-off = apresentação interativa ou o PR dos artefatos em Cursor Cloud; remediações P0/P1 e guardrails de agent-miss executados na mesma sessão). Use when the user asks for an engineering audit, code-smell sweep, architecture drift check, deduplication/consolidation pass, "Pass 3", "auditoria de engenharia", "varredura de code smells", "consolidação de duplicações", or to plan fixes against the repo's highest engineering standards.
---

# Engineering Audit (Pass N)

**Audit solitário (não paralelizável):** quando esta skill roda, o desenvolvimento paralelo **pausa** — nenhum outro agente trabalhando no repo. O agente do audit também **executa as remediações P0/P1 na mesma sessão** para trazer o projeto aos trilhos (não só registra); P2/P3 seguem o fluxo normal de ledger. Se o **agent-pool** estiver ligado, pause-o no início do audit (`gh workflow run agent-pool.yml -f action=pause`) e retome ao final (`-f action=resume`); o tick recusa spawn enquanto `POOL_PAUSED=true`. Em **Cursor Cloud** o `gh` do agente é read-only e o pause por dispatch não está disponível — vale o precheck fail-closed da seção "Modo autônomo (Cursor Cloud)".

## Modo autônomo (Cursor Cloud)

A skill roda sem supervisão humana no paradigma de agentes paralelos. Quatro diferenças em relação à execução interativa (desktop):

1. **Precheck solitário, fail-closed.** Antes de qualquer varredura: `pnpm agent:pool -- status` (read-only). Pool `desligado` ou `pausado` → segue. Pool **ligado** → o agente Cloud não consegue pausá-lo (`gh workflow run` é escrita): **pare** com o remédio nomeado ("pause o pool — `pnpm agent:pool -- pause` — e re-dispare o audit"). Nunca rodar a varredura com o pool spawnando.
2. **Sign-off = PR.** O gate "apresentar os três artefatos antes de escrever" (passo 5) não se aplica em modo autônomo — não há humano interativo na sessão. Os artefatos são escritos na branch e o **PR (Ready, base `stage`) é a superfície de sign-off**: merge humano = aprovação do plano; fechar o PR = rejeição (o ledger sobrevive no histórico da branch). As remediações **P0/P1 e os guardrails das misses colhidas não esperam esse sign-off** — são correctness/active-harm e seguem na mesma sessão, cada um em PR próprio com gate completo. P2/P3 continuam só ledger/plano.
3. **Canais de PR:** fechar miss colhida = `Closes #N` no body do PR do guardrail (o flip `done`/`in-prod` no merge em `main` — keyword adjacente a cada número, `Closes #52, closes #73`, nunca `Closes #52, #73`). Em Cloud, preferir `ManagePullRequest` com **`draft: false`**. **Exceção só deste skill:** o PR dos *artefatos* do audit (sign-off) fica Ready **sem** auto-merge — merge humano = aprovação do plano. Remediações P0/P1 e guardrails de misses na mesma sessão seguem o fluxo normal (`agent-pr-workflow`: Ready + `gh pr merge --auto --merge`). Push: `pnpm push -u origin HEAD`.
4. **Delta desde o último audit é o foco declarado** (passo 1): a varredura cobre o repo inteiro, mas o esforço concentra-se no churn desde a data do último Pass — é o trabalho paralelo dos agentes desde o último audit que precisa ser consolidado.

Read-only audit that sweeps the Teqo codebase for code smells, drift from documented patterns, and consolidation opportunities, then produces a findings ledger and a remediation plan. **No fixes in the audit run** — deliverables are updated docs, presented for sign-off before writing — exceto as remediações P0/P1 declaradas acima. Sign-off: interativo = apresentação prévia dos artefatos; autônomo (Cursor Cloud) = o PR dos artefatos (ver "Modo autônomo (Cursor Cloud)").

Method: the engineering skills this repo follows (improve-code-quality, clean-code, refactoring-patterns, software-design-philosophy, pragmatic-programmer, working-with-legacy-code, remove-technical-debt), specialized to Teqo's standards and history. The pass number is the next one after the last in `docs/IMPROVE-CODE-QUALITY-PLAN.md`.

## Checklist

```
- [ ] 0. Precheck solitário (fail-closed) — pool off/paused; em Cloud, ver "Modo autônomo"
- [ ] 0a. Load the canon and the history (before judging anything) — incl. `docs/AGENT-OPS.md` (paradigma vigente)
- [ ] 0b. Harvest `kind:agent-miss` → candidatos a guardrail (alimenta o Passo 4b)
- [ ] 1. Hotspot map (churn × size × mechanical gates) — aim the sweep; âncora de delta = data do último Pass
- [ ] 2. Smell sweep (Fowler families + Teqo-specific), parallelized per area
- [ ] 3. Consolidation hunt (equivalence classes; name the duplicated KNOWLEDGE)
- [ ] 4. Triage (severity P0–P3; verify open ledger rows)
- [ ] 4b. Recurrence prevention: classify a deterministic guard for every finding class
- [ ] 5. Draft the three artifacts; sign-off (interativo = apresentar antes de escrever; autônomo = PR dos artefatos); then write and stop
```

## Ground rules (non-negotiable)

1. Read-only on `src/`, `tests/`, `scripts/` durante a varredura. Os únicos writes da sessão são: os artefatos do passo 5 (após sign-off interativo; em modo autônomo, direto na branch do PR) e as remediações P0/P1 + guardrails de misses colhidas declarados no cabeçalho.
2. Gate commands bare, never piped (`pnpm test | tail` swallows the exit code).
3. Never `knip --fix` blind — verify with `git grep -w <symbol>` (knip cannot load `payload.config.ts`; ledgered P3).
4. Production is live Neon with real PII. Local DB only, `teqo_test` for tests. The audit needs no DB writes.
5. Every claim gets a number (lines, exports, call sites, ms, kB). "Rejected by measurement" is an acceptable outcome for any hypothesis, including the ones below.

## Step 0a — Load the canon

Read, in this order:

1. `.cursor/rules/engineering-standards.mdc` — gates, type honesty, client boundary, caching ladder, access control.
2. `.cursor/rules/codebase-map.mdc` — dependency direction, where things live, the list system, invariants.
3. `docs/ARCHITECTURE.md` — layers, bounded contexts, decision log.
4. `AGENTS.md` — operational rules + "Recently resolved" history (Pass 1, Pass 2, every post-Pass-2 delivery's /simplify findings).
5. `docs/AGENT-OPS.md` — paradigma de agentes paralelos vigente (claim→PR→stage→promote humano, skills plan-issue/work-issue/project-status). O audit avalia o repo **contra** esse fluxo, não contra o fluxo legacy de roadmap.md.
6. `docs/IMPROVE-CODE-QUALITY-PLAN.md` — what the earlier passes already swept. Don't re-register what they fixed; verify fixes held.
7. `docs/TECH-DEBT.md` — open ledger. New findings de-dup against it; verify each open row still exists, close stale ones.
8. `docs/TESTING.md` — safety-net map: what is pinned, where the gaps are.
9. `docs/plans/escala-dry-pos-*.md` — per-delivery debt registrations.
10. Consolidation precedents (the quality bar for step 3): `runStaffEntityMutation` (`src/utilities/campaignEntityActions.ts` — dedup by POLICY, not generic plumbing), `runCampaignFormAction`/`runCampaignRedirectFormAction` (`src/utilities/campaignFormActionError.ts`), `CampaignTable` columns-as-data (`src/components/campaign/shared/CampaignTable.tsx`), `RelationChipCell` (B37: one engine, two thin domain wrappers), `useCampaignCellAutosave` + `campaignJsonMutationRoute` (B32+: wrapper > helper — a helper is a line someone can forget), `relationMembershipDelta.ts` (algorithm once, cap as data, three one-line wrappers).
11. **Rejected-with-reason** (never re-propose): set-with-floor generic form (B37); `CampaignCellEditOverlay` Popover branch for comboboxes (dialog can't be an ARIA 1.2 combobox popup); `maxItems` on dobradinhas "for parity" (invents a rule); catalog-out-of-browser vs payload-minimal chips (B34+ — fixes oppose each other; chosen: payload-minimal); `src/domains/` + ports-and-adapters (Pass 2 D1 NO-GO).

## Step 0b — Harvest `kind:agent-miss` → guardrails

Antes da varredura, colha os défices comportamentais registrados pelo fluxo:

```bash
gh issue list --label kind:agent-miss --state open
```

**Investigue cada miss colhida** (`gh issue view <N>` — leitura, disponível no Cloud): o corpo registra causa raiz, fix aplicado e o guardrail proposto por `agent:file-miss`. Verifique no código se o fix segurou e se a classe do defeito ainda é reproduzível. Miss cuja classe já tem guarda viva não gera guardrail novo — gera item de hardening da guarda existente (o passo 2 já trata guarda dodgeable como finding).

Cada Issue colhida alimenta o **Passo 4b (recurrence prevention)**: toda miss vira candidata a guardrail determinístico (tipo / ESLint / convention spec / CI / pin comportamental). O ledger desses guardrails vive em **`docs/GUARDRAILS.md`** (criar o arquivo na primeira execução — é o escopo da Issue OPS2): uma linha por guardrail — miss de origem (link da Issue), classe 1–6, mecanismo, status. Quando o guardrail mergeia, **feche as Issues colhidas** (`done`) com comentário apontando o guardrail. Em Cursor Cloud o fechamento é determinístico e não exige escrita `gh`: o PR do guardrail carrega `Closes #N` (keyword repetida por número — o regex do `issue-done-on-stage-merge.yml` não resolve `Closes #A, #B`) e o merge em `stage` flippa a miss para `done`; guardrails de várias misses podem ir no mesmo PR desde que cada uma tenha seu `closes`. Miss que não admite guardrail determinístico vira convenção explícita marcada "judgment-only" — não fingir que doc é guarda.

## Step 1 — Hotspot map

- **Âncora de delta (desde o último audit):** a data do último Pass está na seção mais recente de `docs/IMPROVE-CODE-QUALITY-PLAN.md`. Meça o delta com `git log --since="<data do último Pass>" --name-only --format= | sort -u` — esse conjunto é o **foco prioritário** da varredura (consolidação do trabalho paralelo dos agentes desde o último audit); a varredura estrutural continua cobrindo o repo inteiro.
- Churn: `git log --since="3 months ago" --name-only --format= | sort | uniq -c | sort -rn | head -40` (e o mesmo comando com `--since` da âncora de delta). Three-axis heuristic: changing next × high churn × core domain.
- Size: largest modules and widest interfaces (exports per module).
- Static gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm exec knip`, `pnpm check:cycles` — record baseline. Pre-existing reds (e.g. the ledger's P1 e2e row) are noted as pre-existing, not the audit's.

## Step 2 — Smell sweep

Sweep `src/lib`, `src/utilities` (+`access/`), `src/components/campaign`, `src/app/(campaign)`, `src/app/(frontend)`, `src/collections`, `src/globals`, `scripts/`, `tests/`. Parallelize with subagents per area; each returns findings in the step-4 row format.

**Fowler families, Teqo reading:**

- Bloaters: god modules (>400 lines or >20 exports needs justification), long functions (>~60 lines), long parameter lists (>4 → options object), god cells/pages.
- Dispensables: dead code, commented-out code, speculative generality (config params nobody passes — a decision the author declined to make), pass-through wrappers.
- Change preventers: divergent change (one file every feature touches), shotgun surgery (one concept scattered — e.g. a cap message as a bare literal in a throw AND in two allowlists; B32+/B37 found exactly this).
- Couplers: feature envy, message chains, middle men, inappropriate intimacy.
- Primitive obsession: stringly-typed slugs/ids/enums where a contract type exists; magic numbers without a named constant next to its policy.

**Teqo-specific smells:**

- Local API with `user` but no `overrideAccess: false`; admin bypass without the justifying comment.
- Multi-collection write without `withPayloadTransaction` / `req: { transactionID }`.
- Client component importing a server data module for VALUES (only `import type` or contract modules); URL serializers reaching the browser (B14's 21 kB lesson); static catalogs in RSC payloads without measurement.
- Loader missing `import 'server-only'`; `lib/` importing from `utilities/`; pure helpers stranded in `utilities/`; React components in `utilities/`.
- `as never` (banned), unjustified casts, types declared twice (W4e single-source rule), `any`.
- RSC payload bloat: whole Payload docs over the wire instead of selected view models.
- New lists not on the W1 list system (raw `ui/Table` outside documented exceptions); JSON POST routes not on `campaignJsonMutationRoute`; formActions ladders not on the shared wrappers beyond documented exceptions.
- Vocabulary: banned terms (`actionPlan`, Praça/Núcleo) outside migrations; pt-BR identifiers; English in user-visible copy.
- Error messages as bare literals matched by exact string in `mapCampaignFormActionError` — must be constants (B32+ lesson).
- State captured by the render that scheduled the work (B34's recurring bug class): closures over stale state in autosave/optimistic paths; functional updaters whose FALLBACK reads stale render state.
- Live-region mistakes (B32+): regions inside what unmounts on close; polite regions mounted unconditionally at scale.
- Effects doing derived-state work; state lifted higher than its consumers; providers wrapping non-consumers.
- Caching-ladder violations: live 2026 data under `unstable_cache` without write-path invalidation; auth inside a cached core; artifacts computed at build time.

**Legacy-code discipline:** a bug found while auditing gets RECORDED, not fixed. Pin actual behavior before proposing its consolidation.

**Existing guards are findings too.** For every convention spec (`codebaseConventions.unit.spec.ts`), ESLint restriction, and knip/madge config, ask how it can be dodged: accent variants the regex misses, filename shapes the glob doesn't reach, import kinds the sweep doesn't mark, props invisible to knip, modules born after the allowlist. A dodgeable guard is a finding in its own row.

## Step 3 — Consolidation hunt (core deliverable)

Merge components, hooks, functions, and modules implementing the SAME functionality with different data — even when not textually identical. Small result changes are acceptable when functionality is equivalent; every proposal names its **behavior delta** explicitly.

**Anti-DRY trap:** DRY is about KNOWLEDGE, not text. Two identical-looking blocks serving different business rules are NOT duplication. For every candidate pair, write down *what single piece of knowledge/rule/policy both encode*. Can't name it → record "look-alike, not duplication" and move on.

**Equivalence classes (ranked by expected yield):**

1. Same algorithm, different domain data → parameterize the data (`relationMembershipDelta` precedent).
2. Same interaction machine, different entity → one engine + thin domain wrappers (`RelationChipCell` precedent).
3. Same state machine, different field → shared hook (`useCampaignCellAutosave` precedent).
4. Same route/action skeleton, different collection → policy wrapper with typed caller (`runStaffEntityMutation` — NEVER a generic slug-union factory; typed mutation stays in the caller).
5. Same visual pattern, different content → slots/children from the server, not flag props.
6. Same predicate shape, different role/field → policy-as-data or named aliases (`canUpdateX = canReadX` is a deliberate declaration).

**Fertile grounds (history):** `components/campaign/**/*Cell.tsx`/`*Control.tsx` (remaining twins — ledger B34+ F2: `LeadershipStateDeputyRelationCell` vs shared chip cell, ~165 duplicated lines); `campanha/actions/*.ts` twins beyond current wrappers; `utilities/*Data.ts`/`*PageData.ts` same-shaped read assemblies (where-builders, facet loaders, scope reads — E11's own-read-vs-shared-scope is the documented example); `utilities/access/*.ts` same constraint per domain; `lib/` parse/format/label twins, same-shaped zod schemas, constants under two names; `components/campaign/shared/` overlapping pieces; `tests/` cloned specs (`describe.each` precedent) and helper twins; `scripts/` seed/build twins (B5 precedent: `scripts/lib/`).

**Generalization tactics, in order:** (1) parameterize difference as DATA (columns/caps/copy); (2) compose via slots/children from the server; (3) inject the variant as a narrow concrete-typed callback; (4) named wrapper over a shared core (policy in the wrapper; core stays dumb). Forbidden/last-resort: boolean-flag multiplication; generics forcing `as never`/`as unknown` (type honesty outranks reuse); "universal" abstraction with more configuration than code; merging things whose only commonality is shape.

**Abstraction gate:** 3+ call sites OR a policy worth naming. With exactly 2: delete one, inline, or ledger the pair WITH A TRIGGER ("3rd call site merges these") — the B34+/B37 pattern. Merges must REDUCE total interface count (anti-classitis).

**Behavior-delta protocol:** allowed — consolidating where outputs differ in small ways (copy, ordering, debounce timings, class names), listed per item; required — existing pins are the characterization net, updated DELIBERATELY in the same delivery with every changed assertion listed (a silently changed pin is a defect); not allowed — URL contracts (frozen, B18), DB schema (migration = separate delivery), public API shapes, Consent/LGPD fail-closed behavior, without a named separately-approved item.

## Step 4 — Triage

Each finding a ledger row: ID, area, smell/type, evidence (file:line + measurement), pattern/decision violated, proposed fix/consolidation, behavior delta, blast radius, pins needed, recurrence-guard class (step 4b), effort (S/M/L), severity:

- **P0** correctness/security (access control, transactions, consent, type honesty masking errors)
- **P1** active harm (permanently red gate, measured perf harm, duplication causing divergent behavior)
- **P2** smell/drift with real cost
- **P3** polish

Prioritize: changing next × high churn × core domain. Verify every open TECH-DEBT row: still true? Close stale with evidence.

## Step 4b — Recurrence prevention (deterministic guards)

A finding is not fully planned until its **recurrence prevention** is classified. The question for every finding class: "what deterministic mechanism makes this smell impossible — or at least a build failure — next time?" Rank the mechanisms by determinism:

1. **Type** — the bad state becomes unrepresentable (single-source the type/value; a required prop; a schema transform). Strongest: it cannot compile.
2. **ESLint** (`no-restricted-syntax`, `no-restricted-imports`) — per-file, instant feedback. Precedents: the `as never` ban; the `src/lib` boundary.
3. **Convention unit spec** (`tests/unit/codebaseConventions.unit.spec.ts`, table-driven sweeps of `src`/`tests`/`scripts`) — structural policies. Precedents: vocabulary guard (C13), formActions guard (W4d), `campaignJsonMutationRoute` guard (B32+), `server-only` sweep.
4. **CI static analysis** — knip (dead code), madge (cycles). Already at error level.
5. **Behavioral pin** — a unit/int spec locking the contract ("every curated alias resolves in every consumer"; "dossier aggregate === list aggregate").
6. **Doc/convention** — rules files, codebase-map, rejected-with-reason lists. Last resort, and it must say so: judgment-only findings (abstraction-gate calls, bundle trade-offs) live here, declared as such.

Rules:

- If a guard is feasible, it ships **in the same delivery as the fix** — never as a follow-up. A guard that lands later is a guard that never lands.
- If an existing guard covers the class but is dodgeable, hardening it is its own plan item.
- If only judgment prevents recurrence, register the convention explicitly (rules/codebase-map) and mark the finding "judgment-only" — do not pretend a doc is a guard.
- Prefer one guard per class over N per-instance pins: the guard is what makes the fix the _last_ time the smell is fixed.

## Step 5 — Artifacts (draft, then sign-off)

1. `docs/IMPROVE-CODE-QUALITY-PLAN.md` — new Pass section (context, audit headlines with numbers, workstreams, decisions), matching earlier-pass format.
2. `docs/TECH-DEBT.md` — new rows in the same tables/columns, marked `open — Pass N`; stale rows closed with evidence.
3. `docs/plans/entrega-engenharia-pN.md` (pt-BR, like the other plans) — workstreams ordered P0→P1→P2; each item: goal, evidence, target shape, migration path (Branch by Abstraction / Parallel Change for wide merges), pins to write first, full gate, rollback. Items too big for one delivery → Issue rastreável via `plan-issue`. Every workstream item declares its **Guarda determinística** (class 1–6, step 4b), and the plan carries a **guard map** section: new guards shipped / existing guards hardened / judgment-only residue with the convention that stands in.
4. **Interativo (desktop):** present ALL THREE for sign-off before writing. Then write and stop. **Autônomo (Cursor Cloud):** não há sign-off interativo — escreva os três na branch e abra o PR (**Ready**, base `main`, **sem** auto-merge — merge humano = sign-off; "Modo autônomo", item 2). As remediações P0/P1 e os guardrails das misses colhidas seguem na mesma sessão, em PRs próprios com gate completo + auto-merge normal, sem esperar esse merge.

## Execution rules for the eventual implementation (record in the plan)

- One consolidation per delivery; full gate per delivery: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`, `pnpm test`, `pnpm build` — bare — plus Aikido on edited files.
- Structure-only commits never mix with behavior changes; red test mid-refactor = revert, not debug.
- Frozen migrations never edited; schema change = `pnpm migrate:create`.
- The rejected-with-reason list binds implementation too.
- Leftovers → ledger via `capture-review-debts`; nothing lives only in chat.
- No item closes without its prevention class recorded in the PR; a guard ships with the fix, not "after".

## Done when

Precheck solitário verde (ou parada fail-closed com remédio nomeado); canon read; hotspot map com âncora de delta desde o último Pass e números; sweep complete with ledger rows; every consolidation candidate classified (merge now / register with trigger / look-alike-not-duplication — duplicated KNOWLEDGE named for each merge); every open ledger row verified; every harvested miss classified (guardrail shipped com `Closes #N` / hardening de guarda viva / judgment-only); every finding class carries a recurrence-guard classification and the plan carries the guard map; three artifacts presented for sign-off (interativo) ou commitados na branch com PR aberto (autônomo).
