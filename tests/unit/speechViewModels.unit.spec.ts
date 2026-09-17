// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { speechPosterHref } from '@/lib/speechPoster'
import {
  toSpeechListItemViewModel,
  type SpeechListRecord,
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
