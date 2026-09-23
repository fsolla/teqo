// @vitest-environment node

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  COLINHA_ESTADUAL_PLACEHOLDER,
  COLINHA_FIXED_ROWS,
  COLINHA_LAYOUT,
  COLINHA_LEGAL_TEXT,
  colinhaVoteRows,
  fitColinhaCandidate,
} from '@/lib/cardColinha'
import { getStateDeputyCard } from '@/lib/stateDeputyCatalog'

const publicFile = (src: string) => fileURLToPath(new URL(`../../public${src}`, import.meta.url))

const APPROVED_TILE_SRC = fileURLToPath(
  new URL('../../docs/plans/cards-colinha-ui-design-assets/modelo-colinha.jpeg', import.meta.url),
)

/** Frozen identity of the approved model art (byte-for-byte copy of the tile). */
const TILE_SHA256 = '76505492fb243c67313d237e58926afbd4d0847c00ab3bb43c090859cbdf18c8'

describe('colinha vote rows (S31)', () => {
  it('keeps the five fixed choices in the gate order and literals', () => {
    expect(
      COLINHA_FIXED_ROWS.map((row) => [
        row.officeLines.join(' '),
        row.candidate,
        row.digits.join(''),
      ]),
    ).toEqual([
      ['DEPUTADO FEDERAL', 'Jorge Solla', '1313'],
      ['SENADOR', 'Jaques Wagner', '130'],
      ['SENADOR', 'Rui Costa', '133'],
      ['GOVERNADOR', 'Jerônimo', '13'],
      ['PRESIDENTE', 'Lula', '13'],
    ])
  })

  it('builds the six rows with the estadual second, filled from the catalog entry', () => {
    const rows = colinhaVoteRows(getStateDeputyCard('julio')!)

    expect(rows).toHaveLength(6)
    expect(rows[1]).toMatchObject({
      officeLines: ['DEPUTADO', 'ESTADUAL'],
      candidate: 'JULIO PINHEIRO',
      digits: ['1', '3', '9', '9', '9'],
    })
    expect(rows[1]!.empty).toBeUndefined()
    expect(rows[0]).toEqual(COLINHA_FIXED_ROWS[0])
    expect(rows.slice(2)).toEqual(COLINHA_FIXED_ROWS.slice(1))
  })

  it('marks the estadual row empty (placeholder + five empty boxes) without a pick', () => {
    const rows = colinhaVoteRows(null)

    expect(rows).toHaveLength(6)
    expect(rows[1]).toMatchObject({
      officeLines: ['DEPUTADO', 'ESTADUAL'],
      candidate: COLINHA_ESTADUAL_PLACEHOLDER,
      digits: ['', '', '', '', ''],
      empty: true,
    })
    expect(rows.slice(2)).toEqual(COLINHA_FIXED_ROWS.slice(1))
  })

  it('uppercases the picked deputy display name (gate literal JULIO PINHEIRO)', () => {
    expect(colinhaVoteRows(getStateDeputyCard('leninha')!)[1]!.candidate).toBe('LENÍNHA VALENTE')
    expect(colinhaVoteRows(getStateDeputyCard('adriana')!)[1]!.candidate).toBe(
      'COLETIVO DE ENFERMAGEM',
    )
  })
})

describe('colinha layout (S31 — measured from the design gate at 1080×1920)', () => {
  it('pins the top composition geometry', () => {
    expect(COLINHA_LAYOUT.top).toMatchObject({
      height: 710.4,
      background: '#148fc2',
      photoWidth: 1080,
      photoHeight: 1440,
      photoOffsetY: -335.62,
    })
    expect(COLINHA_LAYOUT.top.lockup).toMatchObject({
      x: 32.4,
      y: 21.29,
      width: 529.19,
      height: 134.97,
      gradientAngleDeg: 125,
      gradientSplit: 0.52,
      gradientFrom: '#e4102f',
      gradientTo: '#184e92',
      imageWidth: 1037,
      imageHeight: 595,
    })
    expect(COLINHA_LAYOUT.top.band).toMatchObject({
      y: 504.39,
      height: 206,
      background: '#e4102f',
      sourceY: 1232.36,
    })
  })

  it('pins the legal line, body and row rhythm of the gate', () => {
    expect(COLINHA_LAYOUT.legal).toMatchObject({
      x: 7.55,
      y: 748.79,
      width: 15.66,
      height: 1132.81,
      fontSize: 15.66,
      color: '#333333',
    })
    expect(COLINHA_LAYOUT.body).toMatchObject({
      x: 51.83,
      y: 710.39,
      width: 1028.17,
      height: 1209.61,
      paddingTop: 34.56,
      paddingX: 35.64,
      paddingBottom: 32.4,
      rowGap: 34.56,
    })
    expect(COLINHA_LAYOUT.row).toMatchObject({
      minHeight: 108,
      officeWidthRatio: 0.3,
      columnGap: 21.6,
    })
    // 30% of the body content is the office column (gate measured 287.07).
    expect(
      (COLINHA_LAYOUT.body.width - COLINHA_LAYOUT.body.paddingX * 2) *
        COLINHA_LAYOUT.row.officeWidthRatio,
    ).toBeCloseTo(287.07, 2)
  })

  it('pins the digit boxes, the candidate and the CONFIRMA pill', () => {
    expect(COLINHA_LAYOUT.office).toMatchObject({
      fontSize: 27,
      lineHeight: 27.54,
      color: '#171717',
    })
    expect(COLINHA_LAYOUT.candidate).toMatchObject({
      fontSize: 26.46,
      minFontSize: 18,
      color: '#e4102f',
      gap: 9.6,
    })
    expect(COLINHA_LAYOUT.digit).toMatchObject({
      width: 59.39,
      height: 73.44,
      borderWidth: 5.94,
      radius: 6.48,
      fontSize: 46.44,
      gap: 8.1,
      borderColor: '#111111',
      background: '#ffffff',
      emptyBorderColor: '#9a9a9a',
      emptyBackground: '#fafafa',
    })
    expect(COLINHA_LAYOUT.confirm).toMatchObject({
      fontSize: 21.6,
      paddingX: 21.6,
      paddingY: 17.28,
      background: '#009647',
      color: '#ffffff',
      emptyOpacity: 0.3,
    })
  })

  it('keeps the legal literal of the intent (federation + candidate CNPJ)', () => {
    expect(COLINHA_LEGAL_TEXT).toBe(
      'FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL (PT-PC DO B - PV) | CNPJ CANDIDATO: 68.430.467/0001-05',
    )
  })
})

describe('colinha tile asset (S31)', () => {
  it('ships the exact approved model art (byte-for-byte, 900×1600)', async () => {
    const shipped = readFileSync(publicFile('/cards/modelo-colinha.jpeg'))
    const approved = readFileSync(APPROVED_TILE_SRC)

    expect(createHash('sha256').update(shipped).digest('hex')).toBe(TILE_SHA256)
    expect(createHash('sha256').update(shipped).digest('hex')).toBe(
      createHash('sha256').update(approved).digest('hex'),
    )

    const metadata = await sharp(publicFile('/cards/modelo-colinha.jpeg')).metadata()
    expect(`${metadata.width}x${metadata.height}`).toBe('900x1600')
  })
})

describe('fitColinhaCandidate (S31)', () => {
  const measure = (text: string, fontSize: number) => ({ width: text.length * fontSize * 0.84 })
  const officeColumn = 287.07

  it('keeps the ideal size while the name fits the office column', () => {
    expect(fitColinhaCandidate('Lula', measure, officeColumn)).toEqual({
      fontSize: COLINHA_LAYOUT.candidate.fontSize,
      lines: ['Lula'],
    })
  })

  it('shrinks a long name on one line instead of wrapping (fixed row rhythm)', () => {
    const fit = fitColinhaCandidate('Julio Pinheiro', measure, officeColumn)

    expect(fit.fontSize).toBeLessThan(COLINHA_LAYOUT.candidate.fontSize)
    expect(fit.fontSize).toBe(24)
    expect(fit.lines).toEqual(['Julio Pinheiro'])
  })

  it('wraps by word into two lines at the floor when shrinking is not enough', () => {
    const fit = fitColinhaCandidate('Marlene do Sindicato', measure, officeColumn)

    expect(fit.fontSize).toBe(COLINHA_LAYOUT.candidate.minFontSize)
    expect(fit.lines).toEqual(['Marlene do', 'Sindicato'])
  })

  it('wraps the longest catalog names into two lines that fit the column', () => {
    const fit = fitColinhaCandidate('COLETIVO DE ENFERMAGEM', measure, officeColumn)

    expect(fit.lines).toEqual(['COLETIVO DE', 'ENFERMAGEM'])
    for (const line of fit.lines) {
      expect(measure(line, fit.fontSize).width).toBeLessThanOrEqual(officeColumn)
    }
  })
})
