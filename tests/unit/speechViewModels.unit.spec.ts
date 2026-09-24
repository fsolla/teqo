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

describe('toSpeechListItemViewModel theme match (C192)', () => {
  const segment = (text: string) => ({ startSeconds: 0, endSeconds: 3, text })
  const themeRow = ({
    text,
    query,
    themeTerms,
    keywords = [],
    searchText,
  }: {
    text: string
    query?: string
    themeTerms: string[]
    keywords?: string[]
    searchText?: string
  }) =>
    toSpeechListItemViewModel({
      speech: { id: 1, speechAt: '2026-08-11T18:48', keywords, searchText },
      segments: [segment(text)],
      query,
      municipalityLabels: new Map(),
      themeTerms,
    })

  it('surfaces the theme passage with the expanded term highlighted', () => {
    const row = themeRow({
      text: 'Defendemos o atendimento público e acesso universal à saúde',
      searchText: 'defendemos o atendimento publico e acesso universal a saude',
      query: 'defesa do SUS',
      themeTerms: ['acesso universal'],
    })

    expect(row.matchKind).toBe('theme')
    expect(row.themeMatchTerm).toBe('acesso universal')
    expect(row.matchedTextSearch).toBe(false)
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(true)
  })

  it('keeps the theme term when the speech also matches the literal query', () => {
    const row = themeRow({
      text: 'A defesa do SUS e da saúde pública baiana',
      searchText: 'a defesa do sus e da saude publica baiana',
      query: 'SUS',
      themeTerms: ['saúde pública'],
    })

    expect(row.matchKind).toBe('segment')
    expect(row.themeMatchTerm).toBe('saúde pública')
    expect(row.matchedTextSearch).toBe(true)
  })

  it('matches a keyword as theme evidence and uses it as the excerpt', () => {
    const row = themeRow({
      text: 'Uma fala sobre outro assunto',
      query: 'defesa do SUS',
      themeTerms: ['Farmácia Popular'],
      keywords: ['Farmácia Popular'],
    })

    expect(row.matchKind).toBe('theme')
    expect(row.themeMatchTerm).toBe('Farmácia Popular')
    const excerptText = row.excerpt.parts.map((part) => part.text).join('')
    expect(excerptText).toContain('Farmácia Popular')
    expect(row.excerpt.parts.some((part) => part.highlighted)).toBe(true)
  })

  it('does not claim a theme the where never used (word-only coincidence)', () => {
    const row = themeRow({
      text: 'O atendimento público é prioridade',
      searchText: 'o atendimento publico e prioridade',
      query: 'defesa do SUS',
      themeTerms: ['atendimento universal'],
    })

    expect(row.themeMatchTerm).toBeNull()
    expect(row.matchKind).toBe('fallback')
  })

  it('stays literal without theme terms or when none matches', () => {
    expect(
      themeRow({ text: 'A defesa do SUS', query: 'SUS', themeTerms: [] }).themeMatchTerm,
    ).toBeNull()
    expect(
      themeRow({ text: 'A defesa do SUS', query: 'SUS', themeTerms: ['educação'] }).themeMatchTerm,
    ).toBeNull()
  })

  it('never claims a theme term the where mirror did not match (C192)', () => {
    // "saúde pública" never appears contiguously in the search text, so the
    // mirror rejects it and only the term that really matched is claimed.
    expect(
      themeRow({
        text: 'Saúde para todos e a rede pública de atendimento',
        searchText: 'saude para todos e a rede publica de atendimento',
        query: 'defesa do SUS',
        themeTerms: ['saúde pública', 'atendimento'],
      }).themeMatchTerm,
    ).toBe('atendimento')
  })

  it('falls back to keywords as theme evidence when the text does not match', () => {
    const row = themeRow({
      text: 'Uma fala sobre outro assunto',
      query: 'defesa do SUS',
      themeTerms: ['Farmácia Popular'],
      keywords: ['Farmácia Popular'],
    })

    expect(row.themeMatchTerm).toBe('Farmácia Popular')
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
      themeTerms: [],
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
    expect(audio.segments[0]?.startLabel).toBe('00:00')

    const video = detail({ id: 12, mimeType: 'video/mp4', filename: 'source.mp4' })
    expect(video.mediaKind).toBe('video')

    const missing = detail(null)
    expect(missing.mediaKind).toBe('video')
    expect(missing.fileHref).toBeNull()
    expect(missing.downloadHref).toBeNull()
  })
})
