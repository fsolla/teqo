# Referência — famílias de smell (passo 2)

Checklist de varredura aplicado pelos varredores de área — contrato do passo 2 em [../SKILL.md](../SKILL.md).

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
