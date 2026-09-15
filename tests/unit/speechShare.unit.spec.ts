import { describe, expect, it } from 'vitest'

import {
  buildSpeechExcerptMessage,
  buildSpeechExcerptShare,
  buildSpeechExcerptYoutubeUrl,
} from '@/lib/speechShare'

const decodeWaText = (url: string): string =>
  decodeURIComponent(url.slice('https://wa.me/?text='.length)).replace(/\+/g, ' ')

describe('buildSpeechExcerptYoutubeUrl', () => {
  it('opens the watch page at the session offset plus the excerpt start', () => {
    expect(buildSpeechExcerptYoutubeUrl('lLhRDkSPw0A', 2634, 43)).toBe(
      'https://www.youtube.com/watch?v=lLhRDkSPw0A&t=2677',
    )
  })

  it('floors fractional seconds — the link carries whole seconds', () => {
    expect(buildSpeechExcerptYoutubeUrl('lLhRDkSPw0A', 2634.6, 43.9)).toBe(
      'https://www.youtube.com/watch?v=lLhRDkSPw0A&t=2678',
    )
  })

  it('omits t when the session offset is unknown', () => {
    expect(buildSpeechExcerptYoutubeUrl('lLhRDkSPw0A', null, 43)).toBe(
      'https://www.youtube.com/watch?v=lLhRDkSPw0A',
    )
  })

  it('never goes negative', () => {
    expect(buildSpeechExcerptYoutubeUrl('id', 10, -30)).toBe(
      'https://www.youtube.com/watch?v=id&t=10',
    )
  })
})

describe('buildSpeechExcerptMessage', () => {
  it('carries the interval and the link, since YouTube cannot encode the end', () => {
    expect(
      buildSpeechExcerptMessage({
        speechType: 'BREVES COMUNICAÇÕES',
        dateLabel: '11/08/2026',
        startSeconds: 43,
        endSeconds: 130,
        url: 'https://www.youtube.com/watch?v=id&t=2634',
      }),
    ).toBe(
      'Trecho de BREVES COMUNICAÇÕES (11/08/2026): de 00:43 a 02:10 https://www.youtube.com/watch?v=id&t=2634',
    )
  })

  it('falls back to "fala" when the speech has no type', () => {
    const message = buildSpeechExcerptMessage({
      speechType: '   ',
      dateLabel: '11/08/2026',
      startSeconds: 0,
      endSeconds: 65,
      url: 'https://www.youtube.com/watch?v=id',
    })
    expect(message).toBe(
      'Trecho de fala (11/08/2026): de 00:00 a 01:05 https://www.youtube.com/watch?v=id',
    )
  })

  it('keeps the hour in the clock when the speech is long', () => {
    const message = buildSpeechExcerptMessage({
      speechType: null,
      dateLabel: '11/08/2026',
      startSeconds: 3723,
      endSeconds: 3843,
      url: 'https://www.youtube.com/watch?v=id',
    })
    expect(message).toContain('de 1:02:03 a 1:04:03')
  })
})

describe('buildSpeechExcerptShare', () => {
  const input = {
    videoId: 'lLhRDkSPw0A',
    offsetSeconds: 2634,
    startSeconds: 43,
    endSeconds: 130,
    speechType: 'BREVES COMUNICAÇÕES',
    dateLabel: '11/08/2026',
  } as const

  it('bundles the positioned URL and the message with the interval', () => {
    const share = buildSpeechExcerptShare(input)
    expect(share.url).toBe('https://www.youtube.com/watch?v=lLhRDkSPw0A&t=2677')
    expect(share.message).toBe(
      'Trecho de BREVES COMUNICAÇÕES (11/08/2026): de 00:43 a 02:10 https://www.youtube.com/watch?v=lLhRDkSPw0A&t=2677',
    )
  })

  it('reuses the recipient-less wa.me builder with the exact message', () => {
    const share = buildSpeechExcerptShare(input)
    expect(share.whatsAppUrl.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeWaText(share.whatsAppUrl)).toBe(share.message)
  })

  it('shares a link without t when the session offset is unknown', () => {
    const share = buildSpeechExcerptShare({ ...input, offsetSeconds: null })
    expect(share.url).toBe('https://www.youtube.com/watch?v=lLhRDkSPw0A')
    expect(share.message).toContain('https://www.youtube.com/watch?v=lLhRDkSPw0A')
    expect(share.message).not.toContain('&t=')
  })
})
