import { describe, expect, it } from 'vitest'

import { buildShareLinkAnnouncementView } from '@/lib/shareLinkAnnouncement'

describe('buildShareLinkAnnouncementView', () => {
  it('formats the Bahia event label and trims the location', () => {
    const view = buildShareLinkAnnouncementView({
      link: {
        slug: 'plenaria-saude',
        title: 'Plenária da saúde',
        description: 'Encontro online da campanha.',
        startsAt: '2026-10-03T22:00:00.000Z',
        endsAt: '2026-10-04T00:00:00.000Z',
        location: '  Online  ',
      },
      imageUrl: '/api/media/file/plenaria.jpg',
      canonicalUrl: 'https://jorgesolla1313.com.br/plenaria-saude',
    })

    expect(view).toEqual({
      slug: 'plenaria-saude',
      title: 'Plenária da saúde',
      description: 'Encontro online da campanha.',
      imageUrl: '/api/media/file/plenaria.jpg',
      imageAlt: 'Plenária da saúde',
      eventLabel: 'Sábado, 3 de outubro · 19h',
      location: 'Online',
      startsAt: '2026-10-03T22:00:00.000Z',
      endsAt: '2026-10-04T00:00:00.000Z',
      canonicalUrl: 'https://jorgesolla1313.com.br/plenaria-saude',
    })
  })

  it('prefers the media alt and nulls the absent event data', () => {
    const view = buildShareLinkAnnouncementView({
      link: {
        slug: 'sem-data',
        title: 'Atividade',
        description: 'Descrição',
        image: { alt: 'Foto do encontro' },
        location: '   ',
      },
      imageUrl: null,
      canonicalUrl: null,
    })

    expect(view.imageAlt).toBe('Foto do encontro')
    expect(view.imageUrl).toBeNull()
    expect(view.eventLabel).toBeNull()
    expect(view.location).toBeNull()
    expect(view.startsAt).toBeNull()
    expect(view.endsAt).toBeNull()
    expect(view.canonicalUrl).toBeNull()
  })

  it('hides the event label when the date cannot be parsed', () => {
    const view = buildShareLinkAnnouncementView({
      link: {
        slug: 'data-invalida',
        title: 'Atividade',
        description: 'Descrição',
        startsAt: 'lixo',
      },
      imageUrl: null,
      canonicalUrl: null,
    })

    expect(view.eventLabel).toBeNull()
  })
})
