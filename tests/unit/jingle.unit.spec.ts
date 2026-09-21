import { describe, expect, it } from 'vitest'

import { jingleDownloadFilename, splitJingleTitle, toJingleViewModel } from '@/lib/jingle'

describe('jingleDownloadFilename', () => {
  it.each([
    ['axe', 'Jorge Solla 1313 - Axé.mp3', 'jorge-solla-1313-axe.mp3'],
    ['forro', 'JORGE SOLLA 1313 - FORRO.MP3', 'jorge-solla-1313-forro.mp3'],
    ['Pagodão', 'Jorge Solla 1313 - Pagodão.wav', 'jorge-solla-1313-pagodao.wav'],
    ['axe-2026', 'audio.mp3', 'jorge-solla-1313-axe-2026.mp3'],
  ])('derives %s → %s', (slug, filename, expected) => {
    expect(jingleDownloadFilename(slug, filename)).toBe(expected)
  })

  it('falls back to the generic base when the slug normalizes to nothing', () => {
    expect(jingleDownloadFilename('---', 'audio.mp3')).toBe('jorge-solla-1313-jingle.mp3')
    expect(jingleDownloadFilename(null, null)).toBe('jorge-solla-1313-jingle.mp3')
  })

  it('falls back to mp3 when the stored filename has no usable extension', () => {
    expect(jingleDownloadFilename('axe', 'Jorge Solla 1313 - Axé')).toBe('jorge-solla-1313-axe.mp3')
    expect(jingleDownloadFilename('axe', 'audio.')).toBe('jorge-solla-1313-axe.mp3')
    expect(jingleDownloadFilename('axe', 'audio')).toBe('jorge-solla-1313-axe.mp3')
  })
})

describe('splitJingleTitle', () => {
  it.each([
    ['Jorge Solla 1313 (feat. Felipe Forrozeiro)', 'Jorge Solla 1313', 'feat. Felipe Forrozeiro'],
    ['Jorge Solla 1313 (feat. Nagib Barroso)', 'Jorge Solla 1313', 'feat. Nagib Barroso'],
    ['Jorge Solla 1313 (feat. É O MT)', 'Jorge Solla 1313', 'feat. É O MT'],
    ['Jorge Solla 1313 (FEAT. É O MT)', 'Jorge Solla 1313', 'feat. É O MT'],
    ['Jorge Solla 1313 ( feat.  É O MT )', 'Jorge Solla 1313', 'feat. É O MT'],
    ['Jorge Solla 1313 (feat. Felipe Forrozeiro) ', 'Jorge Solla 1313', 'feat. Felipe Forrozeiro'],
    ['Jorge Solla 1313 (feat. A) (feat. B)', 'Jorge Solla 1313 (feat. A)', 'feat. B'],
  ])('splits %s', (title, base, credit) => {
    expect(splitJingleTitle(title)).toEqual({ base, credit })
  })

  it.each([
    'Axé',
    'Forró',
    'Jorge Solla 1313 (ao vivo)',
    'Jorge Solla 1313 (feat. )',
    '(feat. Felipe Forrozeiro)',
    'Jorge Solla 1313 (feat. X) ao vivo',
  ])('keeps %s verbatim without a credit line', (title) => {
    expect(splitJingleTitle(title)).toEqual({ base: title, credit: null })
  })
})

describe('toJingleViewModel', () => {
  const jingle = { id: 7, title: 'Axé', slug: 'axe' }

  it('fails closed without a readable cover or audio', () => {
    expect(toJingleViewModel({ jingle, cover: null, audio: { url: '/a.mp3' } })).toBeNull()
    expect(toJingleViewModel({ jingle, cover: { url: '/c.jpg' }, audio: null })).toBeNull()
    expect(toJingleViewModel({ jingle, cover: { url: null }, audio: { url: '/a.mp3' } })).toBeNull()
  })

  it('maps the card and derives the download name', () => {
    expect(
      toJingleViewModel({
        jingle,
        cover: { url: '/capa.jpg', alt: 'Capa oficial' },
        audio: { url: '/axe.mp3', filename: 'Jorge Solla 1313 - Axé.mp3' },
      }),
    ).toEqual({
      id: 7,
      title: 'Axé',
      coverUrl: '/capa.jpg',
      coverAlt: 'Capa oficial',
      audioUrl: '/axe.mp3',
      downloadFilename: 'jorge-solla-1313-axe.mp3',
    })
  })

  it('falls back to a readable cover alt', () => {
    expect(
      toJingleViewModel({
        jingle,
        cover: { url: '/capa.jpg', alt: '   ' },
        audio: { url: '/axe.mp3' },
      })?.coverAlt,
    ).toBe('Capa do jingle Axé de Jorge Solla 1313')
  })
})
