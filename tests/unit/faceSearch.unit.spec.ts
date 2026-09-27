// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { ArchivePhotoPublicItem } from '@/lib/archivePhotoPublicCatalog'
import {
  FACE_SEARCH_DESCRIPTOR_LENGTH,
  FACE_SEARCH_MAX_DISTANCE,
  FACE_SEARCH_MODEL,
  faceEuclideanDistance,
  faceStubDescriptorFromBytes,
  faceSubjectIsEligible,
  findFaceMatch,
  readFaceVector,
  toFaceSearchPhotoView,
} from '@/lib/faceSearch'

// C234 — the pure contract of the selfie search: vector validation, the
// euclidean math, the eligibility of an enrolled subject and the result view
// model that by shape cannot carry a score or a third-party name.

const vectorOf = (value: number, length = FACE_SEARCH_DESCRIPTOR_LENGTH): number[] =>
  Array.from({ length }, () => value)

const subjectOf = (
  overrides: Partial<{
    id: number
    status: string
    model: string
    consentHash: string | null
    vector: unknown
  }> = {},
) => ({
  id: 1,
  status: 'active',
  model: FACE_SEARCH_MODEL,
  consentHash: 'hash-atual',
  vector: vectorOf(0),
  ...overrides,
})

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

describe('faceSubjectIsEligible', () => {
  const current = { model: FACE_SEARCH_MODEL, consentHash: 'hash-atual' }

  it('requires active status, the current model and the current consent hash', () => {
    expect(faceSubjectIsEligible(subjectOf(), current)).toBe(true)
    expect(faceSubjectIsEligible(subjectOf({ status: 'removed' }), current)).toBe(false)
    expect(faceSubjectIsEligible(subjectOf({ model: 'outro-modelo' }), current)).toBe(false)
    expect(faceSubjectIsEligible(subjectOf({ consentHash: 'hash-antigo' }), current)).toBe(false)
    expect(faceSubjectIsEligible(subjectOf({ consentHash: null }), current)).toBe(false)
  })
})

describe('findFaceMatch', () => {
  const current = { model: FACE_SEARCH_MODEL, consentHash: 'hash-atual' }

  it('returns the closest eligible subject strictly under the threshold', () => {
    const far = subjectOf({ id: 1, vector: [...vectorOf(0).slice(1), 1] })
    const near = subjectOf({ id: 2, vector: [...vectorOf(0).slice(1), 0.1] })
    const match = findFaceMatch({
      vector: vectorOf(0),
      subjects: [far, near],
      ...current,
    })
    expect(match?.id).toBe(2)
  })

  it('ignores ineligible subjects and subjects with a malformed vector', () => {
    const removed = subjectOf({ id: 1, status: 'removed', vector: vectorOf(0) })
    const staleModel = subjectOf({ id: 2, model: 'outro', vector: vectorOf(0) })
    const staleConsent = subjectOf({ id: 3, consentHash: 'antigo', vector: vectorOf(0) })
    const broken = subjectOf({ id: 4, vector: [1, 2, 3] })
    const eligible = subjectOf({ id: 5, vector: vectorOf(0) })

    const match = findFaceMatch({
      vector: vectorOf(0),
      subjects: [removed, staleModel, staleConsent, broken, eligible],
      ...current,
    })
    expect(match?.id).toBe(5)
  })

  it('never matches at or beyond the threshold and answers null when nothing is close', () => {
    const atThreshold = subjectOf({
      id: 1,
      vector: [...vectorOf(0).slice(1), FACE_SEARCH_MAX_DISTANCE],
    })
    expect(findFaceMatch({ vector: vectorOf(0), subjects: [atThreshold], ...current })).toBeNull()

    const far = subjectOf({
      id: 2,
      vector: [...vectorOf(0).slice(1), FACE_SEARCH_MAX_DISTANCE + 1],
    })
    expect(findFaceMatch({ vector: vectorOf(0), subjects: [far], ...current })).toBeNull()
    expect(findFaceMatch({ vector: vectorOf(0), subjects: [], ...current })).toBeNull()
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
