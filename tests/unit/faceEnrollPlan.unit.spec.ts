// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  FACE_ENROLL_DEFAULT_OUT_DIR,
  faceEnrollReportStamp,
  formatFaceEnrollReport,
  parseFaceEnrollCliArgs,
} from '../../scripts/lib/faceEnrollPlan.mjs'

// C234 — the pure parser/report of `pnpm faces:enroll`: every refusal happens
// before any engine call or DB connection, and the human lines never carry the
// descriptor.

describe('parseFaceEnrollCliArgs', () => {
  it('defaults to the dry-run with the standard receipt dir', () => {
    const options = parseFaceEnrollCliArgs(['--label', 'Pessoa', '--selfie', '/tmp/selfie.jpg'])
    expect(options).toEqual({
      apply: false,
      label: 'Pessoa',
      selfie: '/tmp/selfie.jpg',
      subject: null,
      out: FACE_ENROLL_DEFAULT_OUT_DIR,
      help: false,
    })
  })

  it('parses --apply, --subject, --out and --help', () => {
    const options = parseFaceEnrollCliArgs([
      '--apply',
      '--label',
      ' Pessoa ',
      '--selfie',
      '/tmp/selfie.jpg',
      '--subject',
      '7',
      '--out',
      'data/outro',
    ])
    expect(options.apply).toBe(true)
    expect(options.label).toBe(' Pessoa ')
    expect(options.subject).toBe(7)
    expect(options.out).toBe('data/outro')

    expect(parseFaceEnrollCliArgs(['--help']).help).toBe(true)
  })

  it('fails closed on missing label/selfie, bad subject and unknown args', () => {
    expect(() => parseFaceEnrollCliArgs(['--selfie', '/tmp/a.jpg'])).toThrow(/--label/)
    expect(() => parseFaceEnrollCliArgs(['--label', 'Pessoa'])).toThrow(/--selfie/)
    expect(() => parseFaceEnrollCliArgs(['--label', ' ', '--selfie', '/tmp/a.jpg'])).toThrow(
      /--label/,
    )
    expect(() =>
      parseFaceEnrollCliArgs(['--label', 'P', '--selfie', '/tmp/a.jpg', '--subject', '0']),
    ).toThrow(/--subject/)
    expect(() =>
      parseFaceEnrollCliArgs(['--label', 'P', '--selfie', '/tmp/a.jpg', '--nope']),
    ).toThrow(/argumento desconhecido/)
    expect(() => parseFaceEnrollCliArgs(['--label'])).toThrow(/faltou valor/)
    expect(() =>
      parseFaceEnrollCliArgs(['--label', 'P', '--selfie', '/tmp/a.jpg', '--out', '../etc']),
    ).toThrow(/--out/)
  })
})

describe('faceEnrollReportStamp', () => {
  it('is filesystem-safe', () => {
    expect(faceEnrollReportStamp('2026-09-27T16:42:01.123Z')).toBe('2026-09-27T16-42-01-123Z')
  })
})

describe('formatFaceEnrollReport', () => {
  const base = {
    runAt: '2026-09-27T16:42:01.123Z',
    mode: 'apply',
    target: '127.0.0.1/teqo_wt234',
    model: 'face-api@1.7.15/faceRecognitionNet',
    label: 'Pessoa',
    subjectId: 3,
    subjectAction: 'created' as const,
    faceCount: 1,
    allowed: true,
    reason: null,
    consentKey: 'busca-selfie-indice',
    consentHash: 'abc',
    durationMs: 10,
  }

  it('reports the enrollment without ever mentioning a descriptor', () => {
    const lines = formatFaceEnrollReport(base)
    const text = lines.join('\n')

    expect(text).toContain('criada: #3 (Pessoa)')
    expect(text).toContain('busca-selfie-indice')
    expect(text).toContain('pnpm faces:index --apply')
    expect(text).not.toMatch(/descriptor|vetor|vector/i)
  })

  it('shows the dry-run as a plan, never as a write', () => {
    const lines = formatFaceEnrollReport({
      ...base,
      mode: 'plan',
      subjectAction: null,
      subjectId: null,
    })
    const text = lines.join('\n')

    expect(text).toContain('plano: Pessoa (nada gravado')
    expect(text).not.toContain('criada')
  })

  it('shows the refusal reason and no subject line', () => {
    const lines = formatFaceEnrollReport({
      ...base,
      allowed: false,
      subjectId: null,
      subjectAction: null,
      faceCount: 2,
      reason: 'mais de um rosto na selfie',
    })
    const text = lines.join('\n')

    expect(text).toContain('RECUSADO: mais de um rosto na selfie')
    expect(text).not.toContain('criada')
  })
})
