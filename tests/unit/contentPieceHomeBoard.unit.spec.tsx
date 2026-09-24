import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ContentPieceHomeBoard } from '@/components/conteudos/ContentPieceHomeBoard'
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

    render(<ContentPieceHomeBoard items={items} />)

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

    render(<ContentPieceHomeBoard items={items} />)

    await waitFor(() => expect(readPermission).toHaveBeenCalled())
    expect(locateButton()).toBeNull()
    expect(screen.getByText('Seleção recente')).toBeDefined()
  })

  it('upgrades to the visitor territory without a dialog when permission is granted', async () => {
    readPermission.mockResolvedValue('granted')

    render(<ContentPieceHomeBoard items={items} />)

    await waitFor(() => expect(sampleTag()).toBe('municipality'))
    expect(screen.getByText('Do seu município')).toBeDefined()
    expect(locateButton()).toBeNull()
    expect(readPosition).toHaveBeenCalledTimes(1)
  })

  it('upgrades to the visitor territory when the affordance is tapped', async () => {
    readPermission.mockResolvedValue('prompt')

    render(<ContentPieceHomeBoard items={items} />)

    await waitFor(() => expect(locateButton()).not.toBeNull())
    fireEvent.click(locateButton()!)
    await waitFor(() => expect(sampleTag()).toBe('municipality'))
    expect(locateButton()).toBeNull()
    expect(readPosition).toHaveBeenCalledTimes(1)
  })

  it('offers the affordance when the browser cannot tell the permission (Safari)', async () => {
    readPermission.mockResolvedValue('unknown')

    render(<ContentPieceHomeBoard items={items} />)

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

    render(<ContentPieceHomeBoard items={[video]} />)

    await waitFor(() => expect(readPermission).toHaveBeenCalled())
    expect(document.querySelector('video')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir Vídeo da home' }))
    const element = document.querySelector('video')
    expect(element).not.toBeNull()

    fireEvent.ended(element!)
    await waitFor(() => expect(document.querySelector('video')).toBeNull())
  })

  it('keeps the recent selection when the position fails, without an error or a retry', async () => {
    readPermission.mockResolvedValue('granted')
    readPosition.mockResolvedValue({ ok: false, reason: 'timeout' })

    render(<ContentPieceHomeBoard items={items} />)

    await waitFor(() => expect(readPosition).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Seleção recente')).toBeDefined()
    expect(locateButton()).toBeNull()
    expect(screen.queryByText(/Não foi possível/)).toBeNull()
  })

  it('keeps the recent selection for a coarse fix (no município claim)', async () => {
    readPermission.mockResolvedValue('granted')
    readPosition.mockResolvedValue({ ok: true, fix: { ...feiraPoint, accuracyM: 50_000 } })

    render(<ContentPieceHomeBoard items={items} />)

    // The coarse fix keeps the region sample, never the município claim.
    await waitFor(() => expect(screen.getByText('Da sua região')).toBeDefined())
    expect(readPosition).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Seleção recente')).toBeDefined()
    expect(screen.queryByText('Do seu município')).toBeNull()
  })

  it('does not offer the affordance for a single published piece', async () => {
    readPermission.mockResolvedValue('prompt')

    render(<ContentPieceHomeBoard items={[localPiece]} />)

    await waitFor(() => expect(readPermission).toHaveBeenCalled())
    expect(locateButton()).toBeNull()
    expect(
      screen.getByText('Uma peça oficial já está pronta para você compartilhar.'),
    ).toBeDefined()
    // Cena 05 — the single-piece section ends on the CTA, with no footnote.
    expect(screen.queryByText(/Nenhum card personalizável/)).toBeNull()
    expect(screen.queryByText(/A localização não é guardada/)).toBeNull()
  })
})
