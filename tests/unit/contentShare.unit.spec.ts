import { describe, expect, it } from 'vitest'

import {
  buildContentShareLink,
  buildContentShareMessage,
  buildContentShareWhatsAppUrl,
  CONTENT_SHARE_PREFIXES,
  type ContentShareKind,
} from '@/lib/contentShare'

describe('buildContentShareMessage', () => {
  it('uses the article opener for articles', () => {
    expect(buildContentShareMessage('article', 'Título do artigo', 'https://site.com/artigo')).toBe(
      'Olha isso do Solla: Título do artigo — https://site.com/artigo',
    )
  })

  it('uses the video opener for YouTube cards', () => {
    expect(
      buildContentShareMessage('video', 'Título do vídeo', 'https://www.youtube.com/watch?v=abc'),
    ).toBe('Olha esse vídeo do Solla: Título do vídeo — https://www.youtube.com/watch?v=abc')
  })

  it('uses the post opener for Instagram cards', () => {
    expect(
      buildContentShareMessage('instagram', 'Legenda do post', 'https://www.instagram.com/p/xyz/'),
    ).toBe('Olha esse post do Solla: Legenda do post — https://www.instagram.com/p/xyz/')
  })

  it('keeps one opener per kind, matching the locked product decision', () => {
    expect(CONTENT_SHARE_PREFIXES).toEqual({
      article: 'Olha isso do Solla: ',
      video: 'Olha esse vídeo do Solla: ',
      instagram: 'Olha esse post do Solla: ',
    })
  })
})

describe('buildContentShareLink', () => {
  it('resolves a relative article path against the origin', () => {
    expect(
      buildContentShareLink('/noticia/saude/sus-pela-vida', 'https://jorgesolla1313.com.br'),
    ).toBe('https://jorgesolla1313.com.br/noticia/saude/sus-pela-vida')
  })

  it('passes absolute platform URLs through unchanged', () => {
    const videoUrl = 'https://www.youtube.com/watch?v=abc123'
    expect(buildContentShareLink(videoUrl, 'https://jorgesolla1313.com.br')).toBe(videoUrl)
    const postUrl = 'https://www.instagram.com/p/xyz/'
    expect(buildContentShareLink(postUrl, 'https://jorgesolla1313.com.br')).toBe(postUrl)
  })

  it('resolves a trailing-slash origin without double slashes', () => {
    expect(buildContentShareLink('/artigo', 'https://site.com/')).toBe('https://site.com/artigo')
  })

  it('fails soft on a malformed href instead of throwing', () => {
    const broken = 'https://[malformed'
    expect(buildContentShareLink(broken, 'https://site.com')).toBe(broken)
  })
})

/** Decode the `text` query param exactly as a URLSearchParams consumer would — `+` is space. */
const decodeWaText = (url: string): string =>
  decodeURIComponent(url.slice('https://wa.me/?text='.length)).replace(/\+/g, ' ')

describe('buildContentShareWhatsAppUrl', () => {
  it('builds wa.me with the encoded pre-configured message', () => {
    const url = buildContentShareWhatsAppUrl(
      'article',
      'Título',
      'https://site.com/noticia/saude/um',
    )
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeWaText(url)).toBe('Olha isso do Solla: Título — https://site.com/noticia/saude/um')
  })

  it('encodes accents, spaces and the em dash', () => {
    const url = buildContentShareWhatsAppUrl(
      'video',
      'Ação em Salvador',
      'https://site.com/video?x=1&y=2',
    )
    expect(url).not.toMatch(/[áàãéêç—& ]/)
    expect(decodeWaText(url)).toBe(
      'Olha esse vídeo do Solla: Ação em Salvador — https://site.com/video?x=1&y=2',
    )
  })

  it('keeps every kind producing the same wa.me shape', () => {
    const kinds: ContentShareKind[] = ['article', 'video', 'instagram']
    for (const kind of kinds) {
      expect(buildContentShareWhatsAppUrl(kind, 'T', 'https://site.com/x')).toMatch(
        /^https:\/\/wa\.me\/\?text=/,
      )
    }
  })
})
