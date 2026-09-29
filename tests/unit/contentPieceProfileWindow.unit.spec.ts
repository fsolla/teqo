// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  contentPieceProfileFeedIdentityUrls,
  contentPieceProfilePeriodBounds,
  contentPieceProfilePeriodError,
  contentPieceProfileWindowLabel,
  contentPieceProfileWindowStartReached,
  planContentPieceProfileWindow,
} from '@/lib/contentPieceProfileWindow'

// C235 — the window owner: the civil-date bounds of the operator's period, the
// recency filter over the feed timestamps, the identity dedupe (Central and
// feed itself) and the honest coverage check. Pure: no Payload, no network.

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

describe('planContentPieceProfileWindow', () => {
  const from = '2026-08-01T03:00:00.000Z'
  const to = '2026-09-21T03:00:00.000Z'

  it('keeps the window novelties, newest first, and classifies each link-only kind', () => {
    const plan = planContentPieceProfileWindow({
      posts: [
        post('NOVO'),
        post('CARROSSEL', { mediaType: 'CAROUSEL_ALBUM', mediaUrl: null }),
        post('PROTEGIDO', { mediaUrl: null }),
      ],
      from,
      to,
    })

    expect(plan.found).toBe(3)
    expect(plan.existingCount).toBe(0)
    expect(plan.outsideWindow).toBe(0)
    expect(plan.malformed).toBe(0)
    expect(plan.window).toEqual({ from, to })
    expect(plan.candidates.map((candidate) => candidate.shortcode)).toEqual([
      'NOVO',
      'CARROSSEL',
      'PROTEGIDO',
    ])
    expect(plan.candidates.map((candidate) => candidate.linkOnlyReason)).toEqual([
      null,
      'carrossel',
      'indisponivel',
    ])
  })

  it('drops what falls outside the window, the malformed and the feed twins', () => {
    const plan = planContentPieceProfileWindow({
      posts: [
        post('JA', { permalink: 'https://www.instagram.com/reel/JA/' }),
        post('ANTES', { timestamp: '2026-07-31T23:59:59.000Z' }),
        post('DEPOIS', { timestamp: '2026-09-22T00:00:00.000Z' }),
        post('SEMID', { permalink: 'https://example.com/no-id/' }),
        post('REPETIDA'),
        post('REPETIDA', { permalink: 'https://www.instagram.com/p/REPETIDA/' }),
      ],
      existingSourceUrls: ['https://www.instagram.com/p/JA/'],
      from,
      to,
    })

    expect(plan.found).toBe(3)
    expect(plan.existingCount).toBe(1)
    expect(plan.existingShortcodes).toEqual(['JA'])
    expect(plan.outsideWindow).toBe(2)
    expect(plan.malformed).toBe(1)
    expect(plan.feedDuplicates).toBe(1)
    expect(plan.candidates.map((candidate) => candidate.shortcode)).toEqual(['REPETIDA'])
  })

  it('treats an unbounded window as the whole feed (the recency mode)', () => {
    const plan = planContentPieceProfileWindow({
      posts: [
        post('ANTIGA', { timestamp: '2020-01-01T00:00:00.000Z' }),
        post('NOVA', { timestamp: '2026-09-20T12:00:00.000Z' }),
      ],
    })

    expect(plan.window).toEqual({ from: null, to: null })
    expect(plan.found).toBe(2)
    expect(plan.outsideWindow).toBe(0)
    expect(plan.candidates.map((candidate) => candidate.shortcode)).toEqual(['ANTIGA', 'NOVA'])
  })

  it('refuses an invalid bound', () => {
    expect(() => planContentPieceProfileWindow({ posts: [], from: 'ontem' })).toThrow(/janela/)
    expect(() => planContentPieceProfileWindow({ posts: [], to: 'amanhã' })).toThrow(/janela/)
  })
})

describe('contentPieceProfilePeriodError', () => {
  const today = '2026-09-29'

  it('accepts a real, ordered, non-future period', () => {
    expect(contentPieceProfilePeriodError({ since: '2026-08-01', today })).toBeNull()
    expect(
      contentPieceProfilePeriodError({ since: '2026-08-01', until: '2026-08-31', today }),
    ).toBeNull()
    expect(contentPieceProfilePeriodError({ since: today, today })).toBeNull()
  })

  it('rejects a malformed or impossible date', () => {
    expect(contentPieceProfilePeriodError({ since: '01/08/2026', today })).toBe(
      'Informe uma data inicial válida.',
    )
    expect(contentPieceProfilePeriodError({ since: '2026-02-30', today })).toBe(
      'Informe uma data inicial válida.',
    )
    expect(
      contentPieceProfilePeriodError({ since: '2026-08-01', until: '2026-02-30', today }),
    ).toBe('Informe uma data final válida.')
  })

  it('rejects an inverted or future period', () => {
    expect(
      contentPieceProfilePeriodError({ since: '2026-08-31', until: '2026-08-01', today }),
    ).toBe('A data final não pode ser anterior à data inicial.')
    expect(contentPieceProfilePeriodError({ since: '2026-10-01', today })).toBe(
      'A data inicial não pode estar no futuro.',
    )
  })
})

describe('contentPieceProfilePeriodBounds', () => {
  it('resolves the start of the since day and the exclusive end of the until day in Bahia', () => {
    expect(contentPieceProfilePeriodBounds({ since: '2026-08-01' })).toEqual({
      fromIso: '2026-08-01T03:00:00.000Z',
      toIso: null,
    })
    expect(contentPieceProfilePeriodBounds({ since: '2026-08-01', until: '2026-08-31' })).toEqual({
      fromIso: '2026-08-01T03:00:00.000Z',
      toIso: '2026-09-01T03:00:00.000Z',
    })
  })

  it('refuses an impossible date defensively', () => {
    expect(() => contentPieceProfilePeriodBounds({ since: '2026-13-01' })).toThrow(
      'Informe uma data inicial válida.',
    )
  })
})

describe('contentPieceProfileWindowStartReached', () => {
  const fromIso = '2026-08-01T03:00:00.000Z'

  it('is reached when the walk got a post older than the window start', () => {
    expect(
      contentPieceProfileWindowStartReached({
        posts: [post('NOVA'), post('ANTES', { timestamp: '2026-07-31T23:59:59.000Z' })],
        fromIso,
      }),
    ).toBe(true)
  })

  it('is not reached when every post is still inside the window', () => {
    expect(contentPieceProfileWindowStartReached({ posts: [post('NOVA')], fromIso })).toBe(false)
    expect(contentPieceProfileWindowStartReached({ posts: [], fromIso })).toBe(false)
  })

  it('is reached when there is no bound to reach', () => {
    expect(contentPieceProfileWindowStartReached({ posts: [], fromIso: null })).toBe(true)
  })
})

describe('contentPieceProfileWindowLabel', () => {
  it('labels the recency and the civil period', () => {
    expect(contentPieceProfileWindowLabel({ mode: 'recent' })).toBe('Recentes')
    expect(contentPieceProfileWindowLabel({ mode: 'period', since: '2026-08-01' })).toBe(
      '01/08/2026 → hoje',
    )
    expect(
      contentPieceProfileWindowLabel({
        mode: 'period',
        since: '2026-08-01',
        until: '2026-08-31',
      }),
    ).toBe('01/08/2026 → 31/08/2026')
  })
})

describe('contentPieceProfileFeedIdentityUrls', () => {
  it('spells every canonical kind of each parseable post once', () => {
    expect(
      contentPieceProfileFeedIdentityUrls([
        post('A'),
        post('B', { permalink: 'https://www.instagram.com/p/B/' }),
        post('A', { permalink: 'https://www.instagram.com/p/A/' }),
        post('X', { permalink: 'https://example.com/x/' }),
      ]),
    ).toEqual([
      'https://www.instagram.com/p/A/',
      'https://www.instagram.com/reel/A/',
      'https://www.instagram.com/tv/A/',
      'https://www.instagram.com/p/B/',
      'https://www.instagram.com/reel/B/',
      'https://www.instagram.com/tv/B/',
    ])
  })
})
