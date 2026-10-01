import { describe, expect, it } from 'vitest'

import { formatBahiaEventDayLabel, formatBahiaEventTimeLabel } from '@/lib/campaignTime'
import {
  buildShareLinkHomeSectionView,
  resolveShareLinkLiveActionLabel,
  SHARE_LINK_HOME_SECTION_SLUG,
} from '@/lib/shareLinkHomeSection'

const STARTS_AT = '2026-10-02T21:00:00.000Z'
const ENDS_AT = '2026-10-03T00:00:00.000Z'
const BEFORE_END = Date.parse('2026-10-02T22:00:00.000Z')

const baseLink = {
  slug: SHARE_LINK_HOME_SECTION_SLUG,
  title: 'Plenária da Vitória',
  description: 'O time de Jorge Solla se encontra antes da vitória.',
  startsAt: STARTS_AT,
  location: 'Online',
  destinations: [
    { label: 'Google Meet', url: 'https://meet.google.com/fyz-rurx-biv' },
    { label: 'Youtube', url: 'https://www.youtube.com/live/77bUgl7cvQ8' },
  ],
}

describe('buildShareLinkHomeSectionView (S44)', () => {
  it('builds the serializable view while the event window is open', () => {
    const view = buildShareLinkHomeSectionView({
      link: { ...baseLink, image: { alt: 'Plenária da Vitória 1313' } },
      imageUrl: '/api/media/file/plenaria.jpg',
      canonicalUrl: 'https://jorgesolla1313.com.br/plenaria-vitoria',
      nowMs: BEFORE_END,
    })

    expect(view).toEqual({
      slug: 'plenaria-vitoria',
      title: 'Plenária da Vitória',
      description: 'O time de Jorge Solla se encontra antes da vitória.',
      imageUrl: '/api/media/file/plenaria.jpg',
      imageAlt: 'Plenária da Vitória 1313',
      eventLabel: 'Sexta-feira, 2 de outubro · 18h',
      location: 'Online',
      startsAt: STARTS_AT,
      endsAt: null,
      canonicalUrl: 'https://jorgesolla1313.com.br/plenaria-vitoria',
      expiresAt: Date.parse('2026-10-02T23:00:00.000Z'),
      youtubeVideoId: '77bUgl7cvQ8',
    })
  })

  it('honors a configured end and drops the section at the exact close', () => {
    const view = buildShareLinkHomeSectionView({
      link: { ...baseLink, endsAt: ENDS_AT },
      imageUrl: null,
      canonicalUrl: null,
      nowMs: Date.parse(ENDS_AT) - 1,
    })
    expect(view?.expiresAt).toBe(Date.parse(ENDS_AT))

    expect(
      buildShareLinkHomeSectionView({
        link: { ...baseLink, endsAt: ENDS_AT },
        imageUrl: null,
        canonicalUrl: null,
        nowMs: Date.parse(ENDS_AT),
      }),
    ).toBeNull()
  })

  it('fails closed without a valid event window', () => {
    const args = { imageUrl: null, canonicalUrl: null, nowMs: BEFORE_END }
    expect(
      buildShareLinkHomeSectionView({ ...args, link: { ...baseLink, startsAt: null } }),
    ).toBeNull()
    expect(
      buildShareLinkHomeSectionView({ ...args, link: { ...baseLink, startsAt: 'lixo' } }),
    ).toBeNull()
    expect(
      buildShareLinkHomeSectionView({
        ...args,
        link: { ...baseLink, startsAt: '2026-09-30T21:00:00.000Z' },
      }),
    ).toBeNull()
  })

  it('renders without the player when there is no YouTube destination', () => {
    const view = buildShareLinkHomeSectionView({
      link: { ...baseLink, destinations: [{ label: 'Meet', url: 'https://meet.google.com/x' }] },
      imageUrl: null,
      canonicalUrl: null,
      nowMs: BEFORE_END,
    })
    expect(view?.youtubeVideoId).toBeNull()
  })
})

describe('resolveShareLinkLiveActionLabel (S44)', () => {
  it.each([
    ['https://meet.google.com/fyz-rurx-biv', 'Entrar na plenária'],
    ['https://www.youtube.com/live/77bUgl7cvQ8', 'Assistir no YouTube'],
    ['https://youtu.be/77bUgl7cvQ8', 'Assistir no YouTube'],
    ['https://zoom.us/j/123', 'Entrar'],
    ['javascript:alert(1)', 'Entrar'],
  ])('labels %s', (href, label) => {
    expect(resolveShareLinkLiveActionLabel({ href, label: 'Destino' })).toBe(label)
  })
})

describe('Bahia event labels (S44)', () => {
  it('splits the day and the time for the home meta row', () => {
    expect(formatBahiaEventDayLabel(STARTS_AT)).toBe('sexta-feira, 2 de outubro')
    expect(formatBahiaEventTimeLabel(STARTS_AT)).toBe('18h')
    expect(formatBahiaEventTimeLabel('2026-10-02T21:30:00.000Z')).toBe('18h30')
  })

  it('returns an empty string for an unparsable instant', () => {
    expect(formatBahiaEventDayLabel('lixo')).toBe('')
    expect(formatBahiaEventTimeLabel('lixo')).toBe('')
  })
})
