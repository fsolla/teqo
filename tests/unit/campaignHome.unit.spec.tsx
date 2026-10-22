import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomePage from '@/app/(frontend)/(home)/page'
import type { ArchivePhotoPublicItem } from '@/lib/archivePhotoPublicCatalog'
import type { ShareLinkHomeSectionData } from '@/utilities/shareLinkReads'

const photo = (id: number): ArchivePhotoPublicItem => ({
  id,
  alt: `Foto aprovada ${id}`,
  title: `Foto aprovada ${id}`,
  takenOn: '2026-09-12',
  dateLabel: '12 de setembro de 2026',
  shortDateLabel: '12 set 2026',
  municipalityName: 'Feira de Santana',
  municipalitySlug: 'feira-de-santana',
  scene: 'plenaria',
  sceneLabel: 'Plenária',
  people: [],
  peopleLabel: null,
  metaLabel: '12 set 2026 · Feira de Santana · Plenária',
  searchText: `foto aprovada ${id}`,
  thumbnailPath: `/fotos/${id}/midia?tamanho=grade`,
  mediaPath: `/fotos/${id}/midia`,
  downloadPath: `/fotos/${id}/midia?download=1`,
  downloadFilename: `jorge-solla-foto-${id}.jpg`,
})

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean
  priority?: boolean
}

vi.mock('next/image', () => ({
  default: ({ alt, fill: _fill, priority: _priority, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

// The editorial board reads posts/feeds through the Payload DB; the unit env
// has no database and its empty/full behavior is e2e-covered.
vi.mock('@/components/CampaignContentSection', () => ({
  CampaignContentSection: () => null,
}))

// C233/C243 — the home reads the approved archive photos and the photoAlbum
// global through the Payload DB; the unit env has no database and the real
// gate is e2e-covered (frontendFotos.e2e.spec.ts).
const homePhotoAlbum = vi.hoisted(() => ({
  photos: [] as ArchivePhotoPublicItem[],
  selfieSearchEnabled: false,
  published: true,
}))

vi.mock('@/utilities/archivePhotos/archivePhotoReads', () => ({
  getApprovedArchivePhotoItems: async () => homePhotoAlbum.photos,
}))

vi.mock('@/utilities/globalReads', () => ({
  getCachedGlobal: () => async () => ({
    published: homePhotoAlbum.published,
    selfieSearchEnabled: homePhotoAlbum.selfieSearchEnabled,
  }),
}))

// S44 — the Plenária section reads the fixed share link through the Payload DB
// (cached under the shareLinks tag); the unit env has no database, and the real
// window gate/swap behavior is e2e-covered (frontendShareLink.e2e.spec.ts).
const homeShareLink = vi.hoisted(() => ({
  section: null as ShareLinkHomeSectionData | null,
}))

vi.mock('@/utilities/shareLinkReads', () => ({
  loadShareLinkHomeSection: async () => homeShareLink.section,
}))

afterEach(() => {
  homePhotoAlbum.photos = []
  homePhotoAlbum.selfieSearchEnabled = false
  homePhotoAlbum.published = true
  homeShareLink.section = null
  cleanup()
})

describe('Campaign home', () => {
  it('abre no agradecimento e monta a casa do mandato', async () => {
    const { container } = render(await HomePage())

    expect(
      screen.getByRole('heading', { level: 1, name: '152.049 votos de confiança' }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Saúde pública como escolha de vida' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Compromissos que orientam o trabalho' }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'O mandato em fotos' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Navegue' })).toBeTruthy()

    // The campaign sections are gone from the composition.
    expect(screen.queryByText('Por que essa eleição importa')).toBeNull()
    expect(screen.queryByText('A caminhada, em tempo real')).toBeNull()
    expect(screen.queryByText(/Mostre que você está com Solla/i)).toBeNull()
    expect(screen.queryByText(/Rádio 1313/i)).toBeNull()
    expect(screen.queryByText(/Receba as novidades da campanha/i)).toBeNull()

    expect(container.textContent).not.toContain('1313')
    expect(container.textContent).not.toMatch(/CNPJ|1º turno|Quero apoiar/i)
  })

  it('usa as seis bandeiras do mandato', async () => {
    render(await HomePage())

    const expectedTitles = [
      'Defender o SUS e valorizar quem cuida',
      'Mais oportunidades no interior',
      'Crescimento com dignidade',
      'Participação e direitos',
      'A Bahia no centro das decisões',
      'Tempo para viver, renda para cuidar',
    ]
    for (const title of expectedTitles) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
  })

  it('mostra o estado vazio do álbum sem nenhuma foto aprovada', async () => {
    const { container } = render(await HomePage())

    expect(screen.getByRole('heading', { name: 'O álbum está sendo preparado' })).toBeTruthy()
    expect(container.querySelector('[data-home-section="photos"] a[href*="?foto="]')).toBeNull()
  })

  it('mostra as duas fotos aprovadas e o ladrilho de assinatura', async () => {
    homePhotoAlbum.photos = [photo(10), photo(11)]
    const { container } = render(await HomePage())

    const section = container.querySelector('[data-home-section="photos"]')
    expect(section).not.toBeNull()
    const links = section!.querySelectorAll('a[href*="?foto="]')
    expect(links).toHaveLength(2)
    expect(links[0]!.getAttribute('href')).toBe('/fotos?foto=10')
    expect(links[1]!.getAttribute('href')).toBe('/fotos?foto=11')
    expect(screen.getByText('Trabalho presente, memória viva.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver o álbum' }).getAttribute('href')).toBe('/fotos')
  })

  it('mostra a seção da busca por selfie só quando a busca está aberta (C243, fail-closed)', async () => {
    homePhotoAlbum.photos = [photo(10)]
    homePhotoAlbum.selfieSearchEnabled = true
    render(await HomePage())

    expect(screen.getByRole('heading', { name: 'Encontre você nas fotos' })).toBeTruthy()
    const ctas = screen.getAllByRole('link', { name: /Encontrar minhas fotos/ })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) expect(cta.getAttribute('href')).toBe('/fotos/encontre')

    cleanup()

    homePhotoAlbum.selfieSearchEnabled = false
    render(await HomePage())
    expect(screen.queryByRole('heading', { name: 'Encontre você nas fotos' })).toBeNull()

    cleanup()

    // Flag on but no approved photo is still closed: no dead CTA.
    homePhotoAlbum.selfieSearchEnabled = true
    homePhotoAlbum.photos = []
    render(await HomePage())
    expect(screen.queryByRole('heading', { name: 'Encontre você nas fotos' })).toBeNull()
  })

  it('mostra a seção da Plenária só com o link publicado na janela (S44, fail-closed)', async () => {
    const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    homeShareLink.section = {
      view: {
        slug: 'plenaria-vitoria',
        title: 'Plenária da Vitória',
        description: 'O time de Jorge Solla se encontra antes da vitória.',
        imageUrl: null,
        imageAlt: 'Plenária da Vitória',
        eventLabel: 'Sexta-feira, 2 de outubro · 18h',
        location: 'Online',
        startsAt,
        endsAt: null,
        canonicalUrl: 'https://jorgesolla1313.com.br/plenaria-vitoria',
        expiresAt: Date.parse(startsAt) + 2 * 60 * 60 * 1000,
        youtubeVideoId: null,
      },
      initialLive: null,
    }
    render(await HomePage())

    expect(screen.getByRole('heading', { name: 'Plenária da Vitória' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adicionar à agenda' })).toBeTruthy()
    expect(
      screen.queryByRole('link', { name: /Entrar na plenária|Assistir no YouTube/ }),
    ).toBeNull()

    cleanup()
    homeShareLink.section = null
    render(await HomePage())
    expect(screen.queryByRole('heading', { name: 'Plenária da Vitória' })).toBeNull()
  })
})
