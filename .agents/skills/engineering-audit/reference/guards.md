# Referência — escada de guardas determinísticas (passo 4b)

Classificação 1–6 por classe de achado; ledger em docs/GUARDRAILS.md — contrato do passo 4b em [../SKILL.md](../SKILL.md).

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
