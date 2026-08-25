# Referência — canon e precedents (passo 0a)

Leitura OBRIGATÓRIA antes de julgar qualquer coisa — contrato do passo 0a em [../SKILL.md](../SKILL.md).

## Step 0a — Load the canon

Read, in this order:

1. `.agents/rules/engineering-standards.mdc` — gates, type honesty, client boundary, caching ladder, access control.
2. `.agents/rules/codebase-map.mdc` — dependency direction, where things live, the list system, invariants.
3. `docs/ARCHITECTURE.md` — layers, bounded contexts, decision log.
4. `AGENTS.md` — operational rules + "Recently resolved" history (Pass 1, Pass 2, every post-Pass-2 delivery's /simplify findings).
5. `docs/AGENT-OPS.md` — paradigma de agentes paralelos vigente (claim→PR→main, skills plan-issue / work-issue / agent-work-issue / project-status). O audit avalia o repo **contra** esse fluxo, não contra o fluxo legacy de roadmap.md.
6. `docs/IMPROVE-CODE-QUALITY-PLAN.md` — what the earlier passes already swept. Don't re-register what they fixed; verify fixes held.
7. `docs/TECH-DEBT.md` — open ledger. New findings de-dup against it; verify each open row still exists, close stale ones.
8. `docs/TESTING.md` — safety-net map: what is pinned, where the gaps are.
9. `docs/plans/escala-dry-pos-*.md` — per-delivery debt registrations.
10. Consolidation precedents (the quality bar for step 3): `runStaffEntityMutation` (`src/utilities/campaignEntityActions.ts` — dedup by POLICY, not generic plumbing), `runCampaignFormAction`/`runCampaignRedirectFormAction` (`src/utilities/campaignFormActionError.ts`), `CampaignTable` columns-as-data (`src/components/campaign/shared/CampaignTable.tsx`), `RelationChipCell` (B37: one engine, two thin domain wrappers), `useCampaignCellAutosave` + `campaignJsonMutationRoute` (B32+: wrapper > helper — a helper is a line someone can forget), `relationMembershipDelta.ts` (algorithm once, cap as data, three one-line wrappers).
11. **Rejected-with-reason** (never re-propose): set-with-floor generic form (B37); `CampaignCellEditOverlay` Popover branch for comboboxes (dialog can't be an ARIA 1.2 combobox popup); `maxItems` on dobradinhas "for parity" (invents a rule); catalog-out-of-browser vs payload-minimal chips (B34+ — fixes oppose each other; chosen: payload-minimal); `src/domains/` + ports-and-adapters (Pass 2 D1 NO-GO).
