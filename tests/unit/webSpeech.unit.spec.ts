import { describe, expect, it } from 'vitest'

import {
  canonicalWebSpeechUrl,
  parseWebSpeechBatch,
  parseWebSpeechFinding,
  webSpeechAtFromPublishedAt,
  webSpeechDownloadFilename,
  webSpeechPlatformLabel,
  webSpeechSourceKey,
} from '@/lib/webSpeech'

// C215 — the pure web-speech contract: identity (sourceKey), canonical URL and
// the finding-batch validation that fails one entry without killing the batch.

describe('canonicalWebSpeechUrl', () => {
  it('collapses every YouTube shape to the watch URL', () => {
    expect(canonicalWebSpeechUrl('youtube', 'https://youtu.be/dQw4w9WgXcQ?si=track')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )
    expect(
      canonicalWebSpeechUrl('youtube', 'https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share'),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(
      canonicalWebSpeechUrl('youtube', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'),
    ).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(canonicalWebSpeechUrl('youtube', 'https://www.youtube.com/live/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )
  })

  it('collapses Instagram post shapes and normalizes reels', () => {
    expect(
      canonicalWebSpeechUrl('instagram', 'https://www.instagram.com/reels/ABC123/?igsh=xyz'),
    ).toBe('https://www.instagram.com/reel/ABC123/')
    expect(canonicalWebSpeechUrl('instagram', 'https://instagram.com/p/ABC123')).toBe(
      'https://www.instagram.com/p/ABC123/',
    )
  })

  it('drops tracking params, the fragment and the trailing slash for direct audio', () => {
    expect(
      canonicalWebSpeechUrl(
        'radio',
        'https://RadioBahia.com.br/audio/entrevista.mp3/?utm_source=share&id=7#t=1',
      ),
    ).toBe('https://radiobahia.com.br/audio/entrevista.mp3?id=7')
  })

  it('keeps an unparseable URL trimmed instead of inventing one', () => {
    expect(canonicalWebSpeechUrl('audio', '  nao-e-url  ')).toBe('nao-e-url')
  })
})

describe('webSpeechSourceKey', () => {
  it('prefers the external id and falls back to the canonical URL', () => {
    expect(
      webSpeechSourceKey({
        platform: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        externalId: 'dQw4w9WgXcQ',
      }),
    ).toBe('web:youtube:dQw4w9WgXcQ')
    expect(
      webSpeechSourceKey({ platform: 'audio', url: 'https://radio.example/a.mp3?utm_source=x' }),
    ).toBe('web:audio:https://radio.example/a.mp3')
  })

  it('is stable across YouTube URL shapes (same identity, no duplicate row)', () => {
    const short = webSpeechSourceKey({ platform: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' })
    const long = webSpeechSourceKey({
      platform: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90',
    })
    expect(short).toBe(long)
    expect(short).toBe('web:youtube:https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})

describe('webSpeechAtFromPublishedAt', () => {
  it('normalizes date-only and converts an explicit timezone to Brasília', () => {
    expect(webSpeechAtFromPublishedAt('2026-09-20')).toBe('2026-09-20T00:00')
    // 14:35Z is 11:35 in America/Bahia (UTC-3, no DST).
    expect(webSpeechAtFromPublishedAt('2026-09-20T14:35:00Z')).toBe('2026-09-20T11:35')
    expect(webSpeechAtFromPublishedAt('2026-09-20T14:35:00-03:00')).toBe('2026-09-20T14:35')
    expect(webSpeechAtFromPublishedAt('2026-09-20 14:35')).toBe('2026-09-20T14:35')
  })

  it('returns null for an unrecognized or impossible date', () => {
    expect(webSpeechAtFromPublishedAt('20/09/2026')).toBeNull()
    expect(webSpeechAtFromPublishedAt('2026-09-20lixo')).toBeNull()
    expect(webSpeechAtFromPublishedAt('2026-99-99')).toBeNull()
    expect(webSpeechAtFromPublishedAt('2026-09-20T25:00')).toBeNull()
  })
})

describe('parseWebSpeechFinding', () => {
  const validYoutube = {
    platform: 'youtube',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    publishedAt: '2026-09-20',
  }

  it('accepts a YouTube finding without mediaUrl', () => {
    const parsed = parseWebSpeechFinding(validYoutube)
    expect(parsed.ok).toBe(true)
  })

  it('requires mediaUrl for radio/audio and publishedAt everywhere', () => {
    const radio = parseWebSpeechFinding({ ...validYoutube, platform: 'radio' })
    expect(radio.ok).toBe(false)
    if (!radio.ok) expect(radio.error).toContain('mediaUrl')

    const noDate = parseWebSpeechFinding({ ...validYoutube, publishedAt: undefined })
    expect(noDate.ok).toBe(false)

    const badDate = parseWebSpeechFinding({ ...validYoutube, publishedAt: 'ontem' })
    expect(badDate.ok).toBe(false)
  })

  it('rejects an unknown platform and a non-URL', () => {
    expect(parseWebSpeechFinding({ ...validYoutube, platform: 'tiktok' }).ok).toBe(false)
    expect(parseWebSpeechFinding({ ...validYoutube, url: 'nada' }).ok).toBe(false)
  })
})

describe('parseWebSpeechBatch', () => {
  it('validates only the envelope and keeps the findings raw', () => {
    const parsed = parseWebSpeechBatch({ generatedAt: '2026-09-24T10:00:00Z', findings: [{}] })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.batch.generatedAt).toBe('2026-09-24T10:00:00Z')
      expect(parsed.batch.findings).toEqual([{}])
    }
  })

  it('fails closed on a malformed envelope', () => {
    expect(parseWebSpeechBatch({}).ok).toBe(false)
    expect(parseWebSpeechBatch({ findings: 'nope' }).ok).toBe(false)
  })
})

describe('webSpeechPlatformLabel', () => {
  it('owns the pt-BR labels the acervo shows', () => {
    expect(webSpeechPlatformLabel('youtube')).toBe('YouTube')
    expect(webSpeechPlatformLabel('radio')).toBe('Rádio')
  })

  // C216 — the pill of a row without a known platform is honest, not blank.
  it('falls back for a missing or unknown platform (C216)', () => {
    expect(webSpeechPlatformLabel(null)).toBe('Outra plataforma')
    expect(webSpeechPlatformLabel(undefined)).toBe('Outra plataforma')
  })
})

// C216 (closes the C215 S4 defer) — the download name of the mirrored file.
describe('webSpeechDownloadFilename', () => {
  it('keeps the stored extension and the title in the download name', () => {
    expect(
      webSpeechDownloadFilename({
        title: 'Entrevista sobre a saúde pública',
        storedFilename: 'source.mp4',
      }),
    ).toBe('Entrevista sobre a saúde pública.mp4')
  })

  it('strips control characters and path separators', () => {
    expect(
      webSpeechDownloadFilename({
        title: 'Fala "sobre"\n o SUS/educação',
        storedFilename: 'source.mp3',
      }),
    ).toBe('Fala sobre o SUS educação.mp3')
  })

  it('caps the length and never leaves a trailing dot', () => {
    const filename = webSpeechDownloadFilename({
      title: `${'a'.repeat(300)}.`,
      storedFilename: 'source.mp4',
    })
    expect(filename).not.toBeNull()
    expect(filename?.endsWith('.mp4')).toBe(true)
    expect(filename?.length).toBeLessThanOrEqual(120)
  })

  it('falls back to the stored filename when the title leaves nothing readable', () => {
    expect(webSpeechDownloadFilename({ title: '   ', storedFilename: 'source.mp3' })).toBeNull()
    expect(webSpeechDownloadFilename({ title: 'Fala', storedFilename: null })).toBeNull()
  })
})
