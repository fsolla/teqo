// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  FACE_FIGURE_DEFAULT_OUT_DIR,
  faceFigureReportStamp,
  formatEnrollFigureReport,
  parseEnrollFigureArgs,
} from '../../scripts/lib/faceFigurePlan.mjs'

// C244 — the pure argv contract of `faces:enroll-figure`: the slug-shaped
// figure, at least one image, no path escape and the mode flags.

describe('parseEnrollFigureArgs', () => {
  it('parses the full enrollment with repeated images and the optional provenance', () => {
    const parsed = parseEnrollFigureArgs([
      '--figure',
      'lula',
      '--name',
      'Lula',
      '--full-name',
      'Luiz Inácio Lula da Silva',
      '--source',
      'retrato oficial 2023',
      '--image',
      'a.jpg',
      '--image',
      'b.jpg',
      '--replace',
      '--apply',
      '--out',
      'data/face',
    ])

    expect(parsed).toEqual({
      figure: 'lula',
      name: 'Lula',
      fullName: 'Luiz Inácio Lula da Silva',
      source: 'retrato oficial 2023',
      images: ['a.jpg', 'b.jpg'],
      replace: true,
      apply: true,
      out: 'data/face',
      help: false,
    })
  })

  it('defaults to plan mode and to the receipt dir', () => {
    const parsed = parseEnrollFigureArgs(['--figure', 'lula', '--image', 'a.jpg'])
    expect(parsed.apply).toBe(false)
    expect(parsed.replace).toBe(false)
    expect(parsed.out).toBe(FACE_FIGURE_DEFAULT_OUT_DIR)
  })

  it('requires a slug figure and at least one image', () => {
    expect(() => parseEnrollFigureArgs(['--image', 'a.jpg'])).toThrow(/--figure/)
    expect(() => parseEnrollFigureArgs(['--figure', 'Lula', '--image', 'a.jpg'])).toThrow(
      /--figure/,
    )
    expect(() => parseEnrollFigureArgs(['--figure', 'lula'])).toThrow(/--image/)
  })

  it('refuses an unknown argument and a missing value', () => {
    expect(() => parseEnrollFigureArgs(['--figure', 'lula', '--image', 'a.jpg', '--nope'])).toThrow(
      /argumento desconhecido/,
    )
    expect(() => parseEnrollFigureArgs(['--figure', 'lula', '--image'])).toThrow(/faltou valor/)
  })

  it('refuses an --out escaping the repo and lets --help skip the validations', () => {
    expect(() =>
      parseEnrollFigureArgs(['--figure', 'lula', '--image', 'a.jpg', '--out', '../etc']),
    ).toThrow(/não pode escapar/)
    expect(parseEnrollFigureArgs(['--help']).help).toBe(true)
  })
})

describe('faceFigureReportStamp / formatEnrollFigureReport', () => {
  it('makes a filename-safe stamp', () => {
    expect(faceFigureReportStamp('2026-10-01T23:56:32.123Z')).toBe('2026-10-01T23-56-32-123Z')
  })

  it('reports the mode, the figure action, the references and the bust', () => {
    const lines = formatEnrollFigureReport({
      mode: 'apply',
      figure: 'lula',
      model: 'face-api@1.7.15/faceRecognitionNet',
      action: 'criar',
      referencesBefore: 0,
      referencesAfter: 2,
      images: ['lula.jpg'],
    })

    expect(lines.join('\n')).toContain('modo: apply | figura: lula')
    expect(lines.join('\n')).toContain('referências: 0 → 2')
    expect(lines.join('\n')).toContain('/api/revalidate?tag=archivePhotos')
  })
})
