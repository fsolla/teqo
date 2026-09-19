import { describe, expect, it } from 'vitest'

import {
  buildReelRoteiro,
  buildReelSrt,
  buildScriptBeats,
  fitBeat,
  formatSrtTime,
  MAX_BEAT_TEMPO,
  NARRATION_PCM,
  padPcmToSamples,
  pcmByteLength,
  pcmDurationMs,
  pcmSampleCount,
  resolveSceneNarration,
} from '../../scripts/lib/reelScript.mjs'

// C197 — the spoken script is pure: the capture fallback is the burned caption
// (authored spacing preserved), the windows follow the concat order, the SRT is
// one block per beat and the PCM fit never truncates below the scene window.

const capture = (overrides: Record<string, unknown> = {}) => ({
  id: 'step-1',
  kind: 'capture',
  badge: { number: 1, total: 3, label: 'Escolha um modelo' },
  narration: null,
  caption: { parts: [{ text: 'Toque em ' }, { text: '“Card”', accent: true }, { text: '.' }] },
  ...overrides,
})

describe('resolveSceneNarration', () => {
  it('prefers the explicit narration', () => {
    expect(resolveSceneNarration(capture({ narration: '  Fale assim.  ' }))).toBe('Fale assim.')
  })

  it('falls back to the burned caption of a capture scene', () => {
    expect(resolveSceneNarration(capture())).toBe('Toque em “Card”.')
  })

  it('keeps graphic scenes silent without narration', () => {
    expect(resolveSceneNarration({ kind: 'graphic', template: 'hook' })).toBeNull()
    expect(resolveSceneNarration({ kind: 'graphic', template: 'hook', narration: 'Olá.' })).toBe(
      'Olá.',
    )
  })
})

describe('buildScriptBeats', () => {
  it('walks the scenes in concat order with cumulative windows', () => {
    const shotList = {
      scenes: [
        { id: 'hook', kind: 'graphic', template: 'hook', narration: 'Abertura.' },
        capture(),
        { id: 'cta', kind: 'graphic', template: 'cta', narration: null },
      ],
    }
    const plans = new Map([
      ['cta', { durationMs: 3_200 }],
      ['hook', { durationMs: 2_400 }],
      ['step-1', { durationMs: 5_000 }],
    ])
    expect(buildScriptBeats({ shotList, plans })).toEqual([
      {
        id: 'hook',
        kind: 'graphic',
        label: 'hook',
        startMs: 0,
        endMs: 2_400,
        durationMs: 2_400,
        text: 'Abertura.',
      },
      {
        id: 'step-1',
        kind: 'capture',
        label: 'Escolha um modelo',
        startMs: 2_400,
        endMs: 7_400,
        durationMs: 5_000,
        text: 'Toque em “Card”.',
      },
      {
        id: 'cta',
        kind: 'graphic',
        label: 'cta',
        startMs: 7_400,
        endMs: 10_600,
        durationMs: 3_200,
        text: null,
      },
    ])
  })

  it('fails closed when a scene has no plan', () => {
    const shotList = { scenes: [{ id: 'hook', kind: 'graphic', template: 'hook' }] }
    expect(() => buildScriptBeats({ shotList, plans: new Map() })).toThrow(/sem plano de duração/)
  })
})

describe('SRT', () => {
  it('formats timecodes as HH:MM:SS,mmm', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
    expect(formatSrtTime(999)).toBe('00:00:00,999')
    expect(formatSrtTime(1_000)).toBe('00:00:01,000')
    expect(formatSrtTime(3_661_007)).toBe('01:01:01,007')
    expect(formatSrtTime(-5)).toBe('00:00:00,000')
  })

  it('emits one block per spoken beat, skipping mute scenes', () => {
    const beats = [
      { startMs: 0, endMs: 2_400, text: 'Abertura.' },
      { startMs: 2_400, endMs: 7_400, text: 'Toque em “Card”.' },
      { startMs: 7_400, endMs: 10_600, text: null },
    ]
    expect(buildReelSrt(beats)).toBe(
      '1\n00:00:00,000 --> 00:00:02,400\nAbertura.\n\n2\n00:00:02,400 --> 00:00:07,400\nToque em “Card”.\n',
    )
  })

  it('is empty when no scene has speech', () => {
    expect(buildReelSrt([{ startMs: 0, endMs: 1_000, text: null }])).toBe('')
  })
})

describe('roteiro.md', () => {
  it('marks every scene with its window and speech', () => {
    const roteiro = buildReelRoteiro({
      shotList: { slug: 'cards', title: 'Crie seu card de apoio' },
      hash: 'a'.repeat(64),
      durationMs: 10_600,
      beats: [
        { id: 'hook', label: 'hook', startMs: 0, endMs: 2_400, text: 'Abertura.' },
        { id: 'cta', label: 'cta', startMs: 2_400, endMs: 10_600, text: null },
      ],
    })
    expect(roteiro).toContain('# Roteiro — Crie seu card de apoio')
    expect(roteiro).toContain(`- Shot list: \`${'a'.repeat(64)}\``)
    expect(roteiro).toContain('- Duração: 10,6s (2 cenas)')
    expect(roteiro).toContain('## 1. hook — 0,0s–2,4s · hook')
    expect(roteiro).toContain('## 2. cta — 2,4s–10,6s · cta')
    expect(roteiro).toContain('_Sem fala nesta cena._')
  })
})

describe('PCM fit', () => {
  it('converts between ms, samples and bytes exactly', () => {
    expect(NARRATION_PCM).toEqual({ sampleRate: 24000, channels: 1, bytesPerSample: 2 })
    expect(pcmSampleCount(1_000)).toBe(24_000)
    expect(pcmByteLength(24_000)).toBe(48_000)
    expect(pcmDurationMs(48_000)).toBe(1_000)
  })

  it('never slows a short line and caps the speed-up', () => {
    expect(fitBeat({ durationMs: 2_000, targetMs: 3_000 })).toEqual({ tempo: 1, overflow: false })
    expect(fitBeat({ durationMs: 3_000, targetMs: 2_000 })).toEqual({ tempo: 1.5, overflow: false })
    expect(fitBeat({ durationMs: 4_000, targetMs: 2_000 })).toEqual({
      tempo: MAX_BEAT_TEMPO,
      overflow: true,
    })
  })

  it('refuses an invalid scene window', () => {
    expect(() => fitBeat({ durationMs: 1_000, targetMs: 0 })).toThrow(/janela inválida/)
  })

  it('pads and trims the PCM to the exact sample boundary', () => {
    const samples = pcmSampleCount(1_000)
    const shorter = Buffer.alloc(24_000)
    expect(padPcmToSamples(shorter, samples)).toHaveLength(48_000)
    const longer = Buffer.alloc(60_000)
    expect(padPcmToSamples(longer, samples)).toHaveLength(48_000)
    const exact = Buffer.alloc(48_000)
    expect(padPcmToSamples(exact, samples)).toBe(exact)
  })
})
