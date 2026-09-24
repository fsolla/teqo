/**
 * S34 — the drawn overlay of the `Minha colinha` voting slip. The approved art
 * (`public/cards/modelo-colinha.jpeg`, the byte-for-byte 900×1600 file the human
 * delivered) is the base of the preview and the PNG; the only drawn element is
 * the state-deputy row (2nd line of the art) — the burned label wiped by a white
 * mask, the label redrawn at the left, the picked name at the right and one
 * digit per printed box. The geometry is the approved design gate
 * (`docs/plans/cards-colinha-arte-exata-ui-design.html`) measured at the real
 * 1080×1920 output (the exact 1.2× of the art); the label size was corrected by
 * the designer critique (c) to the art's printed cap height. No DOM and no
 * drawing here — the renderer (`renderColinhaCard` in `cardRender.ts`) consumes
 * these constants, so the model stays unit-testable with a deterministic fake.
 */

export type ColinhaRowNameFit = {
  readonly fontSize: number
  readonly text: string
}

/**
 * S34 — the slip typography of the approved gate: the body face of the art
 * (label at weight 400, name at 900) and the digit face (`Arial Black` first).
 * The exact heavy face of the art is not shipped in the repo (the gate marks it
 * NEEDS ASSET); the port proves the closest face side by side and the gate
 * decides composition and geometry.
 */
export const COLINHA_FONT_FAMILY = 'Arial, Helvetica, sans-serif'
export const COLINHA_DIGIT_FONT_FAMILY = 'Arial Black, Arial, Helvetica, sans-serif'

/** The 2nd line of the art: the office label redrawn over the white mask. */
export const COLINHA_ESTADUAL_LABEL = 'DEPUTADO ESTADUAL'

/**
 * S34 — pixel geometry at the 1080×1920 output, measured from the approved
 * design gate (the gate's percentages resolved against the 1080×1920 stage).
 * The mask wipes the burned label of the art and stops at the top of the five
 * printed boxes; `copy` is the right-aligned pair band and the name baseline is
 * anchored on the cap top of the name.
 */
export const COLINHA_ROW_LAYOUT = {
  mask: { x: 264.6, y: 1073.28, width: 619.92, height: 55.68, fill: '#ffffff' },
  copy: { left: 290.52, top: 1084.03, width: 570.24, right: 860.76 },
  // The design gate's 2.15cqw (23.22px) sat below the art's printed labels;
  // the designer critique (c) set 26.9px so the cap height matches the 19.2px
  // of the fixed rows at weight 400.
  office: { fontSize: 26.9, weight: 400, color: '#202020' },
  name: { fontSize: 36.72, weight: 900, color: '#e4102f', letterSpacingEm: -0.04 },
  gap: 16.2,
  digit: {
    left: 279.72,
    step: 74.52,
    width: 65.88,
    height: 83.52,
    top: 1121.28,
    fontSize: 45.9,
    weight: 900,
    color: '#171717',
  },
} as const

/**
 * S34 — the picked name shrinks on one line to fit the white mask band left of
 * the label (`maxWidth` already discounts the label and the gap), so the pair
 * never leaves the mask and the name is never cut nor wrapped. The gate's own
 * CSS keeps the pair right-aligned and lets it use the whole band (the declared
 * `copy` box is narrower than a long pair).
 */
export const fitColinhaRowName = (
  text: string,
  measure: (text: string, fontSize: number) => { width: number },
  maxWidth: number,
): ColinhaRowNameFit => {
  const ideal = COLINHA_ROW_LAYOUT.name.fontSize
  const width = measure(text, ideal).width
  if (width <= maxWidth || width <= 0) return { fontSize: ideal, text }

  return { fontSize: Math.floor((ideal * maxWidth) / width), text }
}
