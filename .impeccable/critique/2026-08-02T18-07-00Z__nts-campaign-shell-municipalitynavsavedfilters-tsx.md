---
target: MunicipalityNavSavedFilters sidebar
total_score: 27
p0_count: 1
p1_count: 2
timestamp: 2026-08-02T18-07-00Z
slug: nts-campaign-shell-municipalitynavsavedfilters-tsx
---

Method: dual-agent (A: dc65e367-57b3-4fa5-947b-a43efdce8fba · B: cb10af92-e254-4c0e-9a39-b100b4226b65)

# Critique — MunicipalityNavSavedFilters (sidebar Municípios)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                        |
| --------- | ------------------------------- | --------- | ---------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Active/expanded OK; context (route/hover) not driving disclosure |
| 2         | Match System / Real World       | 3         | Clear aria; sighted UI lacks “filtros salvos” framing            |
| 3         | User Control and Freedom        | 4         | Toggle, persist, undo delete                                     |
| 4         | Consistency and Standards       | 3         | Familiar shadcn tree; only campaign submenu                      |
| 5         | Error Prevention                | 2         | Instant delete (undo mitigates); dense targets                   |
| 6         | Recognition Rather Than Recall  | 2         | Collapsed bookmarks vanish to a small chevron                    |
| 7         | Flexibility and Efficiency      | 3         | Strong when open; no contextual auto-open                        |
| 8         | Aesthetic and Minimalist Design | 2         | Open list pollutes primary nav; default-open worsens             |
| 9         | Error Recovery                  | 4         | Undo toast + Desfazer                                            |
| 10        | Help and Documentation          | 1         | No in-nav teach after first save                                 |
| **Total** |                                 | **27/40** | **Acceptable — significant intent mismatch**                     |

## Anti-Patterns Verdict

**LLM assessment**: Not AI slop. Failure is disclosure policy + open-list weight reading as a second nav section.

**Deterministic scan**: 0 findings on MunicipalityNavSavedFilters.tsx + CampaignSidebar.tsx (exit 0).

**Visual overlays**: No reliable overlay — browser visualization skipped (no local /campanha with login).

## Overall Impression

Craft and a11y of B18 are strong; the open, persisted submenu breaks proximity to Municípios and clarity under pressure. Biggest opportunity: contextual expand (route + hover-when-panel-visible) instead of durable open preference.

## What's Working

1. Correct IA ownership under Municípios
2. Delete + Desfazer + focus handoff
3. Kit reuse with deliberate touch vs fine-pointer trash visibility

## Priority Issues

### P0 — Disclosure model contradicts product intention

Persisted preference, default open; no hover; no open-on-Municípios-page. Fix: ephemeral/context open.

### P1 — Open list reads as its own nav section

Tree rail + N×h-7 between Municípios and Territórios. Fix: contextual collapse + tighter/muted sub chrome.

### P1 — Hover vs offcanvas history

B18 rejected hover for collapsed rail; intention works when panel is visible. Fix: hover/focus-within only while sidebar expanded/open.

### P2 — Sighted association is chevron-only

No visible “Filtros salvos” framing.

### P3 — Discoverability after deliberate collapse

Mostly solved by contextual open.

## Persona Red Flags

- Alex: open list helps in Municípios, taxes full-nav scan elsewhere
- Sam: long tab path when open; hover-open must sync aria-expanded
- Coordenador em mesa: expanded on Quadro/Atividades = noise; collapsed on Municípios = missing shortcuts

## Minor Observations

Default-open philosophy opposite of new brief; logout clears storage; Feel-the-action pending on sidebar nav is minor.

## Questions to Consider

1. Drop persisted open entirely?
2. Chips under Municípios when active/hovered vs tree?
3. Cap visible sidebar cuts at ≤4 + overflow?
4. Scope hover to panel-visible only?

Cognitive load: 6/8 checklist failures (high).
