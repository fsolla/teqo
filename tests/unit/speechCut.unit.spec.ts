import { describe, expect, it } from 'vitest'

import { SPEECH_VOD_INELIGIBLE_MESSAGE } from '@/lib/schemas/speechVod'
import { formatSpeechDate } from '@/lib/speechClock'
import {
  buildSpeechCutFallbackMetadata,
  buildSpeechCutFfmpegArgs,
  buildSpeechCutShare,
  SPEECH_CUT_FAILURE_GENERATING,
  SPEECH_CUT_FAILURE_INTERRUPTED,
  SPEECH_CUT_FAILURE_SPEECH_GONE,
  SPEECH_CUT_FAILURE_UNAVAILABLE,
  SPEECH_CUT_FAILURE_UNPLAYABLE,
  speechCutFailureMessage,
  speechCutPublicPath,
  speechCutStepStates,
  toSpeechCutViewModel,
} from '@/lib/speechCut'

const decodeWaText = (url: string): string =>
  decodeURIComponent(url.slice('https://wa.me/?text='.length)).replace(/\+/g, ' ')

describe('buildSpeechCutFfmpegArgs', () => {
  const args = buildSpeechCutFfmpegArgs({
    inputPath: '/tmp/source.mp4',
    outputPath: '/tmp/corte-1-43-130.mp4',
    startSeconds: 43,
    endSeconds: 130,
  })

  it('seeks before the input so the re-encode starts exactly at the picked second', () => {
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'))
    expect(args[args.indexOf('-ss') + 1]).toBe('43')
  })

  it('carries the selection duration and re-encodes (never -c copy)', () => {
    expect(args[args.indexOf('-t') + 1]).toBe('87')
    expect(args).toContain('libx264')
    expect(args).toContain('aac')
    expect(args).toContain('+faststart')
    expect(args).not.toContain('copy')
  })

  it('maps video always and audio when present, and ends with the output path', () => {
    expect(args[args.indexOf('-map') + 1]).toBe('0:v:0')
    expect(args).toContain('0:a?')
    expect(args.at(-1)).toBe('/tmp/corte-1-43-130.mp4')
  })

  it('rounds seconds and never builds a negative duration', () => {
    const rounded = buildSpeechCutFfmpegArgs({
      inputPath: 'in',
      outputPath: 'out',
      startSeconds: 42.6,
      endSeconds: 130.2,
    })
    expect(rounded[rounded.indexOf('-ss') + 1]).toBe('43')
    expect(rounded[rounded.indexOf('-t') + 1]).toBe('87')

    const reversed = buildSpeechCutFfmpegArgs({
      inputPath: 'in',
      outputPath: 'out',
      startSeconds: 130,
      endSeconds: 43,
    })
    expect(reversed[reversed.indexOf('-t') + 1]).toBe('0')
  })
})

describe('buildSpeechCutFallbackMetadata', () => {
  it('names the excerpt with the type and the day, and uses the official summary', () => {
    expect(
      buildSpeechCutFallbackMetadata({
        speechType: 'BREVES COMUNICAÇÕES',
        dateLabel: '11/08/2026',
        summary: 'Saúde e educação em Feira de Santana.',
      }),
    ).toEqual({
      title: 'Trecho de BREVES COMUNICAÇÕES — 11/08/2026',
      description: 'Saúde e educação em Feira de Santana.',
    })
  })

  it('falls back to "fala" and to a dated sentence when there is no type or summary', () => {
    expect(
      buildSpeechCutFallbackMetadata({ speechType: '  ', dateLabel: '11/08/2026', summary: null }),
    ).toEqual({
      title: 'Trecho de fala — 11/08/2026',
      description: 'Trecho de fala de 11/08/2026, na Câmara dos Deputados.',
    })
  })

  it('clips an oversized summary to the field limit', () => {
    const description = buildSpeechCutFallbackMetadata({
      speechType: null,
      dateLabel: '11/08/2026',
      summary: 'a'.repeat(5000),
    }).description
    expect(description).toHaveLength(2000)
  })
})

describe('speechCutStepStates', () => {
  it('marks the previous steps done, the current one and the rest queued', () => {
    expect(speechCutStepStates('metadata').map((entry) => [entry.step, entry.state])).toEqual([
      ['resolving', 'done'],
      ['cutting', 'done'],
      ['metadata', 'current'],
      ['publishing', 'queued'],
    ])
  })

  it('queues every step when there is no current step', () => {
    expect(speechCutStepStates(null).every((entry) => entry.state === 'queued')).toBe(true)
  })
})

describe('toSpeechCutViewModel', () => {
  const view = toSpeechCutViewModel({
    id: 123,
    status: 'published',
    step: 'publishing',
    title: 'Acesso a medicamentos',
    description: 'Descrição',
    startSeconds: 43,
    endSeconds: 118,
    durationSeconds: 75,
    media: { url: '/api/media/file/corte-123-43-118.mp4', filename: 'corte-123-43-118.mp4' },
    speech: { youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A' },
    publishedAt: '2026-09-15T12:00:00.000Z',
  })

  it('exposes the public path, the stored file and the YouTube cover id', () => {
    expect(view.publicPath).toBe('/corte/123')
    expect(view.mediaUrl).toBe('/api/media/file/corte-123-43-118.mp4')
    expect(view.mediaFilename).toBe('corte-123-43-118.mp4')
    expect(view.youtubeVideoId).toBe('lLhRDkSPw0A')
    expect(view.durationLabel).toBe('1min15s')
  })

  it('never lets an unknown status/step through, and falls back to end − start', () => {
    const unknown = toSpeechCutViewModel({
      id: 1,
      status: 'weird',
      step: 'weird',
      title: 't',
      description: 'd',
      startSeconds: 10,
      endSeconds: 30,
      media: null,
      speech: 7,
    })
    expect(unknown.status).toBe('failed')
    expect(unknown.step).toBeNull()
    expect(unknown.durationSeconds).toBe(20)
    expect(unknown.mediaUrl).toBeNull()
    expect(unknown.youtubeVideoId).toBeNull()
  })

  it('hands a failed cut its mapped cause and never the raw error', () => {
    const failed = toSpeechCutViewModel({
      id: 9,
      status: 'failed',
      step: 'cutting',
      title: 't',
      description: 'd',
      startSeconds: 0,
      endSeconds: 20,
      error: 'HTTP 403 em https://cdn.camara.leg.br/trecho.mp4',
    })

    expect(failed.failureMessage).toBe('Não foi possível cortar o trecho.')
    expect(JSON.stringify(failed)).not.toContain('HTTP 403')
    expect(view.failureMessage).toBeNull()
  })
})

describe('speechCutFailureMessage', () => {
  it('maps the named causes of the first stage to honest pt-BR copy', () => {
    expect(speechCutFailureMessage({ error: SPEECH_CUT_FAILURE_SPEECH_GONE })).toBe(
      SPEECH_CUT_FAILURE_SPEECH_GONE,
    )
    expect(speechCutFailureMessage({ error: SPEECH_VOD_INELIGIBLE_MESSAGE })).toBe(
      'Esta fala não tem trecho de vídeo para cortar.',
    )
    expect(speechCutFailureMessage({ error: SPEECH_CUT_FAILURE_GENERATING })).toBe(
      SPEECH_CUT_FAILURE_GENERATING,
    )
    expect(speechCutFailureMessage({ error: SPEECH_CUT_FAILURE_UNAVAILABLE })).toBe(
      'A Câmara não disponibiliza mais o arquivo deste trecho.',
    )
    expect(speechCutFailureMessage({ error: SPEECH_CUT_FAILURE_UNPLAYABLE })).toBe(
      'A Câmara não disponibilizou um arquivo válido deste trecho.',
    )
    expect(speechCutFailureMessage({ error: SPEECH_CUT_FAILURE_INTERRUPTED })).toBe(
      SPEECH_CUT_FAILURE_INTERRUPTED,
    )
  })

  it('maps an unnamed cause by the step where the job died', () => {
    const raw = 'HTTP 403 em https://cdn.camara.leg.br/trecho.mp4'
    expect(speechCutFailureMessage({ error: raw, step: 'resolving' })).toBe(
      'Não foi possível localizar o trecho na Câmara.',
    )
    expect(speechCutFailureMessage({ error: 'ffmpeg failed', step: 'cutting' })).toBe(
      'Não foi possível cortar o trecho.',
    )
    expect(speechCutFailureMessage({ error: 'storage down', step: 'metadata' })).toBe(
      'Não foi possível guardar o arquivo do corte.',
    )
    expect(speechCutFailureMessage({ error: 'storage down', step: 'publishing' })).toBe(
      'Não foi possível guardar o arquivo do corte.',
    )
    expect(speechCutFailureMessage({ error: 'boom', step: null })).toBe(
      'Não foi possível preparar o corte.',
    )
    expect(speechCutFailureMessage({ error: raw, step: 'resolving' })).not.toContain('https://')
  })

  it('stays null when the row stored no cause', () => {
    expect(speechCutFailureMessage({ error: null, step: 'resolving' })).toBeNull()
    expect(speechCutFailureMessage({ error: '   ', step: 'resolving' })).toBeNull()
    expect(speechCutFailureMessage({})).toBeNull()
  })
})

describe('buildSpeechCutShare', () => {
  it('bundles the title with the public link and reuses the wa.me builder', () => {
    const share = buildSpeechCutShare({
      title: 'Acesso a medicamentos',
      url: 'https://jorgesolla1313.com.br/corte/123',
    })
    expect(share.message).toBe('Acesso a medicamentos https://jorgesolla1313.com.br/corte/123')
    expect(share.whatsAppUrl.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeWaText(share.whatsAppUrl)).toBe(share.message)
  })

  it('builds the public path from the numeric id', () => {
    expect(speechCutPublicPath(42)).toBe('/corte/42')
  })
})

describe('formatSpeechDate', () => {
  it('reads the Câmara wall clock as a day-only label', () => {
    expect(formatSpeechDate('2026-08-11T18:48')).toBe('11/08/2026')
    expect(formatSpeechDate('not-a-date')).toBe('not-a-date')
  })
})
