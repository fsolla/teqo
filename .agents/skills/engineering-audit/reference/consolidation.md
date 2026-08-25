# Referência — caça à consolidação (passo 3)

Classes de equivalência, táticas de generalização e protocolo de behavior delta — contrato do passo 3 em [../SKILL.md](../SKILL.md).

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
