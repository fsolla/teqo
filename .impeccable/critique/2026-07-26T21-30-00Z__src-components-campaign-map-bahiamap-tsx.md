# Critique — BahiaMap pan/zoom lock (Limitar mapa à Bahia)

Target: `src/components/campaign/map/BahiaMap.tsx`
Date: 2026-07-26
Provenance: Assessment A via sub-agent; Assessment B via `detect.mjs` (empty findings). Interaction-only Class B fill-in — no browser overlay (no visual chrome change).

## Summary

Constraint-only Leaflet lock (`maxBounds` pad 0.1 + viscosity 1 + runtime `minZoom`). No AI slop. No P0/P1. Polish beyond shipped: none.

## Heuristics (relevant)

- User Control and Freedom: 3/4 (freedom scoped to Bahia — intentional)
- Error Prevention: 4/4

## Detector

`[]`

## Strengths

1. Error prevention without UI tax
2. minZoom ↔ fitBounds padding parity (16px)
3. Soft pad under rigid viscosity + ResizeObserver recompute
