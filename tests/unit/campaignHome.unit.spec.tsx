import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomePage from '@/app/(frontend)/(home)/page'
import { toContentPiecePublicItem, type ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import type { ShareLinkHomeSectionData } from '@/utilities/shareLinkReads'

const pieceItem = toContentPiecePublicItem({
  id: 1,
  slug: 'peca-da-home',
  title: 'Peça da home',
  type: 'foto',
  status: 'publicado',
  origin: 'arquivo',
  media: { id: 2, filename: 'peca.png', mimeType: 'image/png' },
})
if (!pieceItem) throw new Error('fixture should be public')

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

// The content section is an async server component that reads posts through
// the Payload DB; the unit env has no database and an async child suspends the
// whole tree under testing-library. Its empty/full behavior is covered by e2e
// (frontend.e2e.spec.ts), so the home skeleton tests render it away.
vi.mock('@/components/CampaignContentSection', () => ({
  CampaignContentSection: () => null,
}))

// The S9 capture form is a client component (radix comboboxes/checkbox) whose
// interactions are e2e-covered; the unit skeleton only pins the section shell.
vi.mock('@/components/CampaignNewsletterForm', () => ({
  CampaignNewsletterCapture: () => null,
}))

// S10 — the section reads the site-settings global (server-only, Payload DB);
// the unit env has no database, and the pixel behavior is e2e-covered.
vi.mock('@/utilities/campaignHomeTracking', () => ({
  getCampaignHomeMetaPixelId: async () => null,
}))

// S21/S22 — the home reads the jingle listing through the Payload DB +
// unstable_cache for the sound section and the footer discovery flag; the unit
// env has neither, and the real listing/kill-switch behavior is e2e-covered
// (frontendJingles.e2e.spec.ts).
vi.mock('@/utilities/jingleReads', () => ({
  getPublishedJingleItems: async () => [],
}))

// S27/S39 — the same for the Central de Conteúdos listing (cached read that
// feeds the discovery flag and the home sample); the real kill-switch behavior
// is e2e-covered (frontendConteudos.e2e.spec.ts).
const contentPieces = vi.hoisted(() => ({ items: [] as ContentPiecePublicItem[] }))

vi.mock('@/utilities/content/contentPieceReads', () => ({
  getPublishedContentPieceItems: async () => contentPieces.items,
}))

// C233/C243 — the footer's "Fotos" discovery flag and the selfie-search section
// read the approved archive photos and the photoAlbum global through the
// Payload DB; the unit env has no database and the real gate is e2e-covered
// (frontendFotosSelfie.e2e.spec.ts).
const homePhotoAlbum = vi.hoisted(() => ({
  hasPhotos: false,
  selfieSearchEnabled: false,
  published: true,
}))

vi.mock('@/utilities/archivePhotos/archivePhotoReads', () => ({
  hasPublishedArchivePhotos: async () => homePhotoAlbum.hasPhotos,
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

// S14 — the card section renders the client studio island (next/font local
// face + matchMedia + canvas); its behavior is e2e-covered, so the unit
// skeleton mocks both the face module and the island.
vi.mock('@/app/(frontend)/fonts', () => ({
  brexterBold: { variable: 'font-brexter-mock', style: { fontFamily: 'Brexter' } },
}))

vi.mock('@/components/cards/CardsStudio', () => ({
  CardsStudio: () => null,
}))

afterEach(() => {
  contentPieces.items = []
  homePhotoAlbum.hasPhotos = false
  homePhotoAlbum.selfieSearchEnabled = false
  homePhotoAlbum.published = true
  homeShareLink.section = null
  cleanup()
})

describe('Campaign home', () => {
  it('monta as seis seções previstas e o rodapé eleitoral', async () => {
    render(await HomePage())

    expect(screen.getByRole('heading', { level: 1, name: 'MAIS SAÚDE MAIS FUTURO' })).toBeTruthy()
    expect(screen.getByText('3.333')).toBeTruthy()
    expect(screen.getByText('1.031')).toBeTruthy()
    expect(screen.getByText('3º')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Eleger deputado é coisa séria/i })).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: /Junto com o trabalhador e do lado de quem mais precisa, sempre/i,
      }),
    ).toBeTruthy()
    // S22 — with zero published jingles the sound section shows only the radio.
    expect(screen.getByRole('heading', { name: 'Sintonize com a Rádio 1313' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Mostre que você está com Solla/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Receba as novidades da campanha/i })).toBeTruthy()
    expect(screen.getByText(/CNPJ: 68\.430\.467\/0001-05/)).toBeTruthy()
  })

  it('usa exatamente as seis bandeiras aprovadas', async () => {
    render(await HomePage())

    // S6: cada bandeira aparece em duas renderizações irmãs (grade desktop e
    // carrossel mobile); o teste garante que as duas seguem a mesma copy.
    const expectedTitles = [
      'Defender o SUS e valorizar quem cuida',
      'Fim da escala 6×1 e jornada de 40h',
      'Educação em tempo integral e federais no interior',
      'Recomprar a Refinaria de Mataripe',
      'Salário mínimo forte, emprego e moradia',
      'Defesa intransigente da democracia',
    ]
    for (const title of expectedTitles) {
      expect(screen.getAllByText(title)).toHaveLength(2)
    }
  })

  it('mostra a seção da Central com peça publicada e a esconde sem nenhuma (fail-closed)', async () => {
    contentPieces.items = [pieceItem]
    render(await HomePage())

    expect(screen.getByRole('heading', { name: 'Peça voto pra Solla 1313' })).toBeTruthy()
    // The single-piece layout renders one CTA per viewport (split desktop +
    // stacked mobile); both hand off to the Central.
    const ctas = screen.getAllByRole('link', { name: /Ver todas as peças/ })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) expect(cta.getAttribute('href')).toBe('/conteudos')

    cleanup()
    contentPieces.items = []
    render(await HomePage())

    expect(screen.queryByRole('heading', { name: 'Peça voto pra Solla 1313' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Ver todas as peças/ })).toBeNull()
  })

  it('mostra a seção da busca por selfie só quando a busca está aberta (C243, fail-closed)', async () => {
    homePhotoAlbum.hasPhotos = true
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
    homePhotoAlbum.hasPhotos = false
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
    // Pré-live: the S29 agenda is the only action — never an entry button.
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
