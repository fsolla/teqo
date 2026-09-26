// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { speechPosterHref } from '@/lib/speechPoster'
import {
  toSpeechListItemViewModel,
  toWebSpeechDetailViewModel,
  toWebSpeechListItemViewModel,
  type SpeechListRecord,
  type WebSpeechDetailRecord,
  type WebSpeechListRecord,
} from '@/utilities/speech/speechViewModels'

const viewModel = (overrides: Partial<SpeechListRecord> = {}) =>
  toSpeechListItemViewModel({
    speech: { id: 1, speechAt: '2026-08-11T18:48', ...overrides },
    segments: [],
    municipalityLabels: new Map(),
  })

describe('toSpeechListItemViewModel thumbnail (C175)', () => {
  it('carries the YouTube cover when the session link parses', () => {
    const row = viewModel({ youtubeUrl: 'https://www.youtube.com/watch?v=lLhRDkSPw0A' })

    expect(row.thumbnailUrl).toBe('https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg')
  })

  it('has no thumbnail without a YouTube link', () => {
    expect(viewModel().thumbnailUrl).toBeNull()
    expect(viewModel({ youtubeUrl: null }).thumbnailUrl).toBeNull()
    expect(viewModel({ youtubeUrl: 'https://camara.leg.br/discurso' }).thumbnailUrl).toBeNull()
  })

  it('keeps the source link independent from the thumbnail', () => {
    const row = viewModel({
      youtubeUrl: 'https://youtu.be/lLhRDkSPw0A',
      officialTextUrl: 'https://camara.leg.br/discurso',
    })

    expect(row.thumbnailUrl).toBe('https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg')
    expect(row.officialTextUrl).toBe('https://camara.leg.br/discurso')
  })

  it('has no source link without the official text, never the YouTube fallback (C177)', () => {
    expect(viewModel().officialTextUrl).toBeNull()
    expect(viewModel({ youtubeUrl: 'https://youtu.be/lLhRDkSPw0A' }).officialTextUrl).toBeNull()
    expect(viewModel({ officialTextUrl: 'https://camara.leg.br/discurso' }).officialTextUrl).toBe(
      'https://camara.leg.br/discurso',
    )
  })
})

describe('toSpeechListItemViewModel thumbnail (C182 — frame of the speech)', () => {
  const coordinates = { eventId: 67091, audioId: 558641, excerptTMs: 1675801808560 }
  const cover = 'https://i.ytimg.com/vi/lLhRDkSPw0A/hqdefault.jpg'
  const youtubeUrl = 'https://www.youtube.com/watch?v=lLhRDkSPw0A'

  it('prefers the frame route over the session cover when the Câmara can resolve the excerpt', () => {
    const row = viewModel({ id: 42, durationSeconds: 252, ...coordinates, youtubeUrl })

    expect(row.thumbnailUrl).toBe(speechPosterHref(42))
  })

  it('falls back to the session cover without coordinates or without a duration', () => {
    expect(viewModel({ durationSeconds: 252, youtubeUrl }).thumbnailUrl).toBe(cover)
    expect(viewModel({ durationSeconds: 0, ...coordinates, youtubeUrl }).thumbnailUrl).toBe(cover)
    expect(viewModel({ durationSeconds: 252, eventId: 67091 }).thumbnailUrl).toBeNull()
  })
})

describe('toSpeechListItemViewModel semantic evidence (C229)', () => {
  const segment = (text: string, startSeconds = 0) => ({
    startSeconds,
    endSeconds: startSeconds + 3,
    text,
  })
  const semanticRow = ({
    text,
    query,
    evidence,
    keywords = [],
    searchText,
  }: {
    text: string
    query?: string
    evidence?: { text: string; startSeconds: number | null } | null
    keywords?: string[]
    searchText?: string
  }) =>
    toSpeechListItemViewModel({
      speech: { id: 1, speechAt: '2026-08-11T18:48', keywords, searchText },
      segments: [segment(text)],
      query,
      municipalityLabels: new Map(),
      semanticMatch: Boolean(evidence),
      semanticEvidence: evidence,
    })

  it('shows the semantic passage with no highlight when no term matches', () => {
    const row = semanticRow({
      text: 'Uma fala sobre outro assunto',
      query: 'combate à oposição',
      evidence: { text: 'O embate com a oposição e o bolsonarismo', startSeconds: 42 },
    })

    expect(row.matchKind).toBe('theme')
    expect(row.semanticMatch).toBe(true)
    expect(row.matchedTextSearch).toBe(false)
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(false)
    expect(row.excerpt.parts.map((part) => part.text).join('')).toContain('bolsonarismo')
    expect(row.watchHref).toBe(
      '/campanha/comunicacao/acervo/1?t=42&q=combate+%C3%A0+oposi%C3%A7%C3%A3o',
    )
  })

  it('keeps the literal match flag when the speech also contains the query', () => {
    const row = semanticRow({
      text: 'A defesa do SUS e da saúde pública baiana',
      searchText: 'a defesa do sus e da saude publica baiana',
      query: 'SUS',
      evidence: { text: 'A defesa do SUS', startSeconds: 0 },
    })

    expect(row.semanticMatch).toBe(true)
    expect(row.matchedTextSearch).toBe(true)
    // The evidence never highlights the term: the engine did not match it.
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(false)
  })

  it('stays literal without semantic evidence', () => {
    const row = semanticRow({
      text: 'A defesa do SUS',
      searchText: 'a defesa do sus',
      query: 'SUS',
    })

    expect(row.semanticMatch).toBe(false)
    expect(row.matchKind).toBe('segment')
    expect(row.matchedTextSearch).toBe(true)
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(true)
  })

  it('seeks the evidence start when known and omits the seek without one', () => {
    const window = semanticRow({
      text: 'Outra fala',
      query: 'tema',
      evidence: { text: 'Trecho de janela', startSeconds: null },
    })
    expect(window.watchHref).toBe('/campanha/comunicacao/acervo/1?q=tema')
  })

  it('flags a degraded literal row without claiming the theme', () => {
    const row = toSpeechListItemViewModel({
      speech: { id: 1, speechAt: '2026-08-11T18:48', searchText: 'a defesa do sus' },
      segments: [segment('A defesa do SUS')],
      query: 'SUS',
      municipalityLabels: new Map(),
      literalFallback: true,
    })

    expect(row.literalFallback).toBe(true)
    expect(row.semanticMatch).toBe(false)
    expect(row.matchKind).toBe('segment')
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(true)
  })
})

// C216 — the web speeches view models: platform label, day-only date, the
// private cover href, the media kind of the detail and the origin attribution.
describe('web speech view models (C216)', () => {
  const webListRow = (overrides: Partial<WebSpeechListRecord> = {}) =>
    toWebSpeechListItemViewModel({
      speech: {
        id: 7,
        speechAt: '2026-09-20T00:00',
        title: 'Entrevista na rádio',
        platform: 'radio',
        durationSeconds: 90,
        topics: ['saude'],
        scopes: ['bahia'],
        ...overrides,
      },
      segments: [],
      query: undefined,
    })

  it('labels the platform and the day-only publication date', () => {
    const row = webListRow()
    expect(row.platform).toEqual({ value: 'radio', label: 'Rádio' })
    expect(row.dateLabel).toBe('20/09/2026')
    expect(row.durationLabel).toBe('1min30s')
    expect(row.title).toBe('Entrevista na rádio')
  })

  it('falls back for a row without a platform or title', () => {
    const row = webListRow({ platform: null, title: '  ' })
    expect(row.platform).toEqual({ value: null, label: 'Outra plataforma' })
    expect(row.title).toBe('Fala da internet #7')
  })

  it('links the private cover only when the ingestion captured a thumbnail', () => {
    expect(webListRow().thumbnailUrl).toBeNull()
    expect(webListRow({ thumbnail: 12 }).thumbnailUrl).toBe(
      '/campanha/comunicacao/acervo/internet/7/capa',
    )
    expect(webListRow({ thumbnail: { id: 12 } }).thumbnailUrl).toBe(
      '/campanha/comunicacao/acervo/internet/7/capa',
    )
  })

  it('builds the detail href with the segment seek and keeps the query', () => {
    expect(webListRow().watchHref).toBe('/campanha/comunicacao/acervo/internet/7')

    const row = toWebSpeechListItemViewModel({
      speech: { id: 7, speechAt: '2026-09-20T00:00', title: 'Fala' },
      segments: [{ startSeconds: 12.7, endSeconds: 15, text: 'A saúde pública importa' }],
      query: 'saúde',
    })
    expect(row.watchHref).toBe('/campanha/comunicacao/acervo/internet/7?t=12&q=sa%C3%BAde')
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(true)
  })

  it('picks the native control from the stored mime type', () => {
    const detail = (mirroredMedia: WebSpeechDetailRecord['mirroredMedia']) =>
      toWebSpeechDetailViewModel({
        speech: {
          id: 7,
          speechAt: '2026-09-20T00:00',
          title: 'Entrevista na rádio',
          platform: 'radio',
          channel: 'Rádio Metrópole',
          sourceUrl: 'https://radio.example/entrevista',
          durationSeconds: 87,
          mirroredMedia,
        },
        segments: [{ startSeconds: 0, endSeconds: 4, text: 'A saúde pública' }],
      })

    const audio = detail({ id: 12, mimeType: 'audio/mpeg', filename: 'source.mp3' })
    expect(audio.mediaKind).toBe('audio')
    expect(audio.fileHref).toBe('/campanha/comunicacao/acervo/internet/7/arquivo')
    expect(audio.downloadHref).toBe('/campanha/comunicacao/acervo/internet/7/arquivo?download=1')
    expect(audio.channel).toBe('Rádio Metrópole')
    expect(audio.sourceUrl).toBe('https://radio.example/entrevista')
    expect(audio.dateLabel).toBe('20/09/2026')
    expect(audio.durationSeconds).toBe(87)
    expect(audio.durationLabel).toBe('1min27s')
    expect(audio.segments[0]?.startLabel).toBe('00:00')

    const video = detail({ id: 12, mimeType: 'video/mp4', filename: 'source.mp4' })
    expect(video.mediaKind).toBe('video')

    const missing = detail(null)
    expect(missing.mediaKind).toBe('video')
    expect(missing.fileHref).toBeNull()
    expect(missing.downloadHref).toBeNull()
  })
})
