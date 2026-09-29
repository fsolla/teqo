// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  formatInstagramContentReport,
  instagramContentFeedIdentityUrls,
  instagramContentReportStamp,
  parseInstagramContentCliArgs,
  planInstagramContentWindow,
  shouldPublishImportedPiece,
  summarizeInstagramContentResults,
} from '../../scripts/lib/instagramContentPlan.mjs'

// C230-followup — the import planner contract: the recency window filter, the
// identity dedupe (in both directions: the feed against the Central and the
// feed against itself), the link-only classification and the honest report.
// The feed is always a plain array; no network, no Payload.

const post = (
  shortcode: string,
  {
    mediaType = 'REEL',
    mediaUrl = `https://cdn.example/${shortcode}.mp4`,
    timestamp = '2026-09-20T12:00:00.000Z',
    permalink,
  }: {
    mediaType?: string
    mediaUrl?: string | null
    timestamp?: string
    permalink?: string
  } = {},
) => ({
  id: shortcode,
  permalink: permalink ?? `https://www.instagram.com/reel/${shortcode}/`,
  mediaType,
  mediaUrl,
  timestamp,
})

describe('content:instagram:import arguments', () => {
  it('defaults to the 60-day plan with no writes', () => {
    expect(parseInstagramContentCliArgs([])).toEqual({
      apply: false,
      publish: false,
      days: 60,
      limit: null,
      out: 'data/content-instagram',
      help: false,
    })
  })

  it('accepts the apply/publish pair and the window options', () => {
    expect(
      parseInstagramContentCliArgs([
        '--apply',
        '--publish',
        '--days',
        '45',
        '--limit',
        '3',
        '--out',
        'data/out',
      ]),
    ).toMatchObject({ apply: true, publish: true, days: 45, limit: 3, out: 'data/out' })
  })

  it('refuses --publish without --apply', () => {
    expect(() => parseInstagramContentCliArgs(['--publish'])).toThrow(/exige --apply/)
  })

  it('refuses an unknown argument', () => {
    expect(() => parseInstagramContentCliArgs(['--force'])).toThrow(/argumento desconhecido/)
  })

  it('refuses an out-of-range window, a zero limit and an escaping out dir', () => {
    expect(() => parseInstagramContentCliArgs(['--days', '0'])).toThrow(/--days/)
    expect(() => parseInstagramContentCliArgs(['--days', '366'])).toThrow(/--days/)
    expect(() => parseInstagramContentCliArgs(['--limit', '0'])).toThrow(/--limit/)
    expect(() => parseInstagramContentCliArgs(['--out', '../etc'])).toThrow(/--out/)
  })

  it('prints the help before any validation', () => {
    expect(parseInstagramContentCliArgs(['--help', '--days', '0'])).toMatchObject({ help: true })
  })
})

describe('planInstagramContentWindow', () => {
  const from = '2026-08-01T00:00:00.000Z'
  const to = '2026-09-30T00:00:00.000Z'

  it('keeps the window novelties, newest first, and classifies each link-only kind', () => {
    const plan = planInstagramContentWindow({
      posts: [
        post('NOVO'),
        post('CARROSSEL', { mediaType: 'CAROUSEL_ALBUM', mediaUrl: null }),
        post('PROTEGIDO', { mediaUrl: null }),
      ],
      existingSourceUrls: [],
      from,
      to,
    })

    expect(plan.found).toBe(3)
    expect(plan.existingCount).toBe(0)
    expect(plan.outsideWindow).toBe(0)
    expect(plan.malformed).toBe(0)
    expect(plan.candidates).toEqual([
      {
        url: 'https://www.instagram.com/reel/NOVO/',
        shortcode: 'NOVO',
        linkOnlyReason: null,
        timestamp: '2026-09-20T12:00:00.000Z',
        mediaType: 'REEL',
      },
      expect.objectContaining({ shortcode: 'CARROSSEL', linkOnlyReason: 'carrossel' }),
      expect.objectContaining({ shortcode: 'PROTEGIDO', linkOnlyReason: 'indisponivel' }),
    ])
  })

  it('drops what the Central already carries in ANY spelling and counts the rest', () => {
    const plan = planInstagramContentWindow({
      posts: [
        post('JA', { permalink: 'https://www.instagram.com/reel/JA/' }),
        post('FORA', { timestamp: '2026-07-01T00:00:00.000Z' }),
        post('SEMID', { permalink: 'https://example.com/no-id/' }),
        post('REPETIDA'),
        post('REPETIDA', { permalink: 'https://www.instagram.com/p/REPETIDA/' }),
      ],
      // The catalogue carries the same post under the `p` kind.
      existingSourceUrls: ['https://www.instagram.com/p/JA/'],
      from,
      to,
    })

    expect(plan.found).toBe(3)
    expect(plan.existingCount).toBe(1)
    expect(plan.existingShortcodes).toEqual(['JA'])
    expect(plan.outsideWindow).toBe(1)
    expect(plan.malformed).toBe(1)
    expect(plan.feedDuplicates).toBe(1)
    expect(plan.candidates.map((candidate) => candidate.shortcode)).toEqual(['REPETIDA'])
  })
})

describe('instagramContentFeedIdentityUrls', () => {
  it('spells every canonical kind of each parseable post once', () => {
    const urls = instagramContentFeedIdentityUrls([
      post('A'),
      post('B', { permalink: 'https://www.instagram.com/p/B/' }),
      post('A', { permalink: 'https://www.instagram.com/p/A/' }),
      post('X', { permalink: 'https://example.com/x/' }),
    ])

    expect(urls).toEqual([
      'https://www.instagram.com/p/A/',
      'https://www.instagram.com/reel/A/',
      'https://www.instagram.com/tv/A/',
      'https://www.instagram.com/p/B/',
      'https://www.instagram.com/reel/B/',
      'https://www.instagram.com/tv/B/',
    ])
  })
})

describe('summaries and receipt', () => {
  it('publishes only a ready piece when the run asked for it', () => {
    expect(shouldPublishImportedPiece({ processingStatus: 'pronto', publish: true })).toBe(true)
    expect(shouldPublishImportedPiece({ processingStatus: 'pronto', publish: false })).toBe(false)
    expect(shouldPublishImportedPiece({ processingStatus: 'falhou', publish: true })).toBe(false)
  })

  it('aggregates the run with the provider cost', () => {
    const summary = summarizeInstagramContentResults(
      [
        {
          outcome: 'created',
          processingStatus: 'pronto',
          durationSeconds: 60,
          published: true,
          linkFailureReason: null,
        },
        {
          outcome: 'created',
          processingStatus: 'pronto',
          durationSeconds: 30,
          published: true,
          linkFailureReason: 'carrossel',
        },
        { outcome: 'created', processingStatus: 'falhou', error: 'ffmpeg' },
        { outcome: 'existing' },
      ],
      { costPerMinuteUsd: 0.00045 },
    )

    expect(summary).toMatchObject({
      attempted: 4,
      created: 3,
      existing: 1,
      ready: 2,
      failed: 1,
      published: 2,
      linkOnly: 1,
      asrSeconds: 90,
    })
    expect(summary.asrCostUsd).toBeCloseTo(0.0007, 4)
  })

  it('reports the window, the plan and the named failures', () => {
    const plan = planInstagramContentWindow({
      posts: [post('A'), post('B', { mediaType: 'CAROUSEL_ALBUM', mediaUrl: null })],
      existingSourceUrls: [],
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
    })
    const lines = formatInstagramContentReport({
      target: '127.0.0.1/teqo_1313',
      mode: 'apply',
      window: { days: 60, from: '2026-08-01T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z' },
      feedCount: 2,
      plan,
      summary: summarizeInstagramContentResults([
        { outcome: 'created', processingStatus: 'falhou', error: 'ffmpeg ausente' },
      ]),
      failures: [{ shortcode: 'A', error: 'ffmpeg ausente' }],
      candidatesRemaining: 1,
      reportPath: 'data/content-instagram/x.json',
    })

    const text = lines.join('\n')
    expect(text).toContain('alvo: 127.0.0.1/teqo_1313 | modo: apply')
    expect(text).toContain('janela: 60 dias')
    expect(text).toContain('candidatos: 2 (peça-link previstos: 1)')
    expect(text).toContain('falha A: ffmpeg ausente')
    expect(text).toContain('peça-link B: carrossel')
    expect(text).toContain('restam 1 candidatos')
    expect(text).toContain('recibo: data/content-instagram/x.json')
  })

  it('stamps the receipt with the run instant', () => {
    expect(instagramContentReportStamp('2026-09-29T12:34:56.789Z')).toBe('2026-09-29T12-34-56-789Z')
  })
})
