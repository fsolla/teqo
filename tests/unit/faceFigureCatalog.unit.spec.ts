// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  findFaceFigureMatches,
  groupFaceFigureMatchesByPhoto,
  type FaceFigure,
} from '@/lib/faceFigureCatalog'
import {
  FACE_SEARCH_DESCRIPTOR_LENGTH,
  FACE_SEARCH_MAX_DISTANCE,
  FACE_SEARCH_MODEL,
  type FaceDescriptorEntry,
} from '@/lib/faceSearch'

// C244 — the pure curated-figure matcher: only active figures with a
// current-model reference, only photos under the shared threshold, no score in
// the answer, deterministic grouping for the album read.

const zeroVector = (): number[] => Array.from({ length: FACE_SEARCH_DESCRIPTOR_LENGTH }, () => 0)

/** Constant vector whose euclidean distance to the zero vector is `distance`. */
const vectorAtDistance = (distance: number): number[] => {
  const component = distance / Math.sqrt(FACE_SEARCH_DESCRIPTOR_LENGTH)
  return Array.from({ length: FACE_SEARCH_DESCRIPTOR_LENGTH }, () => component)
}

const reference = (distance: number, model: string = FACE_SEARCH_MODEL) => ({
  model,
  vector: vectorAtDistance(distance),
})

const figure = (overrides: Partial<FaceFigure> = {}): FaceFigure => ({
  slug: 'lula',
  name: 'Lula',
  active: true,
  references: [reference(0)],
  ...overrides,
})

const descriptors: FaceDescriptorEntry[] = [
  { photoId: 10, vector: zeroVector() },
  { photoId: 20, vector: zeroVector() },
]

describe('findFaceFigureMatches', () => {
  it('matches the distinct photos of an active figure and keeps the index order', () => {
    expect(findFaceFigureMatches({ figures: [figure()], descriptors })).toEqual([
      { slug: 'lula', name: 'Lula', photoIds: [10, 20] },
    ])
  })

  it('never matches under the threshold distance (strictly below)', () => {
    const below = findFaceFigureMatches({
      figures: [figure({ references: [reference(FACE_SEARCH_MAX_DISTANCE - 0.01)] })],
      descriptors,
    })
    const at = findFaceFigureMatches({
      figures: [figure({ references: [reference(FACE_SEARCH_MAX_DISTANCE)] })],
      descriptors,
    })

    expect(below).toHaveLength(1)
    expect(at).toEqual([])
  })

  it('ignores a figure that is not explicitly active', () => {
    expect(findFaceFigureMatches({ figures: [figure({ active: false })], descriptors })).toEqual([])
    expect(findFaceFigureMatches({ figures: [figure({ active: null })], descriptors })).toEqual([])
    expect(
      findFaceFigureMatches({ figures: [figure({ active: undefined })], descriptors }),
    ).toEqual([])
  })

  it('ignores foreign-model references and malformed vectors', () => {
    const foreignModel = figure({ references: [reference(0, 'outro-modelo')] })
    const malformed = figure({ references: [{ model: FACE_SEARCH_MODEL, vector: [1, 2, 3] }] })
    const poisoned = figure({
      references: [{ model: FACE_SEARCH_MODEL, vector: zeroVector().fill(Number.NaN) }],
    })

    expect(findFaceFigureMatches({ figures: [foreignModel], descriptors })).toEqual([])
    expect(findFaceFigureMatches({ figures: [malformed], descriptors })).toEqual([])
    expect(findFaceFigureMatches({ figures: [poisoned], descriptors })).toEqual([])
  })

  it('dedupes the same photo across faces and references and sorts by slug', () => {
    const matches = findFaceFigureMatches({
      figures: [
        figure({ slug: 'wagner', name: 'Wagner' }),
        figure({
          slug: 'lula',
          name: 'Lula',
          references: [reference(0), reference(0.05)],
        }),
      ],
      descriptors: [
        { photoId: 10, vector: zeroVector() },
        { photoId: 10, vector: zeroVector() },
      ],
    })

    expect(matches.map((match) => match.slug)).toEqual(['lula', 'wagner'])
    expect(matches[0]!.photoIds).toEqual([10])
  })

  it('carries only slug, name and photoIds — no distance or score by shape', () => {
    const [match] = findFaceFigureMatches({ figures: [figure()], descriptors })
    expect(Object.keys(match!).sort()).toEqual(['name', 'photoIds', 'slug'])
  })
})

describe('groupFaceFigureMatchesByPhoto', () => {
  it('pivots into photos ordered by id and figures ordered by slug', () => {
    const grouped = groupFaceFigureMatchesByPhoto([
      { slug: 'wagner', name: 'Wagner', photoIds: [20] },
      { slug: 'lula', name: 'Lula', photoIds: [20, 10] },
    ])

    expect(grouped).toEqual([
      { photoId: 10, figures: [{ slug: 'lula', name: 'Lula' }] },
      {
        photoId: 20,
        figures: [
          { slug: 'lula', name: 'Lula' },
          { slug: 'wagner', name: 'Wagner' },
        ],
      },
    ])
  })

  it('keeps only the public identity of each figure', () => {
    const [photoMatch] = groupFaceFigureMatchesByPhoto([
      { slug: 'lula', name: 'Lula', photoIds: [10] },
    ])
    expect(Object.keys(photoMatch!.figures[0]!).sort()).toEqual(['name', 'slug'])
  })
})
