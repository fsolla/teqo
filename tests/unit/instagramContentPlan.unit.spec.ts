// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  contentPieceProfileFeedIdentityUrls,
  planContentPieceProfileWindow,
} from '@/lib/contentPieceProfileWindow'

import {
  formatInstagramContentPruneReport,
  formatInstagramContentReport,
  formatInstagramContentWithdrawReport,
  instagramContentFeedIdentityUrls,
  instagramContentPostDates,
  instagramContentReportStamp,
  parseInstagramContentCliArgs,
  parseInstagramContentPruneCliArgs,
  parseInstagramContentWithdrawCliArgs,
  planInstagramContentDraftsToPublish,
  planInstagramContentPrune,
  planInstagramContentWindow,
  planInstagramContentWithdraw,
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
      publishExisting: false,
      days: 60,
      limit: null,
      out: 'data/content-instagram',
      help: false,
    })
  })

  it('accepts --publish-existing only with --apply', () => {
    expect(parseInstagramContentCliArgs(['--apply', '--publish-existing'])).toMatchObject({
      apply: true,
      publishExisting: true,
    })
    expect(() => parseInstagramContentCliArgs(['--publish-existing'])).toThrow(/exige --apply/)
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

describe('planner re-exports (C235)', () => {
  it('keeps the CLI names bound to the single owner in src/lib', () => {
    // The window policy is pinned by its owner spec; here only the delegation
    // contract of the CLI shell matters.
    expect(planInstagramContentWindow).toBe(planContentPieceProfileWindow)
    expect(instagramContentFeedIdentityUrls).toBe(contentPieceProfileFeedIdentityUrls)
  })
})

describe('window draft publication (C230-followup)', () => {
  it('dates the feed by shortcode, keeping the earliest publication', () => {
    const dates = instagramContentPostDates([
      post('A', { timestamp: '2026-09-02T12:00:00.000Z' }),
      post('A', {
        timestamp: '2026-09-01T12:00:00.000Z',
        permalink: 'https://www.instagram.com/p/A/',
      }),
      post('X', { permalink: 'https://example.com/x/' }),
    ])

    expect(dates.get('A')).toBe(Date.parse('2026-09-01T12:00:00.000Z'))
    expect(dates.size).toBe(1)
  })

  it('orders the ready drafts oldest post first and names the undateable', () => {
    const planned = planInstagramContentDraftsToPublish({
      pieces: [
        { id: 1, title: 'A', sourceUrl: 'https://www.instagram.com/reel/A/' },
        { id: 2, title: 'B', sourceUrl: 'https://www.instagram.com/p/B/' },
        {
          id: 3,
          title: 'D',
          sourceUrl: 'https://www.instagram.com/reel/D/',
          linkFailureReason: 'carrossel',
        },
        { id: 4, title: 'C', sourceUrl: 'https://www.instagram.com/reel/NAO-ESTA/' },
      ],
      posts: [
        post('A', { timestamp: '2026-09-01T12:00:00.000Z' }),
        post('B', { timestamp: '2026-08-20T12:00:00.000Z' }),
        post('D', { timestamp: '2026-08-25T12:00:00.000Z' }),
      ],
    })

    expect(planned.ordered.map((piece) => piece.id)).toEqual([2, 3, 1])
    expect(planned.ordered.map((piece) => piece.shortcode)).toEqual(['B', 'D', 'A'])
    expect(planned.undateable.map((piece) => piece.id)).toEqual([4])
    expect(planned.linkOnly).toBe(1)
  })
})

describe('pre-campaign withdrawal (C230-followup)', () => {
  const publishedPosts = [
    post('KEEP', { timestamp: '2026-08-16T00:00:00-03:00' }),
    post('DROP-LATE', { timestamp: '2026-08-15T23:59:59-03:00' }),
    post('DROP-EARLY', { timestamp: '2026-07-31T09:00:00-03:00' }),
  ]

  it('splits by the Bahia civil cutoff, oldest withdrawn first', () => {
    const plan = planInstagramContentWithdraw({
      pieces: [
        { id: 1, title: 'KEEP', sourceUrl: 'https://www.instagram.com/reel/KEEP/' },
        { id: 2, title: 'DROP-LATE', sourceUrl: 'https://www.instagram.com/p/DROP-LATE/' },
        { id: 3, title: 'DROP-EARLY', sourceUrl: 'https://www.instagram.com/reel/DROP-EARLY/' },
        { id: 4, title: 'SEM-DATA', sourceUrl: 'https://www.instagram.com/reel/FORA-DO-FEED/' },
        { id: 5, title: 'SEM-URL', sourceUrl: null },
      ],
      posts: publishedPosts,
      before: '2026-08-16',
    })

    // 16/08 00:00 na Bahia = 03:00Z: o que veio antes sai, inclusive a noite do dia 15.
    expect(plan.cutoffIso).toBe('2026-08-16T03:00:00.000Z')
    expect(plan.toWithdraw.map((piece) => piece.id)).toEqual([3, 2])
    expect(plan.toWithdraw.map((piece) => piece.postDate.slice(0, 10))).toEqual([
      '2026-07-31',
      '2026-08-16',
    ])
    expect(plan.undateable.map((piece) => piece.id)).toEqual([4, 5])
  })

  it('refuses an impossible civil date', () => {
    expect(() =>
      planInstagramContentWithdraw({ pieces: [], posts: [], before: '2026-02-30' }),
    ).toThrow(/data inicial válida/)
  })

  it('parses the withdraw arguments with a required cutoff', () => {
    expect(parseInstagramContentWithdrawCliArgs(['--before', '2026-08-16'])).toEqual({
      apply: false,
      before: '2026-08-16',
      scanDays: 90,
      out: 'data/content-instagram',
      help: false,
    })
    expect(
      parseInstagramContentWithdrawCliArgs([
        '--before',
        '2026-08-16',
        '--apply',
        '--scan-days',
        '60',
      ]),
    ).toMatchObject({ apply: true, before: '2026-08-16', scanDays: 60 })
    expect(() => parseInstagramContentWithdrawCliArgs([])).toThrow(/--before é obrigatório/)
    expect(() => parseInstagramContentWithdrawCliArgs(['--before', '16/08/2026'])).toThrow(
      /YYYY-MM-DD/,
    )
    expect(() => parseInstagramContentWithdrawCliArgs(['--before', '2026-02-30'])).toThrow(
      /data civil válida/,
    )
    expect(() => parseInstagramContentWithdrawCliArgs(['--force'])).toThrow(
      /argumento desconhecido/,
    )
    expect(parseInstagramContentWithdrawCliArgs(['--help'])).toMatchObject({ help: true })
  })

  it('reports the cutoff, the period and the undateable pieces', () => {
    const plan = planInstagramContentWithdraw({
      pieces: [
        { id: 3, title: 'DROP-EARLY', sourceUrl: 'https://www.instagram.com/reel/DROP-EARLY/' },
        { id: 4, title: 'SEM-DATA', sourceUrl: null },
      ],
      posts: publishedPosts,
      before: '2026-08-16',
    })
    const lines = formatInstagramContentWithdrawReport({
      target: '127.0.0.1/teqo_1313',
      mode: 'apply',
      before: '2026-08-16',
      scanDays: 90,
      feedCount: 3,
      publishedCount: 2,
      plan,
      withdrawn: 1,
      failures: [],
      revalidation: { attempted: true, ok: true, reason: null },
      reportPath: 'data/content-instagram/x-withdraw.json',
    })

    const text = lines.join('\n')
    expect(text).toContain('alvo: 127.0.0.1/teqo_1313 | modo: apply')
    expect(text).toContain('corte: 2026-08-16 (Bahia; posts anteriores)')
    expect(text).toContain('anteriores ao corte: 1 · sem data no feed: 1')
    expect(text).toContain('DROP-EARLY (2026-07-31)')
    expect(text).toContain('? sem data: #4 SEM-DATA')
    expect(text).toContain('retiradas: 1 · falhas: 0 · revalidação: ok')
    expect(text).toContain('recibo: data/content-instagram/x-withdraw.json')
  })
})

describe('pre-campaign pruning (C230-followup)', () => {
  const cataloguePosts = [
    post('KEEP', { timestamp: '2026-08-16T00:00:00-03:00' }),
    post('DROP-LATE', { timestamp: '2026-08-15T23:59:59-03:00' }),
    post('DROP-EARLY', { timestamp: '2026-07-31T09:00:00-03:00' }),
  ]
  const catalogue = [
    { id: 1, title: 'KEEP', sourceUrl: 'https://www.instagram.com/reel/KEEP/', status: 'rascunho' },
    {
      id: 2,
      title: 'DROP-LATE',
      sourceUrl: 'https://www.instagram.com/p/DROP-LATE/',
      status: 'publicado',
    },
    {
      id: 3,
      title: 'DROP-EARLY',
      sourceUrl: 'https://www.instagram.com/reel/DROP-EARLY/',
      status: 'rascunho',
    },
    {
      id: 4,
      title: 'SEM-DATA',
      sourceUrl: 'https://www.instagram.com/reel/FORA-DO-FEED/',
      status: 'rascunho',
    },
    { id: 5, title: 'SEM-URL', sourceUrl: null, status: 'rascunho' },
  ]

  it('matches every piece before the cutoff, drafts included, sharing the withdraw split', () => {
    const plan = planInstagramContentPrune({
      pieces: catalogue,
      posts: cataloguePosts,
      before: '2026-08-16',
    })
    const withdrawn = planInstagramContentWithdraw({
      pieces: catalogue,
      posts: cataloguePosts,
      before: '2026-08-16',
    })

    // 16/08 00:00 na Bahia = 03:00Z: a noite do dia 15 e tudo antes sai; peça
    // sem data no feed nunca entra no conjunto (fail-closed).
    expect(plan.cutoffIso).toBe('2026-08-16T03:00:00.000Z')
    expect(plan.toDelete.map((piece) => piece.id)).toEqual([3, 2])
    expect(plan.toDelete.map((piece) => piece.postDate.slice(0, 10))).toEqual([
      '2026-07-31',
      '2026-08-16',
    ])
    expect(plan.undateable.map((piece) => piece.id)).toEqual([4, 5])
    expect(plan.toDelete.map((piece) => piece.id)).toEqual(
      withdrawn.toWithdraw.map((piece) => piece.id),
    )
  })

  it('parses the prune arguments with the deep default scan', () => {
    expect(parseInstagramContentPruneCliArgs(['--before', '2026-08-16'])).toEqual({
      apply: false,
      before: '2026-08-16',
      scanDays: 365,
      out: 'data/content-instagram',
      help: false,
    })
    expect(
      parseInstagramContentPruneCliArgs(['--before', '2026-08-16', '--apply', '--scan-days', '90']),
    ).toMatchObject({ apply: true, before: '2026-08-16', scanDays: 90 })
    expect(() => parseInstagramContentPruneCliArgs([])).toThrow(/--before é obrigatório/)
    expect(() => parseInstagramContentPruneCliArgs(['--before', '16/08/2026'])).toThrow(
      /YYYY-MM-DD/,
    )
    expect(() => parseInstagramContentPruneCliArgs(['--before', '2026-02-30'])).toThrow(
      /data civil válida/,
    )
    expect(() =>
      parseInstagramContentPruneCliArgs(['--before', '2026-08-16', '--scan-days']),
    ).toThrow(/faltou valor/)
    expect(() =>
      parseInstagramContentPruneCliArgs(['--before', '2026-08-16', '--scan-days', '0']),
    ).toThrow(/--scan-days/)
    expect(() => parseInstagramContentPruneCliArgs(['--force'])).toThrow(/argumento desconhecido/)
    expect(parseInstagramContentPruneCliArgs(['--help'])).toMatchObject({ help: true })
  })

  it('reports the cutoff, the period, the catalogue size and the undateable rows', () => {
    const plan = planInstagramContentPrune({
      pieces: catalogue,
      posts: cataloguePosts,
      before: '2026-08-16',
    })
    const lines = formatInstagramContentPruneReport({
      target: '127.0.0.1/teqo_1313',
      mode: 'apply',
      before: '2026-08-16',
      scanDays: 365,
      feedCount: 3,
      piecesCount: 5,
      plan,
      deleted: 2,
      failures: [],
      revalidation: { attempted: true, ok: true, reason: null },
      reportPath: 'data/content-instagram/x-prune.json',
    })

    const text = lines.join('\n')
    expect(text).toContain('alvo: 127.0.0.1/teqo_1313 | modo: apply')
    expect(text).toContain('corte: 2026-08-16 (Bahia; posts anteriores)')
    expect(text).toContain('no catálogo: 5 · anteriores ao corte: 2 · sem data no feed: 2')
    expect(text).toContain('DROP-EARLY (2026-07-31)')
    expect(text).toContain('? sem data: #4 SEM-DATA')
    expect(text).toContain('apagadas: 2 · falhas: 0 · revalidação: ok')
    expect(text).toContain('recibo: data/content-instagram/x-prune.json')
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
      publishedExisting: 3,
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
    expect(text).toContain('publicadas da janela (já importadas, rascunhos prontos): 3')
    expect(text).toContain('restam 1 candidatos')
    expect(text).toContain('recibo: data/content-instagram/x.json')
  })

  it('stamps the receipt with the run instant', () => {
    expect(instagramContentReportStamp('2026-09-29T12:34:56.789Z')).toBe('2026-09-29T12-34-56-789Z')
  })
})
