// @vitest-environment node

import { describe, expect, it } from 'vitest'

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
    expect(row.sourceUrl).toBe('https://camara.leg.br/discurso')
  })
})
