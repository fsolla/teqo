/**
 * S31 — the pure layout of the `Minha colinha` voting slip: the six vote rows
 * (five fixed + the state deputy picked from the S30 catalog) and the pixel
 * geometry of the approved design gate (`docs/plans/cards-colinha-ui-design.html`)
 * measured at the real 1080×1920 output. No DOM and no drawing here — the
 * renderer (`renderColinhaCard` in `cardRender.ts`) consumes these constants,
 * so the model stays unit-testable with a deterministic fake.
 *
 * The gate is the canonical source of the numbers (the human-approved model
 * `modelo-colinha.jpeg` is the conference reference and the gallery tile).
 */

import type { StateDeputyCatalogEntry } from './stateDeputyCatalog'

export type ColinhaRow = {
  /** Office label lines, e.g. `['DEPUTADO', 'FEDERAL']` (already uppercase). */
  readonly officeLines: readonly string[]
  /** Candidate display name: Title Case on the fixed rows, uppercase on the estadual. */
  readonly candidate: string
  /** One glyph per digit box, in reading order. */
  readonly digits: readonly string[]
  /** The estadual row before a deputy is picked: empty boxes + a dimmed CONFIRMA. */
  readonly empty?: boolean
}

/** The five fixed choices of the slip, in the gate's order (estadual goes second). */
export const COLINHA_FIXED_ROWS: readonly ColinhaRow[] = [
  { officeLines: ['DEPUTADO', 'FEDERAL'], candidate: 'Jorge Solla', digits: ['1', '3', '1', '3'] },
  { officeLines: ['SENADOR'], candidate: 'Jaques Wagner', digits: ['1', '3', '0'] },
  { officeLines: ['SENADOR'], candidate: 'Rui Costa', digits: ['1', '3', '3'] },
  { officeLines: ['GOVERNADOR'], candidate: 'Jerônimo', digits: ['1', '3'] },
  { officeLines: ['PRESIDENTE'], candidate: 'Lula', digits: ['1', '3'] },
]

const COLINHA_ESTADUAL_OFFICE_LINES = ['DEPUTADO', 'ESTADUAL'] as const
export const COLINHA_ESTADUAL_PLACEHOLDER = 'Escolha abaixo'
const COLINHA_ESTADUAL_DIGIT_COUNT = 5

/**
 * S31 — the slip typography of the approved gate (`Arial, Helvetica, sans-serif`,
 * the gate's card body face), not the site display family the rest of the
 * studio draws with. The designer's critique (c) fixed this as gate parity.
 */
export const COLINHA_FONT_FAMILY = 'Arial, Helvetica, sans-serif'

/** The vertical legal line of the left edge (literal of the intent). */
export const COLINHA_LEGAL_TEXT =
  'FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL (PT-PC DO B - PV) | CNPJ CANDIDATO: 68.430.467/0001-05'

/** The green seal every row carries. */
export const COLINHA_CONFIRM_LABEL = 'CONFIRMA'

/**
 * The six rows in the gate's order: federal, the estadual (filled from the
 * catalog entry, or the empty placeholder), then the remaining four fixed rows.
 */
export const colinhaVoteRows = (deputy: StateDeputyCatalogEntry | null): ColinhaRow[] => {
  const estadual: ColinhaRow = deputy
    ? {
        officeLines: COLINHA_ESTADUAL_OFFICE_LINES,
        candidate: deputy.name.toLocaleUpperCase('pt-BR'),
        digits: [...deputy.ballotNumber],
      }
    : {
        officeLines: COLINHA_ESTADUAL_OFFICE_LINES,
        candidate: COLINHA_ESTADUAL_PLACEHOLDER,
        digits: Array.from({ length: COLINHA_ESTADUAL_DIGIT_COUNT }, () => ''),
        empty: true,
      }

  return [COLINHA_FIXED_ROWS[0], estadual, ...COLINHA_FIXED_ROWS.slice(1)]
}

/**
 * Pixel geometry at the 1080×1920 output, measured from the rendered gate. The
 * top composes the official assets (group photo, brand box, band); the body is
 * the measured CSS grid of the gate (`30% | 1fr | auto`, rows of 108).
 */
export const COLINHA_LAYOUT = {
  background: '#ffffff',
  top: {
    height: 710.4,
    background: '#148fc2',
    photoWidth: 1080,
    photoHeight: 1440,
    photoOffsetY: -335.62,
    lockup: {
      x: 32.4,
      y: 21.29,
      width: 529.19,
      height: 134.97,
      padding: 27,
      gradientAngleDeg: 125,
      gradientSplit: 0.52,
      gradientFrom: '#e4102f',
      gradientTo: '#184e92',
      imageWidth: 1037,
      imageHeight: 595,
    },
    band: {
      y: 504.39,
      height: 206,
      background: '#e4102f',
      sourceY: 1232.36,
      imageWidth: 1080,
      imageHeight: 1440,
    },
  },
  legal: {
    x: 7.55,
    y: 748.79,
    width: 15.66,
    height: 1132.81,
    fontSize: 15.66,
    letterSpacing: 0.31,
    color: '#333333',
  },
  body: {
    x: 51.83,
    y: 710.39,
    width: 1028.17,
    height: 1209.61,
    paddingTop: 34.56,
    paddingX: 35.64,
    paddingBottom: 32.4,
    rowGap: 34.56,
  },
  row: {
    minHeight: 108,
    officeWidthRatio: 0.3,
    columnGap: 21.6,
  },
  office: {
    fontSize: 27,
    lineHeight: 27.54,
    color: '#171717',
  },
  candidate: {
    fontSize: 26.46,
    minFontSize: 18,
    color: '#e4102f',
    gap: 9.6,
  },
  digit: {
    width: 59.39,
    height: 73.44,
    borderWidth: 5.94,
    radius: 6.48,
    fontSize: 46.44,
    gap: 8.1,
    borderColor: '#111111',
    color: '#141414',
    background: '#ffffff',
    emptyBorderColor: '#9a9a9a',
    emptyBackground: '#fafafa',
  },
  confirm: {
    fontSize: 21.6,
    paddingX: 21.6,
    paddingY: 17.28,
    background: '#009647',
    color: '#ffffff',
    emptyOpacity: 0.3,
  },
} as const

type ColinhaCandidateFit = {
  readonly fontSize: number
  readonly lines: readonly string[]
}

/**
 * S31 — the candidate shrinks inside the office column down to `minFontSize`
 * (the gate's CSS would wrap freely, but the body keeps its fixed row rhythm).
 * A name still too long at the floor wraps by word into two lines: the row
 * grows to ~101 of its 108 and the six rows never reflow.
 */
export const fitColinhaCandidate = (
  text: string,
  measure: (text: string, fontSize: number) => { width: number },
  maxWidth: number,
): ColinhaCandidateFit => {
  const { fontSize: ideal, minFontSize } = COLINHA_LAYOUT.candidate
  const width = measure(text, ideal).width
  if (width <= maxWidth || width <= 0) return { fontSize: ideal, lines: [text] }

  const shrunk = Math.floor((ideal * maxWidth) / width)
  if (shrunk >= minFontSize) return { fontSize: shrunk, lines: [text] }

  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate, minFontSize).width > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)

  return { fontSize: minFontSize, lines: lines.length > 1 ? lines : [text] }
}
