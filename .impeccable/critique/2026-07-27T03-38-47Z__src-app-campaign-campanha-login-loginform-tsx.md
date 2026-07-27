---
target: src/app/(campaign)/campanha/login/LoginForm.tsx
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-07-27T03-38-47Z
slug: src-app-campaign-campanha-login-loginform-tsx
---

Method: dual-agent (A: 40f4d719-1f16-4263-b89d-6aeacd953292 · B: a1f29395-5031-4607-8fe4-d2519097813b; parent completed detector/browser evidence after B's browser restriction)

## Design Health Score

| #         | Heuristic                       |     Score | Key issue                                              |
| --------- | ------------------------------- | --------: | ------------------------------------------------------ |
| 1         | Visibility of system status     |         3 | Pending and errors are announced clearly               |
| 2         | Match system / real world       |         4 | Plain pt-BR copy                                       |
| 3         | User control and freedom        |         3 | Recovery remains limited for phone-only accounts       |
| 4         | Consistency and standards       |         4 | House Field and Checkbox patterns                      |
| 5         | Error prevention                |         2 | Combined phone/e-mail input has pre-existing ambiguity |
| 6         | Recognition rather than recall  |         3 | First-access help assumes the assessor is known        |
| 7         | Flexibility and efficiency      |         3 | Native autocomplete and enter hints                    |
| 8         | Aesthetic and minimalist design |         3 | Focused; initial TTL copy was dense                    |
| 9         | Error recovery                  |         3 | Both credential fields are marked invalid together     |
| 10        | Help and documentation          |         2 | Recovery help is not actionable for every role         |
| **Total** |                                 | **30/40** | **Good**                                               |

## Anti-Patterns Verdict

The restrained campaign auth card does not read as AI-generated: no gradients, ornamental cards, or campaign kitsch. It is intentionally familiar product UI. The deterministic detector returned zero findings. Browser review at 390×844, 768×1024, and 1440×900 found no overflow.

## What's Working

- Clear logo → title → credentials → submit hierarchy.
- Native labels, focus treatment, pending feedback, and error announcement are strong.
- The new checkbox uses the shared control and keeps the real 8-hour / 14-day contract visible.

## Priority Issues

- **P1 — Checkbox target was 40×32 px.** The shared default pseudo-target was short of the field-use 44 px bar. **Resolved in polish:** this instance now has a measured 44×44 px target.
- **P2 — Session copy was policy-first and four lines on mobile.** **Resolved in polish:** outcome-first copy is shorter while retaining both exact durations and the personal-device warning.
- **P1 — Phone-first recovery ambiguity.** Pre-existing and outside B39: phone-only users cannot use e-mail reset.
- **P2 — Secondary recovery targets are compact.** Pre-existing and outside B39.

## Persona Red Flags

- **Jordan:** first-access recovery assumes they know an assessor.
- **Sam:** the B39 checkbox is labeled, described with `aria-describedby`, focus-visible, and now has a 44×44 px target.
- **Casey:** the new option is one tap and defaults safely off; the pre-existing identifier placeholder remains long on narrow phones.

## Minor Observations

- The remembered option remains visually subordinate to the primary login action.
- The final description takes two lines at desktop/tablet and wraps without overflow on mobile.
- The identifier placeholder clipping is unrelated to B39.

## Questions to Consider

- Should a future auth pass make recovery adapt to the identifier type?
- Should compact secondary auth links receive the same 44 px target policy?
