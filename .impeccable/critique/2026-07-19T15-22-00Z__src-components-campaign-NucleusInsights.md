# Critique — A5 conversão (NucleusInsights + overview)

**Target:** `src/components/campaign/NucleusInsights.tsx`, `src/components/campaign/NucleusListOverview.tsx`
**Score:** 34/40 (compact craft pass)
**Detector:** clean

## Strengths
- Reuses Alert stack and tokens `estimate-confirmed` / `pending` consistent with Gap and Tendência.
- One-line veredito + support numbers match design-ref Baseline-Eleitoral-2022.
- Overview aggregation mirrors existing gap/trend lines.

## Issues addressed in polish
- P1: Duplicated confirmed-alert class strings → extracted `confirmedInsightAlertClass`.

## Minor (deferred)
- Band label (reduto/consolidado/oportunidade) not shown in detail Alert title — product may want chip later.
- Overview distribution counts may be zero-heavy on small filters — acceptable for v1.
