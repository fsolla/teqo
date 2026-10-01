// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { ArchivePhotoPublicItem } from '@/lib/archivePhotoPublicCatalog'
import {
  FACE_SEARCH_DESCRIPTOR_LENGTH,
  FACE_SEARCH_MAX_DISTANCE,
  faceEuclideanDistance,
  faceStubDescriptorFromBytes,
  findFaceDescriptorPhotoIds,
  readFaceVector,
  toFaceSearchPhotoView,
} from '@/lib/faceSearch'

// C242 — the pure contract of the selfie search: vector validation, the
// euclidean math, the anonymous descriptor match (which by shape cannot carry a
// score or a third-party name) and the result view model.

const vectorOf = (value: number, length = FACE_SEARCH_DESCRIPTOR_LENGTH): number[] =>
  Array.from({ length }, () => value)

describe('readFaceVector', () => {
  it('accepts exactly the descriptor length of finite numbers', () => {
    expect(readFaceVector(vectorOf(0.25))).toHaveLength(FACE_SEARCH_DESCRIPTOR_LENGTH)
  })

  it('fails closed on anything else', () => {
    expect(readFaceVector(null)).toBeNull()
    expect(readFaceVector('vector')).toBeNull()
    expect(readFaceVector([1, 2, 3])).toBeNull()
    expect(readFaceVector(vectorOf(0).slice(1))).toBeNull()
    expect(readFaceVector([...vectorOf(0).slice(1), Number.NaN])).toBeNull()
    expect(readFaceVector([...vectorOf(0).slice(1), Number.POSITIVE_INFINITY])).toBeNull()
    expect(readFaceVector([...vectorOf(0).slice(1), '1'])).toBeNull()
  })
})

describe('faceEuclideanDistance', () => {
  it('is the plain euclidean distance of same-length descriptors', () => {
    expect(faceEuclideanDistance([0, 0], [0, 0])).toBe(0)
    expect(faceEuclideanDistance([0, 0], [3, 4])).toBe(5)
  })

  it('is Infinity when the descriptors cannot be compared', () => {
    expect(faceEuclideanDistance([0, 0], [0])).toBe(Number.POSITIVE_INFINITY)
    expect(faceEuclideanDistance([], [])).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('findFaceDescriptorPhotoIds', () => {
  const near = (photoId: number, delta = 0.1) => ({
    photoId,
    vector: [...vectorOf(0).slice(1), delta],
  })
  const far = (photoId: number, delta = FACE_SEARCH_MAX_DISTANCE + 1) => ({
    photoId,
    vector: [...vectorOf(0).slice(1), delta],
  })

  it('returns the distinct photo ids with a face under the threshold', () => {
    const ids = findFaceDescriptorPhotoIds(vectorOf(0), [
      near(7),
      near(7, 0.2),
      near(9, 0.3),
      far(11),
    ])
    expect(ids).toEqual([7, 9])
  })

  it('never matches at or beyond the threshold and answers empty when nothing is close', () => {
    expect(
      findFaceDescriptorPhotoIds(vectorOf(0), [
        { photoId: 1, vector: [...vectorOf(0).slice(1), FACE_SEARCH_MAX_DISTANCE] },
      ]),
    ).toEqual([])
    expect(findFaceDescriptorPhotoIds(vectorOf(0), [far(2)])).toEqual([])
    expect(findFaceDescriptorPhotoIds(vectorOf(0), [])).toEqual([])
  })

  it('accepts Float32Array descriptors (the in-process cache shape)', () => {
    const ids = findFaceDescriptorPhotoIds(vectorOf(0), [
      { photoId: 3, vector: Float32Array.from(near(3).vector) },
    ])
    expect(ids).toEqual([3])
  })
})

describe('toFaceSearchPhotoView', () => {
  const item: ArchivePhotoPublicItem = {
    id: 7,
    alt: 'Plenária na Câmara',
    title: 'Plenária pela saúde',
    takenOn: '2026-09-12T12:00:00.000Z',
    dateLabel: '12 de setembro de 2026',
    shortDateLabel: '12 set 2026',
    municipalityName: 'Feira de Santana',
    municipalitySlug: 'feira-de-santana',
    scene: 'plenaria',
    sceneLabel: 'Plenária',
    people: ['Jorge Solla', 'Outra Pessoa'],
    peopleLabel: 'Jorge Solla e Outra Pessoa',
    metaLabel: '12 set 2026 · Feira de Santana · Plenária',
    searchText: 'plenaria feira de santana',
    thumbnailPath: '/fotos/7/midia?tamanho=grade',
    mediaPath: '/fotos/7/midia',
    downloadPath: '/fotos/7/midia?download=1',
    downloadFilename: 'jorge-solla-1313-foto-7.jpg',
  }

  it('carries the photo context but never third-party names', () => {
    const view = toFaceSearchPhotoView(item) as Record<string, unknown>

    expect(view.id).toBe(7)
    expect(view.title).toBe('Plenária pela saúde')
    expect(view.metaLabel).toBe('12 set 2026 · Feira de Santana · Plenária')
    expect(view.thumbnailPath).toBe('/fotos/7/midia?tamanho=grade')

    expect(view).not.toHaveProperty('people')
    expect(view).not.toHaveProperty('peopleLabel')
    expect(Object.keys(view).join(' ')).not.toMatch(/score|similar|distance|percent/i)
  })
})

describe('faceStubDescriptorFromBytes', () => {
  it('is deterministic, descriptor-sized and bounded', () => {
    const bytes = Uint8Array.from([1, 2, 3, 4, 5])
    const first = faceStubDescriptorFromBytes(bytes)
    const second = faceStubDescriptorFromBytes(bytes)

    expect(first).toHaveLength(FACE_SEARCH_DESCRIPTOR_LENGTH)
    expect(first).toEqual(second)
    expect(first.every((value) => value >= -1 && value <= 1)).toBe(true)
  })

  it('derives different descriptors for different bytes', () => {
    const a = faceStubDescriptorFromBytes(Uint8Array.from([1, 2, 3]))
    const b = faceStubDescriptorFromBytes(Uint8Array.from([3, 2, 1]))
    expect(a).not.toEqual(b)
    expect(faceEuclideanDistance(a, b)).toBeGreaterThan(FACE_SEARCH_MAX_DISTANCE)
  })
})
