---
target: src/app/(campaign)/campanha/(app)/territorios/page.tsx
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-07-25T23-12-35Z
slug: src-app-campaign-campanha-app-territorios-page-tsx
---

Method: dual-agent (A: 216f0e46-ffcc-4caf-8c2e-947cb6fe8d8c · B: 7e537205-ca99-4e97-ac92-1742875a045b)

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                           |
| --------- | ------------------------------- | --------: | --------------------------------------------------- |
| 1         | Visibility of system status     |         3 | Pending region is honest and announced              |
| 2         | Match system / real world       |         2 | Metric labels need explicit semantics               |
| 3         | User control and freedom        |         3 | Clear search/filter recovery                        |
| 4         | Consistency and standards       |         3 | Reuses the campaign list system                     |
| 5         | Error prevention                |         2 | Mobile comparison can lose row context              |
| 6         | Recognition rather than recall  |         2 | Mobile selected territory was hidden behind a count |
| 7         | Flexibility and efficiency      |         3 | URL-backed sort/filter supports power use           |
| 8         | Aesthetic and minimalist design |         3 | Sober field-desk visual language                    |
| 9         | Error recovery                  |         3 | Empty state offers direct recovery                  |
| 10        | Help and documentation          |         1 | Intelligence metrics lack contextual definitions    |
| **Total** |                                 | **25/40** | **Acceptable**                                      |

## Anti-patterns verdict

No classic AI slop. The restrained, flat field-desk styling is consistent with Teqo. The deterministic scan returned zero findings. Browser evidence found one functional gap that the detector could not see: on mobile, the empty state was centered across the full table width and started outside the visible horizontal viewport.

## What's working

- URL-backed filters and sorting make the view shareable and recoverable.
- Pending feedback dims the result region and announces updates without blocking the controls.
- The table reuses the campaign list system and keeps the data density appropriate for staff.

## Priority issues

- **P1 — Mobile row context and empty recovery:** the horizontal table is an approved product decision, but an 888–974 px table in a 356 px viewport needs a sticky territory column, and the empty recovery must remain in the initial viewport.
- **P1 — Ambiguous metric labels:** “% da votação”, “Estimativa 2026” and “Com assessor” hide denominator, scenario and coverage semantics.
- **P2 — Mobile active-filter recall:** a selected territory was reduced to “1 selecionado(s)” while the active summary was desktop-only.
- **P2 — Historical disclosure:** the 2022 value lacked a disclosure signifier and its tap target was below 44 px.
- **P2 — Action promise mismatch:** the intro promised allocation decisions while the current metrics support regional comparison.

## Persona red flags

- **Alex (power user):** can sort and share URLs quickly, but this slice deliberately does not yet include E12 regional deficit/LQ metrics.
- **Sam (keyboard/screen reader):** horizontal reflow is demanding; the historical disclosure and parent/sub-row relationship need explicit cues.
- **Casey (mobile field user):** selected filter names and row context must survive horizontal movement.

## Minor observations

- The generic campaign loading shell is broader than this list.
- The footer confirms quantity but intentionally avoids inventing a recommendation.
- The detector returned no automated rule findings; the material issues were interaction and semantics.

## Questions

- Which three regional metrics should remain visible without horizontal movement once E12 lands?
- Should Territórios become a mobile bottom-nav destination only after it carries actionable regional intelligence?
