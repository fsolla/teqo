import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentPieceHomeBoard } from '@/components/conteudos/ContentPieceHomeBoard'
import type { ContentPieceHomeFacets } from '@/components/conteudos/ContentPieceHomeFilterRow'
import {
  loadMunicipalityGeometryModule,
  loadMunicipalityZoneGeometryModule,
  loadTerritoryGeometryModule,
} from '@/lib/bahiaGeometries'
import type {
  BahiaFeature,
  BahiaMunicipalityFeature,
  BahiaTerritoryFeature,
  MunicipalityGeometryModule,
  MunicipalityZoneGeometryModule,
  TerritoryGeometryModule,
} from '@/lib/bahiaGeometriesTypes'
import type { ContentPieceHomeItem } from '@/lib/contentPieceHomeSelection'
import {
  readGeolocationPermissionState,
  requestCurrentPosition,
} from '@/utilities/campaignGeolocation'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/bahiaGeometries', () => ({
  loadMunicipalityGeometryModule: vi.fn(),
  loadMunicipalityZoneGeometryModule: vi.fn(),
  loadTerritoryGeometryModule: vi.fn(),
}))

vi.mock('@/utilities/campaignGeolocation', () => ({
  COARSE_ACCURACY_M: 10_000,
  readGeolocationPermissionState: vi.fn(),
  requestCurrentPosition: vi.fn(),
}))

const readPermission = vi.mocked(readGeolocationPermissionState)
const readPosition = vi.mocked(requestCurrentPosition)
const readMunicipalityGeometry = vi.mocked(loadMunicipalityGeometryModule)
const readZoneGeometry = vi.mocked(loadMunicipalityZoneGeometryModule)
const readTerritoryGeometry = vi.mocked(loadTerritoryGeometryModule)

const item = (id: number, patch: Partial<ContentPieceHomeItem> = {}): ContentPieceHomeItem => ({
  id,
  slug: `peca-${id}`,
  title: `Peça ${id}`,
  type: 'foto',
  typeLabel: 'Foto',
  origin: 'arquivo',
  originLabel: 'Arquivo',
  isLink: false,
  sourceUrl: null,
  cityLabel: null,
  regionLabel: null,
  excerpt: null,
  durationLabel: null,
  metaLabel: 'Tema · Local',
  publicPath: `/conteudos/peca-${id}`,
  file: {
    id: 100 + id,
    path: `/conteudos/peca-${id}/midia`,
    mimeType: 'image/png',
    downloadFilename: `peca-${id}.png`,
  },
  framePath: null,
  ...patch,
})

/** Axis-aligned squares over the committed-mesh contract the resolver reads. */
const square = <Properties extends Record<string, unknown>>(
  properties: Properties,
  box: { west: number; south: number; size?: number },
): BahiaFeature<Properties> => {
  const size = box.size ?? 0.4
  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [box.west, box.south],
          [box.west + size, box.south],
          [box.west + size, box.south + size],
          [box.west, box.south + size],
          [box.west, box.south],
        ],
      ],
    },
  }
}

const feira = square(
  { codarea: '2910800', name: 'Feira de Santana' },
  { west: -39.2, south: -12.4 },
)
const portal = square({ code: '20', name: 'Portal do Sertão' }, { west: -40, south: -13, size: 3 })

const municipalityModule = (
  features: readonly BahiaMunicipalityFeature[],
): MunicipalityGeometryModule => ({
  topology: {
    type: 'Topology',
    objects: { municipalities: { type: 'GeometryCollection', geometries: [] } },
    arcs: [],
  },
  features,
  getMunicipalityFeature: (codarea) =>
    features.find((feature) => feature.properties.codarea === codarea),
})

const zoneModule = (): MunicipalityZoneGeometryModule => ({
  topology: {
    type: 'Topology',
    objects: { municipalityZones: { type: 'GeometryCollection', geometries: [] } },
    arcs: [],
  },
  features: [],
})

const territoryModule = (features: readonly BahiaTerritoryFeature[]): TerritoryGeometryModule => ({
  topology: {
    type: 'Topology',
    objects: { territories: { type: 'GeometryCollection', geometries: [] } },
    arcs: [],
  },
  features,
})

const feiraPoint = { lat: -12.2, lng: -39 }
const localPiece = item(1, { cityLabel: 'Feira de Santana', regionLabel: 'Portal do Sertão' })
const otherPiece = item(2, { cityLabel: 'Ilhéus', regionLabel: 'Litoral Sul' })
const items = [localPiece, otherPiece]

/** S42 — the server hands the explore row the catalogue vocabulary of the sample. */
const facets: ContentPieceHomeFacets = {
  tipo: [
    { value: 'video', label: 'Vídeo' },
    { value: 'foto', label: 'Foto' },
  ],
  cidade: [{ value: 'feira-de-santana', label: 'Feira de Santana' }],
  regiao: [{ value: 'portal-do-sertao', label: 'Portal do Sertão' }],
}

const renderBoard = (boardItems: ContentPieceHomeItem[] = items, boardFacets = facets) =>
  render(<ContentPieceHomeBoard items={boardItems} facets={boardFacets} />)

const locateButton = () => screen.queryByRole('button', { name: /Usar minha localização/ })

/** The section tag is split by the decorative glyph, so the hook is the attribute. */
const sampleTag = () =>
  document.querySelector('[data-sample-tag]')?.getAttribute('data-sample-tag') ?? null

beforeEach(() => {
  vi.clearAllMocks()
  readMunicipalityGeometry.mockResolvedValue(municipalityModule([feira]))
  readZoneGeometry.mockResolvedValue(zoneModule())
  readTerritoryGeometry.mockResolvedValue(territoryModule([portal]))
  readPosition.mockResolvedValue({ ok: true, fix: { ...feiraPoint, accuracyM: 80 } })
})

afterEach(cleanup)

describe('ContentPieceHomeBoard', () => {
  it('renders the recent selection and the affordance while permission is undecided', async () => {
    readPermission.mockResolvedValue('prompt')

    renderBoard()

    await waitFor(() => expect(locateButton()).not.toBeNull())
    expect(screen.getByText('Seleção recente')).toBeDefined()
    expect(screen.getAllByText('Mais recente')).toHaveLength(items.length)
    expect(screen.getByRole('link', { name: /Ver todas as peças/ }).getAttribute('href')).toBe(
      '/conteudos',
    )
    // No surprise dialog on load and nothing stored anywhere (LGPD contract).
    expect(readPosition).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
  })

  it('hides the affordance when the browser already refused the permission', async () => {
    readPermission.mockResolvedValue('denied')

    renderBoard()

    await waitFor(() => expect(readPermission).toHaveBeenCalled())
    expect(locateButton()).toBeNull()
    expect(screen.getByText('Seleção recente')).toBeDefined()
  })

  it('upgrades to the visitor territory without a dialog when permission is granted', async () => {
    readPermission.mockResolvedValue('granted')

    renderBoard()

    await waitFor(() => expect(sampleTag()).toBe('municipality'))
    expect(screen.getByText('Do seu município')).toBeDefined()
    expect(locateButton()).toBeNull()
    expect(readPosition).toHaveBeenCalledTimes(1)
  })

  it('upgrades to the visitor territory when the affordance is tapped', async () => {
    readPermission.mockResolvedValue('prompt')

    renderBoard()

    await waitFor(() => expect(locateButton()).not.toBeNull())
    fireEvent.click(locateButton()!)
    await waitFor(() => expect(sampleTag()).toBe('municipality'))
    expect(locateButton()).toBeNull()
    expect(readPosition).toHaveBeenCalledTimes(1)
  })

  it('offers the affordance when the browser cannot tell the permission (Safari)', async () => {
    readPermission.mockResolvedValue('unknown')

    renderBoard()

    await waitFor(() => expect(locateButton()).not.toBeNull())
    expect(readPosition).not.toHaveBeenCalled()
  })

  it('mounts the media only after the tap and unmounts it when the play ends', async () => {
    readPermission.mockResolvedValue('denied')
    const video = item(7, {
      title: 'Vídeo da home',
      type: 'video',
      typeLabel: 'Vídeo',
      file: {
        id: 107,
        path: '/conteudos/peca-7/midia',
        mimeType: 'video/mp4',
        downloadFilename: 'peca-7.mp4',
      },
    })

    renderBoard([video])

    await waitFor(() => expect(readPermission).toHaveBeenCalled())
    expect(document.querySelector('video')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir Vídeo da home' }))
    const element = document.querySelector('video')
    expect(element).not.toBeNull()

    fireEvent.ended(element!)
    await waitFor(() => expect(document.querySelector('video')).toBeNull())
  })

  it('keeps the frame of the type on the sample card (S45)', async () => {
    readPermission.mockResolvedValue('denied')
    const photo = item(1)
    const video = item(2, {
      title: 'Vídeo da home',
      type: 'video',
      typeLabel: 'Vídeo',
      file: {
        id: 102,
        path: '/conteudos/peca-2/midia',
        mimeType: 'video/mp4',
        downloadFilename: 'peca-2.mp4',
      },
    })
    const audio = item(3, {
      title: 'Áudio da home',
      type: 'audio',
      typeLabel: 'Áudio',
      file: {
        id: 103,
        path: '/conteudos/peca-3/midia',
        mimeType: 'audio/mpeg',
        downloadFilename: 'peca-3.mp3',
      },
    })

    renderBoard([photo, video, audio])
    await waitFor(() => expect(readPermission).toHaveBeenCalled())

    const slot = (slug: string) =>
      document.querySelector<HTMLElement>(
        `article[data-content-piece="${slug}"] [data-content-piece-media]`,
      )

    // Photo keeps 4:5 and the Reel keeps 9:16; the wide kinds stay short on the
    // phone and take the wide block from `sm` up.
    expect(slot('peca-1')?.className).toContain('aspect-[4/5]')
    expect(slot('peca-2')?.className).toContain('aspect-[9/16]')
    expect(slot('peca-3')?.className).toContain('max-sm:h-[156px]')
  })

  it('keeps the recent selection when the position fails, without an error or a retry', async () => {
    readPermission.mockResolvedValue('granted')
    readPosition.mockResolvedValue({ ok: false, reason: 'timeout' })

    renderBoard()

    await waitFor(() => expect(readPosition).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Seleção recente')).toBeDefined()
    expect(locateButton()).toBeNull()
    expect(screen.queryByText(/Não foi possível/)).toBeNull()
  })

  it('keeps the recent selection for a coarse fix (no município claim)', async () => {
    readPermission.mockResolvedValue('granted')
    readPosition.mockResolvedValue({ ok: true, fix: { ...feiraPoint, accuracyM: 50_000 } })

    renderBoard()

    // The coarse fix keeps the region sample, never the município claim.
    await waitFor(() => expect(screen.getByText('Da sua região')).toBeDefined())
    expect(readPosition).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Seleção recente')).toBeDefined()
    expect(screen.queryByText('Do seu município')).toBeNull()
  })

  it('does not offer the affordance for a single published piece', async () => {
    readPermission.mockResolvedValue('prompt')

    renderBoard([localPiece])

    await waitFor(() => expect(readPermission).toHaveBeenCalled())
    expect(locateButton()).toBeNull()
    expect(
      screen.getByText('Uma peça oficial já está pronta para você compartilhar.'),
    ).toBeDefined()
    // Cena 05 — the single-piece section ends on the CTA, with no footnote.
    expect(screen.queryByText(/Nenhum card personalizável/)).toBeNull()
    expect(screen.queryByText(/A localização não é guardada/)).toBeNull()
  })

  it('opens the S27 share sheet from the card without leaving the home (S42)', async () => {
    readPermission.mockResolvedValue('denied')

    renderBoard()
    await waitFor(() => expect(readPermission).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar Peça 1' }))

    const sheet = screen.getByRole('dialog', { name: 'Compartilhar peça' })
    expect(sheet).toBeDefined()
    const message = within(sheet).getByLabelText(
      'Mensagem para compartilhar',
    ) as HTMLTextAreaElement
    expect(message.value).toContain('Peça 1')
    // The section stays mounted behind the sheet — the visitor never leaves the home.
    expect(screen.getByText('Seleção recente')).toBeDefined()
  })

  it('links the honest tags to the catalogue and keeps "Mais recente" static (S42)', async () => {
    readPermission.mockResolvedValue('granted')

    renderBoard()
    await waitFor(() => expect(sampleTag()).toBe('municipality'))

    const localCard = document.querySelector('article[data-content-piece="peca-1"]') as HTMLElement
    const otherCard = document.querySelector('article[data-content-piece="peca-2"]') as HTMLElement

    expect(within(localCard).getByRole('link', { name: 'Foto' }).getAttribute('href')).toBe(
      '/conteudos?tipo=foto',
    )
    expect(
      within(localCard).getByRole('link', { name: 'Do seu município' }).getAttribute('href'),
    ).toBe('/conteudos?cidade=feira-de-santana')
    expect(within(otherCard).queryByRole('link', { name: 'Mais recente' })).toBeNull()
    // The section tag is the shortcut of the visitor's município.
    expect(screen.getByRole('link', { name: /Para seu município/ }).getAttribute('href')).toBe(
      '/conteudos?cidade=feira-de-santana',
    )
  })

  it('renders the explore row with canonical facet links and never filters the sample (S42)', async () => {
    readPermission.mockResolvedValue('denied')

    renderBoard()
    await waitFor(() => expect(readPermission).toHaveBeenCalled())

    // Both breakpoint captions render (one hidden by CSS); the row itself has
    // one chip per non-empty facet.
    expect(screen.getAllByText(/Explore na Central/)).toHaveLength(2)

    // The board hands the server facets to the row; every option href is the
    // row's own contract (pinned in `contentPieceHomeFilterRow.unit.spec.tsx`).
    const tipoDetails = screen.getByText('Tipo').closest('details') as HTMLElement
    fireEvent.click(within(tipoDetails).getByText('Tipo'))
    expect(within(tipoDetails).getByRole('link', { name: 'Vídeo' }).getAttribute('href')).toBe(
      '/conteudos?tipo=video',
    )

    // The row is pure navigation: the sample stays intact.
    expect(document.querySelectorAll('article[data-content-piece]')).toHaveLength(2)
  })
})
