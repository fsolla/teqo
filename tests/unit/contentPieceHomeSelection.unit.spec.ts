// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type {
  BahiaMunicipalityFeature,
  BahiaTerritoryFeature,
  MunicipalityZoneFeature,
} from '@/lib/bahiaGeometriesTypes'
import { toContentPiecePublicItem, type ContentPiecePublicSource } from '@/lib/contentPieceCatalog'
import {
  resolveContentPieceHomeVisitor,
  selectContentPieceHomeItems,
  toContentPieceHomeItem,
  type ContentPieceHomeItem,
} from '@/lib/contentPieceHomeSelection'

const source = (patch: Partial<ContentPiecePublicSource> = {}): ContentPiecePublicSource => ({
  id: 1,
  slug: 'fim-da-escala-6x1',
  title: 'Fim da escala 6x1 é saúde',
  type: 'video',
  status: 'publicado',
  origin: 'arquivo',
  topics: ['economia-trabalho'],
  cityLabel: 'Feira de Santana',
  region: 'Portal do Sertão',
  description: 'Solla explica a jornada.',
  transcript: 'A redução da jornada é saúde.',
  durationSeconds: 134,
  searchText: 'fim da escala 6x1 e saude feira de santana',
  media: { id: 7, filename: 'Fim da Escala.MP4' },
  ...patch,
})

const homeItem = (patch: Partial<ContentPiecePublicSource> = {}): ContentPieceHomeItem => {
  const item = toContentPiecePublicItem(source(patch))
  if (!item) throw new Error('fixture should be public')
  return toContentPieceHomeItem(item)
}

/** Axis-aligned square in degrees — small enough that planar reasoning holds. */
const square = <Properties extends Record<string, unknown>>(
  properties: Properties,
  { west, south, size }: { west: number; south: number; size: number },
) => ({
  type: 'Feature' as const,
  properties,
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [west, south],
        [west + size, south],
        [west + size, south + size],
        [west, south + size],
        [west, south],
      ],
    ],
  },
})

const municipalitySquare = (
  codarea: string,
  name: string,
  box: { west: number; south: number; size: number },
): BahiaMunicipalityFeature => square({ codarea, name }, box)

const zoneSquare = (
  municipalitySlug: string,
  name: string,
  ibgeCode: string,
  box: { west: number; south: number; size: number },
): MunicipalityZoneFeature => square({ municipalitySlug, name, ibgeCode }, box)

const territorySquare = (
  code: string,
  name: string,
  box: { west: number; south: number; size: number },
): BahiaTerritoryFeature => square({ code, name }, box)

describe('content piece home selection', () => {
  describe('toContentPieceHomeItem', () => {
    it('projects exactly the card fields — the search haystack never rides along', () => {
      const item = homeItem()

      expect(Object.keys(item).sort()).toEqual([
        'cityLabel',
        'durationLabel',
        'excerpt',
        'file',
        'framePath',
        'id',
        'isLink',
        'metaLabel',
        'origin',
        'originLabel',
        'publicPath',
        'regionLabel',
        'slug',
        'title',
        'type',
        'typeLabel',
      ])
      expect('searchText' in item).toBe(false)
      expect('description' in item).toBe(false)
      expect('topics' in item).toBe(false)
    })

    it('carries the frame of a video piece into the home card (C226)', () => {
      // The field-by-field map is what stops a new public field from leaking by
      // spread, so the copy is pinned here on purpose.
      expect(
        homeItem({
          id: 3,
          slug: 'peca-video',
          type: 'video',
          media: { id: 7, filename: 'video.mp4', mimeType: 'video/mp4' },
        }).framePath,
      ).toBe('/conteudos/peca-video/frame')
      expect(
        homeItem({
          id: 4,
          slug: 'peca-foto',
          type: 'foto',
          media: { id: 8, filename: 'foto.png', mimeType: 'image/png' },
        }).framePath,
      ).toBeNull()
    })

    it('keeps a link piece with no archived file — the platform handoff', () => {
      const item = homeItem({
        id: 9,
        slug: 'peca-link',
        origin: 'instagram',
        media: null,
        sourceUrl: 'https://www.instagram.com/p/abc/',
      })

      expect(item.isLink).toBe(true)
      expect(item.file).toBeNull()
    })
  })

  describe('selectContentPieceHomeItems', () => {
    const local = homeItem({ id: 1, slug: 'local', cityLabel: 'Feira de Santana' })
    const regional = homeItem({
      id: 2,
      slug: 'regional',
      cityLabel: 'Serrinha',
      region: 'Portal do Sertão',
    })
    const other = homeItem({ id: 3, slug: 'outro', cityLabel: 'Ilhéus', region: 'Litoral Sul' })
    const newest = homeItem({ id: 4, slug: 'recente', cityLabel: null, region: null })
    const visitor = { municipalityName: 'Feira de Santana', region: 'Portal do Sertão' }

    it('orders município → região → recentes and annotates every match', () => {
      const selection = selectContentPieceHomeItems([other, regional, local], visitor)

      expect(selection.map((entry) => [entry.item.slug, entry.match])).toEqual([
        ['local', 'municipality'],
        ['regional', 'region'],
        ['outro', 'recent'],
      ])
    })

    it('never repeats a piece that matches more than one bucket', () => {
      const both = homeItem({ id: 5, slug: 'both' })
      const selection = selectContentPieceHomeItems([both, local], visitor)

      expect(selection.map((entry) => entry.item.slug)).toEqual(['both', 'local'])
      expect(selection[0]?.match).toBe('municipality')
    })

    it('keeps the newest-first order inside each bucket and caps at the limit', () => {
      const localNewer = homeItem({ id: 11, slug: 'local-nova' })
      const localOlder = homeItem({ id: 12, slug: 'local-antiga' })

      const selection = selectContentPieceHomeItems([localNewer, localOlder, regional], visitor, 2)
      expect(selection.map((entry) => entry.item.slug)).toEqual(['local-nova', 'local-antiga'])
      expect(
        selectContentPieceHomeItems([localNewer, localOlder, regional], visitor, 1).map(
          (entry) => entry.item.slug,
        ),
      ).toEqual(['local-nova'])
    })

    it('shows fewer pieces when the catalogue is smaller than the limit', () => {
      expect(selectContentPieceHomeItems([local], visitor)).toHaveLength(1)
    })

    it('defaults to three pieces when the catalogue is larger than the sample', () => {
      const many = [1, 2, 3, 4, 5].map((id) => homeItem({ id, slug: `peca-${id}` }))

      expect(selectContentPieceHomeItems(many, null)).toHaveLength(3)
    })

    it('falls back to the newest pieces without a visitor or without any label', () => {
      const items = [newest, other, local]

      expect(selectContentPieceHomeItems(items, null).map((entry) => entry.item.slug)).toEqual([
        'recente',
        'outro',
        'local',
      ])
      expect(
        selectContentPieceHomeItems(items, { municipalityName: null, region: null }).map(
          (entry) => entry.match,
        ),
      ).toEqual(['recent', 'recent', 'recent'])
    })

    it('matches a Salvador ZE by its exact name and degrades to the region without one', () => {
      const zonePiece = homeItem({
        id: 6,
        slug: 'ze',
        cityLabel: 'Salvador — ZE 3',
        region: 'Metropolitano de Salvador',
      })

      expect(
        selectContentPieceHomeItems([zonePiece], {
          municipalityName: 'Salvador — ZE 3',
          region: 'Metropolitano de Salvador',
        })[0]?.match,
      ).toBe('municipality')
      expect(
        selectContentPieceHomeItems([zonePiece], {
          municipalityName: 'Salvador',
          region: 'Metropolitano de Salvador',
        })[0]?.match,
      ).toBe('region')
    })
  })

  describe('resolveContentPieceHomeVisitor', () => {
    const feira = municipalitySquare('2910800', 'Feira de Santana', {
      west: -39.2,
      south: -12.4,
      size: 0.4,
    })
    const portal = territorySquare('20', 'Portal do Sertão', {
      west: -40,
      south: -13,
      size: 3,
    })
    const point = { lat: -12.2, lng: -39 }

    it('resolves the município name and the identity territory', () => {
      expect(
        resolveContentPieceHomeVisitor({
          point,
          municipalityGeometry: { features: [feira] },
          territoryGeometry: { features: [portal] },
        }),
      ).toEqual({ municipalityName: 'Feira de Santana', region: 'Portal do Sertão' })
    })

    it('prefers the Salvador zone name when the zone mesh contains the point', () => {
      const salvador = municipalitySquare('2927408', 'Salvador', {
        west: -38.6,
        south: -13.1,
        size: 0.6,
      })
      const ze = zoneSquare('salvador-ze-3', 'Salvador — ZE 3', '2927408', {
        west: -38.55,
        south: -13.05,
        size: 0.2,
      })

      expect(
        resolveContentPieceHomeVisitor({
          point: { lat: -13, lng: -38.5 },
          municipalityGeometry: { features: [salvador] },
          zoneGeometry: { features: [ze] },
          territoryGeometry: { features: [portal] },
        }),
      ).toEqual({ municipalityName: 'Salvador — ZE 3', region: 'Portal do Sertão' })
    })

    it('falls back to the whole município when no zone contains the point', () => {
      const salvador = municipalitySquare('2927408', 'Salvador', {
        west: -38.6,
        south: -13.1,
        size: 0.6,
      })
      const ze = zoneSquare('salvador-ze-3', 'Salvador — ZE 3', '2927408', {
        west: -38.55,
        south: -13.05,
        size: 0.05,
      })

      expect(
        resolveContentPieceHomeVisitor({
          point: { lat: -12.7, lng: -38.2 },
          municipalityGeometry: { features: [salvador] },
          zoneGeometry: { features: [ze] },
          territoryGeometry: { features: [portal] },
        }),
      ).toEqual({ municipalityName: 'Salvador', region: 'Portal do Sertão' })
    })

    it('keeps only the region on a coarse fix', () => {
      expect(
        resolveContentPieceHomeVisitor({
          point,
          coarse: true,
          municipalityGeometry: { features: [feira] },
          territoryGeometry: { features: [portal] },
        }),
      ).toEqual({ municipalityName: null, region: 'Portal do Sertão' })
    })

    it('is null outside the municipal mesh — outside Bahia or without a signal', () => {
      expect(
        resolveContentPieceHomeVisitor({
          point: { lat: -23.5, lng: -46.6 },
          municipalityGeometry: { features: [feira] },
          territoryGeometry: { features: [portal] },
        }),
      ).toBeNull()
      expect(
        resolveContentPieceHomeVisitor({
          point: { lat: -23.5, lng: -46.6 },
          coarse: true,
          municipalityGeometry: { features: [feira] },
          territoryGeometry: { features: [portal] },
        }),
      ).toBeNull()
    })
  })
})
